import throat from 'throat';
import { fetchGet } from './fetchGet';
import { fetchMove } from './fetchMove';
import { ConfParams, config } from '../utils/config';
import { getLockUid, QUERY_LEVEL } from './querLevel';
import { Node as DicomNode } from 'dicom-dimse-native';
import { LoggerSingleton } from '../utils/logger';

const maxAssociations = config.get(ConfParams.MAX_ASSOCIATIONS) as number;
const throatLock = throat(maxAssociations);
const lock = new Map();

export async function waitOrFetchData(studyUid: string, seriesUid: string, imageUid: string, level: QUERY_LEVEL): Promise<unknown> {
  const logger = LoggerSingleton.Instance;
  const peers = config.get(ConfParams.PEERS) as DicomNode[];

  for (const peer of peers) {
    try {
      return await waitOrFetchDataOnAet(studyUid, seriesUid, imageUid, level, peer);
    } catch (error) {
      logger.warn(error);
    }
  }
  return Promise.reject('failed waitOrFetchData');
}

export async function waitOrFetchDataOnAet(
  studyUid: string,
  seriesUid: string,
  imageUid: string,
  level: QUERY_LEVEL,
  target: DicomNode
): Promise<unknown> {
  const scu = config.get(ConfParams.C_GET) ? fetchGet : fetchMove;
  const lockId = getLockUid(studyUid, seriesUid, imageUid, level);

  return await throatLock(async () => {
    if (lock.has(lockId)) {
      return lock.get(lockId);
    }
    const promise = scu(studyUid, seriesUid, imageUid, level, target);
    promise
      .then(() => {
        lock.delete(lockId);
      })
      .catch(() => {
        lock.delete(lockId);
      });
    lock.set(lockId, promise);
    return promise;
  });
}
