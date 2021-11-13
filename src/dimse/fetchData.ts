
import throat from 'throat';
import { fetchGet } from './fetchGet';
import { fetchMove } from './fetchMove';
import { ConfParams, config } from '../utils/config';
import { getLockUid, QUERY_LEVEL } from './querLevel';

const maxAssociations = config.get(ConfParams.MAX_ASSOCIATIONS) as number;
const throatLock = throat(maxAssociations);
const lock = new Map();


export async function waitOrFetchData(studyUid: string, seriesUid: string, imageUid: string, level: QUERY_LEVEL): Promise<any> {
  const scu = config.get(ConfParams.C_GET) ? fetchGet : fetchMove;
  const lockId = getLockUid(studyUid, seriesUid, imageUid, level);

  return await throatLock(async () => {
    if (lock.has(lockId)) {
      return lock.get(lockId);
    }
    const promise = scu(studyUid, seriesUid, imageUid, level);
    promise.then(() => {
      lock.delete(lockId);
    }).catch(() => {
      lock.delete(lockId);
    })
    lock.set(lockId, promise);
    return promise;
  });
};