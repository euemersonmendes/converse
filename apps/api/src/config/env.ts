import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV_SECRET = 'converse-dev-secret-change-in-production-2026';

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const jwtSecret = process.env.JWT_SECRET || DEV_SECRET;

if (isProd && (!process.env.JWT_SECRET || jwtSecret === DEV_SECRET || jwtSecret.length < 24)) {
  throw new Error(
    'FATAL: Em produção (NODE_ENV=production), defina JWT_SECRET com pelo menos 24 caracteres aleatórios.'
  );
}

const rawCors = process.env.CORS_ORIGIN || '*';
const corsOrigin: string | string[] =
  rawCors === '*' ? '*' : rawCors.split(',').map((o) => o.trim()).filter(Boolean);

if (isProd && corsOrigin === '*') {
  console.warn('[SECURITY WARNING] CORS_ORIGIN está configurado como "*". Defina o domínio oficial em produção.');
}

export const env = {
  PORT: Number(process.env.PORT || 3001),
  JWT_SECRET: jwtSecret,
  DB_PATH: process.env.DB_PATH || path.resolve(__dirname, '../../data/converse.db'),
  CORS_ORIGIN: corsOrigin,
  NODE_ENV: nodeEnv,
  IS_PROD: isProd,
  SEED_DEMO: process.env.SEED_DEMO === 'true',
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER || '',
  SMS_WEBHOOK_URL: process.env.SMS_WEBHOOK_URL || '',
  SMS_WEBHOOK_TOKEN: process.env.SMS_WEBHOOK_TOKEN || '',
};
