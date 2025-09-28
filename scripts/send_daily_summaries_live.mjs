import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import { AgentMailClient } from 'agentmail';

const FROM_INBOX = process.env.FROM_INBOX;
if (!FROM_INBOX) {
  console.error('Missing FROM_INBOX in .env');
  process.exit(1);
}
const API_KEY = process.env.AGENTMAIL_API_KEY;
if (!API_KEY) {
  console.error('Missing AGENTMAIL_API_KEY in .env');
  process.exit(1);
}

const client = new AgentMailClient({ apiKey: API_KEY });

const TEST_DRY_RUN = process.env.TEST_DRY_RUN !== 'false';
const TOP_N = process.env.SUMMARY_TOP_N ? Number(process.env.SUMMARY_TOP_N) : 5;

function formatDate(d) {
  return new Date(d).toLocaleString();
}

async function sendSummary(to, subject, body) {
  console.log(`Prepared summary for ${to}: ${subject}\n---\n${body}\n---`);
  if (TEST_DRY_RUN) {
    console.log('Dry-run: not sending. Set TEST_DRY_RUN=false to enable.');
    return { dryRun: true };
  }
  return client.inboxes.messages.send(FROM_INBOX, { to, subject, text: body });
}

function summarizeAssignments(assignments) {
  // map by student email
  const byEmail = new Map();
  const now = new Date();
  for (const a of assignments) {
    if (!a.student || !a.student.email) continue;
    const email = a.student.email;
    if (!byEmail.has(email)) byEmail.set(email, []);
    byEmail.get(email).push(a);
  }

  const summaries = [];
  for (const [email, list] of byEmail.entries()) {
    const current = list.filter((x) => !x.completed && new Date(x.dueAt) >= now);
    const past = list.filter((x) => !x.completed && new Date(x.dueAt) < now);
    const completed = list.filter((x) => x.completed);
    // sort upcoming by due date
    current.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    const upcoming = current.slice(0, TOP_N).map((x) => ({ id: x.id, title: x.title, dueAt: x.dueAt }));
    summaries.push({ email, counts: { current: current.length, past: past.length, completed: completed.length }, upcoming });
  }
  return summaries;
}

async function run() {
  const samplePath = path.resolve(process.cwd(), 'data', 'sample-assignments.json');
  if (!fs.existsSync(samplePath)) {
    console.log('No assignments found.');
    return;
  }
  const raw = fs.readFileSync(samplePath, 'utf8');
  const assignments = JSON.parse(raw);
  const summaries = summarizeAssignments(assignments);
  for (const s of summaries) {
    const body = [];
    body.push(`Hi,`);
    body.push('');
    body.push(`You have ${s.counts.current} current assignment(s) due and ${s.counts.past} overdue assignment(s).`);
    body.push(`You have completed ${s.counts.completed} assignment(s).`);
    body.push('');
    if (s.upcoming.length) {
      body.push(`Upcoming (${s.upcoming.length}):`);
      for (const u of s.upcoming) {
        body.push(`- ${u.title} — due ${formatDate(u.dueAt)}`);
      }
    } else {
      body.push('No upcoming assignments.');
    }
    body.push('');
    body.push('— This is an automated summary.');

    await sendSummary(s.email, `Your assignments summary — ${s.counts.current} due`, body.join('\n'));
    await new Promise((r) => setTimeout(r, 50));
  }
  console.log('Summaries processed:', summaries.length);
}

run().catch((e) => {
  console.error('Summary job failed:', e?.message ?? e);
  process.exit(1);
});
