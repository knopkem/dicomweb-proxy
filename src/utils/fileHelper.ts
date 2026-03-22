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

export function getCachedInstancePathCandidates(storagePath: string, studyInstanceUID: string, sopInstanceUID: string): string[] {
  return [
    path.join(storagePath, studyInstanceUID, sopInstanceUID),
    path.join(storagePath, `${sopInstanceUID}.dcm`),
  ];
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

export async function waitForFile(pathname: string, maxRetries = 3, delay = 100) {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (await fileExists(pathname)) {
        return true;
      } else {
        throw new Error(`file not found: ${pathname}`);
      }
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export async function resolveCachedInstancePath(
  storagePath: string,
  studyInstanceUID: string,
  sopInstanceUID: string
): Promise<string | undefined> {
  const candidates = getCachedInstancePathCandidates(storagePath, studyInstanceUID, sopInstanceUID);
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export async function waitForCachedInstancePath(
  storagePath: string,
  studyInstanceUID: string,
  sopInstanceUID: string,
  maxRetries = 3,
  delay = 100
): Promise<string> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const resolved = await resolveCachedInstancePath(storagePath, studyInstanceUID, sopInstanceUID);
    if (resolved) {
      return resolved;
    }
    lastError = new Error(`file not found for SOP ${sopInstanceUID} in ${storagePath}`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw lastError ?? new Error(`file not found for SOP ${sopInstanceUID} in ${storagePath}`);
}

export async function clearCache() {
  const storagePath = config.get(ConfParams.STORAGE_PATH) as string;
  const retention = config.get(ConfParams.CACHE_RETENTION) as number;
  const logger = LoggerSingleton.Instance;

  if (retention < 0) {
    logger.warn('cache cleanup disabled');
    return;
  }

  const entries = await promises.readdir(storagePath, { withFileTypes: true }).catch(() => []);
  const dateNow = new Date();

  for (const entry of entries) {
    if (!entry.isDirectory() && !(entry.isFile() && entry.name.endsWith('.dcm'))) {
      continue;
    }
    const filepath = path.join(storagePath, entry.name);
    const stats = await promises.stat(filepath);
    const mtime = stats.mtime;
    const minutes = (dateNow.getTime() - mtime.getTime()) / 60000;
    if (minutes > retention) {
      logger.info(`removing: ${filepath}`);
      await promises.rm(filepath, { recursive: true, force: true });
    }
  }
}
