import 'dotenv/config';
import { runFirebaseReminderJob } from './reminderJob.firebase';

(async () => {
  try {
    const unit = (process.env.TEST_MINUTES_MODE === 'true') ? 'minutes' : 'hours';
    const windows = process.env.TEST_WINDOWS ? process.env.TEST_WINDOWS.split(',').map((s) => Number(s)) : (unit === 'minutes' ? [1, 2] : [24, 2]);
    const windowMinutes = process.env.TEST_WINDOW_MINUTES ? Number(process.env.TEST_WINDOW_MINUTES) : 10;

    const sent = await runFirebaseReminderJob({ unit: unit as any, windows, windowMinutes });
    console.log(`Firebase reminder job complete. Sent ${sent} reminders.`);
  } catch (e: any) {
    console.error('Firebase reminder job failed:', e?.message ?? e);
    process.exit(1);
  }
})();
