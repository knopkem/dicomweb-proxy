import { LoggerSingleton } from '../utils/logger';
import { ConfParams, config } from '../utils/config';
import { fileExists } from '../utils/fileHelper';
import dicomParser from 'dicom-parser';
import fs from 'fs';
import path from 'path';

interface ValueType {
  Value: string[] | number[];
  vr: string;
}
type ElementType = Record<string, ValueType>;

function parseFile(filename: string): Promise<ElementType> {
  const logger = LoggerSingleton.Instance;
  return new Promise<ElementType>((resolve, reject) => {
    fileExists(filename).then((success: boolean) => {
      if (!success) {
        logger.error(`file does not exist: ${filename}`);
        return reject();
      }

      fs.promises.readFile(filename).then((data: any) => {
        const dataset = dicomParser.parseDicom(data);

        // parse additional needed attributes
        const studyInstanceUID = dataset.string('x0020000d');
        const seriesInstanceUID = dataset.string('x0020000e');
        const sopInstanceUID = dataset.string('x00080018');
        const sopClassUID = dataset.string('x00080016');
        const bitsAllocated = dataset.uint16('x00280100');
        const bitsStored = dataset.uint16('x00280101');
        const highBit = dataset.uint16('x00280102');
        const rows = dataset.uint16('x00280010');
        const cols = dataset.uint16('x00280011');
        const pixelSpacingString = dataset.string('x00280030');
        const pixelSpacing = pixelSpacingString ? pixelSpacingString.split('\\').map((e: any) => parseFloat(e)) : [1, 1];
        const modality = dataset.string('x00080060');
        const samplesPerPixel = dataset.uint16('x00280002');
        const photometricInterpretation = dataset.string('x00280004');
        const pixelRepresentation = dataset.uint16('x00280103');
        const windowCenter = dataset.string('x00281050');
        const wc = windowCenter ? parseFloat(windowCenter.split('\\')[0]) : 40;
        const windowWidth = dataset.string('x00281051');
        const ww = windowWidth ? parseFloat(windowWidth.split('\\')[0]) : 80;
        const rescaleIntercept = parseFloat(dataset.string('x00281052'));
        const rescaleSlope = parseFloat(dataset.string('x00281053'));
        const iopString = dataset.string('x00200037');
        const iop = iopString ? iopString.split('\\').map((e: any) => parseFloat(e)) : null;
        const ippString = dataset.string('x00200032');
        const ipp = ippString ? ippString.split('\\').map((e: any) => parseFloat(e)) : null;

        // append to all results
        const result: ElementType = {
          '0020000D': { Value: [studyInstanceUID], vr: 'UI' },
          '0020000E': { Value: [seriesInstanceUID], vr: 'UI' },
          '00080018': { Value: [sopInstanceUID], vr: 'UI' },
          '00080016': { Value: [sopClassUID], vr: 'UI' },
          '00080060': { Value: [modality], vr: 'CS' },
          '00280002': { Value: [samplesPerPixel], vr: 'US' },
          '00280004': { Value: [photometricInterpretation], vr: 'CS' },
          '00280010': { Value: [rows], vr: 'US' },
          '00280011': { Value: [cols], vr: 'US' },
          '00280030': { Value: pixelSpacing, vr: 'DS' },
          '00280100': { Value: [bitsAllocated], vr: 'US' },
          '00280101': { Value: [bitsStored], vr: 'US' },
          '00280102': { Value: [highBit], vr: 'US' },
          '00280103': { Value: [pixelRepresentation], vr: 'US' },
          '00281050': { Value: [wc], vr: 'DS' },
          '00281051': { Value: [ww], vr: 'DS' },
          '00281052': { Value: [rescaleIntercept], vr: 'DS' },
          '00281053': { Value: [rescaleSlope], vr: 'DS' },
          ...(iop && { '00200037': { Value: iop, vr: 'DS' } }),
          ...(ipp && { '00200032': { Value: ipp, vr: 'DS' } }),
        };
        resolve(result);
      });
    });
  });
}

export function parseMeta(json: any, studyInstanceUID: string, eriesInstanceUID: string): Promise<any> {
  const logger = LoggerSingleton.Instance;
  logger.info(`parsing series ${eriesInstanceUID}`);

  const parsing = new Array<Promise<ElementType>>();
  const storagePath = config.get(ConfParams.STORAGE_PATH) as string;
  for (let i = 0; i < json.length; i += 1) {
    const sopInstanceUid = json[i]['00080018'].Value[0];
    const pathname = path.join(storagePath, studyInstanceUID, sopInstanceUid);
    parsing.push(parseFile(pathname));
  }
  return Promise.all(parsing);
}
