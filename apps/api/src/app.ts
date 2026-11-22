import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { chatsRouter } from './routes/chats.js';
import { discoverRouter } from './routes/discover.js';
import { pairingRouter } from './routes/pairing.js';
import { socialRouter } from './routes/social.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '5mb' }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'converse-api', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/pairing', pairingRouter);
  app.use('/api/chats', chatsRouter);
  app.use('/api/discover', discoverRouter);
  app.use('/api/social', socialRouter);

  app.use(errorHandler);
  return app;
}
