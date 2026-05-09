import React from 'react';
import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { LogIn, LogOut, User } from 'lucide-react';

export function AuthButton({ user }: { user: any }) {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (user) {
    return (
      <button 
        onClick={handleLogout}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-sm transition-colors"
      >
        <LogOut size={16} />
        <span>Sign Out</span>
      </button>
    );
  }

  return (
    <button 
      onClick={handleLogin}
      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-md transition-all active:scale-[0.98]"
    >
      <LogIn size={18} />
      <span>Sign In with Google</span>
    </button>
  );
}
