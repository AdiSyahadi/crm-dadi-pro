import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import { scheduledMessageService } from '../services/scheduled-message.service';

export function startScheduledMessageWorker() {
  const worker = new Worker(
    'scheduled-messages',
    async (job) => {
      const { scheduleId } = job.data;
      console.log(`⏰ Processing scheduled message: ${scheduleId}`);
      await scheduledMessageService.executeSchedule(scheduleId);
      console.log(`✅ Scheduled message completed: ${scheduleId}`);
    },
    {
      connection: redis,
      concurrency: 1,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`❌ Scheduled message job failed: ${job?.id}`, err.message);
  });

  console.log('✅ Scheduled message worker started');
  return worker;
}
