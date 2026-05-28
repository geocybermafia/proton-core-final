import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';
import firebaseConfig from '../firebase-applet-config.json';

// Handle potential missing config during build/runtime
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Analytics - DISABLED to avoid "403 Permission Denied" error from Installations API
export const analytics = null;

// Initialize Firestore with experimentalForceLongPolling to handle proxy/iframe WebSocket limitations reliably
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

// Set persistence explicitly to LOCAL (default, but good to be explicit for "secure session management")
setPersistence(auth, browserLocalPersistence);

export const googleProvider = new GoogleAuthProvider();
