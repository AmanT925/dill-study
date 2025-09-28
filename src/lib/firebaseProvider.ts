// Dynamically import Firestore binding for browser (Vite) or Node (scripts)
let db: any;
try {
  // Prefer Node/server binding when running in scripts
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  db = require('./firebaseServer').db;
} catch {
  // Fallback to browser binding in Vite app
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  db = require('./firebase').db;
}
import { collection, getDocs, query, where, doc, getDoc, Timestamp } from 'firebase/firestore';
import type { AssignmentProvider } from '../jobs/reminderJob';

type Student = { id: string; email: string; name?: string | null; contact_opt_out?: boolean };
type Assignment = { id: string; title: string; dueAt: string | Date; student: Student; completed: boolean };

export const firebaseProvider: AssignmentProvider = {
  async fetchIncompleteAssignments() {
    const assignmentsCol = collection(db, 'assignments');
    // In Firestore we typically fetch all incomplete for demo; in prod use pagination and filters
    const q = query(assignmentsCol, where('completed', '==', false));
    const snap = await getDocs(q);
    const asgs: Array<{ id: string; title: string; dueAt: any; student_id: string; completed: boolean }> = [];
    const studentIds = new Set<string>();
    snap.forEach((d) => {
      const data = d.data() as any;
      const due = data.due_at instanceof Timestamp ? data.due_at.toDate() : (data.due_at || data.dueAt || data.due || null);
      const sid = data.student_id || data.studentId || (data.student && data.student.id);
      if (sid) studentIds.add(String(sid));
      asgs.push({ id: d.id, title: data.title, dueAt: due, student_id: String(sid), completed: !!data.completed });
    });

    // Fetch student docs
    const studentsMap = new Map<string, Student>();
    for (const sid of studentIds) {
      try {
        const ref = doc(db, 'users', sid);
        const u = await getDoc(ref);
        if (u.exists()) {
          const ud = u.data() as any;
          studentsMap.set(sid, { id: sid, email: ud.email, name: ud.name ?? ud.displayName ?? null, contact_opt_out: !!ud.contact_opt_out });
        }
      } catch (e) {
        // ignore missing/failed user fetches
      }
    }

    const out: Assignment[] = asgs
      .filter((a) => !!a.student_id && studentsMap.has(a.student_id))
      .map((a) => ({
        id: a.id,
        title: a.title,
        dueAt: a.dueAt,
        student: studentsMap.get(a.student_id)!,
        completed: a.completed,
      }));

    return out;
  },
};

export default firebaseProvider;
