
import { ConfParams, config } from '../utils/config';
import { getScu, getScuOptions, findScu, findScuOptions, Node as DicomNode } from 'dicom-dimse-native';
import { LoggerSingleton } from '../utils/logger';
import { QUERY_LEVEL, queryLevelToPath, queryLevelToString } from './querLevel';

async function findOnPacs(studyUid: string, seriesUid: string, imageUid: string, level: QUERY_LEVEL, target: DicomNode): Promise<unknown> {
  const logger = LoggerSingleton.Instance;

  const findOptions: findScuOptions = {
    tags: [
      {
        key: '00080052',
        value: queryLevelToString(level),
      },
      {
        key: '0020000D',
        value: studyUid,
      },
    ],
    source: config.get(ConfParams.SOURCE),
    target,
    verbose: config.get(ConfParams.VERBOSE) as boolean,
  };

  if (level >= QUERY_LEVEL.SERIES) {
    findOptions.tags.push({
      key: '0020000E',
      value: seriesUid,
    });
  }

  if (level >= QUERY_LEVEL.IMAGE) {
    findOptions.tags.push({
      key: '00080018',
      value: imageUid,
    });
  }
  const uidPath = queryLevelToPath(studyUid, seriesUid, imageUid, level);

  return new Promise((resolve, reject) => {
    try {
      logger.info(`find start: ${uidPath}`);
      findScu(findOptions, (result: string) => {
        if (result && result.length > 0) {
          try {
            const json = JSON.parse(result);
            if (json.code === 0 || json.code === 2) {
              logger.info(`find finished: ${uidPath}`);
              json.container ? resolve(result) : reject();
            } else {
              logger.info(JSON.parse(result));
            }
          } catch (error) {
            reject(error);
          }
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function fetchGet (studyUid: string, seriesUid: string, imageUid: string, level: QUERY_LEVEL): Promise<unknown> {
  const logger = LoggerSingleton.Instance;
  const peers =  config.get(ConfParams.PEERS) as DicomNode[];


  for (const peer of peers) {
      try {
        await findOnPacs(studyUid, seriesUid, imageUid, level, peer);
        logger.info("fetching from " + peer.aet);
        return sendCGetRequest(studyUid, seriesUid, imageUid, level, peer);
      } catch (error) {
        logger.warn("no data found on pacs" + peer.aet);        
      }
      
  }

  return Promise.reject("no suitable peer found");

}

// request data from PACS via c-get or c-move
export async function sendCGetRequest(studyUid: string, seriesUid: string, imageUid: string, level: QUERY_LEVEL, target: DicomNode): Promise<unknown> {
  const logger = LoggerSingleton.Instance;

  // add query retrieve level and fetch whole study
  const ts = config.get(ConfParams.XTRANSFER) as string;

  const getOptions: getScuOptions = {
    tags: [
      {
        key: '00080052',
        value: queryLevelToString(level),
      },
      {
        key: '0020000D',
        value: studyUid,
      },
    ],
    netTransferPrefer: ts,
    source: config.get(ConfParams.SOURCE),
    target,
    verbose: config.get(ConfParams.VERBOSE) as boolean,
    storagePath: config.get(ConfParams.STORAGE_PATH),
  };

  if (level >= QUERY_LEVEL.SERIES) {
    getOptions.tags.push({
      key: '0020000E',
      value: seriesUid,
    });
  }

  if (level >= QUERY_LEVEL.IMAGE) {
    getOptions.tags.push({
      key: '00080018',
      value: imageUid,
    });
  }
  const uidPath = queryLevelToPath(studyUid, seriesUid, imageUid, level);

  return new Promise((resolve, reject) => {
    try {
      logger.info(`fetch start: ${uidPath}`);
      getScu(getOptions, (result: string) => {
        if (result && result.length > 0) {
          try {
            const json = JSON.parse(result);
            if (json.code === 0 || json.code === 2) {
              logger.info(`fetch finished: ${uidPath}`);
              resolve(result);
            } else {
              logger.info(JSON.parse(result));
            }
          } catch (error) {
            reject(error);
          }
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}
