import { ConfParams, config } from '../utils/config';
import { LoggerSingleton } from '../utils/logger';
import { resolveCachedInstancePath, waitForCachedInstancePath } from '../utils/fileHelper';
import { compressFile } from './compressFile';
import { waitOrFetchData } from './fetchData';
import path from 'path';
import fs from 'fs';
import { stringToQueryLevel } from './querLevel';

type WadoUriArgs = {
  studyInstanceUid: string;
  seriesInstanceUid: string;
  sopInstanceUid: string;
};
type WadoUriResponse = {
  contentType: string;
  buffer: Buffer;
};
export async function doWadoUri({ studyInstanceUid, seriesInstanceUid, sopInstanceUid }: WadoUriArgs): Promise<WadoUriResponse> {
  const logger = LoggerSingleton.Instance;
  const fetchLevel = config.get(ConfParams.FETCH_LEVEL) as string;
  const level = stringToQueryLevel(fetchLevel);

  const storagePath = config.get(ConfParams.STORAGE_PATH) as string;
  let pathname = await resolveCachedInstancePath(storagePath, studyInstanceUid, sopInstanceUid);
  
  // fetch if needed
  if (!pathname) {
    try {
      await waitOrFetchData(studyInstanceUid, seriesInstanceUid, sopInstanceUid, level);
    } catch (err) {
      logger.error(`fetch failed for study: ${studyInstanceUid}`);
      throw err;
    }
  }

  pathname = pathname ?? await waitForCachedInstancePath(storagePath, studyInstanceUid, sopInstanceUid);
  const outputDirectory = path.dirname(pathname);

  try {
    await compressFile(pathname, outputDirectory);
  } catch (error) {
    logger.error(error);
    const msg = `failed to compress ${pathname}`;
    throw msg;
  }

  // read file from file system
  const fsPromise = fs.promises;
  try {
    return {
      contentType: 'application/dicom',
      buffer: await fsPromise.readFile(pathname),
    };
  } catch (error) {
    logger.error(error);
    const msg = `failed to read ${pathname}`;
    throw msg;
  }
}
