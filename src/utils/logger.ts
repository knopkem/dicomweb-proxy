import SimpleLogger from 'simple-node-logger';
import shell from 'shelljs';
import { ConfParams, config } from './config';

export class LoggerSingleton {
  private static _instance: LoggerSingleton;
  private logger: SimpleLogger.Logger;

  private constructor() {
    // make sure default directories exist
    const logDir = config.get(ConfParams.LOG_DIR) as string;
    shell.mkdir('-p', logDir);
    shell.mkdir('-p', config.get(ConfParams.LOG_DIR));

    // create a rolling file logger based on date/time that fires process events
    const opts = {
      errorEventName: 'error',
      logDirectory: logDir, // NOTE: folder must exist and be writable...
      fileNamePattern: 'roll-<DATE>.log',
      dateFormat: 'YYYY.MM.DD',
    };

    const manager = SimpleLogger.createLogManager();
    // manager.createConsoleAppender();
    manager.createRollingFileAppender(opts);
    this.logger = manager.createLogger();
  }

  public static get Instance() {
    // Do you need arguments? Make it a regular static method instead.
    const inst = this._instance || (this._instance = new this());
    return inst.logger;
  }
}
