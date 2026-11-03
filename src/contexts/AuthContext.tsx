import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { User, onAuthStateChanged, onIdTokenChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  initialized: false,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const logout = useCallback(async () => {
    try {
      // Programmatically wipe cart, ledger, tasks, scratchpad, drafts, notifications from localStorage
      localStorage.removeItem('proton_market_cart');
      localStorage.removeItem('proton_market_hub_ledger');
      localStorage.removeItem('proton_tasks');
      localStorage.removeItem('organizer_scratchpad');
      localStorage.removeItem('organizer_daily_focus');
      localStorage.removeItem('proton_notifications');
      localStorage.removeItem('proton_markethub_draft_form_data');
      localStorage.removeItem('proton_image_history');
      
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (
          key.includes('form') || 
          key.includes('draft') || 
          key.includes('listing') || 
          key.includes('market') || 
          key.includes('cart') ||
          key.includes('task') ||
          key.includes('scratchpad')
        )) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn("Error clearing localStorage during session switch cleanup:", e);
    } finally {
      await signOut(auth);
    }
  }, []);

  useEffect(() => {
    let authSettled = false;

    // Safety timeout: If Firebase Auth takes longer than 3500ms (e.g. mobile cellular latency,
    // captive portal, or sandboxed IndexedDB restrictions), unblock the app in Guest mode.
    // The listener remains subscribed, so when Firebase later resolves the actual user,
    // the state will cleanly elevate without reloading.
    const fallbackTimer = setTimeout(() => {
      if (!authSettled) {
        console.warn('[AuthContext] Firebase Auth resolution took longer than 3500ms. Transitioning to Guest mode while listener continues in background.');
        setLoading(false);
        setInitialized(true);
      }
    }, 3500);

    // onAuthStateChanged handles the initial session and subsequent sign-in/sign-out
    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (u) => {
        authSettled = true;
        clearTimeout(fallbackTimer);
        setUser(u);
        setLoading(false);
        setInitialized(true);
      },
      (error) => {
        console.warn('[AuthContext] onAuthStateChanged encountered an error:', error);
        authSettled = true;
        clearTimeout(fallbackTimer);
        setUser(null);
        setLoading(false);
        setInitialized(true);
      }
    );

    // onIdTokenChanged handles token refreshes (important for long-lived sessions)
    const unsubscribeToken = onIdTokenChanged(auth, (u) => {
      if (u) {
        setUser(u);
      }
    });

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribeAuth();
      unsubscribeToken();
    };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    initialized,
    logout,
  }), [user, loading, initialized, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
