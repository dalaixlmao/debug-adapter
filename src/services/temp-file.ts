import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { LANGUAGE_FILE_EXTENSION, TEMP_DIR_MODE, TEMP_DIR_PREFIX } from '../config/config';
import type { TempFileResult } from '../contracts';

export async function createTempFile(code: string, language: string): Promise<TempFileResult> {
  const ext = LANGUAGE_FILE_EXTENSION[language] ?? 'txt';
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
  await fs.chmod(dir, TEMP_DIR_MODE);
  const filePath = path.join(dir, `${randomUUID()}.${ext}`);
  await fs.writeFile(filePath, code, 'utf8');
  return { filePath, cleanup: buildCleanup(dir) };
}

function buildCleanup(dir: string): () => Promise<void> {
  return async () => {
    await fs.rm(dir, { recursive: true, force: true });
  };
}
