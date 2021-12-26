import fs from 'fs';

export async function fileExists(pathname: string): Promise<boolean> {
  return new Promise((resolve) => {
    fs.access(pathname, (err) => {
      err ? resolve(false) : resolve(true);
    });
  });
}