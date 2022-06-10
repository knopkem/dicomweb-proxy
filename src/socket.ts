import { ConfParams, config } from './utils/config';
import { io } from 'socket.io-client';
import { doFind } from './dimse/findData';
import { stringToQueryLevel } from './dimse/querLevel';
import { doWadoUri } from './dimse/wadoUri';
import { LoggerSingleton } from './utils/logger';

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
  logger.info('websocket QIDO request received, fetching metadata now...');
  const { level, query }: { level: string; query: any } = data;

  if (data) {
    const lvl = stringToQueryLevel(level);
    const json = await doFind(lvl, query);
    logger.info('sending websocket response');
    socket.emit(data.uuid, json);
  }
});

socket.on('wadouri-request', async (data) => {
  logger.info('websocket wadouri request received, fetching metadata now...');
  const {
    studyUID, seriesUID, objectUID, studyInstanceUid, seriesInstanceUid, sopInstanceUid
  } = data.query;

  if (data) {
    try {
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
