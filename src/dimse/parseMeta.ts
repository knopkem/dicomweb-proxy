import { LoggerSingleton } from '../utils/logger';
import { ConfParams, config } from '../utils/config';
import { fileExists } from '../utils/fileHelper';
import { get_element } from '@iwharris/dicom-data-dictionary';
import dicomParser from 'dicom-parser';
import fs from 'fs';
import path from 'path';

interface ValueType {
  Value?: string[] | number[] | unknown[];
  BulkDataURI?: string;
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

      fs.promises.readFile(filename).then((data: Uint8Array) => {
        const dataset = dicomParser.parseDicom(data);

        // parse additional needed attributes
        const patientName = dataset.string('x00100010');
        const patentID = dataset.string('x00100020');
        const studyInstanceUID = dataset.string('x0020000d');
        const studyDate = dataset.string('x00080020');
        const studyTime = dataset.string('x00080030');
        const seriesInstanceUID = dataset.string('x0020000e');
        const seriesNumber = dataset.string('x00200011');
        const sopInstanceUID = dataset.string('x00080018');
        const sopClassUID = dataset.string('x00080016');
        const bitsAllocated = dataset.uint16('x00280100');
        const bitsStored = dataset.uint16('x00280101');
        const highBit = dataset.uint16('x00280102');
        const rows = dataset.uint16('x00280010');
        const cols = dataset.uint16('x00280011');
        const pixelSpacingString = dataset.string('x00280030');
        const pixelSpacing = pixelSpacingString ? pixelSpacingString.split('\\').map((e: string) => parseFloat(e)) : [1, 1];
        const modality = dataset.string('x00080060');
        const samplesPerPixel = dataset.uint16('x00280002');
        const photometricInterpretation = dataset.string('x00280004');
        const pixelRepresentation = dataset.uint16('x00280103');
        const windowCenter = dataset.string('x00281050');
        const wc = windowCenter ? parseFloat(windowCenter.split('\\')[0]) : 40;
        const windowWidth = dataset.string('x00281051');
        const ww = windowWidth ? parseFloat(windowWidth.split('\\')[0]) : 80;
        const rescaleIntercept = parseFloat(dataset.string('x00281052') || '1');
        const rescaleSlope = parseFloat(dataset.string('x00281053') || '1');
        const iopString = dataset.string('x00200037');
        const iop = iopString ? iopString.split('\\').map((e: string) => parseFloat(e)) : null;
        const ippString = dataset.string('x00200032');
        const ipp = ippString ? ippString.split('\\').map((e: string) => parseFloat(e)) : null;
        const instanceNumber = dataset.string('x00200013');
        const sliceThickness = dataset.string('x00180050');
        const sliceLocation = dataset.string('x00201041');
        const encDocumentValue = dataset.elements.x00420011;
        const encapsulatedDocument = encDocumentValue
          ? Buffer.from(dataset.byteArray.buffer, encDocumentValue.dataOffset, encDocumentValue.length).toString('base64')
          : null;

        // append to all results
        const resultStatic: ElementType = {
          '00100010': { Value: [{ Alphabetic: patientName }], vr: 'PN' },
          '00100020': { Value: [patentID], vr: 'LO' },
          '0020000D': { Value: [studyInstanceUID], vr: 'UI' },
          ...(studyDate && { '00080020': { Value: [studyDate], vr: 'DA' } }),
          ...(studyTime && { '00080030': { Value: [studyTime], vr: 'TM' } }),
          '0020000E': { Value: [seriesInstanceUID], vr: 'UI' },
          ...(seriesNumber && { '00200011': { Value: [seriesNumber], vr: 'IS' } }),
          '00080018': { Value: [sopInstanceUID], vr: 'UI' },
          '00080016': { Value: [sopClassUID], vr: 'UI' },
          ...(modality && { '00080060': { Value: [modality], vr: 'CS' } }),
          '00280002': { Value: [samplesPerPixel], vr: 'US' },
          ...(photometricInterpretation && { '00280004': { Value: [photometricInterpretation], vr: 'CS' } }),
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
          ...(instanceNumber && { '00200013': { Value: [instanceNumber], vr: 'IS' } }),
          ...(sliceThickness && { '00180050': { Value: [sliceThickness], vr: 'DS' } }),
          ...(sliceLocation && { '00201041': { Value: [sliceLocation], vr: 'DS' } }),
          //...( encapsulatedDocument && {'00420011': { Value: [encapsulatedDocument], vr: 'OB' }}), // unfortunately this does not work
          ...(encapsulatedDocument && { '00420011': { BulkDataURI: `series/${seriesInstanceUID}/bulkdata/${sopInstanceUID}`, vr: 'OB' } }),
        };

        const keys: string[] = [];
        for (const propertyName in dataset.elements) {
          keys.push(propertyName);
        }
        keys.sort();

        let resultDynamic: ElementType = {};
        for (let k = 0; k < keys.length; k++) {
          const propertyName = keys[k];
          const element = dataset.elements[propertyName];
          const tag = element.tag.substring(1).toUpperCase();
          const vr = element.vr || get_element(tag)?.vr;
          const tagValue = dataset.string(element.tag);

          if (tagValue) {
            resultDynamic = Object.assign(resultDynamic, {
              [tag]: {
                Value: [tagValue],
                vr,
              },
            });
          }
        }

        resolve({ ...resultDynamic, ...resultStatic });
      });
    });
  });
}

export function parseMeta(json: object, studyInstanceUID: string, seriesInstanceUID: string): Promise<unknown> {
  const logger = LoggerSingleton.Instance;
  logger.info(`parsing series ${seriesInstanceUID}`);

  const parsing = new Array<Promise<ElementType>>();
  const storagePath = config.get(ConfParams.STORAGE_PATH) as string;
  for (const [key] of Object.entries(json)) {
    const sopInstanceUid = json[key]['00080018'].Value[0];
    const pathname = path.join(storagePath, studyInstanceUID, sopInstanceUid);
    parsing.push(parseFile(pathname));
  }
  return Promise.all(parsing);
}
