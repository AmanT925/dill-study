import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Load .env.local if present (non-fatal)
const envLocal = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal, override: false });
}

const trimQ = (s) => (typeof s === 'string' ? s.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '') : s);

const cfg = {
  apiKey: trimQ(process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY),
  authDomain: trimQ(process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: trimQ(process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: trimQ(process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: trimQ(process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: trimQ(process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID),
};

if (!cfg.projectId) {
  throw new Error('Missing Firebase config. Set FIREBASE_* or VITE_FIREBASE_* vars in .env/.env.local');
}

const app = getApps().length ? getApps()[0] : initializeApp(cfg);
export const db = getFirestore(app);
export default { db };
