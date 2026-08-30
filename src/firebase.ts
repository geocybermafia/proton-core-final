import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import firebaseConfig from '../firebase-applet-config.json';

// Handle potential missing config during build/runtime
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Analytics - DISABLED to avoid "403 Permission Denied" error from Installations API
export const analytics = null;

// Initialize Firestore with explicit database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

// Initialize Firebase Functions
export const functions = getFunctions(app);

// Set persistence explicitly to LOCAL (default, but good to be explicit for "secure session management")
setPersistence(auth, browserLocalPersistence);

export const googleProvider = new GoogleAuthProvider();
