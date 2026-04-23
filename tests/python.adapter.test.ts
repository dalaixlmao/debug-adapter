import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('child_process', () => ({ spawn: vi.fn() }));

import { spawn } from 'child_process';
import { spawnPythonAdapter } from '../src/adapters/python';
import { ErrorCode } from '../src/errors';

function makeChildProcess(overrides: { stdin?: unknown; stdout?: unknown; stderr?: unknown } = {}) {
  const proc = new EventEmitter() as EventEmitter & {
    stdin: unknown; stdout: unknown; stderr: unknown; kill: ReturnType<typeof vi.fn>; pid: number;
  };
  proc.stdin  = 'stdin'  in overrides ? overrides.stdin  : new EventEmitter();
  proc.stdout = 'stdout' in overrides ? overrides.stdout : new EventEmitter();
  proc.stderr = 'stderr' in overrides ? overrides.stderr : new EventEmitter();
  proc.kill   = vi.fn();
  proc.pid    = 1234;
  return proc;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('spawnPythonAdapter', () => {
  describe('when spawn succeeds', () => {
    it('returns handle with process, stdin, stdout, kill, and getStderr', () => {
      // Arrange
      const child = makeChildProcess();
      vi.mocked(spawn).mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);

      // Act
      const handle = spawnPythonAdapter('/tmp/dap-abc/script.py');

      // Assert
      expect(handle.process).toBe(child);
      expect(handle.stdin).toBe(child.stdin);
      expect(handle.stdout).toBe(child.stdout);
      expect(typeof handle.kill).toBe('function');
      expect(typeof handle.getStderr).toBe('function');
    });

    it('spawns with python -m debugpy.adapter and restricted env', () => {
      // Arrange
      const child = makeChildProcess();
      vi.mocked(spawn).mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);

      // Act
      spawnPythonAdapter('/tmp/dap-abc/script.py');

      // Assert
      expect(spawn).toHaveBeenCalledWith(
        'python',
        ['-m', 'debugpy.adapter'],
        expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] }),
      );
    });

    it('sets cwd to directory of the given file path', () => {
      // Arrange
      const child = makeChildProcess();
      vi.mocked(spawn).mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);

      // Act
      spawnPythonAdapter('/tmp/dap-xyz/script.py');

      // Assert
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ cwd: '/tmp/dap-xyz' }),
      );
    });

    it('kill() sends SIGKILL to the child process', () => {
      // Arrange
      const child = makeChildProcess();
      vi.mocked(spawn).mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);
      const handle = spawnPythonAdapter('/tmp/dap-abc/script.py');

      // Act
      handle.kill();

      // Assert
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    });
  });

  describe('stderr capture', () => {
    it('getStderr returns captured stderr output', () => {
      // Arrange
      const stderrEmitter = new EventEmitter();
      const child = makeChildProcess({ stderr: stderrEmitter });
      vi.mocked(spawn).mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);
      const handle = spawnPythonAdapter('/tmp/dap-abc/script.py');

      // Act
      stderrEmitter.emit('data', Buffer.from('some error'));

      // Assert
      expect(handle.getStderr()).toBe('some error');
    });

    it('getStderr truncates stderr at 2048 bytes', () => {
      // Arrange
      const stderrEmitter = new EventEmitter();
      const child = makeChildProcess({ stderr: stderrEmitter });
      vi.mocked(spawn).mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);
      const handle = spawnPythonAdapter('/tmp/dap-abc/script.py');

      // Act
      const bigChunk = Buffer.alloc(3000, 'x');
      stderrEmitter.emit('data', bigChunk);

      // Assert
      expect(handle.getStderr().length).toBe(2048);
    });

    it('getStderr stops accumulating after 2048 bytes are captured', () => {
      // Arrange
      const stderrEmitter = new EventEmitter();
      const child = makeChildProcess({ stderr: stderrEmitter });
      vi.mocked(spawn).mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);
      const handle = spawnPythonAdapter('/tmp/dap-abc/script.py');

      // Act — fill the buffer then emit more
      stderrEmitter.emit('data', Buffer.alloc(2048, 'a'));
      stderrEmitter.emit('data', Buffer.from('extra'));

      // Assert
      expect(handle.getStderr().length).toBe(2048);
      expect(handle.getStderr()).not.toContain('extra');
    });
  });

  describe('when stdin or stdout is null', () => {
    it('throws ADAPTER_CRASH and kills the child when stdin is null', () => {
      // Arrange
      const child = makeChildProcess({ stdin: null });
      vi.mocked(spawn).mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);

      // Act / Assert
      expect(() => spawnPythonAdapter('/tmp/dap-abc/script.py')).toThrow(
        expect.objectContaining({ code: ErrorCode.ADAPTER_CRASH }),
      );
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('throws ADAPTER_CRASH and kills the child when stdout is null', () => {
      // Arrange
      const child = makeChildProcess({ stdout: null });
      vi.mocked(spawn).mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);

      // Act / Assert
      expect(() => spawnPythonAdapter('/tmp/dap-abc/script.py')).toThrow(
        expect.objectContaining({ code: ErrorCode.ADAPTER_CRASH }),
      );
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    });
  });
});
