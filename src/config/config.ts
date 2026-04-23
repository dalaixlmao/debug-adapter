import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_PORT                  = 3000;
const DEFAULT_DEBUG_TIMEOUT_MS      = 5000;
const DEFAULT_MAX_STEPS             = 100;
const DEFAULT_DAP_REQUEST_TIMEOUT_MS = 5000;

export type SupportedLanguage = 'c++' | 'java' | 'python' | 'javascript' | 'golang';
export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['c++', 'java', 'python', 'javascript', 'golang'];

export const MAX_CODE_SIZE_BYTES = 65536;

export const TEMP_DIR_PREFIX = 'dap-';
export const TEMP_DIR_MODE   = 0o700;

export const LANGUAGE_FILE_EXTENSION: Record<string, string> = {
  python:     'py',
  javascript: 'js',
  'c++':      'cpp',
  java:       'java',
  golang:     'go',
} as const;

export const PYTHON_ADAPTER_COMMAND      = 'python';
export const PYTHON_ADAPTER_ARGS         = ['-m', 'debugpy.adapter'] as const;
export const PYTHON_ADAPTER_ENV_KEYS     = ['PATH', 'HOME', 'TMPDIR'] as const;
export const ADAPTER_STDERR_BUFFER_BYTES = 2048;

export const DAP_SESSION_CLIENT_ID  = 'debug-adapter';
export const DAP_SESSION_ADAPTER_ID = 'debug-adapter';
export const DAP_DEFAULT_THREAD_ID  = 1;

export const config =  {
  PORT:                   parseInt(process.env.PORT ?? DEFAULT_PORT.toString(), 10),
  HOST:                   process.env.HOST || '0.0.0.0',
  DEBUG_TIMEOUT_MS:       parseInt(process.env.DEBUG_TIMEOUT_MS || DEFAULT_DEBUG_TIMEOUT_MS.toString(), 10),
  MAX_STEPS:              parseInt(process.env.MAX_STEPS || DEFAULT_MAX_STEPS.toString(), 10),
  DAP_REQUEST_TIMEOUT_MS: parseInt(process.env.DAP_REQUEST_TIMEOUT_MS || DEFAULT_DAP_REQUEST_TIMEOUT_MS.toString(), 10),
};