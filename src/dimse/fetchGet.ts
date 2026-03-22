import { ConfParams, config } from '../utils/config';
import { getScu, getScuOptions, Node as DicomNode } from 'dicom-dimse-native';
import { LoggerSingleton } from '../utils/logger';
import { QUERY_LEVEL, queryLevelToPath, queryLevelToString } from './querLevel';

// request data from PACS via c-get or c-move
export async function fetchGet(studyUid: string, seriesUid: string, imageUid: string, level: QUERY_LEVEL, target: DicomNode): Promise<unknown> {
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
    let settled = false;
    try {
      logger.info(`fetch start: ${uidPath}`);
      getScu(getOptions, (result: string) => {
        if (settled || !result || result.length === 0) {
          return;
        }

        if (result && result.length > 0) {
          try {
            const json = JSON.parse(result);

            if (json.code === 1) {
              return;
            }

            if (json.code === 0) {
              settled = true;
              logger.info(`fetch finished: ${uidPath}`);
              resolve(result);
              return;
            }

            settled = true;
            reject(new Error(`fetch failed for ${uidPath}: ${json.message || result}`));
          } catch (error) {
            settled = true;
            reject(error);
          }
        }
      });
    } catch (error) {
      settled = true;
      reject(error);
    }
  });
}
