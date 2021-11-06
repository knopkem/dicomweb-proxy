
import throat from 'throat';
import { fetchGet } from './fetchGet';
import { fetchMove } from './fetchMove';
import { ConfParams, config } from '../utils/config';

const maxAssociations = config.get(ConfParams.MAX_ASSOCIATIONS) as number;
const throatLock = throat(maxAssociations);


export async function waitOrFetchData(studyUid: string, seriesUid: string, imageUid: string, level: string): Promise<any> {
  const scu = config.get(ConfParams.C_GET) ? fetchGet : fetchMove;
  return await throatLock(async () => await scu(studyUid, seriesUid, imageUid, level));
};