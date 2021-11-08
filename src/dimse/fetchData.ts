
import throat from 'throat';
import { fetchGet } from './fetchGet';
import { fetchMove } from './fetchMove';
import { ConfParams, config } from '../utils/config';
import { QUERY_LEVEL } from './querLevel';

const maxAssociations = config.get(ConfParams.MAX_ASSOCIATIONS) as number;
const throatLock = throat(maxAssociations);


export async function waitOrFetchData(studyUid: string, seriesUid: string, imageUid: string, level: QUERY_LEVEL): Promise<any> {
  const scu = config.get(ConfParams.C_GET) ? fetchGet : fetchMove;
  return await throatLock(async () => await scu(studyUid, seriesUid, imageUid, level));
};