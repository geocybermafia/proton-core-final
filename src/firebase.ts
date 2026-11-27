import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence, 
  inMemoryPersistence,
  Auth 
} from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import firebaseConfig from '../firebase-applet-config.json';

// Handle potential missing config during build/runtime
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Analytics - DISABLED to avoid "403 Permission Denied" error from Installations API
export const analytics = null;

// Initialize Firestore with explicit database ID and forced long-polling transport.
// In iframe/sandboxed environments, default WebChannel streaming often fails the initial handshake,
// throwing: "@firebase/firestore: Could not reach Cloud Firestore backend. [code=unavailable]".
// experimentalForceLongPolling forces reliable HTTPS long-polling and prevents transport disconnects.
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId);
} catch {
  // If already initialized in hot-reload or existing instance
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreDb;

export const auth = getAuth(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

// Initialize Firebase Functions
export const functions = getFunctions(app);

declare global {
  var __PROTON_AUTH_PERSISTENCE_MAP__: WeakMap<Auth, Promise<void>> | undefined;
}

const GLOBAL_AUTH_MAP_KEY = '__PROTON_AUTH_PERSISTENCE_MAP__';

if (!globalThis[GLOBAL_AUTH_MAP_KEY]) {
  globalThis[GLOBAL_AUTH_MAP_KEY] = new WeakMap<Auth, Promise<void>>();
}

const persistenceInitPromises = globalThis[GLOBAL_AUTH_MAP_KEY]!;

/**
 * Robust progressive persistence configuration with HMR-safe WeakMap Singleton,
 * Local -> Session -> InMemory cascading fallback, and strict error propagation.
 */
export const initAuthPersistence = async (targetAuth: Auth = auth): Promise<void> => {
  let existing = persistenceInitPromises.get(targetAuth);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      await setPersistence(targetAuth, browserLocalPersistence);
    } catch (localErr) {
      console.warn('[Firebase Auth] browserLocalPersistence failed, trying session persistence:', localErr);
      try {
        await setPersistence(targetAuth, browserSessionPersistence);
      } catch (sessionErr) {
        console.warn('[Firebase Auth] browserSessionPersistence failed, trying in-memory persistence:', sessionErr);
        try {
          await setPersistence(targetAuth, inMemoryPersistence);
        } catch (memErr) {
          console.error('[Firebase Auth CRITICAL] All explicit persistence configurations failed:', memErr);
          persistenceInitPromises.delete(targetAuth);
          throw memErr;
        }
      }
    }
  })();

  persistenceInitPromises.set(targetAuth, promise);
  return promise;
};

// Execute initial persistence setup non-blockingly with safe error handling
initAuthPersistence().catch((err) => {
  console.error('[Firebase Auth CRITICAL] Initial persistence setup failed:', err);
});

export const googleProvider = new GoogleAuthProvider();

