import 'dotenv/config';
import firebaseProvider from '@/lib/firebaseProvider';
import firebaseService from '@/lib/firebaseService';
import { initAgentMail, sendReminder } from '@/lib/agentmailClient';

type RunOptions = {
  unit?: 'hours' | 'minutes';
  windows?: number[];
  windowMinutes?: number;
};

function withinWindow(now: Date, due: Date, target: number, windowMinutes: number, unit: 'hours' | 'minutes') {
  const diffMs = due.getTime() - now.getTime();
  if (unit === 'hours') {
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.abs(diffHours - target) <= windowMinutes / 60;
  }
  const diffMinutes = diffMs / (1000 * 60);
  return Math.abs(diffMinutes - target) <= windowMinutes;
}

export async function runFirebaseReminderJob(options: RunOptions = {}) {
  const inbox = process.env.FROM_INBOX;
  if (!inbox) throw new Error('Missing FROM_INBOX in env');
  initAgentMail();

  const unit = options.unit ?? 'hours';
  const windows = options.windows ?? (unit === 'hours' ? [24, 2] : [1, 2]);
  const tolerance = options.windowMinutes ?? 10;
  const now = new Date();

  const all = await firebaseProvider.fetchIncompleteAssignments();
  const candidates = all.filter((a) => !a.completed && a.student && a.student.email && !a.student.contact_opt_out);

  let sent = 0;
  for (const target of windows) {
    for (const a of candidates) {
      const due = typeof a.dueAt === 'string' ? new Date(a.dueAt) : (a.dueAt as Date);
      if (!due || Number.isNaN(due.getTime())) continue;
      if (!withinWindow(now, due, target, tolerance, unit)) continue;

      const reminderKey = `${a.id}_${unit === 'hours' ? `${target}h` : `${target}m`}`;
      // schedule (idempotent) then send
      const scheduled = await firebaseService.scheduleReminder(a.id, unit === 'hours' ? `${target}h` : `${target}m`, due);
      try {
        const res = await sendReminder(inbox, a.student.email, a.title, due, target);
        const messageId = (res as any)?.data?.id || (res as any)?.id || undefined;
        await firebaseService.markReminderSent(scheduled.id, 'sent', messageId);
        await firebaseService.logSend({ reminderId: scheduled.id, assignmentId: a.id, toEmail: a.student.email, fromInbox: inbox, messageId, status: 'sent' });
        sent++;
        await new Promise((r) => setTimeout(r, 50));
      } catch (err: any) {
        const error = err?.message ?? String(err);
        await firebaseService.markReminderSent(scheduled.id, 'failed', undefined, error);
        await firebaseService.logSend({ reminderId: scheduled.id, assignmentId: a.id, toEmail: a.student.email, fromInbox: inbox, status: 'failed', error });
      }
    }
  }

  return sent;
}

export default runFirebaseReminderJob;
