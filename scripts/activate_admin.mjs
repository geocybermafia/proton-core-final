import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync, existsSync } from 'fs';

const TARGET_EMAIL = 'devdarianib@gmail.com';
const PROJECT_ID = 'proton-core-ai';

async function main() {
  console.log(`[Proton Admin] Starting admin activation for: ${TARGET_EMAIL}`);

  let app;
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';

  if (existsSync(saPath)) {
    console.log(`[Proton Admin] Using service account credentials from: ${saPath}`);
    const sa = JSON.parse(readFileSync(saPath, 'utf8'));
    app = initializeApp({
      credential: cert(sa),
      projectId: sa.project_id || PROJECT_ID,
    });
  } else {
    console.log(`[Proton Admin] Using ambient / Google Cloud Shell Application Default Credentials for project: ${PROJECT_ID}`);
    app = initializeApp({ projectId: PROJECT_ID });
  }

  const auth = getAuth(app);

  try {
    const user = await auth.getUserByEmail(TARGET_EMAIL);
    console.log(`[Proton Admin] Found user UID: ${user.uid} (${user.email})`);
    console.log(`[Proton Admin] Current claims:`, user.customClaims || {});

    // Set custom claim { admin: true }
    await auth.setCustomUserClaims(user.uid, {
      ...(user.customClaims || {}),
      admin: true,
      role: 'admin',
    });

    // Re-verify the updated claims
    const updatedUser = await auth.getUser(user.uid);
    console.log(`[Proton Admin] SUCCESS: User claims updated successfully!`);
    console.log(`[Proton Admin] Verified claims:`, updatedUser.customClaims);
    console.log(`\nNext Step: In the Proton Web App, go to Settings -> Security and click 'Refresh Token' or sign out and sign back in.`);
  } catch (error) {
    console.error(`[Proton Admin] Error during activation:`, error.message);
    if (error.code === 'auth/user-not-found') {
      console.error(`Please verify that ${TARGET_EMAIL} has signed in at least once via Google Sign-In.`);
    }
    process.exit(1);
  }
}

main();
