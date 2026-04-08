import { prisma } from '../config/database';
import { notificationService } from '../services/notification.service';
import { getIO } from '../socket/io';

/**
 * Task Reminder Worker
 * Runs every 1 minute to check for tasks with reminder_at in the past that haven't been sent yet.
 * Also checks for overdue tasks (due_date passed) and sends a one-time overdue notification.
 */
export function startTaskReminderWorker(intervalMs = 60 * 1000) {
  setTimeout(() => runTaskReminderCheck(), 20_000);

  const timer = setInterval(() => runTaskReminderCheck(), intervalMs);

  console.log('✅ Task reminder worker started (check every 1 min)');
  return timer;
}

async function runTaskReminderCheck() {
  try {
    await processReminders();
    await processOverdue();
  } catch (err) {
    console.error('❌ Task reminder worker error:', err);
  }
}

async function processReminders() {
  const now = new Date();

  const tasks = await prisma.task.findMany({
    where: {
      reminder_at: { lte: now },
      reminder_sent: false,
      status: { in: ['TODO', 'IN_PROGRESS'] },
    },
    include: {
      contact: { select: { name: true } },
      deal: { select: { title: true } },
    },
    take: 50,
  });

  if (tasks.length === 0) return;

  for (const task of tasks) {
    try {
      const targetUserId = task.assigned_to_id || task.created_by_id;
      const extra = task.contact?.name
        ? ` (Kontak: ${task.contact.name})`
        : task.deal?.title
          ? ` (Deal: ${task.deal.title})`
          : '';

      await notificationService.create(
        targetUserId,
        'TASK_DUE',
        'Pengingat Tugas',
        `${task.title}${extra}`,
        { task_id: task.id }
      ).catch(() => {});

      // Emit realtime
      const io = getIO();
      if (io) {
        io.to(`user:${targetUserId}`).emit('task:reminder', {
          id: task.id,
          title: task.title,
          due_date: task.due_date,
        });
      }

      await prisma.task.update({
        where: { id: task.id },
        data: { reminder_sent: true },
      });
    } catch (err) {
      console.error(`  ❌ Failed to process reminder for task ${task.id}:`, err);
    }
  }

  console.log(`🔔 Sent ${tasks.length} task reminder(s)`);
}

async function processOverdue() {
  const now = new Date();
  // Find tasks that are overdue (due_date < now), still open, and reminder hasn't been sent
  // We reuse reminder_sent=false to avoid spamming — if reminder was already sent, skip overdue notification
  const overdueTasks = await prisma.task.findMany({
    where: {
      due_date: { lt: now },
      status: { in: ['TODO', 'IN_PROGRESS'] },
      reminder_sent: false,
      reminder_at: null, // Only for tasks without explicit reminder
    },
    include: {
      contact: { select: { name: true } },
      deal: { select: { title: true } },
    },
    take: 50,
  });

  if (overdueTasks.length === 0) return;

  for (const task of overdueTasks) {
    try {
      const targetUserId = task.assigned_to_id || task.created_by_id;
      const extra = task.contact?.name
        ? ` (Kontak: ${task.contact.name})`
        : task.deal?.title
          ? ` (Deal: ${task.deal.title})`
          : '';

      await notificationService.create(
        targetUserId,
        'TASK_DUE',
        'Tugas Terlambat!',
        `${task.title} sudah melewati deadline${extra}`,
        { task_id: task.id }
      ).catch(() => {});

      await prisma.task.update({
        where: { id: task.id },
        data: { reminder_sent: true },
      });
    } catch (err) {
      console.error(`  ❌ Failed to process overdue for task ${task.id}:`, err);
    }
  }

  console.log(`⚠️ Sent ${overdueTasks.length} overdue task notification(s)`);
}
