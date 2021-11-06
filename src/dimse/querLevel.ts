export enum QUERY_LEVEL {
  STUDY,
  SERIES,
  IMAGE,
};


export function queryLevelToPath (studyUid: string, seriesUid: string, imageUid: string, qlevel: QUERY_LEVEL): string {
  switch (qlevel) {
    case QUERY_LEVEL.STUDY:
      return studyUid;
    case QUERY_LEVEL.SERIES:
      return `${studyUid}/${seriesUid}`;
    case QUERY_LEVEL.IMAGE:
      return `${studyUid}/${seriesUid}/${imageUid}`;
    default:
      return `${studyUid}/${seriesUid}`;
  }
};


export function getQuerLevel (level: string): QUERY_LEVEL {
  if (level === 'STUDY') return QUERY_LEVEL.STUDY;
  if (level === 'SERIES') return QUERY_LEVEL.SERIES;
  if (level === 'IMAGE') return QUERY_LEVEL.IMAGE;
  return QUERY_LEVEL.STUDY;
};
