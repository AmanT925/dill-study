import { AgentMailClient } from "agentmail";

let client: any = null;

export function initAgentMail(apiKey?: string) {
  const key = apiKey ?? process.env.AGENTMAIL_API_KEY;
  if (!key) throw new Error("Missing AGENTMAIL_API_KEY");
  client = new AgentMailClient({ apiKey: key });
}

function getClient() {
  if (!client) throw new Error("AgentMail client not initialized. Call initAgentMail()");
  return client;
}

export async function createInbox(opts: { username?: string; domain?: string } = {}) {
  const res = await getClient().inboxes.create(opts);
  return res.data;
}

export async function getInbox(inboxId: string) {
  const res = await getClient().inboxes.get(inboxId);
  return res.data;
}

export async function sendMessage(fromInboxId: string, to: string, subject: string, text: string) {
  const res = await getClient().inboxes.messages.send(fromInboxId, { to, subject, text });
  return res;
}

export async function sendReminder(fromInbox: string, to: string, assignmentTitle: string, dueAt: Date, hoursBefore: number) {
  const subject = `Reminder: "${assignmentTitle}" due in ${hoursBefore} hour${hoursBefore === 1 ? "" : "s"}`;
  const text = `Hi,\n\nThis is an automated reminder that the assignment "${assignmentTitle}" is due at ${dueAt.toISOString()} (in approximately ${hoursBefore} hours).\n\nIf you've already submitted, please ignore this message.\n\n— Automated reminders`;
  return sendMessage(fromInbox, to, subject, text);
}
