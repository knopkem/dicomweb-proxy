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

export function queryLevelToString (level: QUERY_LEVEL): string {
  switch(level)
  {
    case QUERY_LEVEL.STUDY: return 'STUDY';
    case QUERY_LEVEL.SERIES: return 'SERIES';
    case QUERY_LEVEL.IMAGE: return 'IMAGE';
    default: return 'STUDY';
  }
}


export function stringToQueryLevel (level: string): QUERY_LEVEL {
  switch(level)
  {
    case 'STUDY': return QUERY_LEVEL.STUDY;
    case 'SERIES': return QUERY_LEVEL.SERIES;
    case 'IMAGE': return QUERY_LEVEL.IMAGE;
    default: return QUERY_LEVEL.STUDY;
  }
};
