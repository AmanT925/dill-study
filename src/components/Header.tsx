import { useAuth } from "@/auth/AuthProvider";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, UploadCloud, History, LogOut } from 'lucide-react';
import React from 'react';

const navItems: { label: string; screen: string; icon: React.ReactNode; path?: string }[] = [
  { label: 'New Upload', screen: 'upload', icon: <UploadCloud className="w-4 h-4" /> },
  { label: 'Past Uploads', screen: 'library', icon: <History className="w-4 h-4" /> },
];

export default function Header() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // We infer current screen from location+hash (Index manages internal screens, so we emit events)
  function postScreenChange(screen: string) {
    window.dispatchEvent(new CustomEvent('app:navigate-screen', { detail: { screen } }));
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <button onClick={() => { navigate('/'); postScreenChange('dashboard'); }} className="flex items-center gap-2 group">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-gradient-primary text-primary-foreground font-bold shadow-sm group-hover:scale-105 transition-transform">D</span>
            <span className="tracking-tight text-base text-foreground" style={{ fontFamily: '"Cooper Black", "Cooper", serif', fontWeight: 600 }}>Dill</span>
          </button>
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {navItems.map(item => (
              <button
                key={item.screen}
                onClick={() => { navigate('/'); postScreenChange(item.screen); }}
                className="relative group inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                {item.icon}
                <span>{item.label}</span>
                <span className="absolute inset-x-1 -bottom-[3px] h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : user ? (
            <div className="flex items-center gap-3">
              {user.photoURL && (
                <img src={user.photoURL} alt={user.displayName ?? 'user'} className="w-8 h-8 rounded-full ring-2 ring-primary/30" />
              )}
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-medium text-foreground/90 max-w-[140px] truncate">{user.displayName}</span>
                <span className="text-[10px] text-muted-foreground">Signed in</span>
              </div>
              <button
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/5 transition-colors"
                onClick={async () => { try { await signOut(auth); } catch (e) { console.error('Sign out failed', e); } }}
              >
                <LogOut className="w-3 h-3" />
                Logout
              </button>
            </div>
          ) : (
            <GoogleSignInButton />
          )}
        </div>
      </div>
      {/* mobile nav */}
      <div className="md:hidden border-t border-border/60 px-2 pb-2 bg-background/70 backdrop-blur-lg flex gap-2 overflow-x-auto">
        {navItems.map(item => (
          <button
            key={item.screen}
            onClick={() => { navigate('/'); postScreenChange(item.screen); }}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-medium bg-muted/50 text-foreground hover:bg-muted transition"
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
}
