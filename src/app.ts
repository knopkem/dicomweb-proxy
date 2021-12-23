import path from 'path';
import fastify from 'fastify';
import { ConfParams, config } from './utils/config';
import { sendEcho } from './dimse/sendEcho';
import { startScp, shutdown } from './dimse/store';
import { LoggerSingleton } from './utils/logger';
import { socket } from './socket';

const logger = LoggerSingleton.Instance;

const server = fastify();
server.register(require('fastify-static'), {
  root: path.join(__dirname, '../public'),
});

server.setNotFoundHandler((req: any, res: any) => {
  res.sendFile('index.html');
});
server.register(require('fastify-cors'), {});
server.register(require('fastify-sensible'));
server.register(require('fastify-helmet'), { contentSecurityPolicy: false });
server.register(require('./routes'));
server.register(require('./routes'), { prefix: '/viewer' });

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
server.listen(port, '0.0.0.0', async (err: any, address: any) => {
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
});

//------------------------------------------------------------------
