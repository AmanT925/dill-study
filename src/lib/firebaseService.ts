import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  Timestamp,
  increment,
} from 'firebase/firestore';

/** Find a user by email or create one (returns user id) */
export async function addOrGetUserByEmail(email: string, name?: string) {
  const usersCol = collection(db, 'users');
  const q = query(usersCol, where('email', '==', email));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const d = snap.docs[0];
    return d.id;
  }
  const res = await addDoc(usersCol, {
    email,
    name: name || null,
    timezone: null,
    contact_opt_out: false,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return res.id;
}

/** Types used by the reminder job and DB layer */
export type Student = { id: string; name?: string; email: string; timezone?: string; contact_opt_out?: boolean };
export type Assignment = { id?: string; title: string; dueAt: string | Date; studentId: string; completed?: boolean; metadata?: any };

/** Ensure a user document exists for a Google account (create or update) */
export async function ensureUserFromGoogle(payload: { uid: string; email: string; name?: string; timezone?: string }) {
  const usersCol = collection(db, 'users');
  const userRef = doc(db, 'users', payload.uid);
  const snap = await getDoc(userRef);
  const now = serverTimestamp();
  const data = {
    email: payload.email,
    name: payload.name ?? null,
    timezone: payload.timezone ?? null,
    contact_opt_out: false,
    updated_at: now,
  } as any;
  if (!snap.exists()) {
    await setDoc(userRef, { ...data, created_at: now });
  } else {
    await updateDoc(userRef, data);
  }
  return { id: payload.uid, ...data } as Student;
}

/** Attach an uploaded document (store meta and owner) */
export async function attachUpload(userId: string, uploadMeta: { filename: string; url?: string; size?: number; mimetype?: string }) {
  const uploadsCol = collection(db, 'uploads');
  const res = await addDoc(uploadsCol, {
    user_id: userId,
    filename: uploadMeta.filename,
    url: uploadMeta.url || null,
    size: uploadMeta.size || null,
    mimetype: uploadMeta.mimetype || null,
    created_at: serverTimestamp(),
  });
  return { id: res.id };
}

/** Fetch a user document by id */
export async function getUserById(userId: string): Promise<Student | null> {
  const ref = doc(db, 'users', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data() as any;
  return {
    id: userId,
    email: d.email,
    name: d.name || d.displayName || null,
    timezone: d.timezone || null,
    contact_opt_out: !!d.contact_opt_out,
  } as Student;
}

/** Create an assignment attached to a student */
export async function createAssignment(a: Assignment) {
  const assignmentsCol = collection(db, 'assignments');
  const due = typeof a.dueAt === 'string' ? new Date(a.dueAt) : (a.dueAt as Date);
  const res = await addDoc(assignmentsCol, {
    title: a.title,
    due_at: Timestamp.fromDate(due),
    student_id: a.studentId,
    completed: !!a.completed,
    metadata: a.metadata || null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return { id: res.id };
}

/** Find the latest (incomplete) assignment for a given user and pdfId */
export async function findAssignmentByPdf(userId: string, pdfId: string): Promise<Assignment | null> {
  const assignmentsCol = collection(db, 'assignments');
  // Avoid potential composite index requirement by querying simple fields and filtering client-side for metadata.pdfId
  const q = query(assignmentsCol, where('student_id', '==', userId), where('completed', '==', false));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const match = snap.docs
    .map((d) => ({ id: d.id, data: d.data() as any }))
    .find((x) => x.data?.metadata?.pdfId === pdfId);
  if (!match) return null;
  const data = match.data;
  const due = data.due_at instanceof Timestamp ? data.due_at.toDate() : (data.due_at ? new Date(data.due_at) : null);
  return { id: match.id, title: data.title, dueAt: due, studentId: data.student_id, completed: data.completed, metadata: data.metadata } as Assignment;
}

/** Create an immediate 'manual' reminder record for an assignment */
export async function requestManualReminder(assignmentId: string) {
  const when = new Date();
  return scheduleReminder(assignmentId, 'manual', when);
}

/** Find the latest (by updated_at or due_at) incomplete assignment for a user */
export async function findLatestIncompleteAssignmentForUser(userId: string): Promise<Assignment | null> {
  const assignmentsCol = collection(db, 'assignments');
  const q = query(assignmentsCol, where('student_id', '==', userId), where('completed', '==', false));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  // Pick the one with most recent updated_at, fallback to closest due_at in the future
  let best: { docId: string; data: any } | null = null;
  const items: { docId: string; data: any }[] = [];
  snap.forEach((d) => items.push({ docId: d.id, data: d.data() }));
  // Attempt to sort by updated_at desc
  items.sort((a, b) => {
    const au = a.data.updated_at?.toMillis ? a.data.updated_at.toMillis() : 0;
    const bu = b.data.updated_at?.toMillis ? b.data.updated_at.toMillis() : 0;
    return bu - au;
  });
  best = items[0] || null;
  if (!best) return null;
  const data = best.data;
  const due = data.due_at instanceof Timestamp ? data.due_at.toDate() : (data.due_at ? new Date(data.due_at) : null);
  return { id: best.docId, title: data.title, dueAt: due, studentId: data.student_id, completed: data.completed, metadata: data.metadata } as Assignment;
}

/** Schedule or upsert a reminder for an assignment. Uses doc id = assignmentId_reminderType to ensure uniqueness */
export async function scheduleReminder(assignmentId: string, reminderType: string, scheduledFor: Date) {
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
  } as any;
  if (!snap.exists()) {
    await setDoc(ref, payload);
  } else {
    await updateDoc(ref, { scheduled_for: payload.scheduled_for, updated_at: serverTimestamp() });
  }
  return { id };
}

/** Get a reminder doc by composite key (assignmentId + reminderType) */
export async function getReminder(assignmentId: string, reminderType: string) {
  const id = `${assignmentId}_${reminderType}`;
  const ref = doc(db, 'reminders', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data() as any;
  return { id, ...d } as any;
}

/** Mark reminder as sent/failed and increment attempts */
export async function markReminderSent(reminderId: string, status: 'sent' | 'failed' | 'skipped', messageId?: string, error?: string) {
  const ref = doc(db, 'reminders', reminderId);
  const updates: any = { status, updated_at: serverTimestamp(), attempts: increment(1) };
  if (status === 'sent') {
    updates.sent_at = serverTimestamp();
  }
  if (messageId) updates.message_id = messageId;
  if (error) updates.last_error = error;
  // Use updateDoc; if missing, caller should have created it via scheduleReminder
  await updateDoc(ref, updates).catch(async () => {
    // fallback: set it
    await setDoc(ref, { status, message_id: messageId || null, last_error: error || null, updated_at: serverTimestamp() }, { merge: true });
  });
}

/** Log a send attempt in send_logs */
export async function logSend(params: { reminderId?: string; assignmentId?: string; toEmail: string; fromInbox: string; messageId?: string; status: string; error?: string }) {
  const logs = collection(db, 'send_logs');
  const res = await addDoc(logs, {
    reminder_id: params.reminderId || null,
    assignment_id: params.assignmentId || null,
    to_email: params.toEmail,
    from_inbox: params.fromInbox,
    message_id: params.messageId || null,
    status: params.status,
    error: params.error || null,
    created_at: serverTimestamp(),
  });
  return { id: res.id };
}

/** Query incomplete assignments and return JS objects; for small datasets we fetch and filter client-side. For production, add indexed queries. */
export async function fetchIncompleteAssignmentsAll(): Promise<Assignment[]> {
  const assignmentsCol = collection(db, 'assignments');
  const q = query(assignmentsCol, where('completed', '==', false));
  const snap = await getDocs(q);
  const out: Assignment[] = [];
  snap.forEach((d) => {
    const data = d.data() as any;
    const due = data.due_at instanceof Timestamp ? data.due_at.toDate() : (data.due_at ? new Date(data.due_at) : null);
    out.push({ id: d.id, title: data.title, dueAt: due, studentId: data.student_id, completed: data.completed, metadata: data.metadata });
  });
  return out;
}

/** Utility: return assignments due within window (target in minutes or hours) */
export async function queryAssignmentsDueIn(target: number, unit: 'minutes' | 'hours' = 'hours', windowMinutes = 10) {
  const all = await fetchIncompleteAssignmentsAll();
  const now = new Date();
  return all.filter((a) => {
    const due = typeof a.dueAt === 'string' ? new Date(a.dueAt) : (a.dueAt as Date);
    if (!due) return false;
    const diffMs = due.getTime() - now.getTime();
    if (unit === 'hours') {
      const diffHours = diffMs / (1000 * 60 * 60);
      return Math.abs(diffHours - target) <= windowMinutes / 60;
    }
    const diffMinutes = diffMs / (1000 * 60);
    return Math.abs(diffMinutes - target) <= windowMinutes;
  });
}

export default {
  ensureUserFromGoogle,
  attachUpload,
  createAssignment,
  findAssignmentByPdf,
  requestManualReminder,
  findLatestIncompleteAssignmentForUser,
  scheduleReminder,
  markReminderSent,
  logSend,
  fetchIncompleteAssignmentsAll,
  queryAssignmentsDueIn,
  addOrGetUserByEmail,
  getUserById,
  getReminder,
};
