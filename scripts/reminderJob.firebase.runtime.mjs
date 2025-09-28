import 'dotenv/config';
import { db } from './firebase_init.mjs';
import { AgentMailClient } from 'agentmail';
import { collection, getDocs, query, where, doc, getDoc, Timestamp, setDoc, updateDoc, addDoc, increment, serverTimestamp } from 'firebase/firestore';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

async function fetchIncompleteAssignments() {
  const assignmentsCol = collection(db, 'assignments');
  const q = query(assignmentsCol, where('completed', '==', false));
  const snap = await getDocs(q);
  const items = [];
  for (const d of snap.docs) {
    const data = d.data();
    const due = data.due_at instanceof Timestamp ? data.due_at.toDate() : (data.due_at ? new Date(data.due_at) : null);
    const sid = data.student_id;
    if (!sid) continue;
    const uref = doc(db, 'users', String(sid));
    const us = await getDoc(uref);
    if (!us.exists()) continue;
    const ud = us.data();
    items.push({ id: d.id, title: data.title, dueAt: due, completed: !!data.completed, student: { id: String(sid), email: ud.email, contact_opt_out: !!ud.contact_opt_out } });
  }
  return items;
}

function withinWindow(now, due, target, windowMinutes, unit) {
  const diffMs = due.getTime() - now.getTime();
  if (unit === 'hours') {
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.abs(diffHours - target) <= windowMinutes / 60;
  }
  const diffMinutes = diffMs / (1000 * 60);
  return Math.abs(diffMinutes - target) <= windowMinutes;
}

async function scheduleReminder(assignmentId, reminderType, scheduledFor) {
  const id = `${assignmentId}_${reminderType}`;
  const ref = doc(db, 'reminders', id);
  const snap = await getDoc(ref);
  const payload = {
    assignment_id: assignmentId,
    reminder_type: reminderType,
    scheduled_for: Timestamp.fromDate(scheduledFor),
    status: 'pending',
    attempts: 0,
    last_error: null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  if (!snap.exists()) await setDoc(ref, payload); else await updateDoc(ref, { scheduled_for: payload.scheduled_for, updated_at: serverTimestamp() });
  return { id };
}

async function markReminderSent(reminderId, status, messageId, error) {
  const ref = doc(db, 'reminders', reminderId);
  const updates = { status, updated_at: serverTimestamp(), attempts: increment(1) };
  if (status === 'sent') updates.sent_at = serverTimestamp();
  if (messageId) updates.message_id = messageId;
  if (error) updates.last_error = error;
  try { await updateDoc(ref, updates); } catch { await setDoc(ref, updates, { merge: true }); }
}

async function logSend({ reminderId, assignmentId, toEmail, fromInbox, messageId, status, error }) {
  const logs = collection(db, 'send_logs');
  await addDoc(logs, { reminder_id: reminderId || null, assignment_id: assignmentId || null, to_email: toEmail, from_inbox: fromInbox, message_id: messageId || null, status, error: error || null, created_at: serverTimestamp() });
}

function parseMixedWindows(tokens) {
  const out = [];
  for (const t of tokens || []) {
    const m = String(t).trim().match(/^(\d+(?:\.\d+)?)(m|h)$/i);
    if (!m) continue;
    out.push({ target: Number(m[1]), unit: m[2].toLowerCase() === 'h' ? 'hours' : 'minutes' });
  }
  return out;
}

export async function runFirebaseReminderJobRuntime({ unit = 'minutes', windows = [1, 2], windowsMixed = undefined, windowMinutes = 1 } = {}) {
  const inbox = process.env.FROM_INBOX;
  if (!inbox) throw new Error('Missing FROM_INBOX');
  const now = new Date();
  const all = await fetchIncompleteAssignments();
  const candidates = all.filter((a) => !a.completed && a.student?.email && !a.student?.contact_opt_out);
  let sent = 0;
  const pairs = windowsMixed && windowsMixed.length ? parseMixedWindows(windowsMixed) : (windows || []).map((t) => ({ target: t, unit }));
  for (const { target, unit: u } of pairs) {
    for (const a of candidates) {
      const due = typeof a.dueAt === 'string' ? new Date(a.dueAt) : a.dueAt;
      if (!due || Number.isNaN(due.getTime())) continue;
      if (!withinWindow(now, due, target, windowMinutes, u)) continue;
      const reminderType = u === 'hours' ? `${target}h` : `${target}m`;
      const scheduled = await scheduleReminder(a.id, reminderType, due);
      try {
        const res = await client.inboxes.messages.send(inbox, { to: a.student.email, subject: `Reminder: "${a.title}" due in ${target} ${u === 'hours' ? 'hour' : 'minute'}${target === 1 ? '' : 's'}`, text: `Hi,\n\n"${a.title}" is due at ${due.toISOString()} (in about ${target} ${u}).\n\n— Automated reminders` });
        const messageId = res?.data?.id || res?.id;
        await markReminderSent(scheduled.id, 'sent', messageId);
        await logSend({ reminderId: scheduled.id, assignmentId: a.id, toEmail: a.student.email, fromInbox: inbox, messageId, status: 'sent' });
        sent++;
      } catch (e) {
        const err = e?.message || String(e);
        await markReminderSent(scheduled.id, 'failed', undefined, err);
        await logSend({ reminderId: scheduled.id, assignmentId: a.id, toEmail: a.student.email, fromInbox: inbox, status: 'failed', error: err });
      }
    }
  }
  // Process any manually queued reminders immediately
  async function processManualReminders() {
    const remindersCol = collection(db, 'reminders');
    // Query only by type to avoid composite index requirements; filter status client-side
    const q = query(remindersCol, where('reminder_type', '==', 'manual'));
    const snap = await getDocs(q);
    console.log(`[manual] found ${snap.size} manual reminders, filtering pending…`);
    for (const d of snap.docs) {
      const r = d.data();
      if (r.status !== 'pending') continue;
      const reminderId = d.id;
      const assignmentId = r.assignment_id;
      try {
        console.log(`[manual] processing ${reminderId} for assignment ${assignmentId}`);
        const aref = doc(db, 'assignments', String(assignmentId));
        const as = await getDoc(aref);
        if (!as.exists()) {
          await markReminderSent(reminderId, 'failed', undefined, 'assignment_not_found');
          continue;
        }
        const a = as.data();
        const due = a.due_at instanceof Timestamp ? a.due_at.toDate() : (a.due_at ? new Date(a.due_at) : null);
        const sid = a.student_id;
        const uref = doc(db, 'users', String(sid));
        const us = await getDoc(uref);
        if (!us.exists()) {
          await markReminderSent(reminderId, 'failed', undefined, 'user_not_found');
          continue;
        }
        const ud = us.data();
        const toEmail = ud.email;
        if (!toEmail) {
          await markReminderSent(reminderId, 'failed', undefined, 'missing_email');
          continue;
        }
        const subject = `Reminder: "${a.title}"${due ? ` due at ${due.toISOString()}` : ''}`;
        const text = `Hi,\n\nThis is a manual reminder for the assignment "${a.title}"${due ? `, due at ${due.toISOString()}` : ''}.\n\n— Automated reminders`;
        const res = await client.inboxes.messages.send(inbox, { to: toEmail, subject, text });
        const messageId = res?.data?.id || res?.id;
        await markReminderSent(reminderId, 'sent', messageId);
        await logSend({ reminderId, assignmentId, toEmail, fromInbox: inbox, messageId, status: 'sent' });
        sent++;
      } catch (e) {
        const err = e?.message || String(e);
        await markReminderSent(reminderId, 'failed', undefined, err);
        await logSend({ reminderId, assignmentId, toEmail: 'unknown', fromInbox: inbox, status: 'failed', error: err });
      }
    }
  }
  await processManualReminders();
  return sent;
}

export default { runFirebaseReminderJobRuntime };
