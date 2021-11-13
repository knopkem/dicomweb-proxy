import { ConfParams, config } from '../utils/config';
import { LoggerSingleton } from '../utils/logger';
import { fileExists } from '../utils/fileHelper';
import { waitOrFetchData } from './fetchData';
import { compressFile } from './compressFile';
import dicomParser from 'dicom-parser';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { QUERY_LEVEL } from './querLevel';

type WadoRsArgs = {
  studyInstanceUid: string;
  seriesInstanceUid: string;
  sopInstanceUid: string;
};
type WadoRsResponse = {
  contentType: string;
  buffer: Buffer;
};
export async function doWadoRs({ studyInstanceUid, seriesInstanceUid, sopInstanceUid }: WadoRsArgs): Promise<WadoRsResponse> {
  const logger = LoggerSingleton.Instance;
  const storagePath = config.get(ConfParams.STORAGE_PATH) as string;
  const studyPath = path.join(storagePath, studyInstanceUid);
  const pathname = path.join(studyPath, sopInstanceUid);

  const exists = await fileExists(pathname);
    if (!exists) {
      logger.info(`fetching series ${seriesInstanceUid}`);
      await waitOrFetchData(studyInstanceUid, seriesInstanceUid, '', QUERY_LEVEL.SERIES);
    };

  try {
    // for now we need to use uncompressed images as there is a problem with streaming compressed
    await compressFile(pathname, studyPath, '1.2.840.10008.1.2');
  } catch (error) {
    logger.error(`failed to compress ${pathname}`);
    throw error;
  }

  // read file from file system
  try {
    const data = await fs.promises.readFile(pathname);
    const dataset = dicomParser.parseDicom(data);
    const pixelDataElement = dataset.elements.x7fe00010;
    const buffer = Buffer.from(dataset.byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length);

    const term = '\r\n';
    const boundary = crypto.randomBytes(16).toString('hex');
    const contentId = crypto.randomBytes(16).toString('hex');
    const endline = `${term}--${boundary}--${term}`;

    const contentType = `multipart/related;start=${contentId};type='application/octed-stream';boundary='${boundary}'`;

    const buffArray: Buffer[] = [];
    buffArray.push(Buffer.from(`${term}--${boundary}${term}`));
    buffArray.push(Buffer.from(`Content-Location:localhost${term}`));
    buffArray.push(Buffer.from(`Content-ID:${contentId}${term}`));
    buffArray.push(Buffer.from(`Content-Type:application/octet-stream${term}`));
    buffArray.push(Buffer.from(term));
    buffArray.push(buffer);
    buffArray.push(Buffer.from(endline));

    return Promise.resolve({
      contentType,
      buffer: Buffer.concat(buffArray),
    });
  } catch (error) {
    logger.error(`Error preparing buffer from file: ${pathname}`);
    throw error;
  }
}
