import 'dotenv/config';
import http from 'node:http';
import { AgentMailClient } from 'agentmail';
import { db } from './firebase_init.mjs';
import { collection, doc, getDoc, getDocs, query, where, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';

const PORT = Number(process.env.MANUAL_SEND_PORT || 8787);
const FROM_INBOX = process.env.FROM_INBOX;
const API_KEY = process.env.AGENTMAIL_API_KEY;

if (!API_KEY) {
  console.error('Missing AGENTMAIL_API_KEY in environment.');
  process.exit(1);
}
if (!FROM_INBOX) {
  console.error('Missing FROM_INBOX in environment.');
  process.exit(1);
}

const client = new AgentMailClient({ apiKey: API_KEY });

async function findAssignmentByPdf(userId, pdfId) {
  const assignmentsCol = collection(db, 'assignments');
  const q = query(assignmentsCol, where('student_id', '==', userId), where('completed', '==', false));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const data = d.data();
    if (data?.metadata?.pdfId === pdfId) {
      return { id: d.id, data };
    }
  }
  return null;
}

async function logSend({ reminderId = null, assignmentId = null, toEmail, fromInbox, messageId = null, status, error = null }) {
  const logs = collection(db, 'send_logs');
  await addDoc(logs, { reminder_id: reminderId, assignment_id: assignmentId, to_email: toEmail, from_inbox: fromInbox, message_id: messageId, status, error, created_at: serverTimestamp() });
}

async function handleManualSend(payload) {
  // payload: { assignmentId } or { pdfId, userId }
  let assignmentDoc = null;
  if (payload.assignmentId) {
    const ref = doc(db, 'assignments', String(payload.assignmentId));
    const snap = await getDoc(ref);
    if (!snap.exists()) return { ok: false, error: 'assignment_not_found' };
    assignmentDoc = { id: snap.id, data: snap.data() };
  } else if (payload.pdfId && payload.userId) {
    const found = await findAssignmentByPdf(String(payload.userId), String(payload.pdfId));
    if (!found) return { ok: false, error: 'assignment_not_found' };
    assignmentDoc = found;
  } else {
    return { ok: false, error: 'missing_parameters' };
  }

  const a = assignmentDoc.data;
  const due = a.due_at instanceof Timestamp ? a.due_at.toDate() : (a.due_at ? new Date(a.due_at) : null);
  const studentId = a.student_id;
  const uref = doc(db, 'users', String(studentId));
  const us = await getDoc(uref);
  if (!us.exists()) return { ok: false, error: 'user_not_found' };
  const ud = us.data();
  const toEmail = ud.email;
  if (!toEmail) return { ok: false, error: 'missing_email' };

  const subject = `Reminder: "${a.title}"${due ? ` due at ${due.toISOString()}` : ''}`;
  const text = `Hi,\n\nThis is a manual reminder for the assignment "${a.title}"${due ? `, due at ${due.toISOString()}` : ''}.\n\n— Automated reminders`;
  const res = await client.inboxes.messages.send(FROM_INBOX, { to: toEmail, subject, text });
  const messageId = res?.data?.id || res?.id || null;
  await logSend({ assignmentId: assignmentDoc.id, toEmail, fromInbox: FROM_INBOX, messageId, status: 'sent' });
  return { ok: true, messageId, toEmail };
}

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }
  if (req.method === 'POST' && req.url === '/manual-send') {
    try {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = body ? JSON.parse(body) : {};
          const result = await handleManualSend(payload);
          if (!result.ok) return send(res, 400, { error: result.error });
          return send(res, 200, { messageId: result.messageId, toEmail: result.toEmail });
        } catch (e) {
          console.error('manual-send handler error:', e);
          return send(res, 500, { error: e?.message || 'internal_error' });
        }
      });
    } catch (e) {
      console.error('manual-send error:', e);
      return send(res, 500, { error: e?.message || 'internal_error' });
    }
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(PORT, () => {
  console.log(`Manual send server listening on http://localhost:${PORT}`);
});
