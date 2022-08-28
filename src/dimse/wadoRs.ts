import { ConfParams, config } from '../utils/config';
import { LoggerSingleton } from '../utils/logger';
import { waitOrFetchData } from './fetchData';
import { compressFile } from './compressFile';
import { doFind } from '../dimse/findData';
import path from 'path';
import fs from 'fs/promises';
import { QUERY_LEVEL } from './querLevel';
import deepmerge from 'deepmerge';
import dicomParser from 'dicom-parser';
import combineMerge from '../utils/combineMerge';
import { fileExists } from '../utils/fileHelper';
import { execFile as exFile } from 'child_process';
import util from 'util';

const execFile = util.promisify(exFile);

export type DataFormat = 'pixeldata' | 'bulkdata' | 'rendered' | 'thumbnail'

type WadoRsArgs = {
  studyInstanceUid: string;
  seriesInstanceUid?: string;
  sopInstanceUid?: string;
  dataFormat?: DataFormat;
  frame?: number | number[];
};
type WadoRsResponse = {
  contentType: string;
  buffer: Buffer;
};
type QidoResponse = {
  [key: string]: {
    Value: string[]
    vr: string
  }
}

const term = '\r\n';

/**
 * This function uses DCMTK to convert the given DICOM file to JPEG format
 * It will try twice, once without frames, the other with all frames.
 * If both fail it will throw the error returned by DCMTK.
 * If no resulting JPEG can be found, then it will return undefined.
 * 
 * @param filepath Path to the file to convert
 * @param [asThumbnail=false] Return as thumbnail
 */
async function convertToJpeg(filepath: string, asThumbnail = false) {
  try {
    await execFile(
      'dcmj2pnm',
      ['+oj', '+Jq', asThumbnail ? '10' : '100', filepath, `${filepath}.jpg`]
    );
  }
  catch (e) {
    // Try again but with all frames - if this fails don't catch the error (fail!)
    await execFile(
      'dcmj2pnm',
      ['+oj', '+Jq', asThumbnail ? '10' : '100', '+Fa', filepath, `${filepath}`]
    );
  }
  let exists = await fileExists(`${filepath}.jpg`);
  let filePath;
  if (exists) {
    filePath = `${filepath}.jpg`;
  }
  else {
    exists = await fileExists(`${filepath}.0.jpg`);
    if (exists) {
      filePath = `${filepath}.0.jpg`;
    }
  }

  if (exists && filePath) {
    return fs.readFile(filePath);
  }
  return undefined;
}

/**
 * Compresses (if needed) the DCM file and then adds the required data to the return buffer:
 * bulkdata and PixelData return the DCM pixeldata buffer
 * rendered returns a JPEG file buffer
 * otherwise returns a DICOM file buffer
 * 
 * Attaches needed headers
 */
interface AddFileToBuffer {
  pathname: string,
  filename: string,
  instanceInfo: InstanceInfo,
  dataFormat?: DataFormat,
}

async function addFileToBuffer({ pathname, filename, dataFormat, instanceInfo }: AddFileToBuffer): Promise<Buffer> {
  const logger = LoggerSingleton.Instance;
  const filepath = path.join(pathname, filename);
  const buffArray: Buffer[] = [];
  let transferSyntax;
  // If there is a data format, use default compression
  if (dataFormat) {
    transferSyntax = '1.2.840.10008.1.2';
  }

  let contentLocation = `/studies/${instanceInfo.study}`
  if (instanceInfo.series) {
    contentLocation += `/series/${instanceInfo.series}`
  }
  if (instanceInfo.instance) {
    contentLocation += `/instance/${instanceInfo.instance}`
  }

  // Compress the file
  try {
    await compressFile(filepath, pathname, transferSyntax);
  }
  catch (e) {
    logger.error('Failed to compress', filepath);
  }

  // This will throw out if the file doesn't OK (but that's what we want)
  const data = await fs.readFile(filepath);
  let returnData;
  switch (dataFormat) {
  case 'bulkdata':
  case 'pixeldata': {
    // Get the pixeldata from the DICOM and add it to the buffer.
    const dataset = dicomParser.parseDicom(data);
    const pixeldataElement = dataset.elements.x7fe00010;
    buffArray.push(Buffer.from(`Content-Type:application/octet-stream;${term}`));
    returnData = Buffer.from(dataset.byteArray.buffer, pixeldataElement.dataOffset, pixeldataElement.length);
    break;
  }
  case 'rendered': {
    // Convert the DCM file to a JPEG and return that
    buffArray.push(Buffer.from(`Content-Type:image/jpeg;${term}`));
    returnData = await convertToJpeg(filepath);
    break;
  }
  default: {
    // Just return the DCM file
    buffArray.push(Buffer.from(`Content-Type:${config.get(ConfParams.MIMETYPE)};transfer-syntax:${config.get(ConfParams.XTRANSFER)}${term}`));
    returnData = data;
  }
  }
  buffArray.push(Buffer.from(`Content-Location:${contentLocation};${term}`));
  buffArray.push(Buffer.from(term));
  buffArray.push(returnData);
  buffArray.push(Buffer.from(term));
  return Buffer.concat(buffArray);
}

type InstanceInfo = {
  study: string,
  series?: string,
  instance?: string
}

export async function doWadoRs({ studyInstanceUid, seriesInstanceUid, sopInstanceUid, dataFormat }: WadoRsArgs): Promise<WadoRsResponse> {
  const logger = LoggerSingleton.Instance;
  // Set up all the paths and query levels.
  const storagePath = config.get(ConfParams.STORAGE_PATH) as string;
  let queryLevel = QUERY_LEVEL.STUDY
  const studyPath = path.join(storagePath, studyInstanceUid);
  let pathname = studyPath;
  let filename = '';
  if (seriesInstanceUid) {
    queryLevel = QUERY_LEVEL.SERIES
  }
  if (sopInstanceUid) {
    filename = sopInstanceUid;
    pathname = path.join(pathname, sopInstanceUid);
  }

  // Is the path that we have a directory or a file?
  let isDir = true;
  if (await fileExists(pathname)) {
    const stat = await fs.stat(pathname);
    isDir = await stat.isDirectory();
  }
  let useCache = false;
  const foundInstances: InstanceInfo[] = [];
  if (isDir) {
    // It's a directory, what things do we expect to find in this directory for this search?
    const json = deepmerge.all(await doFind(QUERY_LEVEL.IMAGE, { StudyInstanceUID: studyInstanceUid, SeriesInstanceUID: seriesInstanceUid ?? '', SOPInstanceUID: sopInstanceUid ?? '' }), { arrayMerge: combineMerge}) as QidoResponse[];
    const foundPromises = await Promise.all(json.map(async (instance) => {
      if (instance['00080018']) {
        const instanceUid = instance['00080018'].Value[0];
        const seriesUid = instance['0020000E'].Value[0];
        foundInstances.push({
          study: studyInstanceUid,
          series: seriesUid,
          instance: instanceUid
        });
        return fileExists(path.join(studyPath, instanceUid));
      }
      return true;
    }));

    // If all of the files for this search exist, then we're gonna use the cache!
    useCache = foundPromises.reduce((prev, curr) => prev && curr, true);
  }
  else {
    // If the file exists, use the cache
    useCache = await fileExists(pathname);
  }

  if (!useCache) {
    // We're not using the cache, so go and fetch the files. This will happen even if just one file is missing.
    // Could this be improved to just get the needed files?
    logger.info(`fetching ${pathname}`);
    await waitOrFetchData(studyInstanceUid, seriesInstanceUid ?? '', sopInstanceUid ?? '', queryLevel);
  }

  // We only need a thumbnail - get it and bail.
  if (dataFormat === 'thumbnail') {
    // Just use the first of the foundInstances for this search
    const filePath = isDir ? path.join(pathname, foundInstances[0].instance as string) : pathname;
    const buff = await convertToJpeg(filePath, true);
    if (buff) {
      return {
        contentType: 'image/jpeg',
        buffer: buff
      };
    }
    else {
      throw new Error('Failed to create thumbnail');
    }
  }

  let buffers: (Buffer | undefined)[] = [];
  try {
    if (isDir) {
      // We're in a directory, loop through the files we want and attach them to the return buffer
      const files = await fs.readdir(pathname)
      buffers = await Promise.all(files.map(async (file) => {
        const instanceInfo = foundInstances.find((i) => i.instance === file)
        if (instanceInfo) {
          return addFileToBuffer({ pathname, filename: file, dataFormat, instanceInfo });
        }
      }))
    }
    else {
      // Attach the one file that we need to the return buffer
      const instanceInfo = { study: studyInstanceUid, series: seriesInstanceUid, instance: sopInstanceUid }
      buffers = [await addFileToBuffer({ pathname: studyPath, filename, dataFormat, instanceInfo })];
    }

    // Set up the boundaries and join together all of the file buffers to form
    // the final buffer to return to the client.
    const boundary = studyInstanceUid;
    const buffArray: Buffer[] = [];
    buffers = buffers.filter((b: Buffer | undefined) => !!b);
    buffers.forEach(async (buff) => {
      if (buff) {
        buffArray.push(Buffer.from(`--${boundary}${term}`));
        buffArray.push(buff);
      }
    });
    buffArray.push(Buffer.from(`--${boundary}--${term}`));

    // We need to set the correct contentType depending on what was asked for.
    let type = 'application/dicom';
    if (dataFormat === 'rendered') {
      type = 'image/jpeg';
    }
    if (dataFormat?.match(/bulkdata|pixeldata/ig)) {
      type = 'application/octet-stream';
    }

    const contentType = `multipart/related;type='${type}';boundary=${boundary}`;
    return Promise.resolve({
      contentType,
      buffer: Buffer.concat(buffArray),
    });

  } catch (error) {
    logger.error(`failed to process ${pathname}`);
    throw error;
  }
}
