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
      localStorage.removeItem('organizer_habits');
      localStorage.removeItem('organizer_daily_mood');
      localStorage.removeItem('organizer_daily_focus');
      localStorage.removeItem('organizer_water_glasses');
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
    // onAuthStateChanged handles the initial session and subsequent sign-in/sign-out
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      if (!u) {
        // Backup clearance on unauthenticated state transitions for security coverage
        try {
          localStorage.removeItem('proton_market_cart');
          localStorage.removeItem('proton_market_hub_ledger');
        } catch (e) {
          console.warn(e);
        }
      }
      setUser(u);
      setLoading(false);
      setInitialized(true);
    });

    // onIdTokenChanged handles token refreshes (important for long-lived sessions)
    const unsubscribeToken = onIdTokenChanged(auth, (u) => {
      if (u) {
        setUser(u);
      }
    });

    return () => {
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
