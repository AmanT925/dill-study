import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Node/server-side Firebase initialization using process.env
// Accept both FIREBASE_* and VITE_FIREBASE_* names for convenience
const cfg = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
};

if (!cfg.projectId) {
  throw new Error(
    "Missing Firebase config in env. Set FIREBASE_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID) and related keys."
  );
}

const app = getApps().length ? getApps()[0] : initializeApp(cfg as any);
export const db = getFirestore(app);
export default { db };
