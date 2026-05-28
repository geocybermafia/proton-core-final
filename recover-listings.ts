import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync, writeFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const dbStatus = firebaseConfig.firestoreDatabaseId; // Will be "(default)"
const db = getFirestore(app, dbStatus);

async function recover() {
  console.log(`Connecting to database to fetch all listings: ${dbStatus}`);
  try {
    const snap = await getDocs(collection(db, 'listings'));
    console.log(`Total listings found in ${dbStatus}: ${snap.docs.length}`);
    const listingsList: any[] = [];
    snap.docs.forEach(docSnap => {
      const d = docSnap.data();
      console.log(`- Document ID: ${docSnap.id}`);
      console.log(JSON.stringify(d, null, 2));
      listingsList.push({ id: docSnap.id, ...d });
    });
    
    // Save to a local backup file
    writeFileSync('./recovered-listings-backup.json', JSON.stringify(listingsList, null, 2), 'utf8');
    console.log("Successfully saved listings backup to ./recovered-listings-backup.json");
  } catch (err) {
    console.error("Failed to recover:", err);
  }
  process.exit(0);
}

recover();
