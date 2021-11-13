import { ConfParams, config } from '../utils/config';
import { LoggerSingleton } from '../utils/logger';
import * as dict from 'dicom-data-dictionary';
import { queryLevelToString, QUERY_LEVEL } from "./querLevel";

import * as dcmjsDimse from 'dcmjs-dimse';
const { Dataset, Client } = dcmjsDimse;
const { CFindRequest } = dcmjsDimse.requests;
const { Status } = dcmjsDimse.constants;

const findDicomName = (name: string) => {
  // eslint-disable-next-line no-restricted-syntax
  for (const key of Object.keys(dict.standardDataElements)) {
    const value = dict.standardDataElements[key];
    if (value.name === name) {
      return key;
    }
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
    options.tags.push({ key: tagName, value: '' });
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

  const { Client } = dcmjsDimse;
  const { CFindRequest } = dcmjsDimse.requests;
  const { Status } = dcmjsDimse.constants;

  const baseElements = defaults.map((elem) => findDicomName(elem)).reduce((acc: any, curr: any)=> (acc[curr]='',acc),{});
  const elements = tags.map
  const mergedElements = { ...baseElements, ...elements };
  mergedElements.QueryRetrieveLevel = queryLevelToString(level);

  const findRequest = new CFindRequest();
  findRequest.setDataset(new Dataset(mergedElements));

  
  const client = new Client();
  request.on('response', (response: any) => {
    if (response.getStatus() === Status.Pending && response.hasDataset()) {
      console.log(response.getDataset());
    }
  });
  client.addRequest(request);
  client.on('networkError', (e: any) => {
    console.log('Network error: ', e);
  });
  client.send('127.0.0.1', 5678, 'SCU', 'ANY-SCP');
  }


const client = new Client();
const request = CFindRequest.createSeriesFindRequest({ StudyInstanceUID: '1.3.46.670589.5.2.10.2156913941.892665384.993397' });
request.on('response', (response: any) => {
  if (response.getStatus() === Status.Pending && response.hasDataset()) {
    console.log(response.getDataset());
  }
});
client.addRequest(request);
client.on('networkError', (e: any) => {
  console.log('Network error: ', e);
});
client.send('127.0.0.1', 5678, 'SCU', 'ANY-SCP');


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