import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import { AgentMailClient } from 'agentmail';

const FROM_INBOX = process.env.FROM_INBOX;
if (!FROM_INBOX) {
  console.error('Missing FROM_INBOX in .env');
  process.exit(1);
}
const API_KEY = process.env.AGENTMAIL_API_KEY;
if (!API_KEY) {
  console.error('Missing AGENTMAIL_API_KEY in .env');
  process.exit(1);
}

const client = new AgentMailClient({ apiKey: API_KEY });

// runtime flags for testing
const TEST_MINUTES_MODE = process.env.TEST_MINUTES_MODE === 'true';
const TEST_WINDOWS = process.env.TEST_WINDOWS ? process.env.TEST_WINDOWS.split(',').map((s) => Number(s)) : (TEST_MINUTES_MODE ? [1, 2] : [24, 2]);
const TEST_WINDOW_MINUTES = process.env.TEST_WINDOW_MINUTES ? Number(process.env.TEST_WINDOW_MINUTES) : 10;
const TEST_DRY_RUN = process.env.TEST_DRY_RUN !== 'false'; // default true

function withinWindow(now, due, target, windowMinutes = TEST_WINDOW_MINUTES, unit = TEST_MINUTES_MODE ? 'minutes' : 'hours') {
  const diffMs = due.getTime() - now.getTime();
  if (unit === 'hours') {
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.abs(diffHours - target) <= windowMinutes / 60;
  }
  const diffMinutes = diffMs / (1000 * 60);
  return Math.abs(diffMinutes - target) <= windowMinutes;
}

async function sendReminder(from, to, title, dueAt, hoursOrMinutes) {
  const unitLabel = TEST_MINUTES_MODE ? 'minute' + (hoursOrMinutes === 1 ? '' : 's') : 'hour' + (hoursOrMinutes === 1 ? '' : 's');
  const subject = `Reminder: "${title}" due in ${hoursOrMinutes} ${unitLabel}`;
  const text = `Hi,\n\nThis is an automated reminder that the assignment "${title}" is due at ${dueAt.toISOString()} (in approximately ${hoursOrMinutes} ${unitLabel}).\n\nIf you've already submitted, please ignore this message.`;
  console.log(`Prepared reminder to ${to} for ${title} (~${hoursOrMinutes} ${unitLabel})`);
  if (TEST_DRY_RUN) {
    console.log('Dry-run mode: not sending (set TEST_DRY_RUN=false to enable actual sends)');
    return { dryRun: true };
  }
  return client.inboxes.messages.send(from, { to, subject, text });
}

async function run() {
  const samplePath = path.resolve(process.cwd(), 'data', 'sample-assignments.json');
  if (!fs.existsSync(samplePath)) {
    console.log('No sample-assignments.json found. Nothing to do.');
    return;
  }
  const raw = fs.readFileSync(samplePath, 'utf8');
  const assignments = JSON.parse(raw);
  const now = new Date();
  const windows = TEST_WINDOWS;
  let sent = 0;
  console.log(`Now=${now.toISOString()} mode=${TEST_MINUTES_MODE ? 'minutes' : 'hours'} windows=${JSON.stringify(windows)} tolerance=${TEST_WINDOW_MINUTES}min dryRun=${TEST_DRY_RUN}`);
  for (const target of windows) {
    for (const asg of assignments) {
      if (asg.completed) continue;
      if (!asg.student || !asg.student.email) continue;
      if (asg.student.contact_opt_out) continue;
      const due = new Date(asg.dueAt);
      if (Number.isNaN(due.getTime())) continue;
      const diffMinutes = Math.round((due.getTime() - now.getTime()) / (1000 * 60));
      const matches = withinWindow(now, due, target);
      console.log(`- assignment=${asg.id} title="${asg.title}" due=${due.toISOString()} diffMinutes=${diffMinutes} matchTarget=${target} => ${matches}`);
      if (matches) {
        try {
          const res = await sendReminder(FROM_INBOX, asg.student.email, asg.title, due, target);
          if (!TEST_DRY_RUN) sent++;
          await new Promise((r) => setTimeout(r, 100));
        } catch (err) {
          console.error('Send failed for', asg.student.email, err?.message ?? err);
        }
      }
    }
  }
  console.log(`Done. Sent ${sent} reminders.`);
}

run().catch((e) => {
  console.error('Job failed:', e?.message ?? e);
  process.exit(1);
});
