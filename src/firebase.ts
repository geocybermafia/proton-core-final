import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyAawNki7fRFS_ZQGiAiXh4dmFNOH0OpZDM",
  authDomain: "proton-core-ai.firebaseapp.com",
  projectId: "proton-core-ai",
  storageBucket: "proton-core-ai.firebasestorage.app",
  messagingSenderId: "770674231164",
  appId: "1:770674231164:web:10476d47ce81ea56b486f9",
  measurementId: "G-WTE6YHHYFC",
  firestoreDatabaseId: "(default)"
};

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
