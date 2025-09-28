import 'dotenv/config';
import { AgentMailClient } from 'agentmail';

const API_KEY = process.env.AGENTMAIL_API_KEY;
const FROM_INBOX = process.env.FROM_INBOX;
const DEFAULT_TO = process.env.TO_EMAIL;

if (!API_KEY || !FROM_INBOX) {
  console.error('Missing env: require AGENTMAIL_API_KEY, FROM_INBOX');
  process.exit(1);
}

const client = new AgentMailClient({ apiKey: API_KEY });

function parseArgs(argv) {
  const out = { to: undefined, subject: undefined, text: undefined };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const val = argv[i + 1];
    if (a === '--to') { out.to = val; i++; }
    else if (a === '--subject') { out.subject = val; i++; }
    else if (a === '--text') { out.text = val; i++; }
  }
  return out;
}

async function main() {
  try {
    const args = parseArgs(process.argv);
    const toAddr = args.to || DEFAULT_TO;
    if (!toAddr) {
      throw new Error('Missing recipient: pass --to or set TO_EMAIL in env');
    }
    const subject = args.subject || 'Draft test – review before send';
    const text = args.text || 'Hello from a Draft. This was prepared and will be sent now.';
    console.log('Creating draft...');
    const draft = await client.inboxes.drafts.create(FROM_INBOX, {
      to: [toAddr],
      subject,
      text
    });
  console.log('Draft created:', draft);

    console.log('Sending draft...');
    // SDK returns { data, rawResponse } for HTTP response wrappers in cjs build
    const draftId = draft?.data?.id || draft?.id || draft?.data?.draftId || draft?.draftId || draft?.draft_id;
    if (!draftId) {
      throw new Error('Could not determine draftId from create response');
    }
    let sent;
    // Per SDK signature: send(inboxId, draftId, { addLabels?, removeLabels? })
    sent = await client.inboxes.drafts.send(FROM_INBOX, draftId, {});
    console.log('Draft sent -> message:', sent);
  } catch (e) {
    console.error('Draft flow failed:', e?.response?.data || e?.message || e);
    process.exit(1);
  }
}

main();
