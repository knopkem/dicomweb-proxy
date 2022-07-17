import path from 'path';
import fastify, { FastifyReply, FastifyRequest, FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import fastifySensible from '@fastify/sensible';
import fastifyHelmet from '@fastify/helmet';
import fastifyAutoload from '@fastify/autoload';

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
server.register(fastifyHelmet, { contentSecurityPolicy: false });
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
});

//------------------------------------------------------------------
