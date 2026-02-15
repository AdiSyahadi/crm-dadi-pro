import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import { broadcastService } from '../services/broadcast.service';

export function startBroadcastWorker() {
  const worker = new Worker(
    'broadcast',
    async (job) => {
      const { broadcastId, organizationId } = job.data;
      console.log(`📤 Processing broadcast: ${broadcastId}`);
      await broadcastService.processBroadcast(broadcastId, organizationId);
      console.log(`✅ Broadcast completed: ${broadcastId}`);
    },
    {
      connection: redis,
      concurrency: 1,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`❌ Broadcast job failed: ${job?.id}`, err.message);
  });

  console.log('✅ Broadcast worker started');
  return worker;
}
