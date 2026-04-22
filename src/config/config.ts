import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_PORT             = 3000;
const DEFAULT_DEBUG_TIMEOUT_MS = 5000;
const DEFAULT_MAX_STEPS        = 100;

export const config =  {
  PORT:             parseInt(process.env.PORT ?? DEFAULT_PORT.toString(), 10),
  HOST:             process.env.HOST || '0.0.0.0',
  DEBUG_TIMEOUT_MS: parseInt(process.env.DEBUG_TIMEOUT_MS || DEFAULT_DEBUG_TIMEOUT_MS.toString(), 10),
  MAX_STEPS:        parseInt(process.env.MAX_STEPS || DEFAULT_MAX_STEPS.toString(), 10),
};