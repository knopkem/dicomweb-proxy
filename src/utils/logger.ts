import pino from 'pino';
import path from 'path';
import shell from 'shelljs';
import { ConfParams, config } from './config';

interface CompatLogger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

function fmt(...args: unknown[]): string {
  return args
    .map((a) => (a instanceof Error ? a.stack ?? a.message : String(a)))
    .join(' ');
}

function createCompatLogger(base: pino.Logger): CompatLogger {
  return {
    info: (...args) => base.info(fmt(...args)),
    warn: (...args) => base.warn(fmt(...args)),
    error: (...args) => base.error(fmt(...args)),
    debug: (...args) => base.debug(fmt(...args)),
  };
}

export class LoggerSingleton {
  private static _instance: CompatLogger;

  public static get Instance(): CompatLogger {
    if (!this._instance) {
      const logDir = config.get(ConfParams.LOG_DIR) as string;
      shell.mkdir('-p', logDir);

      const pinoLogger = pino(
        { level: 'info' },
        pino.transport({
          target: 'pino-roll',
          options: {
            file: path.join(logDir, 'roll'),
            frequency: 'daily',
            extension: '.log',
            mkdir: true,
          },
        }),
      );

      this._instance = createCompatLogger(pinoLogger);
    }

    return this._instance;
  }
}
