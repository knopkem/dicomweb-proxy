const config = require('config');
const path = require('path');
const fastify = require('fastify')({ logger: false });
const io = require('socket.io-client');

const utils = require('./utils');

fastify.register(require('fastify-static'), {
  root: path.join(__dirname, '../public'),
});

fastify.register(require('fastify-cors'), {});

fastify.register(require('fastify-sensible'));

fastify.register(require('fastify-helmet'), { contentSecurityPolicy: false });

fastify.register(require('fastify-compress'), { global: true });

const logger = utils.getLogger();

const websocketUrl = config.get('websocketUrl');
const socket = io(websocketUrl, {
  reconnection: true,
  reconnectionDelayMax: 10000,
  autoConnect: false,
  auth: {
    token: config.get('websocketToken')
  }
});

socket.on('connect', () => {
  logger.info('websocket connection established');
});

socket.on('qido-request', async (data) => {
  logger.info('websocket qido request received, fetching metadata now...');

  if (data) {
    let tags = [];
    if (data.level === 'STUDY') {
      tags = utils.studyLevelTags();
    } else if (data.level === 'SERIES') {
      tags = utils.seriesLevelTags();
    } else if (data.level === 'IMAGE') {
      tags = utils.imageLevelTags();
    }
    const json = await utils.doFind(data.level, data.query, tags);
    logger.info('sending websocket response');
    socket.emit(data.uuid, json);
  }
});

socket.on('wadouri-request', async (data) => {
  logger.info('websocket wadouri request received, fetching metadata now...');

  if (data) {
    try {
      const rsp = await utils.doWadoUri(data.query);
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
  await logger.info('shutting down web server...');
  socket.close();
  fastify.close().then(
    async () => {
      await logger.info('webserver shutdown successfully');
    },
    (err) => {
      logger.error('webserver shutdown failed', err);
    }
  );
  if (!config.get('useCget')) {
    await logger.info('shutting down DICOM SCP server...');
    await utils.shutdown();
  }
  process.exit(1);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies', async (req, reply) => {
  const tags = utils.studyLevelTags();
  const json = await utils.doFind('STUDY', req.query, tags);
  reply.send(json);
});

//------------------------------------------------------------------

fastify.get('/rs/studies', async (req, reply) => {
  const tags = utils.studyLevelTags();
  const json = await utils.doFind('STUDY', req.query, tags);
  reply.send(json);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/metadata', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  const tags = utils.seriesLevelTags();
  const json = await utils.doFind('SERIES', query, tags);
  reply.send(json);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series', async (req, reply) => {
  const tags = utils.seriesLevelTags();
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;

  const json = await utils.doFind('SERIES', query, tags);
  reply.send(json);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances', async (req, reply) => {
  const tags = utils.imageLevelTags();
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;

  const json = await utils.doFind('IMAGE', query, tags);
  reply.send(json);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/metadata', async (req, reply) => {
  const tags = utils.imageLevelTags();
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;

  const json = await utils.doFind('IMAGE', query, tags);
  reply.send(json);
});

//------------------------------------------------------------------

fastify.get('/viewer/wadouri', async (req, reply) => {
  try {
    const rsp = await utils.doWadoUri(req.query);
    reply.header('Content-Type', 'application/dicom');
    reply.send(rsp);
  } catch (error) {
    logger.error(error);
    reply.setCode(500);
    reply.send(error);
  }
});

//------------------------------------------------------------------

const port = config.get('webserverPort');
logger.info('starting...');
fastify.listen(port, '0.0.0.0', async (err, address) => {
  if (err) {
    await logger.error(err, address);
    process.exit(1);
  }
  logger.info(`web-server listening on port: ${port}`);

  await utils.init();

  // if not using c-get, start our scp
  if (!config.get('useCget')) {
    utils.startScp();
  }
  utils.sendEcho();

  if (websocketUrl) {
    logger.info(`connecting to dicomweb.websocket-bridge: ${websocketUrl}`);
    socket.connect();
  }
});

//------------------------------------------------------------------
