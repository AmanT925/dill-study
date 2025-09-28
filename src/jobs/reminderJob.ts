import "dotenv/config";
import { initAgentMail, sendReminder } from "../lib/agentmailClient";

export type Student = { id: string; name?: string; email: string; contact_opt_out?: boolean };
export type Assignment = { id: string; title: string; dueAt: string | Date; student: Student; completed: boolean };

export type AssignmentProvider = { fetchIncompleteAssignments: () => Promise<Assignment[]> };

// Default provider returns empty list; tests will inject a mock provider
export const defaultProvider: AssignmentProvider = {
  async fetchIncompleteAssignments() {
    return [];
  },
};

const WINDOW_MINUTES = 10; // +/- window in minutes

function withinWindow(now: Date, due: Date, target: number, windowMinutes = WINDOW_MINUTES, unit: "hours" | "minutes" = "hours") {
  const diffMs = due.getTime() - now.getTime();
  if (unit === "hours") {
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.abs(diffHours - target) <= windowMinutes / 60;
  }
  // minutes
  const diffMinutes = diffMs / (1000 * 60);
  return Math.abs(diffMinutes - target) <= windowMinutes;
}

export type RunOptions = {
  windows?: number[]; // list of numeric targets (hours or minutes depending on unit)
  unit?: "hours" | "minutes";
  windowMinutes?: number; // +/- tolerance in minutes
};

export async function runReminderJob(provider: AssignmentProvider = defaultProvider, options: RunOptions = {}) {
  const now = new Date();
  const inbox = process.env.FROM_INBOX;
  if (!inbox) throw new Error("Missing FROM_INBOX in env. Set e.g. FROM_INBOX=dill@agentmail.to");

  initAgentMail();

  const all = await provider.fetchIncompleteAssignments();
  const targets = all.filter((a) => !a.completed && a.student && a.student.email && !a.student.contact_opt_out);

  const unit = options.unit ?? "hours";
  const windows = options.windows ?? (unit === "hours" ? [24, 2] : [1, 2]);
  const tolerance = options.windowMinutes ?? WINDOW_MINUTES;

  let sent = 0;
  for (const target of windows) {
    for (const asg of targets) {
      const due = typeof asg.dueAt === "string" ? new Date(asg.dueAt) : (asg.dueAt as Date);
      if (Number.isNaN(due.getTime())) continue;
      if (withinWindow(now, due, target, tolerance, unit)) {
        try {
          await sendReminder(inbox, asg.student.email, asg.title, due, target);
          sent++;
          await new Promise((r) => setTimeout(r, 50));
        } catch (err: any) {
          console.error("Failed sending reminder", { assignment: asg.id, to: asg.student.email, err: err?.message ?? err });
        }
      }
    }
  }

  console.log(`Reminder job complete. Sent ${sent} reminders.`);
  return sent;
}

// If run directly, use default provider (no assignments)
if (require.main === module) {
  (async () => {
    try {
      await runReminderJob();
    } catch (err: any) {
      console.error("Reminder job failed:", err?.message ?? err);
      process.exitCode = 1;
    }
  })();
}
