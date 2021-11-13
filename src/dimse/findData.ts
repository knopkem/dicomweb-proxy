import { findScu, findScuOptions } from "dicom-dimse-native";
import { ConfParams, config } from '../utils/config';
import { LoggerSingleton } from '../utils/logger';
import { queryLevelToString, QUERY_LEVEL } from "./querLevel";
import { get_element } from '@iwharris/dicom-data-dictionary';

const findDicomName = (name: string): string | undefined => {
  const dataElement = get_element(name);
  if (dataElement) {
    return dataElement.tag.replace('(', '').replace(',', '').replace(')', '');
  }
  return undefined;
};


export async function doFind(level: QUERY_LEVEL, query: any, defaults: string[]): Promise<any> {
  const logger = LoggerSingleton.Instance;
  logger.info('doFind...');

  // add query retrieve level
  const options: findScuOptions = {
    tags: [
      {
        key: '00080052',
        value: queryLevelToString(level),
      },
    ],
    source: config.get(ConfParams.SOURCE),
    target: config.get(ConfParams.TARGET),
    verbose: config.get(ConfParams.VERBOSE),
  };

  // parse all include fields
  const includes = query.includefield;

  let tags = new Array<string>();
  if (includes) {
    tags = includes.split(',');
  }
  tags.push(...defaults);

  // add parsed tags
  tags.forEach((element: any) => {
    const tagName = findDicomName(element) || element;
    if (tagName) {
      options.tags.push({ key: tagName, value: '' });
    }
  });

  // add search param
  let invalidInput = false;
  const minCharsQido = config.get(ConfParams.MIN_CHARS) as string;
  Object.keys(query).forEach((propName) => {
    const tag = findDicomName(propName);
    if (tag) {
      let v = query[propName];
      // patient name check
      if (tag === '00100010') {
        // check if minimum number of chars for patient name are given
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
    findScu(options, (result: any) => {
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
};