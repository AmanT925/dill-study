import 'dotenv/config';
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase_init.mjs';

function parseArgs(argv) {
  const out = { email: process.env.TO_EMAIL, title: 'Hackathon Test Assignment', minutes: 2, userId: undefined };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    if (a === '--email') { out.email = v; i++; }
    else if (a === '--title') { out.title = v; i++; }
    else if (a === '--minutes') { out.minutes = Number(v); i++; }
    else if (a === '--userId') { out.userId = v; i++; }
  }
  return out;
}

async function ensureUserByEmail(email, userId) {
  const usersCol = collection(db, 'users');
  let id = userId;
  if (!id) {
    // Create deterministic id from email local part if desired, else Firestore auto-id
    id = undefined;
  }
  if (id) {
    const ref = doc(db, 'users', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { email, contact_opt_out: false, created_at: serverTimestamp(), updated_at: serverTimestamp() });
    }
    return id;
  }
  const res = await addDoc(usersCol, { email, contact_opt_out: false, created_at: serverTimestamp(), updated_at: serverTimestamp() });
  return res.id;
}

async function createAssignment({ title, dueAt, studentId }) {
  const assignmentsCol = collection(db, 'assignments');
  const res = await addDoc(assignmentsCol, {
    title,
    due_at: Timestamp.fromDate(dueAt),
    student_id: studentId,
    completed: false,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return res.id;
}

(async () => {
  try {
    const args = parseArgs(process.argv);
    if (!args.email) throw new Error('Provide --email or set TO_EMAIL');
    const dueAt = new Date(Date.now() + args.minutes * 60 * 1000);
    const userId = await ensureUserByEmail(args.email, args.userId);
    const assignmentId = await createAssignment({ title: args.title, dueAt, studentId: userId });
    console.log('Seeded assignment:', { assignmentId, userId, email: args.email, dueAt: dueAt.toISOString(), title: args.title });
  } catch (e) {
    console.error('Seeding failed:', e?.message || e);
    process.exit(1);
  }
})();
