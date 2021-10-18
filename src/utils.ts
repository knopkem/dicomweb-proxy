import config from 'config';
import dict from 'dicom-data-dictionary';
import dimse from 'dicom-dimse-native';
import simpleLogger from 'simple-node-logger';
import shell from 'shelljs';
import storage from 'node-persist';
import path from 'path';
import fs from 'fs';
import throat from 'throat';

const lock = new Map();
const maxAssociations = config.get('maxAssociations') as number;

// make sure default directories exist
const logDir = config.get('logDir') as string;
shell.mkdir('-p', logDir);
shell.mkdir('-p', config.get('storagePath'));

// create a rolling file logger based on date/time that fires process events
const opts = {
  errorEventName: 'error',
  logDirectory: logDir, // NOTE: folder must exist and be writable...
  fileNamePattern: 'roll-<DATE>.log',
  dateFormat: 'YYYY.MM.DD',
};
const manager = simpleLogger.createLogManager();
// manager.createConsoleAppender();
manager.createRollingFileAppender(opts);
const logger = manager.createLogger();

const QUERY_LEVEL = Object.freeze({ STUDY: 1, SERIES: 2, IMAGE: 3 });

//------------------------------------------------------------------

const findDicomName = (name: any) => {
  // eslint-disable-next-line no-restricted-syntax
  for (const key of Object.keys(dict.standardDataElements)) {
    const value = dict.standardDataElements[key];
    if (value.name === name) {
      return key;
    }
  }
  return undefined;
};

//------------------------------------------------------------------

// helper to add minutes to date object
const addMinutes = (date: any, minutes: any) => {
  const ms = date.getTime() + minutes * 60000;
  return new Date(parseInt(ms, 10));
};

//------------------------------------------------------------------

const getLockUid = (studyUid: any, seriesUid: any, imageUid: any, level: any) => {
  if (level === 'STUDY') return studyUid;
  if (level === 'SERIES') return seriesUid;
  if (level === 'IMAGE') return imageUid;

  logger.warn('getLockUid, level not found: ', level);
  return seriesUid;
};

//------------------------------------------------------------------

const getQueryLevel = (level: any) => {
  if (level === 'STUDY') return QUERY_LEVEL.STUDY;
  if (level === 'SERIES') return QUERY_LEVEL.SERIES;
  if (level === 'IMAGE') return QUERY_LEVEL.IMAGE;

  logger.warn('getQueryLevel, level not found: ', level);
  return QUERY_LEVEL.SERIES;
};

//------------------------------------------------------------------

const queryLevelToString = (qlevel: any) => {
  switch (qlevel) {
    case 1:
      return 'STUDY';
    case 2:
      return 'SERIES';
    case 3:
      return 'IMAGE';
    default:
      logger.warn('queryLevelToString, level not found: ', qlevel);
      return 'SERIES';
  }
};

//------------------------------------------------------------------

const queryLevelToPath = (studyUid: any, seriesUid: any, imageUid: any, qlevel: any) => {
  switch (qlevel) {
    case 1:
      return studyUid;
    case 2:
      return `${studyUid}/${seriesUid}`;
    case 3:
      return `${studyUid}/${seriesUid}/${imageUid}`;
    default:
      logger.warn('queryLevelToPath, level not found: ', qlevel);
      return `${studyUid}/${seriesUid}`;
  }
};

//------------------------------------------------------------------

// remove cached data if outdated
const clearCache = (storagePath: any, currentUid: any) => {
  const currentDate = new Date();
  storage.forEach((item: any) => {
    const dt = new Date(item.value);
    const directory = path.join(storagePath, item.key);
    if (dt.getTime() < currentDate.getTime() && item.key !== currentUid) {
      logger.info(`cleaning directory: ${directory}`);
      fs.rmdir(
        directory,
        {
          recursive: true,
        },
        (error: any) => {
          if (error) {
            logger.error(error);
          } else {
            logger.info('deleted: ', directory);
            storage.rm(item.key); // not nice but seems to work
          }
        }
      );
    }
  });
};

//------------------------------------------------------------------

// request data from PACS via c-get or c-move
const fetchData = async (studyUid: any, seriesUid: any, imageUid: any, level: any) => {
  const lockId = getLockUid(studyUid, seriesUid, imageUid, level);
  const queryLevel = getQueryLevel(level);
  const queryLevelString = queryLevelToString(queryLevel);

  // add query retrieve level and fetch whole study
  const j = {
    tags: [
      {
        key: '00080052',
        value: queryLevelString,
      },
      {
        key: '0020000D',
        value: studyUid,
      },
    ],
  };

  if (queryLevel >= QUERY_LEVEL.SERIES) {
    j.tags.push({
      key: '0020000E',
      value: seriesUid,
    });
  }

  if (queryLevel >= QUERY_LEVEL.IMAGE) {
    j.tags.push({
      key: '00080018',
      value: imageUid,
    });
  }

  // set source and target from config
  const ts = config.get('transferSyntax');
  // @ts-expect-error ts-migrate(2339) FIXME: Property 'netTransferPrefer' does not exist on typ... Remove this comment to see the full error message
  j.netTransferPrefer = ts;
  // @ts-expect-error ts-migrate(2339) FIXME: Property 'netTransferPropose' does not exist on ty... Remove this comment to see the full error message
  j.netTransferPropose = ts;
  // @ts-expect-error ts-migrate(2339) FIXME: Property 'writeTransfer' does not exist on type '{... Remove this comment to see the full error message
  j.writeTransfer = ts;
  // @ts-expect-error ts-migrate(2339) FIXME: Property 'source' does not exist on type '{ tags: ... Remove this comment to see the full error message
  j.source = config.get('source');
  // @ts-expect-error ts-migrate(2339) FIXME: Property 'target' does not exist on type '{ tags: ... Remove this comment to see the full error message
  j.target = config.get('target');
  // @ts-expect-error ts-migrate(2339) FIXME: Property 'verbose' does not exist on type '{ tags:... Remove this comment to see the full error message
  j.verbose = config.get('verboseLogging');
  // @ts-expect-error ts-migrate(2339) FIXME: Property 'storagePath' does not exist on type '{ t... Remove this comment to see the full error message
  j.storagePath = config.get('storagePath');

  const scu = config.get('useCget') ? dimse.getScu : dimse.moveScu;
  const uidPath = queryLevelToPath(studyUid, seriesUid, imageUid, queryLevel);
  const cacheTime = config.get('keepCacheInMinutes') as number;

  const prom = new Promise((resolve, reject) => {
    try {
      logger.info(`fetch start: ${uidPath}`);
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'storagePath' does not exist on type '{ t... Remove this comment to see the full error message
      clearCache(j.storagePath, studyUid);
      scu(JSON.stringify(j), (result: any) => {
        if (result && result.length > 0) {
          try {
            const json = JSON.parse(result);
            if (json.code === 0 || json.code === 2) {
              logger.info(`fetch finished: ${uidPath}`);
              storage
                .getItem(studyUid)
                .then((item: any) => {
                  if (!item) {
                    if (cacheTime >= 0) {
                      const minutes = addMinutes(new Date(), cacheTime);
                      if (studyUid && minutes) {
                        storage.setItem(studyUid, minutes);
                      }
                    }
                  }
                })
                .catch((e: any) => {
                  logger.error(e);
                });
              resolve(result);
            } else {
              logger.info(JSON.parse(result));
            }
          } catch (error) {
            // @ts-expect-error ts-migrate(2554) FIXME: Expected 0-1 arguments, but got 2.
            reject(error, result);
          }
          lock.delete(lockId);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
  // store in lock
  lock.set(lockId, prom);
  return prom;
};

//------------------------------------------------------------------

const utils = {
  getLogger() {
    return logger;
  },

  async init() {
    const persistPath = path.join(config.get('storagePath'), 'persist');
    await storage.init({ dir: persistPath });
  },

  async startScp() {
    const ts = config.get('transferSyntax');
    const j = {};
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'source' does not exist on type '{}'.
    j.source = config.get('source');
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'storagePath' does not exist on type '{}'... Remove this comment to see the full error message
    j.storagePath = config.get('storagePath');
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'verbose' does not exist on type '{}'.
    j.verbose = config.get('verboseLogging');
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'netTransferPrefer' does not exist on typ... Remove this comment to see the full error message
    j.netTransferPrefer = ts;
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'netTransferPropose' does not exist on ty... Remove this comment to see the full error message
    j.netTransferPropose = ts;
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'writeTransfer' does not exist on type '{... Remove this comment to see the full error message
    j.writeTransfer = ts;
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'peers' does not exist on type '{}'.
    j.peers = [config.get('target')];
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'permissive' does not exist on type '{}'.
    j.permissive = true;

    // @ts-expect-error ts-migrate(2339) FIXME: Property 'source' does not exist on type '{}'.
    logger.info(`pacs-server listening on port: ${j.source.port}`);

    dimse.startScp(JSON.stringify(j), (result: any) => {
      // currently this will never finish
      logger.info(JSON.parse(result));
    });
  },

  async shutdown() {
    const j = {};
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'source' does not exist on type '{}'.
    j.source = config.get('source');
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'target' does not exist on type '{}'.
    j.target = config.get('source');
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'verbose' does not exist on type '{}'.
    j.verbose = config.get('verboseLogging');

    // @ts-expect-error ts-migrate(2339) FIXME: Property 'target' does not exist on type '{}'.
    logger.info(`sending shutdown request to target: ${j.target.aet}`);

    return new Promise((resolve, reject) => {
      dimse.shutdownScu(JSON.stringify(j), (result: any) => {
        if (result && result.length > 0) {
          try {
            logger.info(JSON.parse(result));
            // @ts-expect-error ts-migrate(2794) FIXME: Expected 1 arguments, but got 0. Did you forget to... Remove this comment to see the full error message
            resolve();
          } catch (error) {
            logger.error(result);
            reject();
          }
        }
        reject();
      });
    });
  },

  async sendEcho() {
    const j = {};
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'source' does not exist on type '{}'.
    j.source = config.get('source');
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'target' does not exist on type '{}'.
    j.target = config.get('target');
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'verbose' does not exist on type '{}'.
    j.verbose = config.get('verboseLogging');

    // @ts-expect-error ts-migrate(2339) FIXME: Property 'target' does not exist on type '{}'.
    logger.info(`sending C-ECHO to target: ${j.target.aet}`);

    return new Promise((resolve, reject) => {
      dimse.echoScu(JSON.stringify(j), (result: any) => {
        if (result && result.length > 0) {
          try {
            logger.info(JSON.parse(result));
            resolve(true);
          } catch (error) {
            logger.error(result);
            reject(error);
          }
        }
        reject();
      });
    });
  },

  async waitOrFetchData(studyUid: any, seriesUid: any, imageUid: any, level: any) {
    const lockId = getLockUid(studyUid, seriesUid, imageUid, level);

    // check if already locked and return promise
    if (lock.has(lockId)) {
      return lock.get(lockId);
    }

    return throat(maxAssociations, async () => {
      await fetchData(studyUid, seriesUid, imageUid, level);
    });
  },

  fileExists(pathname: any) {
    return new Promise((resolve, reject) => {
      fs.access(pathname, (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  },

  compressFile(inputFile: any, outputDirectory: any, transferSyntax: any) {
    const j = {
      sourcePath: inputFile,
      storagePath: outputDirectory,
      writeTransfer: transferSyntax || config.get('transferSyntax'),
      verbose: config.get('verboseLogging'),
    };

    // run find scu and return json response
    return new Promise((resolve, reject) => {
      dimse.recompress(JSON.stringify(j), (result: any) => {
        if (result && result.length > 0) {
          try {
            const json = JSON.parse(result);
            if (json.code === 0) {
              resolve(true);
            } else {
              logger.error(`recompression failure (${inputFile}): ${json.message}`);
              reject();
            }
          } catch (error) {
            logger.error(error);
            logger.error(result);
            reject();
          }
        } else {
          logger.error('invalid result received');
          reject();
        }
      });
    });
  },

  studyLevelTags() {
    return [
      '00080005',
      '00080020',
      '00080030',
      '00080050',
      '00080054',
      '00080056',
      '00080061',
      '00080090',
      '00081190',
      '00100010',
      '00100020',
      '00100030',
      '00100040',
      '0020000D',
      '00200010',
      '00201206',
      '00201208',
    ];
  },

  seriesLevelTags() {
    return ['00080005', '00080054', '00080056', '00080060', '0008103E', '00081190', '0020000E', '00200011', '00201209'];
  },

  imageLevelTags() {
    return ['00080016', '00080018'];
  },

  async doFind(queryLevel: any, query: any, defaults: any): Promise<any> {
    // add query retrieve level
    const j = {
      tags: [
        {
          key: '00080052',
          value: queryLevel,
        },
      ],
    };

    // set source and target from config
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'source' does not exist on type '{ tags: ... Remove this comment to see the full error message
    j.source = config.get('source');
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'target' does not exist on type '{ tags: ... Remove this comment to see the full error message
    j.target = config.get('target');
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'verbose' does not exist on type '{ tags:... Remove this comment to see the full error message
    j.verbose = config.get('verboseLogging');

    // parse all include fields
    const includes = query.includefield;

    let tags = [];
    if (includes) {
      tags = includes.split(',');
    }
    tags.push(...defaults);

    // add parsed tags
    tags.forEach((element: any) => {
      const tagName = findDicomName(element) || element;
      j.tags.push({ key: tagName, value: '' });
    });

    // add search param
    let isValidInput = false;
    const minCharsQido = config.get('qidoMinChars') as string;
    Object.keys(query).forEach((propName) => {
      const tag = findDicomName(propName);
      if (tag) {
        let v = query[propName];
        // patient name check
        if (tag === '00100010') {
          // check if minimum number of chars for patient name are given
          if (minCharsQido > v.length) {
            isValidInput = true;
          }
          // auto append wildcard
          if (config.get('qidoAppendWildcard')) {
            v += '*';
          }
        }
        j.tags.push({ key: tag, value: v });
      }
    });
    // return with empty results if invalid
    if (isValidInput) {
      return [];
    }

    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    // run find scu and return json response
    return new Promise((resolve) => {
      dimse.findScu(JSON.stringify(j), (result: any) => {
        if (result && result.length > 0) {
          try {
            const json = JSON.parse(result);
            if (json.code === 0) {
              const container = JSON.parse(json.container);
              if (container) {
                resolve(container.slice(offset));
              } else {
                resolve([]);
              }
            } else if (json.code === 1) {
              logger.info('query is pending...');
            } else {
              logger.error(`c-find failure: ${json.message}`);
              resolve([]);
            }
          } catch (error) {
            logger.error(error);
            logger.error(result);
            resolve([]);
          }
        } else {
          logger.error('invalid result received');
          resolve([]);
        }
      });
    });
  },
  async doWadoUri(query: any) {
    const fetchLevel = config.get('useFetchLevel');
    const studyUid = query.studyUID;
    const seriesUid = query.seriesUID;
    const imageUid = query.objectUID;
    if (!studyUid || !seriesUid || !imageUid) {
      const msg = `Error missing parameters.`;
      logger.error(msg);
      throw msg;
    }
    const storagePath = config.get('storagePath') as string;
    const studyPath = path.join(storagePath, studyUid);
    const pathname = path.join(studyPath, imageUid);

    try {
      await utils.fileExists(pathname);
    } catch (error) {
      try {
        await utils.waitOrFetchData(studyUid, seriesUid, imageUid, fetchLevel);
      } catch (e) {
        logger.error(e);
        const msg = `fetch failed`;
        throw msg;
      }
    }

    try {
      await utils.fileExists(pathname);
    } catch (error) {
      logger.error(error);
      const msg = `file not found ${pathname}`;
      throw msg;
    }

    try {
      await utils.compressFile(pathname, studyPath, null);
    } catch (error) {
      logger.error(error);
      const msg = `failed to compress ${pathname}`;
      throw msg;
    }

    // read file from file system
    const fsPromise = fs.promises;
    try {
      return fsPromise.readFile(pathname);
    } catch (error) {
      logger.error(error);
      const msg = `failed to read ${pathname}`;
      throw msg;
    }
  },
};

export default utils;
