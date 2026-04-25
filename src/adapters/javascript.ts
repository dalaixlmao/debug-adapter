import { spawn } from 'child_process';
import path from 'path';
import type { ChildProcess } from 'child_process';
import { AppError, ErrorCode } from '../errors';
import {
  JS_ADAPTER_COMMAND,
  JS_ADAPTER_ENV_KEYS,
  JS_DEBUG_ADAPTER_SCRIPT_ENV,
  ADAPTER_STDERR_BUFFER_BYTES,
} from '../config/config';
import type { AdapterHandle } from '../contracts/adapter';

export function spawnJavaScriptAdapter(filePath: string): AdapterHandle {
  const script = resolveJsDebugScript();
  const child = spawn(JS_ADAPTER_COMMAND, [script], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: buildRestrictedEnv(),
    cwd: path.dirname(filePath),
  });

  const { stdin, stdout } = child;
  if (!stdin || !stdout) {
    child.kill('SIGKILL');
    throw new AppError('js-debug adapter stdio pipes unavailable', ErrorCode.ADAPTER_CRASH);
  }

  const getStderr = attachStderrCapture(child);
  child.on('error', () => { /* handled via getStderr or session timeout */ });
  return { process: child, stdin, stdout, getStderr, kill: () => child.kill('SIGKILL') };
}

function resolveJsDebugScript(): string {
  const envPath = process.env[JS_DEBUG_ADAPTER_SCRIPT_ENV];
  if (envPath) return envPath;
  try {
    return require.resolve('@vscode/js-debug/src/dapDebugServer.js');
  } catch {
    throw new AppError(
      'js-debug adapter not found: install @vscode/js-debug or set JS_DEBUG_ADAPTER_SCRIPT env var',
      ErrorCode.ADAPTER_CRASH,
    );
  }
}

function buildRestrictedEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of JS_ADAPTER_ENV_KEYS) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}

function attachStderrCapture(child: ChildProcess): () => string {
  const chunks: Buffer[] = [];
  let size = 0;
  child.stderr?.on('data', (chunk: Buffer) => {
    if (size >= ADAPTER_STDERR_BUFFER_BYTES) return;
    const remaining = ADAPTER_STDERR_BUFFER_BYTES - size;
    const slice = chunk.subarray(0, remaining);
    chunks.push(slice);
    size += slice.length;
  });
  return () => Buffer.concat(chunks).toString('utf8');
}
