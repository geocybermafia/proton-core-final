import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync, writeFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));

// Connect to default db first
firebaseConfig.firestoreDatabaseId = "(default)";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, "(default)");

async function testAuthAndFetch() {
  console.log("Attempting anonymous authentication...");
  try {
    const cred = await signInAnonymously(auth);
    console.log("Anonymous Auth Succeeded! User UID:", cred.user.uid);
  } catch (err: any) {
    console.warn("Anonymous auth failed, trying to register a temp user...", err.message);
    try {
      const email = `temp_${Date.now()}@test.com`;
      const cred = await createUserWithEmailAndPassword(auth, email, "temp_password_123");
      console.log(`Temp account registered! UID: ${cred.user.uid}, Email: ${email}`);
    } catch (err2: any) {
      console.error("Temp account registration failed:", err2.message);
    }
  }

  // Fetch listings after auth
  console.log("Fetching listings from (default) database...");
  try {
    const snap = await getDocs(collection(db, 'listings'));
    console.log(`Found ${snap.docs.length} listings in (default) database!`);
    const results: any[] = [];
    snap.docs.forEach(docSnap => {
      console.log(`ID: ${docSnap.id}`);
      console.log(docSnap.data());
      results.push({ id: docSnap.id, ...docSnap.data() });
    });
    writeFileSync('./recovered-listings-backup.json', JSON.stringify(results, null, 2), 'utf8');
  } catch (err: any) {
    console.error("Failed to fetch listings:", err.message);
  }
  process.exit(0);
}

testAuthAndFetch();
