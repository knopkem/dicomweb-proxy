import { findScu, findScuOptions, Node as DicomNode } from 'dicom-dimse-native';
import { ConfParams, config } from '../utils/config';
import { LoggerSingleton } from '../utils/logger';
import { queryLevelToString, QUERY_LEVEL } from './querLevel';
import { get_element } from '@iwharris/dicom-data-dictionary';
import { tagsForLevel } from './tags';

const findDicomName = (name: string): string | undefined => {
  const dataElement = get_element(name);
  if (dataElement) {
    return dataElement.tag.replace('(', '').replace(',', '').replace(')', '');
  }
  return undefined;
};

const findVR = (name: string): string => {
  const dataElement = get_element(name);
  if (dataElement) {
    return dataElement.vr;
  }
  return '';
};

export interface IQueryParams {
  [key: string]: string;
}

export async function doFind(level: QUERY_LEVEL, query: IQueryParams): Promise<any> {
  const peers = config.get(ConfParams.PEERS) as DicomNode[];

  const promises: Array<Promise<unknown>> = [];

  peers.forEach((peer) => {
    promises.push(sendCFindRequest(level, peer, query));
  });

  return Promise.all(promises);
}

export async function sendCFindRequest(level: QUERY_LEVEL, target: DicomNode, query: IQueryParams): Promise<unknown> {
  const logger = LoggerSingleton.Instance;

  // add query retrieve level
  const options: findScuOptions = {
    tags: [
      {
        key: '00080052',
        value: queryLevelToString(level),
      },
    ],
    source: config.get(ConfParams.SOURCE),
    target,
    verbose: config.get(ConfParams.VERBOSE),
  };

  // parse all include fields
  const includes = query.includefield;

  let tags = new Array<string>();
  if (includes) {
    tags = includes.split(',');
  }

  const defaultTagsForLevel = tagsForLevel(level);
  tags.push(...defaultTagsForLevel);

  // add parsed tags
  tags.forEach((element: string) => {
    const tagName = findDicomName(element) || element;
    if (tagName) {
      options.tags.push({ key: tagName, value: '' });
    }
  });

  // add search param
  let invalidInput = false;
  const minCharsQido = config.get(ConfParams.MIN_CHARS) as number;
  Object.keys(query).forEach((propName) => {
    const tag = findDicomName(propName);
    const vr = findVR(propName);
    if (tag) {
      let v = query[propName];
      // string vr types check
      if (['PN', 'LO', 'LT', 'SH', 'ST'].includes(vr)) {
        // just make sure to remove any wildcards from prefix and suffix
        v = v.replace(/^[*]/, '');
        v = v.replace(/[*]$/, '');
        
        // check if minimum number of chars are reached from input
        if (minCharsQido > v.length) {
          invalidInput = true;
        }
        // auto append wildcard
        if (config.get(ConfParams.APPEND_WILDCARD)) {
          v += '*';
        }
      }
      options.tags.push({ key: tag, value: v });
    }
  });

  const offset = query.offset ? parseInt(query.offset, 10) : 0;

  // run find scu and return json response
  return new Promise((resolve) => {
    // return with empty results if invalid
    if (invalidInput) {
      resolve([]);
    }
    findScu(options, (result: string) => {
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
}
