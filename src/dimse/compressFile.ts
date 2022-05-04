import { ConfParams, config } from '../utils/config';
import { recompress, recompressOptions } from 'dicom-dimse-native';
import { LoggerSingleton } from '../utils/logger';

export async function compressFile(inputFile: string, outputDirectory: string, transferSyntax: string | undefined = undefined) {
  const logger = LoggerSingleton.Instance;
  const options: recompressOptions = {
    sourcePath: inputFile,
    storagePath: outputDirectory,
    writeTransfer: transferSyntax || config.get(ConfParams.XTRANSFER),
    lossyQuality: config.get(ConfParams.LOSSY_QUALITY),
    verbose: config.get(ConfParams.VERBOSE),
  };

  // run find scu and return json response
  return new Promise((resolve, reject) => {
    recompress(options, (result: string) => {
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
}
