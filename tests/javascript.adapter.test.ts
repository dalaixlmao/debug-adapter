import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('child_process', () => ({ spawn: vi.fn() }));

import { spawn } from 'child_process';
import { ErrorCode } from '../src/errors';
import { JS_DEBUG_ADAPTER_SCRIPT_ENV } from '../src/config/config';

const MOCK_SCRIPT = '/mock/dapDebugServer.js';

function makeChildProcess(overrides: { stdin?: unknown; stdout?: unknown; stderr?: unknown } = {}) {
  const proc = new EventEmitter() as EventEmitter & {
    stdin: unknown; stdout: unknown; stderr: unknown; kill: ReturnType<typeof vi.fn>; pid: number;
  };
  proc.stdin  = 'stdin'  in overrides ? overrides.stdin  : new EventEmitter();
  proc.stdout = 'stdout' in overrides ? overrides.stdout : new EventEmitter();
  proc.stderr = 'stderr' in overrides ? overrides.stderr : new EventEmitter();
  proc.kill   = vi.fn();
  proc.pid    = 5678;
  return proc;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env[JS_DEBUG_ADAPTER_SCRIPT_ENV] = MOCK_SCRIPT;
});

afterEach(() => {
  delete process.env[JS_DEBUG_ADAPTER_SCRIPT_ENV];
});

describe('spawnJavaScriptAdapter', () => {
  describe('when spawn succeeds', () => {
    it('returns handle with process, stdin, stdout, kill, and getStderr', async () => {
      // Arrange
      const child = makeChildProcess();
      vi.mocked(spawn).mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);
      const { spawnJavaScriptAdapter } = await import('../src/adapters/javascript');

      // Act
      const handle = spawnJavaScriptAdapter('/tmp/dap-abc/script.js');

      // Assert
      expect(handle.process).toBe(child);
      expect(handle.stdin).toBe(child.stdin);
      expect(handle.stdout).toBe(child.stdout);
      expect(typeof handle.kill).toBe('function');
      expect(typeof handle.getStderr).toBe('function');
    });

    it('spawns node with the resolved js-debug script path', async () => {
      // Arrange
      const child = makeChildProcess();
      vi.mocked(spawn).mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);
      const { spawnJavaScriptAdapter } = await import('../src/adapters/javascript');

      // Act
      spawnJavaScriptAdapter('/tmp/dap-abc/script.js');

      // Assert
      expect(spawn).toHaveBeenCalledWith(
        'node',
        [MOCK_SCRIPT],
        expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] }),
      );
    });

    it('sets cwd to directory of the given file path', async () => {
      // Arrange
      const child = makeChildProcess();
      vi.mocked(spawn).mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);
      const { spawnJavaScriptAdapter } = await import('../src/adapters/javascript');

      // Act
      spawnJavaScriptAdapter('/tmp/dap-xyz/script.js');

      // Assert
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ cwd: '/tmp/dap-xyz' }),
      );
    });

    it('kill() sends SIGKILL to the child process', async () => {
      // Arrange
      const child = makeChildProcess();
      vi.mocked(spawn).mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);
      const { spawnJavaScriptAdapter } = await import('../src/adapters/javascript');
      const handle = spawnJavaScriptAdapter('/tmp/dap-abc/script.js');

      // Act
      handle.kill();

      // Assert
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    });
  });

  describe('stderr capture', () => {
    it('getStderr returns captured stderr output', async () => {
      // Arrange
      const stderrEmitter = new EventEmitter();
      const child = makeChildProcess({ stderr: stderrEmitter });
      vi.mocked(spawn).mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);
      const { spawnJavaScriptAdapter } = await import('../src/adapters/javascript');
      const handle = spawnJavaScriptAdapter('/tmp/dap-abc/script.js');

      // Act
      stderrEmitter.emit('data', Buffer.from('some error'));

      // Assert
      expect(handle.getStderr()).toBe('some error');
    });

    it('getStderr truncates stderr at 2048 bytes', async () => {
      // Arrange
      const stderrEmitter = new EventEmitter();
      const child = makeChildProcess({ stderr: stderrEmitter });
      vi.mocked(spawn).mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);
      const { spawnJavaScriptAdapter } = await import('../src/adapters/javascript');
      const handle = spawnJavaScriptAdapter('/tmp/dap-abc/script.js');

      // Act
      stderrEmitter.emit('data', Buffer.alloc(3000, 'x'));

      // Assert
      expect(handle.getStderr().length).toBe(2048);
    });

    it('getStderr stops accumulating after 2048 bytes are captured', async () => {
      // Arrange
      const stderrEmitter = new EventEmitter();
      const child = makeChildProcess({ stderr: stderrEmitter });
      vi.mocked(spawn).mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);
      const { spawnJavaScriptAdapter } = await import('../src/adapters/javascript');
      const handle = spawnJavaScriptAdapter('/tmp/dap-abc/script.js');

      // Act
      stderrEmitter.emit('data', Buffer.alloc(2048, 'a'));
      stderrEmitter.emit('data', Buffer.from('extra'));

      // Assert
      expect(handle.getStderr().length).toBe(2048);
      expect(handle.getStderr()).not.toContain('extra');
    });
  });

  describe('when stdin or stdout is null', () => {
    it('throws ADAPTER_CRASH and kills the child when stdin is null', async () => {
      // Arrange
      const child = makeChildProcess({ stdin: null });
      vi.mocked(spawn).mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);
      const { spawnJavaScriptAdapter } = await import('../src/adapters/javascript');

      // Act / Assert
      expect(() => spawnJavaScriptAdapter('/tmp/dap-abc/script.js')).toThrow(
        expect.objectContaining({ code: ErrorCode.ADAPTER_CRASH }),
      );
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('throws ADAPTER_CRASH and kills the child when stdout is null', async () => {
      // Arrange
      const child = makeChildProcess({ stdout: null });
      vi.mocked(spawn).mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);
      const { spawnJavaScriptAdapter } = await import('../src/adapters/javascript');

      // Act / Assert
      expect(() => spawnJavaScriptAdapter('/tmp/dap-abc/script.js')).toThrow(
        expect.objectContaining({ code: ErrorCode.ADAPTER_CRASH }),
      );
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    });
  });

  describe('when JS_DEBUG_ADAPTER_SCRIPT is not set', () => {
    it('throws ADAPTER_CRASH when @vscode/js-debug is not installed and env var is absent', async () => {
      // Arrange
      delete process.env[JS_DEBUG_ADAPTER_SCRIPT_ENV];
      const { spawnJavaScriptAdapter } = await import('../src/adapters/javascript');

      // Act / Assert
      expect(() => spawnJavaScriptAdapter('/tmp/dap-abc/script.js')).toThrow(
        expect.objectContaining({ code: ErrorCode.ADAPTER_CRASH }),
      );
    });
  });
});
