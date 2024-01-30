import path from 'path';
import fastify, { FastifyReply, FastifyRequest, FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import fastifySensible from '@fastify/sensible';
import fastifyHelmet from '@fastify/helmet';
import fastifyAutoload from '@fastify/autoload';
import { sendEcho } from './dimse/sendEcho';
import { startScp } from './dimse/store';
import { clearCache } from './utils/fileHelper';
import { ConfParams, config } from './utils/config';
import { shutdown } from './dimse/store';
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
server.register(fastifyHelmet, {
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: { policy: 'require-corp' },
  crossOriginResourcePolicy: { policy: 'same-site' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
});
server.register(fastifyAutoload, {
  dir: path.join(__dirname, 'routes'),
});
server.register(fastifyAutoload, {
  dir: path.join(__dirname, 'routes'),
  options: { prefix: '/viewer' },
});

//------------------------------------------------------------------

// log exceptions
process.on('uncaughtException', async (err) => {
  await logger.error('uncaught exception received:');
  await logger.error(err.stack);
});

//------------------------------------------------------------------

process.on('SIGINT', async () => {
  logger.info('shutting down web server...');
  try {
    await server.close();
    logger.info('webserver shutdown successfully');
    await socket.close();
  } catch (error) {
    logger.error(error);
  }
  if (!config.get(ConfParams.C_GET)) {
    logger.info('shutting down DICOM SCP server...');
    await shutdown();
  }
  process.exit(1);
});

//------------------------------------------------------------------

const port = config.get(ConfParams.HTTP_PORT) as number;

// if not using c-get, start our scp
if (!config.get(ConfParams.C_GET)) {
  startScp();
}
setTimeout(sendEcho, 3000);

const websocketUrl = config.get(ConfParams.WEBSOCKET_URL);
if (websocketUrl) {
  logger.info(`connecting to dicomweb.websocket-bridge: ${websocketUrl}`);
  socket.connect();
}

// running clear cache and setup for 1h checks
clearCache();
setInterval(clearCache, 60000);

logger.info('starting webserver...', port);
server.listen({ port, host: '0.0.0.0' });
