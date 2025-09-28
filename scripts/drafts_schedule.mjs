import 'dotenv/config';
import { AgentMailClient } from 'agentmail';

const API_KEY = process.env.AGENTMAIL_API_KEY;
const FROM_INBOX = process.env.FROM_INBOX;
const TO_EMAIL = process.env.TO_EMAIL;

if (!API_KEY || !FROM_INBOX || !TO_EMAIL) {
  console.error('Missing env: require AGENTMAIL_API_KEY, FROM_INBOX, TO_EMAIL');
  process.exit(1);
}

function parseArgs(argv) {
  const args = { minutes: undefined, at: undefined, subject: undefined, text: undefined, addLabels: [], removeLabels: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const val = argv[i + 1];
    if (a === '--minutes') { args.minutes = Number(val); i++; }
    else if (a === '--at') { args.at = val; i++; }
    else if (a === '--subject') { args.subject = val; i++; }
    else if (a === '--text') { args.text = val; i++; }
    else if (a === '--addLabel') { args.addLabels.push(val); i++; }
    else if (a === '--removeLabel') { args.removeLabels.push(val); i++; }
  }
  return args;
}

function resolveSendAt({ minutes, at }) {
  if (minutes != null && !Number.isNaN(minutes)) {
    const d = new Date();
    d.setMinutes(d.getMinutes() + minutes);
    return d;
  }
  if (at) {
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) throw new Error('Invalid --at value; use ISO like 2025-09-28T02:40:00Z');
    return d;
  }
  throw new Error('Provide either --minutes N or --at ISO');
}

async function main() {
  try {
    const args = parseArgs(process.argv);
    const sendAt = resolveSendAt(args);
    const subject = args.subject || 'Scheduled Draft Test';
    const text = args.text || `This draft is scheduled for ${sendAt.toISOString()}.`;

    const client = new AgentMailClient({ apiKey: API_KEY });

    console.log('Creating scheduled draft...');
    const createRes = await client.inboxes.drafts.create(FROM_INBOX, {
      to: [TO_EMAIL],
      subject,
      text,
      sendAt,
      labels: ['draft']
    });

    console.log('Draft created:', createRes);

    // If you want to adjust labels at send time, you can later call send with add/remove labels.
    // For scheduled send, backend should handle sending at `sendAt` without explicit send call now.

    // Log a concise summary for clarity
    const draft = createRes?.data || createRes;
    console.log('Summary:', {
      inboxId: draft.inboxId,
      draftId: draft.draftId,
      subject: draft.subject,
      to: draft.to,
      sendAt: draft.sendAt,
      sendStatus: draft.sendStatus,
      labels: draft.labels,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    });

  } catch (e) {
    console.error('Schedule draft failed:', e?.response?.data || e?.message || e);
    process.exit(1);
  }
}

main();
