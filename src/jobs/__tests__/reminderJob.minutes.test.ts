import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../../lib/agentmailClient", async () => {
  return {
    initAgentMail: vi.fn(),
    sendReminder: vi.fn().mockResolvedValue({ ok: true }),
  };
});

import { runReminderJob } from "../reminderJob";
import * as agent from "../../lib/agentmailClient";

const makeAssignmentMinutes = (minutesFromNow: number, email = "t@example.com") => {
  const due = new Date(Date.now() + minutesFromNow * 60 * 1000);
  return {
    id: `m${minutesFromNow}`,
    title: `Test in ${minutesFromNow}m`,
    dueAt: due.toISOString(),
    student: { id: "s", email },
    completed: false,
  };
};

describe("reminder job minute windows", () => {
  beforeEach(() => {
    process.env.FROM_INBOX = "dill@agentmail.to";
    vi.clearAllMocks();
  });

  it("sends reminders for 1 and 2 minute windows", async () => {
    const provider = {
      fetchIncompleteAssignments: vi.fn().mockResolvedValue([
        makeAssignmentMinutes(1),
        makeAssignmentMinutes(2),
        makeAssignmentMinutes(5),
      ]),
    };

  const sent = await runReminderJob(provider, { unit: "minutes", windows: [1, 2], windowMinutes: 0.5 });
    expect((agent as any).sendReminder).toHaveBeenCalledTimes(2);
    expect(sent).toBe(2);
  });
});
