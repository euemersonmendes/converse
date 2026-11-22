import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { getDb } from './db/database.js';
import { initSchema } from './db/schema.js';
import { backupDbToSupabase, initSupabaseAndRestore } from './db/supabaseSync.js';
import { initSocketGateway } from './socket/gateway.js';

async function bootstrap() {
  await initSupabaseAndRestore();

  const db = getDb();
  initSchema(db);

  const app = createApp();
  const httpServer = createServer(app);
  initSocketGateway(httpServer, env.CORS_ORIGIN);

  // Backup periódico a cada 60s e ao encerrar o container (Render sleep/redeploy)
  const interval = env.DATABASE_URL
    ? setInterval(() => {
        void backupDbToSupabase();
      }, 60_000)
    : null;

  const shutdown = async () => {
    if (interval) clearInterval(interval);
    await backupDbToSupabase();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  httpServer.listen(env.PORT, () => {
    console.log(`🚀 Converse API & WebSocket rodando em http://localhost:${env.PORT}`);
  });
}

void bootstrap();
