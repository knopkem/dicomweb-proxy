import { sendCFindRequest } from './findData';
import { config, ConfParams } from '../utils/config';
import { fileExists } from '../utils/fileHelper';
import { LoggerSingleton } from '../utils/logger';
import { QUERY_LEVEL } from './querLevel';
import { waitOrFetchDataOnAet } from './fetchData';
import { parseMeta } from './parseMeta';
import { Node as DicomNode } from 'dicom-dimse-native';

import path from 'path';

export async function fetchMeta(query: any, studyInstanceUID: string, seriesInstanceUID: string): Promise<unknown> {
  const logger = LoggerSingleton.Instance;
  const peers = config.get(ConfParams.PEERS) as DicomNode[];
  const fullMeta = config.get(ConfParams.FULL_META) as boolean;

  for (let i = 0; i < peers.length; i++) {
    const peer = peers[i];
    logger.info(`checking peer for data: ${peer.aet}`);
    const json = (await sendCFindRequest(QUERY_LEVEL.IMAGE, peer, query)) as any;

    // make sure c-find worked
    if (json.length === 0) {
      logger.info(`no data found on peer: ${peer.aet}`);
      continue;
    }

    if (!fullMeta) {
      return json;
    }

    // check if fetch is needed
    for (let i = 0; i < json.length; i += 1) {
      const sopInstanceUid = json[i]['00080018'].Value[0];
      const storagePath = config.get(ConfParams.STORAGE_PATH) as string;
      const pathname = path.join(storagePath, studyInstanceUID, sopInstanceUid);
      const exists = await fileExists(pathname);
      if (!exists) {
        logger.info(`fetching series ${seriesInstanceUID}`);
        await waitOrFetchDataOnAet(studyInstanceUID, seriesInstanceUID, '', QUERY_LEVEL.SERIES, peer);
        break;
      }
    }
    try {
      const result = await parseMeta(json, studyInstanceUID, seriesInstanceUID);
      logger.info('parsing finished, resolving');
      return Promise.resolve(result);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }
  return Promise.reject('failed fetching meta data');
}
