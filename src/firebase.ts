import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAawNki7fRFS_ZQGiAiXh4dmFNOH0OpZDM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "proton-core-ai.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "proton-core-ai",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "proton-core-ai.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "770674231164",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:770674231164:web:10476d47ce81ea56b486f9",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || "ai-studio-01dfb83a-da41-4952-8647-6368b0e05d51"
};

// Handle potential missing config during build/runtime
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
