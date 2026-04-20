import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAawNki7fRFS_ZQGiAiXh4dmFNOH0OpZDM",
  authDomain: "proton-core-ai.firebaseapp.com",
  projectId: "proton-core-ai",
  storageBucket: "proton-core-ai.firebasestorage.app",
  messagingSenderId: "770674231164",
  appId: "1:770674231164:web:20d834846552090fb486f9",
  measurementId: "G-WTE6YHHYFC"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;