import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence, 
  inMemoryPersistence 
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

/**
 * Robust progressive persistence configuration.
 * Mobile WebViews, iOS Safari (Private Browsing / sandboxed iframes) often restrict or throw
 * SecurityError on IndexedDB access used by browserLocalPersistence.
 * We try browserLocalPersistence -> browserSessionPersistence -> inMemoryPersistence with full error isolation.
 * This runs non-blocking so synchronous exports and listeners are immediately available.
 */
export const initAuthPersistence = async (): Promise<void> => {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (localErr) {
    console.warn('[Firebase Auth] browserLocalPersistence failed (IndexedDB restricted), trying session persistence:', localErr);
    try {
      await setPersistence(auth, browserSessionPersistence);
    } catch (sessionErr) {
      console.warn('[Firebase Auth] browserSessionPersistence failed, trying in-memory persistence:', sessionErr);
      try {
        await setPersistence(auth, inMemoryPersistence);
      } catch (memErr) {
        console.warn('[Firebase Auth] All explicit persistence configurations failed, proceeding with default:', memErr);
      }
    }
  }
};

// Execute persistence setup without blocking runtime exports
initAuthPersistence().catch((err) => {
  console.warn('[Firebase Auth] Unhandled persistence error handled safely:', err);
});

export const googleProvider = new GoogleAuthProvider();

