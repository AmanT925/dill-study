import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase configuration - load from Vite env variables.
// Keep secrets out of source control: set these in your local .env.local or CI secrets.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize or reuse existing app (avoid duplicate initialization in HMR/dev)
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig as any);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider(); // use this in the sign-in button
export const db = getFirestore(app);
