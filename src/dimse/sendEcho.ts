import * as dcmjsDimse from 'dcmjs-dimse';
const { Client } = dcmjsDimse;
const { CEchoRequest } = dcmjsDimse.requests;
const { Status } = dcmjsDimse.constants;


export async function sendEcho() {
const { Client } = dcmjsDimse;
const { CFindRequest } = dcmjsDimse.requests;
const { Status } = dcmjsDimse.constants;

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
}

export async function sendEcho2() {
  const client = new Client();
  const request = new CEchoRequest();
  request.on('response', (response: any) => {
    if (response.getStatus() === Status.Success) {
      console.log('Happy!');
    }
  });
  client.addRequest(request);
  client.on('networkError', (e: any) => {
    console.log('Network error: ', e);
  });
  client.send('127.0.0.1', 5678, 'SCU', 'ANY-SCP');
}
/*
import { ConfParams, config } from '../utils/config';
import { echoScu, echoScuOptions } from 'dicom-dimse-native';
import { LoggerSingleton } from '../utils/logger';

export async function sendEcho() {
  const logger = LoggerSingleton.Instance;
  const options: echoScuOptions = {
    source: config.get(ConfParams.SOURCE),
    target: config.get(ConfParams.TARGET),
    verbose: config.get(ConfParams.VERBOSE),
  };

  logger.info(`sending C-ECHO to target: ${options.target?.aet}`);

  return new Promise((resolve, reject) => {
    echoScu(options, (result: any) => {
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
};
*/
