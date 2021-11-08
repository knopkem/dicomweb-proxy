import { doFind } from './findData';
import { config, ConfParams} from '../utils/config';
import { fileExists } from '../utils/fileHelper';
import { LoggerSingleton } from '../utils/logger';
import { QUERY_LEVEL } from './querLevel';
import { imageLevelTags } from './tags';
import { waitOrFetchData } from './fetchData';
import { parseMeta } from './parseMeta';
import path from 'path';

export async function fetchMeta(query: any, studyInstanceUID: string, seriesInstanceUID: string) {
    const logger = LoggerSingleton.Instance;
  const json = await doFind(QUERY_LEVEL.IMAGE, query, imageLevelTags);

  // make sure c-find worked
  if (json.length === 0) {
    throw ('no metadata found');
    return;
  }

  // check if fetch is needed
  for (let i = 0; i < json.length; i += 1) {
    const sopInstanceUid = json[i]['00080018'].Value[0];
    const storagePath = config.get(ConfParams.STORAGE_PATH) as string;
    const pathname = path.join(storagePath, studyInstanceUID, sopInstanceUid);
    const exists = await fileExists(pathname);
    if (!exists) {
      logger.info(`fetching series ${seriesInstanceUID}`);
      await waitOrFetchData(studyInstanceUID, seriesInstanceUID, '', QUERY_LEVEL.SERIES);
      break;
    };
  }
  try {
    const result = await parseMeta(json, studyInstanceUID, seriesInstanceUID);
    return Promise.resolve(result);
  } catch (error) {
    throw(error);
  }
}