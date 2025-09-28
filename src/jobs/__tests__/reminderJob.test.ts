import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock the agentmail wrapper so we don't call the real API
vi.mock("../../lib/agentmailClient", async () => {
  return {
    initAgentMail: vi.fn(),
    sendReminder: vi.fn().mockResolvedValue({ ok: true }),
  };
});

import { runReminderJob } from "../reminderJob";
import * as agent from "../../lib/agentmailClient";

const makeAssignment = (hoursFromNow: number, email = "t@example.com") => {
  const due = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  return {
    id: "x",
    title: "Test HW",
    dueAt: due.toISOString(),
    student: { id: "s", email },
    completed: false,
  };
};

describe("reminder job", () => {
  beforeEach(() => {
    process.env.FROM_INBOX = "dill@agentmail.to";
    vi.clearAllMocks();
  });

  it("sends reminders for 24h and 2h windows", async () => {
    const provider = {
      fetchIncompleteAssignments: vi.fn().mockResolvedValue([
        makeAssignment(24),
        makeAssignment(2),
        makeAssignment(3),
      ]),
    };

    const sent = await runReminderJob(provider);
    expect((agent as any).sendReminder).toHaveBeenCalledTimes(2);
    expect(sent).toBe(2);
  });
});
