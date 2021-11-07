
import { ConfParams, config } from '../utils/config';
import { LoggerSingleton } from '../utils/logger';
import { fileExists } from '../utils/fileHelper';
import { compressFile } from './compressFile';
import { waitOrFetchData } from './fetchData';
import path from 'path';
import fs from 'fs';

type WadoUriArgs = {
  studyInstanceUid: string;
  seriesInstanceUid: string;
  sopInstanceUid: string;
};
type WadoUriResponse = {
  contentType: string;
  buffer: Buffer;
};
export async function doWadoUri({studyInstanceUid, seriesInstanceUid, sopInstanceUid}: WadoUriArgs): Promise<WadoUriResponse> {
  const logger = LoggerSingleton.Instance;
  const fetchLevel = config.get(ConfParams.FETCH_LEVEL) as string;

  const storagePath = config.get(ConfParams.STORAGE_PATH) as string;
  const studyPath = path.join(storagePath, studyInstanceUid);
  const pathname = path.join(studyPath, sopInstanceUid);

  try {
    await fileExists(pathname);
  } catch (error) {
    try {
      await waitOrFetchData(studyInstanceUid, seriesInstanceUid, sopInstanceUid, fetchLevel);
    } catch (e) {
      logger.error(e);
      const msg = `fetch failed`;
      throw msg;
    }
  }

  try {
    await fileExists(pathname);
  } catch (error) {
    logger.error(error);
    const msg = `file not found ${pathname}`;
    throw msg;
  }

  try {
    await compressFile(pathname, studyPath);
  } catch (error) {
    logger.error(error);
    const msg = `failed to compress ${pathname}`;
    throw msg;
  }

  // read file from file system
  const fsPromise = fs.promises;
  try {
    return  {
      contentType: 'application/dicom',
      buffer: await fsPromise.readFile(pathname),
    };
  } catch (error) {
    logger.error(error);
    const msg = `failed to read ${pathname}`;
    throw msg;
  }
};