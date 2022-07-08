
import conf from 'config';

export const enum ConfParams {
  LOG_DIR,
  STORAGE_PATH,
  XTRANSFER,
  MIMETYPE,
  SOURCE,
  PEERS,
  VERBOSE,
  MIN_CHARS,
  APPEND_WILDCARD,
  FETCH_LEVEL,
  MAX_ASSOCIATIONS,
  C_GET,
  HTTP_PORT,
  WEBSOCKET_URL,
  WEBSOCKET_TOKEN,
  CACHE_RETENTION,
  FULL_META,
  LOSSY_QUALITY,
}

const ConfDef = new Map([
  [ConfParams.LOG_DIR, 'logDir'],
  [ConfParams.STORAGE_PATH, 'storagePath'],
  [ConfParams.XTRANSFER, 'transferSyntax'],
  [ConfParams.MIMETYPE, 'mimeType'],
  [ConfParams.SOURCE, 'source'],
  [ConfParams.PEERS, 'peers'],
  [ConfParams.VERBOSE, 'verboseLogging'],
  [ConfParams.MIN_CHARS, 'qidoMinChars'],
  [ConfParams.APPEND_WILDCARD, 'qidoAppendWildcard'],
  [ConfParams.FETCH_LEVEL, 'useFetchLevel'],
  [ConfParams.MAX_ASSOCIATIONS, 'maxAssociations'],
  [ConfParams.C_GET, 'useCget'],
  [ConfParams.HTTP_PORT, 'webserverPort'],
  [ConfParams.WEBSOCKET_URL, 'websocketUrl'],
  [ConfParams.WEBSOCKET_TOKEN, 'websocketToken'],
  [ConfParams.CACHE_RETENTION, 'cacheRetentionMinutes'],
  [ConfParams.FULL_META, 'fullMeta'],
  [ConfParams.LOSSY_QUALITY, 'lossyQuality'],
]);

interface IConfig {
  get<T>(setting: ConfParams): T;
  has(setting: ConfParams): boolean;
}

class Config implements IConfig {
  get<T>(setting: ConfParams): T {
    const s = ConfDef.get(setting);
    if (s) {
      return conf.get(s);
    }
    return conf.get('');
  }
  has(setting: ConfParams): boolean {
    const s = ConfDef.get(setting);
    return s ? conf.has(s) : false;
  }
}

export const config = new Config();

