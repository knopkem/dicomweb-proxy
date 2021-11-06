
import conf from 'config';

export const enum ConfParams {
  LOG_DIR,
  STORAGE_PATH,
  XTRANSFER,
  SOURCE,
  TARGET,
  VERBOSE,
  MIN_CHARS,
  APPEND_WILDCARD,
  FETCH_LEVEL,
  MAX_ASSOCIATIONS,
}

const ConfDef: any = new Map([
  [ConfParams.LOG_DIR, 'logDir'],
  [ConfParams.STORAGE_PATH, 'storagePath'],
  [ConfParams.XTRANSFER, 'transferSyntax'],
  [ConfParams.SOURCE, 'source'],
  [ConfParams.TARGET, 'target'],
  [ConfParams.VERBOSE, 'verboseLogging'],
  [ConfParams.MIN_CHARS, 'qidoMinChars'],
  [ConfParams.APPEND_WILDCARD, 'qidoAppendWildcard'],
  [ConfParams.FETCH_LEVEL, 'useFetchLevel'],
  [ConfParams.MAX_ASSOCIATIONS, 'maxAssociations'],
]);

interface IConfig {
  get<T>(setting: ConfParams): T;
  has(setting: ConfParams): boolean;
}

class Config implements IConfig {
  get<T>(setting: ConfParams): T {
    return conf.get(ConfDef.get(setting));
  }
  has(setting: ConfParams): boolean  {
     return conf.has(ConfDef.get(setting));
   }
}

export const config = new Config();

