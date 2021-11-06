
import throat from 'throat';
import { fetchData } from './fetchGet';
import { ConfParams, config } from '../utils/config';

const maxAssociations = config.get(ConfParams.MAX_ASSOCIATIONS) as number;
const throatLock = throat(maxAssociations);


export async function waitOrFetchData(studyUid: string, seriesUid: string, imageUid: string, level: string): Promise<any> {
  return await throatLock(async () => await fetchData(studyUid, seriesUid, imageUid, level));
};