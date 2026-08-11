import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import firebaseConfig from '../firebase-applet-config.json';

// Handle potential missing config during build/runtime
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Analytics - DISABLED to avoid "403 Permission Denied" error from Installations API
export const analytics = null;

// Initialize Firestore with experimentalAutoDetectLongPolling to handle proxy/iframe limitations reliably without 10s long-polling timeouts
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

// Initialize Firebase Functions
export const functions = getFunctions(app);

// Set persistence explicitly to LOCAL (default, but good to be explicit for "secure session management")
setPersistence(auth, browserLocalPersistence);

export const googleProvider = new GoogleAuthProvider();
