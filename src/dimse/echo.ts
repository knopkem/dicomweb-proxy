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