import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { getDb } from './db/database.js';
import { initSchema } from './db/schema.js';
import { initSocketGateway } from './socket/gateway.js';

const db = getDb();
initSchema(db);

const app = createApp();
const httpServer = createServer(app);
initSocketGateway(httpServer, env.CORS_ORIGIN);

httpServer.listen(env.PORT, () => {
  console.log(`🚀 Converse API & WebSocket rodando em http://localhost:${env.PORT}`);
});
