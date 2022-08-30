import { ConfParams, config } from './utils/config';
import { io } from 'socket.io-client';
import { doFind } from './dimse/findData';
import { stringToQueryLevel } from './dimse/querLevel';
import { doWadoUri } from './dimse/wadoUri';
import { LoggerSingleton } from './utils/logger';
import { doWadoRs, DataFormat } from './dimse/wadoRs';
import socketIOStream from '@wearemothership/socket.io-stream';
import combineMerge from './utils/combineMerge';
import deepmerge from 'deepmerge';

const options = { arrayMerge: combineMerge };
const websocketUrl = config.get(ConfParams.WEBSOCKET_URL) as string;
const logger = LoggerSingleton.Instance;

export const socket = io(websocketUrl, {
  reconnection: true,
  reconnectionDelayMax: 10000,
  autoConnect: false,
  auth: {
    token: config.get(ConfParams.WEBSOCKET_TOKEN),
  },
});

socket.on('connect', () => {
  logger.info('websocket connection established');
});

socket.on('qido-request', async (data) => {
  const { level, query }: { level: string; query: Record<string, string> } = data;

  if (data) {
    const lvl = stringToQueryLevel(level);
    logger.info('websocket QIDO request received, fetching metadata now...', level, data);
    const json = deepmerge.all(await doFind(lvl, query), options);
    logger.info('sending websocket response');
    socket.emit(data.uuid, json);
  }
});

type WadoRequest = {
  studyInstanceUid: string,
  seriesInstanceUid?: string,
  sopInstanceUid?: string,
  dataFormat?: DataFormat
}

socket.on('wado-request', async (data) => {
  const { query }: { query: WadoRequest } = data;
  const {
    studyInstanceUid, seriesInstanceUid, sopInstanceUid, dataFormat
  } = query;

  if (data) {
    logger.info('websocket WADO request received, fetching metadata now...');
    const { contentType, buffer } = await doWadoRs({ studyInstanceUid, seriesInstanceUid, sopInstanceUid, dataFormat });
    logger.info('sending websocket response stream');
    const stream = socketIOStream.createStream();
    socketIOStream(socket).emit(data.uuid, stream, { contentType: contentType })
    let offset = 0;
    const chunkSize = 512*1024 // 512kb
    const writeBuffer = () => {
      let ok = true;
      do {
        const b = Buffer.alloc(chunkSize)
        buffer.copy(b, 0, offset, offset + chunkSize)
        ok = stream.write(b)
        offset += chunkSize
      } while (offset < buffer.length && ok)
      if (offset < buffer.length) {
        stream.once("drain", writeBuffer)
      }
      else {
        stream.end()
      }
    }
    writeBuffer()
  }
});

socket.on('wadouri-request', async (data) => {
  if (data) {
    const {
      studyUID, seriesUID, objectUID, studyInstanceUid, seriesInstanceUid, sopInstanceUid
    } = data.query;
    try {
      logger.info('websocket wadouri request received, fetching metadata now...');
      const rsp = await doWadoUri({
        studyInstanceUid: studyInstanceUid ?? studyUID,
        seriesInstanceUid: seriesInstanceUid ?? seriesUID,
        sopInstanceUid: sopInstanceUid ?? objectUID
      });
      socket.emit(data.uuid, rsp);
    } catch (error) {
      logger.error(error);
      socket.emit(data.uuid, error);
    }
  }
});

socket.on('disconnect', () => {
  logger.info('websocket connection disconnected');
});
