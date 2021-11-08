import config from 'config';
import path from 'path';
import fastify from 'fastify';
import io from 'socket.io-client';
import { seriesLevelTags, studyLevelTags, imageLevelTags } from './dimse/tags';
import { doFind } from './dimse/findData';
import { sendEcho } from './dimse/sendEcho';
import { doWadoRs } from './dimse/wadoRs';
import { doWadoUri } from './dimse/wadoUri';
import { startScp, shutdown } from './dimse/store';
import { LoggerSingleton } from './utils/logger';
import { fetchMeta } from './dimse/fetchMeta';
import { QUERY_LEVEL, stringToQueryLevel } from './dimse/querLevel';
import { fetchMove } from './dimse/fetchMove';

const logger = LoggerSingleton.Instance;

const server = fastify();
server.register(require('fastify-static'), {
  root: path.join(__dirname, '../public'),});

server.setNotFoundHandler((req: any, res: any) => {
  res.sendFile('index.html');
});
server.register(require('fastify-cors'), {});
server.register(require('fastify-sensible'));
server.register(require('fastify-helmet'), { contentSecurityPolicy: false });


const websocketUrl = config.get('websocketUrl') as string;
const socket = io(websocketUrl, {
  reconnection: true,
  reconnectionDelayMax: 10000,
  autoConnect: false,
  auth: {
    token: config.get('websocketToken'),
  },
});

socket.on('connect', () => {
  logger.info('websocket connection established');
});

socket.on('qido-request', async (data: any) => {
  logger.info('websocket qido request received, fetching metadata now...');
  const { level, query } : { level: string, query: any} = data;

  if (data) {
    let tags = new Array<string>();
    if (level === 'STUDY') {
      tags = studyLevelTags;
    } else if (data.level === 'SERIES') {
      tags = seriesLevelTags;
    } else if (data.level === 'IMAGE') {
      tags = imageLevelTags;
    }
    const json = await doFind(stringToQueryLevel(level), query, tags);
    logger.info('sending websocket response');
    socket.emit(data.uuid, json);
  }
});

socket.on('wadouri-request', async (data: any) => {
  logger.info('websocket wadouri request received, fetching metadata now...');

  if (data) {
    try {
      const rsp = await doWadoUri(data.query);
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

// log exceptions
process.on('uncaughtException', async (err) => {
  await logger.error('uncaught exception received:');
  await logger.error(err.stack);
});

//------------------------------------------------------------------

process.on('SIGINT', async () => {
  try {
    await server.close();
    await socket.close();
  } catch (error) {
    logger.error(error);
  }
  logger.info('shutting down web server...');
  logger.info('webserver shutdown successfully');
  if (!config.get('useCget')) {
    logger.info('shutting down DICOM SCP server...');
    await shutdown();
  }
  process.exit(1);
});

//------------------------------------------------------------------

server.get('/viewer/rs/studies', async (req: any, reply: any) => {
  const json = await doFind(QUERY_LEVEL.STUDY, req.query, studyLevelTags);
  reply.send(json);
});

//------------------------------------------------------------------

server.get('/rs/studies', async (req: any, reply: any) => {
  const json = await doFind(QUERY_LEVEL.STUDY, req.query, studyLevelTags);
  reply.send(json);
});

//------------------------------------------------------------------

server.get('/viewer/rs/studies/:studyInstanceUid/metadata', async (req: any, reply: any) => {
  const { query, params } = req;
  query.StudyInstanceUID = params.studyInstanceUid;
  const json = await doFind(QUERY_LEVEL.SERIES, query, seriesLevelTags);
  reply.send(json);
});

//------------------------------------------------------------------

server.get('/viewer/rs/studies/:studyInstanceUid/series', async (req: any, reply: any) => {
  const { query, params } = req;
  query.StudyInstanceUID = params.studyInstanceUid;

  const json = await doFind(QUERY_LEVEL.SERIES, query, seriesLevelTags);
  reply.send(json);
});

//------------------------------------------------------------------

server.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances', async (req: any, reply: any) => {
  const { query, params } = req;
  query.StudyInstanceUID = params.studyInstanceUid;
  query.SeriesInstanceUID = params.seriesInstanceUid;

  const json = await doFind(QUERY_LEVEL.IMAGE, query, imageLevelTags);
  reply.send(json);
});

//------------------------------------------------------------------

server.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/metadata', async (req: any, reply: any) => {
  const { query, params } = req;
  const { studyInstanceUid, seriesInstanceUid } = params;
    
  try {
    const rsp = await fetchMeta( query, studyInstanceUid, seriesInstanceUid );
    reply.send(rsp);
  } catch (error) {
    logger.error(error);
    reply.send(500);
  }
});

//------------------------------------------------------------------

server.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/frames/:frame', async (req: any, reply: any) => {
  const { studyInstanceUid, seriesInstanceUid, sopInstanceUid } = req.params;

  
  try {
    const rsp = await doWadoRs( {studyInstanceUid, seriesInstanceUid, sopInstanceUid} );
    reply.header('Content-Type', rsp.contentType);
    reply.send(rsp.buffer);
  } catch (error) {
    logger.error(error);
    reply.send(500);
  }
});

//------------------------------------------------------------------

server.get('/viewer/wadouri', async (req: any, reply: any) => {
  const { studyUID, seriesUID, objectUID } = req.query;

  try {
    const rsp = await doWadoUri({studyInstanceUid: studyUID, seriesInstanceUid: seriesUID, sopInstanceUid: objectUID});
    reply.header('Content-Type', rsp.contentType);
    reply.send(rsp.buffer);
  } catch (error) {
    logger.error(error);
    reply.send(500);
  }
});

//------------------------------------------------------------------

const port = config.get('webserverPort') as number;
logger.info('starting...');
server.listen(port, '0.0.0.0', async (err: any, address: any) => {
  if (err) {
    await logger.error(err, address);
    process.exit(1);
  }
  logger.info(`web-server listening on port: ${port}`);

  // if not using c-get, start our scp
  if (!config.get('useCget')) {
    startScp();
  }
  sendEcho();

  if (websocketUrl) {
    logger.info(`connecting to dicomweb.websocket-bridge: ${websocketUrl}`);
    socket.connect();
  }
});

//------------------------------------------------------------------
