import path from 'path';
import fastify, { FastifyReply, FastifyRequest, FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import fastifySensible from '@fastify/sensible';
import fastifyHelmet from '@fastify/helmet';
import fastifyAutoload from '@fastify/autoload';

import { promises } from 'fs';
import { ConfParams, config } from './utils/config';
import { sendEcho } from './dimse/sendEcho';
import { startScp, shutdown } from './dimse/store';
import { LoggerSingleton } from './utils/logger';
import { socket } from './socket';

const logger = LoggerSingleton.Instance;

const server: FastifyInstance = fastify();
server.register(fastifyStatic, {
  root: path.join(__dirname, '../public'),
});

server.setNotFoundHandler((req: FastifyRequest, res: FastifyReply) => {
  res.sendFile('index.html');
});
server.register(fastifyCors, {});
server.register(fastifySensible);
server.register(fastifyHelmet, { contentSecurityPolicy: false });
server.register(fastifyAutoload, {
  dir: path.join(__dirname, 'routes'),
});
server.register(fastifyAutoload, {
  dir: path.join(__dirname, 'routes'),
  options: { prefix: '/viewer' },
});

//------------------------------------------------------------------

const getDirectories = async (source: string) => {
  try {
    const dir = await promises.readdir(source, { withFileTypes: true })
    return dir.filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name)
  }
  catch (e) {
    logger.warn("Storage Folder doesn't exist: ", source);
    return [];
  }
}

//------------------------------------------------------------------

const clearCache = async () => {
  const storagePath = config.get(ConfParams.STORAGE_PATH) as string;
  const retention = config.get(ConfParams.CACHE_RETENTION) as number;

  if (retention < 0) {
    logger.warn('cache cleanup disabled');
    return;
  }

  const dirs = await getDirectories(storagePath);
  const dateNow = new Date();

  for (const dir of dirs) {
    const filepath = path.join(storagePath, dir);
    const stats = await promises.stat(filepath);
    const mtime = stats.mtime;
    const minutes = (dateNow.getTime() - mtime.getTime()) / 60000;
    if (minutes > retention) {
      logger.info(`removing: ${filepath}`);
      await promises.rm(filepath, { recursive: true, force: true });
    }
  }
};

//------------------------------------------------------------------

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
  if (!config.get(ConfParams.C_GET)) {
    logger.info('shutting down DICOM SCP server...');
    await shutdown();
  }
  process.exit(1);
});

//------------------------------------------------------------------

const port = config.get(ConfParams.HTTP_PORT) as number;
logger.info('starting...');
server.listen({ port, host: '0.0.0.0' }, async (err, address) => {
  if (err) {
    await logger.error(err, address);
    process.exit(1);
  }
  logger.info(`web-server listening on port: ${port}`);

  // if not using c-get, start our scp
  if (!config.get(ConfParams.C_GET)) {
    startScp();
  }
  sendEcho();

  const websocketUrl = config.get(ConfParams.WEBSOCKET_URL);
  if (websocketUrl) {
    logger.info(`connecting to dicomweb.websocket-bridge: ${websocketUrl}`);
    socket.connect();
  }

  // running clear cache and setup for 1h checks
  clearCache();
  setInterval(clearCache, 60000);
});

//------------------------------------------------------------------
