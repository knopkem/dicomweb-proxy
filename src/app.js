const config = require('config');
const fs = require('fs');
const path = require('path');
const fastify = require('fastify')({ logger: false });
const io = require('socket.io-client');
const dicomParser = require('dicom-parser');
const crypto = require('crypto');
const { Readable } = require('stream');

const utils = require('./utils');

fastify.register(require('fastify-static'), {
  root: path.join(__dirname, '../public'),
});

fastify.setNotFoundHandler((req, res) => {
  res.sendFile('index.html')
})

fastify.register(require('fastify-cors'), {});

fastify.register(require('fastify-sensible'));

fastify.register(require('fastify-helmet'), { contentSecurityPolicy: false });

// TOO SLOW
// fastify.register(require('fastify-compress'), { global: true });

const logger = utils.getLogger();

const websocketUrl = config.get('websocketUrl');
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

  // make sure c-find worked
  if (json.length === 0) {
    logger.error('no metadata found');
    reply.setCode(500);
    reply.send(json);
    return;
  }

  // check if fetch is needed
  const accessing = [];
  const fetching = [];
  for (let i = 0; i < json.length; i += 1) {
    const sopInstanceUid = json[i]['00080018'].Value[0];
    const storagePath = config.get('storagePath');
    const pathname = path.join(storagePath, query.StudyInstanceUID, sopInstanceUid);
    const accessPromise = utils.fileExists(pathname).catch(() => {
      fetching.push(utils.waitOrFetchData(query.StudyInstanceUID, query.SeriesInstanceUID, undefined, 'SERIES'));
    });
    accessing.push(accessPromise);
  }
  await Promise.all(accessing);

  if (fetching.length > 0) {
     // fetch series
     logger.info(`fetching series ${query.SeriesInstanceUID}`);
     await fetching[0];
  }

  logger.info(`parsing series ${query.SeriesInstanceUID}`);
  const reading = [];
  const parsing = [];
  for (let i = 0; i < json.length; i += 1) {
    const sopInstanceUid = json[i]['00080018'].Value[0];
    const storagePath = config.get('storagePath');
    const pathname = path.join(storagePath, query.StudyInstanceUID, sopInstanceUid);

    const readPromise = fs.promises.readFile(pathname);
    reading.push(readPromise);
    readPromise.then((data) => {
      const dataset = dicomParser.parseDicom(data);

      // parse additional needed attributes
      const bitsAllocated = dataset.uint16('x00280100');
      const bitsStored = dataset.uint16('x00280101');
      const highBit = dataset.uint16('x00280102');
      const rows = dataset.uint16('x00280010');
      const cols = dataset.uint16('x00280011');
      const pixelSpacingString = dataset.string('x00280030');
      const pixelSpacing = pixelSpacingString ? pixelSpacingString.split('\\').map((e) => parseFloat(e)) : [1, 1];
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
      const iop = iopString ? iopString.split('\\').map((e) => parseFloat(e)) : null;
      const ippString = dataset.string('x00200032');
      const ipp = ippString ? ippString.split('\\').map((e) => parseFloat(e)) : null;

      // append to all results

      json[i]['00080060'] = { Value: [modality], vr: 'CS' };
      json[i]['00280002'] = { Value: [samplesPerPixel], vr: 'US' };
      json[i]['00280004'] = { Value: [photometricInterpretation], vr: 'CS' };
      json[i]['00280010'] = { Value: [rows], vr: 'US' };
      json[i]['00280011'] = { Value: [cols], vr: 'US' };
      json[i]['00280030'] = { Value: pixelSpacing, vr: 'DS' };
      json[i]['00280100'] = { Value: [bitsAllocated], vr: 'US' };
      json[i]['00280101'] = { Value: [bitsStored], vr: 'US' };
      json[i]['00280102'] = { Value: [highBit], vr: 'US' };
      json[i]['00280103'] = { Value: [pixelRepresentation], vr: 'US' };
      json[i]['00281050'] = { Value: [wc], vr: 'DS' };
      json[i]['00281051'] = { Value: [ww], vr: 'DS' };
      json[i]['00281052'] = { Value: [rescaleIntercept], vr: 'DS' };
      json[i]['00281053'] = { Value: [rescaleSlope], vr: 'DS' };
      if (iop) json[i]['00200037'] = { Value: iop, vr: 'DS' };
      if (ipp) json[i]['00200032'] = { Value: ipp, vr: 'DS' };
      parsing.push(Promise.resolve());
    });
  }
  await Promise.all(reading);
  await Promise.all(parsing);

  reply.send(json);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/frames/:frame', async (req, reply) => {
  const { studyInstanceUid, sopInstanceUid } = req.params;

  const storagePath = config.get('storagePath');
  const studyPath = path.join(storagePath, studyInstanceUid);
  const pathname = path.join(studyPath, sopInstanceUid);

  try {
    // logger.info(studyInstanceUid, seriesInstanceUid, sopInstanceUid, frame);
    await utils.fileExists(pathname);
  } catch (error) {
    logger.error(error);
    reply.code(404);
    reply.send(`File ${pathname} not found!`);
    return;
  }

  try {
    await utils.compressFile(pathname, studyPath, '1.2.840.10008.1.2');
  } catch (error) {
    logger.error(error);
    const msg = `failed to compress ${pathname}`;
    reply.code(500);
    reply.send(msg);
    return;
  }

  // read file from file system
  try {
    const data = await fs.promises.readFile(pathname);
    const dataset = dicomParser.parseDicom(data);
    const pixelDataElement = dataset.elements.x7fe00010;
    const buffer = Buffer.from(dataset.byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length);

    const term = '\r\n';
    const boundary = crypto.randomBytes(16).toString('hex');
    const contentId = crypto.randomBytes(16).toString('hex');
    const endline = `${term}--${boundary}--${term}`;

    reply.header('Content-Type', `multipart/related;start=${contentId};type='application/octed-stream';boundary='${boundary}'`);

    const readStream = new Readable({
      read() {
        this.push(`${term}--${boundary}${term}`);
        this.push(`Content-Location:localhost${term}`);
        this.push(`Content-ID:${contentId}${term}`);
        this.push(`Content-Type:application/octet-stream${term}`);
        this.push(term);
        this.push(buffer);
        this.push(endline);
        this.push(null);
      },
    });
    reply.send(readStream);
  } catch (error) {
    logger.error(error);
    reply.code(500);
    reply.send(`Error getting the file: ${error}.`);
  }
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