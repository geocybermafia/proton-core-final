import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { User, onAuthStateChanged, onIdTokenChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import {
  PendingGuestLinkContext,
  consumePendingAuthVisitorLinkIntent,
  evaluateGuestToAuthTransition,
  resetMarketAnalyticsSession,
} from '../utils/marketAnalyticsClient';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  logout: () => Promise<void>;
}

export interface AuthSessionStateTracker {
  hasResolvedInitialAuth: boolean;
  previousUid: string | null;
  pendingGuestLinkCandidate: PendingGuestLinkContext | null;
}

/**
 * Pure auth-state transition coordinator used by AuthProvider:
 * - Clears market analytics session on logout (User -> null) or direct account switch (User A -> User B)
 * - Never treats initial page-reload session restoration as a Guest -> Auth sign-in
 * - Only accepts a Guest -> Auth transition when accompanied by an explicit verified sign-in context
 * - Does NOT execute any /api/market/link-visitor request in Phase 2A
 */
export function processAuthStateTransitionForAnalytics(
  tracker: AuthSessionStateTracker,
  nextUid: string | null,
  nowMs: number = Date.now()
): AuthSessionStateTracker {
  const isInitialSessionRestore = !tracker.hasResolvedInitialAuth;
  const previousUid = tracker.previousUid;

  if (isInitialSessionRestore) {
    // Discard any stale pre-reload intent so session restoration never triggers linking
    consumePendingAuthVisitorLinkIntent();
    return {
      hasResolvedInitialAuth: true,
      previousUid: nextUid,
      pendingGuestLinkCandidate: null,
    };
  }

  if (previousUid !== null && nextUid === null) {
    resetMarketAnalyticsSession();
    return {
      hasResolvedInitialAuth: true,
      previousUid: null,
      pendingGuestLinkCandidate: null,
    };
  }

  if (previousUid !== null && nextUid !== null && previousUid !== nextUid) {
    // Direct account switch without an intermediate null frame
    resetMarketAnalyticsSession();
    consumePendingAuthVisitorLinkIntent();
    return {
      hasResolvedInitialAuth: true,
      previousUid: nextUid,
      pendingGuestLinkCandidate: null,
    };
  }

  if (previousUid === null && nextUid !== null) {
    const pendingCtx = consumePendingAuthVisitorLinkIntent();
    const evaluation = evaluateGuestToAuthTransition({
      isInitialSessionRestore: false,
      previousUid,
      nextUid,
      pendingContext: pendingCtx,
      nowMs,
    });
    return {
      hasResolvedInitialAuth: true,
      previousUid: nextUid,
      pendingGuestLinkCandidate: evaluation.shouldLink ? evaluation.context || null : null,
    };
  }

  return {
    hasResolvedInitialAuth: true,
    previousUid: nextUid,
    pendingGuestLinkCandidate: tracker.pendingGuestLinkCandidate,
  };
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  initialized: false,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const SESSION_SWITCH_CLEANUP_LOCAL_STORAGE_KEYS = [
  'proton_market_cart',
  'proton_market_hub_ledger',
  'proton_tasks',
  'organizer_scratchpad',
  'organizer_daily_focus',
  'proton_notifications',
  'proton_markethub_draft_form_data',
  'proton_image_history',
] as const;

/**
 * Performs client-side session hygiene during logout:
 * 1. Clears market analytics session exclusively via resetMarketAnalyticsSession()
 *    (memoryVisitorId, memoryImpressions, memoryViews, pendingAuthLinkContext,
 *     proton_market_visitor_id, proton_market_pending_auth_link, proton_imp_seen_*, proton_view_seen_*).
 * 2. Removes ONLY the explicit allowlisted per-account session-switch keys from localStorage
 *    (never using broad substring wildcards like key.includes('market') / 'draft' / 'form',
 *     so non-session user data such as proton_market_favorites and preferences remain intact).
 */
export function cleanupClientSessionOnLogout(
  storage: Pick<Storage, 'removeItem'> | null | undefined =
    typeof window !== 'undefined' ? window.localStorage : undefined
): void {
  resetMarketAnalyticsSession();

  try {
    if (storage) {
      for (const key of SESSION_SWITCH_CLEANUP_LOCAL_STORAGE_KEYS) {
        storage.removeItem(key);
      }
    }
  } catch (e) {
    console.warn('Error clearing localStorage during session switch cleanup:', e);
  } finally {
    // Re-assert analytics cleanup in case storage threw mid-iteration
    resetMarketAnalyticsSession();
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const sessionTrackerRef = useRef<AuthSessionStateTracker>({
    hasResolvedInitialAuth: false,
    previousUid: null,
    pendingGuestLinkCandidate: null,
  });

  const logout = useCallback(async () => {
    // Always wipe client market analytics RAM & storage state first so a subsequent
    // account in the same SPA session can never inherit the previous visitorToken/throttles.
    sessionTrackerRef.current = {
      ...sessionTrackerRef.current,
      pendingGuestLinkCandidate: null,
    };

    try {
      cleanupClientSessionOnLogout();
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
        sessionTrackerRef.current = processAuthStateTransitionForAnalytics(
          sessionTrackerRef.current,
          u?.uid ?? null
        );
        setUser(u);
        setLoading(false);
        setInitialized(true);
      },
      (error) => {
        console.warn('[AuthContext] onAuthStateChanged encountered an error:', error);
        authSettled = true;
        clearTimeout(fallbackTimer);
        sessionTrackerRef.current = processAuthStateTransitionForAnalytics(
          sessionTrackerRef.current,
          null
        );
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
