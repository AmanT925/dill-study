import dotenv from 'dotenv';
dotenv.config();
import { AgentMailClient } from 'agentmail';

const API_KEY = process.env.AGENTMAIL_API_KEY;
const FROM_INBOX = process.env.FROM_INBOX; // e.g., dill@agentmail.to or an inbox id
const TO_EMAIL = process.env.TO_EMAIL;

if (!API_KEY) {
  console.error('Missing AGENTMAIL_API_KEY in environment');
  process.exit(1);
}
if (!FROM_INBOX) {
  console.error('Missing FROM_INBOX in environment');
  process.exit(1);
}
if (!TO_EMAIL) {
  console.error('Missing TO_EMAIL in environment');
  process.exit(1);
}

const client = new AgentMailClient({ apiKey: API_KEY });

function parseInbox(from) {
  const m = String(from).match(/^([^@]+)@(.+)$/);
  if (!m) return null;
  return { username: m[1], domain: m[2] };
}

async function ensureInbox(from) {
  // If FROM_INBOX is an email-like string, try to create it if needed
  const parsed = parseInbox(from);
  if (!parsed) return from; // assume it's an inbox id
  try {
    // Try a lightweight no-op: get inbox by id/email may not be supported; create will just create if not exists
    console.log(`Ensuring inbox ${from} exists...`);
    const res = await client.inboxes.create({ username: parsed.username, domain: parsed.domain });
    console.log('Inbox ready:', res);
  } catch (e) {
    // If already exists or cannot create, continue; sending may still work if it exists
    console.log('Create inbox returned error (might already exist):', e?.response?.data || e?.message || e);
  }
  return from;
}

async function run() {
  try {
    const from = await ensureInbox(FROM_INBOX);
    console.log(`Sending test email from ${from} to ${TO_EMAIL}...`);
    const res = await client.inboxes.messages.send(from, {
      to: TO_EMAIL,
      subject: 'Dill test: Hello from AgentMail',
      text: 'This is a one-off test message sent via AgentMail.'
    });
    console.log('Send response:', res);
    console.log('Done. Check your inbox.');
  } catch (e) {
    console.error('Send failed:', e?.response?.data || e?.message || e);
    process.exit(1);
  }
}

run();
