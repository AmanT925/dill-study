import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { setDoc, doc, serverTimestamp } from "firebase/firestore";

type AuthCtx = { user: User | null; loading: boolean };
const Ctx = createContext<AuthCtx>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);

      // When a user signs in, ensure we have a user document in Firestore
      if (u) {
        try {
          await setDoc(
            doc(db, "users", u.uid),
            {
              uid: u.uid,
              email: u.email ?? null,
              displayName: u.displayName ?? null,
              photoURL: u.photoURL ?? null,
              lastSeen: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (e) {
          console.warn("Failed to upsert user document:", e);
        }
      }
    });

    return unsub;
  }, []);

  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
