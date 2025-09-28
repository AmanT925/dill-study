import { useAuth } from "@/auth/AuthProvider";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { auth } from "@/lib/firebase";

import { signOut } from "firebase/auth";

export default function Header() {
  const { user, loading } = useAuth();

  return (
    <header className="p-4 flex justify-between items-center bg-gray-100">
      <h1 className="text-xl font-bold">Dill</h1>
      {loading ? (
        <div>Loading...</div>
      ) : user ? (
        <div className="flex items-center gap-2">
          {user.photoURL ? (
            // Only render img when there's a valid photo URL
            <img src={user.photoURL} alt={user.displayName ?? "user"} className="w-8 h-8 rounded-full" />
          ) : null}
          <span>{user.displayName}</span>
          <button
            className="ml-2 text-sm text-gray-600"
            onClick={async () => {
              try {
                await signOut(auth);
              } catch (e) {
                console.error("Sign out failed", e);
              }
            }}
          >
            Sign out
          </button>
        </div>
      ) : (
        <GoogleSignInButton />
      )}
    </header>
  );
}
