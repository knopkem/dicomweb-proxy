
import { ConfParams, config } from '../utils/config';
import { LoggerSingleton } from '../utils/logger';
import { fileExists } from '../utils/fileHelper';
import { compressFile } from './compress';
import { waitOrFetchData } from './fetchData';
import path from 'path';
import fs from 'fs';

export async function doWadoUri(query: any) {
  const logger = LoggerSingleton.Instance;
  const fetchLevel = config.get(ConfParams.FETCH_LEVEL) as string;
  const studyUid = query.studyUID as string;
  const seriesUid = query.seriesUID as string;
  const imageUid = query.objectUID as string;
  if (!studyUid || !seriesUid || !imageUid) {
    const msg = `Error missing parameters.`;
    logger.error(msg);
    throw msg;
  }
  const storagePath = config.get(ConfParams.STORAGE_PATH) as string;
  const studyPath = path.join(storagePath, studyUid);
  const pathname = path.join(studyPath, imageUid);

  try {
    await fileExists(pathname);
  } catch (error) {
    try {
      await waitOrFetchData(studyUid, seriesUid, imageUid, fetchLevel);
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
    await compressFile(pathname, studyPath, undefined);
  } catch (error) {
    logger.error(error);
    const msg = `failed to compress ${pathname}`;
    throw msg;
  }

  // read file from file system
  const fsPromise = fs.promises;
  try {
    return fsPromise.readFile(pathname);
  } catch (error) {
    logger.error(error);
    const msg = `failed to read ${pathname}`;
    throw msg;
  }
};