import { ConfParams, config } from '../utils/config';
import { echoScu, echoScuOptions, Node as DicomNode } from 'dicom-dimse-native';
import { LoggerSingleton } from '../utils/logger';

export async function sendEcho() {
  const peers = config.get(ConfParams.PEERS) as DicomNode[];

  const promises: Array<Promise<unknown>> = [];

  peers.forEach((peer) => {
    promises.push(sendCEchoRequest(peer));
  });

  return Promise.all(promises);
}

export async function sendCEchoRequest(target: DicomNode) {
  const logger = LoggerSingleton.Instance;
  const options: echoScuOptions = {
    source: config.get(ConfParams.SOURCE),
    target,
    verbose: config.get(ConfParams.VERBOSE),
  };

  logger.info(`sending C-ECHO to target: ${options.target?.aet}`);

  return new Promise((resolve, reject) => {
    echoScu(options, (result: string) => {
      if (result && result.length > 0) {
        try {
          const res = JSON.parse(result);
          if (res.code === 2) {
            logger.error(res.message);
          } else {
            logger.info(res.message);
          }
          resolve(true);
        } catch (error) {
          logger.error(result);
          reject(error);
        }
      }
      reject();
    });
  });
}
