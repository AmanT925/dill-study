import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const now = Date.now();
const one = new Date(now + 1 * 60 * 1000).toISOString();
const two = new Date(now + 2 * 60 * 1000).toISOString();

const TO = process.env.TO_EMAIL || 'test@example.com';

const data = [
  {
    id: 't1',
    title: 'QuickTest 1m (live)',
    dueAt: one,
    student: { id: 's1', email: TO },
    completed: false,
  },
  {
    id: 't2',
    title: 'QuickTest 2m (live)',
    dueAt: two,
    student: { id: 's2', email: TO },
    completed: false,
  },
];

const outPath = path.resolve(process.cwd(), 'data', 'sample-assignments.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
console.log('Wrote sample assignments with future due times to', outPath);
console.log(data);
