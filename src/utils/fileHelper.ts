import { promises } from 'fs';
import path from 'path';
import { ConfParams, config } from './config';
import { LoggerSingleton } from './logger';


const getDirectories = async (source: string) => {
  try {
    const dir = await promises.readdir(source, { withFileTypes: true })
    return dir.filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name)
  }
  catch (e) {
    const logger = LoggerSingleton.Instance;
    logger.warn("Storage Folder doesn't exist: ", source);
    return [];
  }
}

export async function fileExists(pathname: string): Promise<boolean> {
  try {
    const stat = await promises.stat(pathname);
    return !!stat;
  }
  catch {
    return false;
  }
}

export async function clearCache() {
  const storagePath = config.get(ConfParams.STORAGE_PATH) as string;
  const retention = config.get(ConfParams.CACHE_RETENTION) as number;
  const logger = LoggerSingleton.Instance;

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
}
