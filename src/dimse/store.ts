import { ConfParams, config } from '../utils/config';
import { startStoreScp, storeScpOptions, shutdownScu, shutdownScuOptions } from 'dicom-dimse-native';
import { LoggerSingleton } from '../utils/logger';

export async function startScp() {
  const logger = LoggerSingleton.Instance;
  const ts = config.get(ConfParams.XTRANSFER) as string;

  const options: storeScpOptions = {
    source: config.get(ConfParams.SOURCE),
    peers: config.get(ConfParams.PEERS),
    storagePath: config.get(ConfParams.STORAGE_PATH),
    netTransferPrefer: ts,
    netTransferPropose: ts,
    writeTransfer: ts,
    permissive: true,
    verbose: config.get(ConfParams.VERBOSE),
  };
  logger.info(`pacs-server listening on port: ${options.source?.port}`);

  startStoreScp(options, (result: string) => {
    // currently this will never log
    logger.info(JSON.parse(result));
  });
}

export async function shutdown() {
  const logger = LoggerSingleton.Instance;
  const options: shutdownScuOptions = {
    source: config.get(ConfParams.SOURCE),
    target: config.get(ConfParams.SOURCE),
    verbose: config.get(ConfParams.VERBOSE),
  };

  logger.info(`sending shutdown request to target: ${options.target?.aet}`);

  return new Promise((resolve, reject) => {
    shutdownScu(options, (result: string) => {
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
}
