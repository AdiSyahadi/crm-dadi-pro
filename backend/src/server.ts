import http from 'http';
import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { disconnectRedis } from './config/redis';
import { initSocketIO } from './socket/io';
import { startBroadcastWorker } from './workers/broadcast.worker';
import { syncService } from './services/sync.service';

const server = http.createServer(app);

async function bootstrap(): Promise<void> {
  // Connect to database
  await connectDatabase();

  // Initialize Socket.IO
  initSocketIO(server);

  // Start background workers
  startBroadcastWorker();

  // Start sync polling for new messages from WA API (every 2 min)
  syncService.startPolling(120_000);

  // Start server
  server.listen(env.PORT, () => {
    console.log(`
🚀 CRM-DADI Backend Server
━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Server:    ${env.APP_URL}
🌍 Env:       ${env.NODE_ENV}
🗄️  Database:  MySQL (XAMPP)
📦 Redis:     ${env.REDIS_URL}
🔌 Socket.IO: Ready
━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  });
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log('\n🛑 Shutting down...');
  server.close();
  await disconnectDatabase();
  await disconnectRedis();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

bootstrap().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
