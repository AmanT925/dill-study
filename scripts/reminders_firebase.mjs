import 'dotenv/config';
import './firebase_init.mjs';
import { runFirebaseReminderJobRuntime } from './reminderJob.firebase.runtime.mjs';

const unit = process.env.TEST_MINUTES_MODE === 'true' ? 'minutes' : 'hours';
const windows = process.env.TEST_WINDOWS ? process.env.TEST_WINDOWS.split(',').map(Number) : (unit === 'minutes' ? [1, 2] : [24, 2]);
const windowMinutes = Number(process.env.TEST_WINDOW_MINUTES || (unit === 'minutes' ? 1 : 10));
const windowsMixed = process.env.TEST_WINDOWS_MIXED ? process.env.TEST_WINDOWS_MIXED.split(',') : undefined;

(async () => {
  try {
  console.log('Starting Firebase reminder job', { unit, windows, windowsMixed, windowMinutes, inbox: process.env.FROM_INBOX });
  const sent = await runFirebaseReminderJobRuntime({ unit, windows, windowsMixed, windowMinutes });
    console.log(`Firebase reminder job complete. Sent ${sent} reminders.`);
  } catch (e) {
    console.error('Firebase reminder job failed:', e?.message || e);
    process.exit(1);
  }
})();
