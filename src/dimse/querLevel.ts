export enum QUERY_LEVEL {
  STUDY,
  SERIES,
  IMAGE,
}

export const STUDY_LEVEL = 'STUDY';
export const SERIES_LEVEL = 'SERIES';
export const IMAGE_LEVEL = 'IMAGE';

export function queryLevelToPath(studyUid: string, seriesUid: string, imageUid: string, qlevel: QUERY_LEVEL): string {
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
}

export function queryLevelToString(level: QUERY_LEVEL): string {
  switch (level) {
    case QUERY_LEVEL.STUDY:
      return STUDY_LEVEL;
    case QUERY_LEVEL.SERIES:
      return SERIES_LEVEL;
    case QUERY_LEVEL.IMAGE:
      return IMAGE_LEVEL;
    default:
      return STUDY_LEVEL;
  }
}

export function stringToQueryLevel(level: string): QUERY_LEVEL {
  switch (level) {
    case STUDY_LEVEL:
      return QUERY_LEVEL.STUDY;
    case SERIES_LEVEL:
      return QUERY_LEVEL.SERIES;
    case IMAGE_LEVEL:
      return QUERY_LEVEL.IMAGE;
    default:
      return QUERY_LEVEL.STUDY;
  }
}

export function getLockUid(studyUid: string, seriesUid: string, imageUid: string, level: QUERY_LEVEL): string {
  switch (level) {
    case QUERY_LEVEL.STUDY:
      return studyUid;
    case QUERY_LEVEL.SERIES:
      return seriesUid;
    case QUERY_LEVEL.IMAGE:
      return imageUid;
    default:
      return studyUid;
  }
}
