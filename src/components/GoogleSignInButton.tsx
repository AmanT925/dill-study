import React, { useState } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";

export default function GoogleSignInButton({ onSignIn }: { onSignIn?: () => void }) {
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
      onSignIn?.();
    } catch (e) {
      console.error("Google sign-in failed", e);
      // TODO: better user feedback
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={signIn} className="btn btn-primary" disabled={loading}>
      {loading ? "Signing in..." : "Continue with Google"}
    </button>
  );
}
