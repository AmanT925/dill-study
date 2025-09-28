import 'dotenv/config';
import { runReminderJob } from '../src/jobs/reminderJob.js';
import firebaseProvider from '../src/lib/firebaseProvider.js';

const TEST_MINUTES_MODE = process.env.TEST_MINUTES_MODE === 'true';
const DRY = process.env.TEST_DRY_RUN !== 'false';

(async () => {
  try {
    console.log('Running reminder job using Firebase provider. Dry-run=', DRY);
    await runReminderJob(firebaseProvider, { unit: TEST_MINUTES_MODE ? 'minutes' : 'hours', windows: TEST_MINUTES_MODE ? [1,2] : [24,2], windowMinutes: Number(process.env.TEST_WINDOW_MINUTES || 10) });
    console.log('Done.');
  } catch (e) {
    console.error('Error running reminders:', e?.message ?? e);
    process.exit(1);
  }
})();
