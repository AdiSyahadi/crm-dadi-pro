import http from 'http';
import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { disconnectRedis } from './config/redis';
import { initSocketIO } from './socket/io';
import { startBroadcastWorker } from './workers/broadcast.worker';
import { startScheduledMessageWorker } from './workers/scheduled-message.worker';
import { startExpiryWorker } from './workers/expiry.worker';
import { startSlaWorker } from './workers/sla.worker';
import { startTaskReminderWorker } from './workers/task-reminder.worker';
import { startRottenDealWorker } from './workers/rotten-deal.worker';
import { syncService } from './services/sync.service';

const server = http.createServer(app);

async function bootstrap(): Promise<void> {
  // ── P185: Validate critical secrets in production ──
  if (env.isProd) {
    const fatal: string[] = [];
    if (!env.JWT_SECRET || env.JWT_SECRET === 'default-secret') fatal.push('JWT_SECRET');
    if (!env.JWT_REFRESH_SECRET || env.JWT_REFRESH_SECRET === 'default-refresh-secret') fatal.push('JWT_REFRESH_SECRET');
    if (!env.DATABASE_URL) fatal.push('DATABASE_URL');
    if (fatal.length > 0) {
      console.error(`❌ FATAL: Missing required environment variables for production: ${fatal.join(', ')}`);
      process.exit(1);
    }
  }

  // Connect to database
  await connectDatabase();

  // Initialize Socket.IO
  initSocketIO(server);

  // Start background workers
  startBroadcastWorker();
  startScheduledMessageWorker();
  startExpiryWorker();
  startSlaWorker();
  startTaskReminderWorker();
  startRottenDealWorker();

  // Start sync polling for new messages from WA API (every 2 min)
  syncService.startPolling(120_000);

  // Start server
  server.listen(env.PORT, () => {
    console.log(`
🚀 Power WA Backend Server
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
