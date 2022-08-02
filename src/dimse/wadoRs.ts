import { ConfParams, config } from '../utils/config';
import { LoggerSingleton } from '../utils/logger';
import { waitOrFetchData } from './fetchData';
import { compressFile } from './compressFile';
import { doFind } from '../dimse/findData';
import path from 'path';
import fs from 'fs/promises';
import { QUERY_LEVEL } from './querLevel';
import deepmerge from 'deepmerge';
import combineMerge from "../utils/combineMerge"

type WadoRsArgs = {
  studyInstanceUid: string;
  seriesInstanceUid?: string;
  sopInstanceUid?: string;
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

async function addFileToBuffer(pathname: string, filename: string): Promise<Buffer> {
  const filepath = path.join(pathname, filename)
  const data = await fs.readFile(filepath);

  const buffArray: Buffer[] = [];
  buffArray.push(Buffer.from(`Content-Type:${config.get(ConfParams.MIMETYPE)};transfer-syntax:${config.get(ConfParams.XTRANSFER)}${term}`));
  buffArray.push(Buffer.from(term));
  buffArray.push(data);
  buffArray.push(Buffer.from(term));
  return Buffer.concat(buffArray);
}

export async function doWadoRs({ studyInstanceUid, seriesInstanceUid, sopInstanceUid }: WadoRsArgs): Promise<WadoRsResponse> {
  const logger = LoggerSingleton.Instance;
  const storagePath = config.get(ConfParams.STORAGE_PATH) as string;
  let queryLevel = QUERY_LEVEL.STUDY
  const studyPath = path.join(storagePath, studyInstanceUid);
  const pathname = studyPath;
  let filename = ''
  if (seriesInstanceUid) {
    queryLevel = QUERY_LEVEL.SERIES
  }
  if (sopInstanceUid) {
    queryLevel = QUERY_LEVEL.IMAGE
    filename = sopInstanceUid
  }

  const json = deepmerge.all(await doFind(QUERY_LEVEL.IMAGE, { StudyInstanceUID: studyInstanceUid, SeriesInstanceUID: seriesInstanceUid ?? '' }), { arrayMerge: combineMerge}) as QidoResponse[];
  const foundInstances: string[] = [];
  const foundPromises = await Promise.all(json.map(async (instance) => {
    if (instance["00080018"]) {
      const id = instance["00080018"].Value[0]
      foundInstances.push(id);
      try {
        const stat = await fs.stat(path.join(studyPath, id))
        if (stat) {
          return true
        }
        return false
      }
      catch (e) {
        return false
      }
    }
    return true
  }))
  
  const useCache = foundPromises.reduce((prev, curr) => prev && curr, true)

  if (!useCache) {
    logger.info(`fetching ${pathname}`);
    await waitOrFetchData(studyInstanceUid, seriesInstanceUid ?? '', sopInstanceUid ?? '', queryLevel);
  }

  let buffers: (Buffer | undefined)[] = []

  try {
    const stat = await fs.stat(pathname)
    const isDir = await stat.isDirectory()
    if (isDir) {
      const files = await fs.readdir(pathname)
      buffers = await Promise.all(files.map(async (file) => {
        if (foundInstances.includes(file)) {
          const filePath = path.join(pathname, file)
          if (!useCache) {
            try {
              await compressFile(filePath, studyPath);
            }
            catch (e) {
              logger.error(`failed to compress ${pathname}`, e);
            }
          }
          return addFileToBuffer(pathname, file)
        }
      }))
    }
    else {
      if (foundInstances.includes(filename)) {
        if (!useCache) {
          try {
            await compressFile(pathname, studyPath);
          }
          catch (e) {
            logger.error(`failed to compress ${pathname}`, e);
          }
        }
        
        buffers = [await addFileToBuffer(pathname, filename)]
      }
    }
    const boundary = studyInstanceUid
    const buffArray: Buffer[] = []
    buffers = buffers.filter((b: Buffer | undefined) => !!b)
    buffers.forEach(async (buff) => {
      if (buff) {
        buffArray.push(Buffer.from(`--${boundary}${term}`));
        buffArray.push(buff);
      }
    });
    buffArray.push(Buffer.from(`--${boundary}--${term}`));

    const contentType = `multipart/related;type='application/octet-stream';boundary=${boundary}`;
    return Promise.resolve({
      contentType,
      buffer: Buffer.concat(buffArray),
    });

  } catch (error) {
    logger.error(`failed to process ${pathname}`);
    throw error;
  }
}
