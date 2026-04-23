import fs from 'fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { createTempFile } from '../src/services/temp-file';

describe('createTempFile', () => {
  const createdPaths: string[] = [];

  afterEach(async () => {
    for (const p of createdPaths.splice(0)) {
      await fs.rm(p, { recursive: true, force: true });
    }
  });

  async function track(result: Awaited<ReturnType<typeof createTempFile>>) {
    const dir = require('path').dirname(result.filePath);
    createdPaths.push(dir);
    return result;
  }

  describe('createTempFile(code, language)', () => {
    it('returns a valid filePath ending in .py when language is python', async () => {
      // Arrange / Act
      const result = await track(await createTempFile('x = 1', 'python'));

      // Assert
      expect(result.filePath).toMatch(/\.py$/);
    });

    it('returns a valid filePath ending in .js when language is javascript', async () => {
      const result = await track(await createTempFile('const x = 1', 'javascript'));
      expect(result.filePath).toMatch(/\.js$/);
    });

    it('returns a valid filePath ending in .cpp when language is c++', async () => {
      const result = await track(await createTempFile('int main(){}', 'c++'));
      expect(result.filePath).toMatch(/\.cpp$/);
    });

    it('returns a valid filePath ending in .java when language is java', async () => {
      const result = await track(await createTempFile('class A{}', 'java'));
      expect(result.filePath).toMatch(/\.java$/);
    });

    it('returns a valid filePath ending in .go when language is golang', async () => {
      const result = await track(await createTempFile('package main', 'golang'));
      expect(result.filePath).toMatch(/\.go$/);
    });

    it('creates the file on disk with the correct content', async () => {
      // Arrange
      const code = 'print("hello")';

      // Act
      const result = await track(await createTempFile(code, 'python'));
      const written = await fs.readFile(result.filePath, 'utf8');

      // Assert
      expect(written).toBe(code);
    });

    it('creates the temp directory with dap- prefix', async () => {
      // Arrange / Act
      const result = await track(await createTempFile('x = 1', 'python'));
      const dir = require('path').dirname(result.filePath);

      // Assert
      expect(require('path').basename(dir)).toMatch(/^dap-/);
    });

    it('returns a cleanup function', async () => {
      const result = await track(await createTempFile('x = 1', 'python'));
      expect(typeof result.cleanup).toBe('function');
    });
  });

  describe('cleanup()', () => {
    it('removes the entire temp directory after cleanup', async () => {
      // Arrange
      const result = await createTempFile('x = 1', 'python');
      const dir = require('path').dirname(result.filePath);

      // Act
      await result.cleanup();

      // Assert
      await expect(fs.access(dir)).rejects.toThrow();
    });

    it('does not throw when called a second time', async () => {
      // Arrange
      const result = await createTempFile('x = 1', 'python');

      // Act
      await result.cleanup();

      // Assert
      await expect(result.cleanup()).resolves.toBeUndefined();
    });

    it('removes the file inside the temp directory', async () => {
      // Arrange
      const result = await createTempFile('x = 1', 'python');

      // Act
      await result.cleanup();

      // Assert
      await expect(fs.access(result.filePath)).rejects.toThrow();
    });
  });
});
