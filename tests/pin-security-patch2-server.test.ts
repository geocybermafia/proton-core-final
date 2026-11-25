import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Import real compiled Cloud Functions handlers from functions/lib/index.js
const serverMod = require(path.join(process.cwd(), 'functions/lib/index.js'));
const {
  handleVerifyStepUpPin,
  handleUpdateSecurityPin,
  handleResetUserWorkspace,
  handleUpdateUserEmail,
} = serverMod;

const FIELD_DELETE_SENTINEL = { __fieldDelete: true };

/**
 * In-memory transactional Firestore & Firebase Auth harness for testing real compiled
 * Cloud Functions logic in functions/lib/index.js (no live Firebase Emulator connection).
 */
function createInMemoryFirebaseEnv() {
  const docs = new Map<string, Record<string, any>>();
  const authUsers = new Map<string, { uid: string; email?: string }>();
  let failNextSetPath: string | null = null;
  let failAuthError: Error | null = null;

  function applyFieldUpdates(target: Record<string, any>, updates: Record<string, any>) {
    for (const [k, v] of Object.entries(updates)) {
      if (v === FIELD_DELETE_SENTINEL) {
        delete target[k];
      } else {
        target[k] = structuredClone(v);
      }
    }
  }

  function makeDocRef(docPath: string): any {
    return {
      path: docPath,
      id: docPath.split('/').pop(),
      collection(subName: string) {
        return makeColRef(`${docPath}/${subName}`);
      },
      async get() {
        const val = docs.get(docPath);
        return {
          exists: val !== undefined,
          id: docPath.split('/').pop(),
          ref: makeDocRef(docPath),
          data: () => (val !== undefined ? structuredClone(val) : undefined),
        };
      },
      async set(data: Record<string, any>, opts?: { merge?: boolean }) {
        if (failNextSetPath && docPath === failNextSetPath) {
          failNextSetPath = null;
          throw new Error(`Injected Firestore write failure at ${docPath}`);
        }
        const existing = opts?.merge ? structuredClone(docs.get(docPath) || {}) : {};
        applyFieldUpdates(existing, data);
        docs.set(docPath, existing);
      },
      async update(data: Record<string, any>) {
        if (!docs.has(docPath)) {
          throw new Error(`NOT_FOUND: ${docPath}`);
        }
        const existing = structuredClone(docs.get(docPath)!);
        applyFieldUpdates(existing, data);
        docs.set(docPath, existing);
      },
    };
  }

  function makeColRef(colPath: string): any {
    const prefix = `${colPath}/`;
    return {
      doc(id: string) {
        return makeDocRef(`${colPath}/${id}`);
      },
      async get() {
        const matched: any[] = [];
        for (const [p, v] of docs.entries()) {
          if (p.startsWith(prefix)) {
            const rest = p.slice(prefix.length);
            if (!rest.includes('/')) {
              matched.push({
                id: rest,
                ref: makeDocRef(p),
                data: () => structuredClone(v),
              });
            }
          }
        }
        return {
          empty: matched.length === 0,
          docs: matched,
        };
      },
    };
  }

  const firestore = {
    collection(name: string) {
      return makeColRef(name);
    },
    batch() {
      const ops: Array<() => void> = [];
      return {
        delete(ref: { path: string }) {
          ops.push(() => docs.delete(ref.path));
        },
        async commit() {
          for (const op of ops) op();
        },
      };
    },
    async runTransaction(fn: (tx: any) => Promise<any>) {
      const tx = {
        get: (ref: any) => ref.get(),
        set: (ref: any, data: any, opts?: any) => ref.set(data, opts),
        update: (ref: any, data: any) => ref.update(data),
      };
      return fn(tx);
    },
  };

  const auth = {
    async getUser(uid: string) {
      const u = authUsers.get(uid);
      if (!u) {
        const err: any = new Error('User not found');
        err.code = 'auth/user-not-found';
        throw err;
      }
      return { ...u };
    },
    async updateUser(uid: string, props: { email?: string }) {
      if (failAuthError) {
        const err = failAuthError;
        failAuthError = null;
        throw err;
      }
      const u = authUsers.get(uid);
      if (!u) throw new Error('User not found');
      if (props.email) {
        for (const [otherUid, otherUser] of authUsers.entries()) {
          if (otherUid !== uid && otherUser.email?.toLowerCase() === props.email.toLowerCase()) {
            const err: any = new Error('Email already exists');
            err.code = 'auth/email-already-exists';
            throw err;
          }
        }
        u.email = props.email;
      }
      return { ...u };
    },
  };

  return {
    docs,
    authUsers,
    setFailNextSetPath(p: string | null) {
      failNextSetPath = p;
    },
    setFailAuthError(err: Error | null) {
      failAuthError = err;
    },
    deps: {
      firestore,
      auth,
      fieldValueDelete: () => FIELD_DELETE_SENTINEL,
      nowMs: () => Date.now(),
    },
  };
}

describe('PROTON PIN Security Patch #2 — Real Compiled Cloud Functions Server Suite (In-Memory Transactional Store)', () => {
  it('Scenarios 1 & 2: Server blocks Reset without valid Step-Up grant even if client claims securityPinEnabled=false', async () => {
    const env = createInMemoryFirebaseEnv();
    const uid = 'uid-pin-on';
    env.authUsers.set(uid, { uid, email: 'user@proton.internal' });
    await env.deps.firestore.collection('users').doc(uid).set({ email: 'user@proton.internal', name: 'Keep Name' });
    await handleUpdateSecurityPin({ auth: { uid }, data: { newPin: '1234' } }, env.deps);

    // Seed workspace data including projects
    await env.deps.firestore.collection('users').doc(uid).collection('projects').doc('p1').set({ title: 'Project 1' });
    await env.deps.firestore.collection('users').doc(uid).collection('tasks').doc('t1').set({ title: 'Task 1' });

    const freshAuthTimeSec = Math.floor(Date.now() / 1000);
    await assert.rejects(
      () =>
        handleResetUserWorkspace(
          { auth: { uid, token: { email: 'user@proton.internal', auth_time: freshAuthTimeSec } }, data: {} },
          env.deps
        ),
      /STEP_UP_REQUIRED/
    );

    // Verify NOTHING was deleted
    assert.equal((await env.deps.firestore.collection('users').doc(uid).collection('projects').doc('p1').get()).exists, true);
    assert.equal((await env.deps.firestore.collection('users').doc(uid).collection('tasks').doc('t1').get()).exists, true);
    assert.equal((await env.deps.firestore.collection('users').doc(uid).get()).data().name, 'Keep Name');
  });

  it('Scenarios 3 & 4: Rejects wrong-scope grantId and rejects already-consumed (replay) grantId', async () => {
    const env = createInMemoryFirebaseEnv();
    const uid = 'uid-grants';
    env.authUsers.set(uid, { uid, email: 'grants@proton.internal' });
    await env.deps.firestore.collection('users').doc(uid).set({ email: 'grants@proton.internal', name: 'Original' });
    await handleUpdateSecurityPin({ auth: { uid }, data: { newPin: '2468' } }, env.deps);

    // Issue grant scoped to 'changeEmail'
    const verifyRes = await handleVerifyStepUpPin(
      { auth: { uid }, data: { pin: '2468', scope: 'changeEmail' } },
      env.deps
    );
    assert.equal(verifyRes.scope, 'changeEmail');

    // Scenario 3: Wrong scope — using changeEmail grantId for resetUserWorkspace MUST fail and NOT consume grant
    await assert.rejects(
      () =>
        handleResetUserWorkspace(
          { auth: { uid, token: { email: 'grants@proton.internal' } }, data: { grantId: verifyRes.grantId } },
          env.deps
        ),
      /invalid for this scope/i
    );

    // Using updateSecurityPin with changeEmail grant MUST also fail
    await assert.rejects(
      () =>
        handleUpdateSecurityPin(
          { auth: { uid }, data: { newPin: '9999', grantId: verifyRes.grantId } },
          env.deps
        ),
      /invalid for this scope/i
    );

    // Scenario 4: Use the grantId ONCE with matching scope -> succeeds
    const emailRes = await handleUpdateUserEmail(
      { auth: { uid }, data: { newEmail: 'updated@proton.internal', grantId: verifyRes.grantId } },
      env.deps
    );
    assert.equal(emailRes.success, true);

    // Replay SAME grantId a second time -> MUST be rejected!
    await assert.rejects(
      () =>
        handleUpdateUserEmail(
          { auth: { uid }, data: { newEmail: 'replayed@proton.internal', grantId: verifyRes.grantId } },
          env.deps
        ),
      /expired, consumed, or invalid/i
    );
    assert.equal((await env.deps.auth.getUser(uid)).email, 'updated@proton.internal');
  });

  it('Scenarios 5 & 8: PIN-disabled Reset requires fresh auth_time and deletes projects + all workspace subcollections on server', async () => {
    const env = createInMemoryFirebaseEnv();
    const uid = 'uid-nopin-reset';
    env.authUsers.set(uid, { uid, email: 'nopin@proton.internal' });
    await env.deps.firestore.collection('users').doc(uid).set({
      email: 'nopin@proton.internal',
      name: 'Custom Name',
      region: 'Batumi, GE',
      securityPinEnabled: false,
    });
    await env.deps.firestore.collection('users').doc(uid).collection('projects').doc('proj-1').set({ name: 'P1' });
    await env.deps.firestore.collection('users').doc(uid).collection('workflows').doc('wf-1').set({ name: 'W1' });
    await env.deps.firestore.collection('users').doc(uid).collection('tasks').doc('task-1').set({ name: 'T1' });
    await env.deps.firestore.collection('users').doc(uid).collection('personas').doc('per-1').set({ name: 'Per1' });
    await env.deps.firestore.collection('users').doc(uid).collection('chatHistory').doc('ch-1').set({ msg: 'hi' });
    await env.deps.firestore.collection('users').doc(uid).collection('customAvatars').doc('av-1').set({ url: 'x' });
    await env.deps.firestore.collection('users').doc(uid).collection('market_ledger').doc('tx-1').set({ amount: 50 });

    // Scenario 5A: Unauthenticated -> rejected
    await assert.rejects(() => handleResetUserWorkspace({ auth: null, data: {} }, env.deps), /Authentication required/);

    // Scenario 5B: Stale auth_time (> 300s ago) -> rejected with REAUTH_REQUIRED, projects preserved
    const staleAuthSec = Math.floor(Date.now() / 1000) - 600;
    await assert.rejects(
      () =>
        handleResetUserWorkspace(
          { auth: { uid, token: { email: 'nopin@proton.internal', auth_time: staleAuthSec } }, data: {} },
          env.deps
        ),
      /REAUTH_REQUIRED/
    );
    assert.equal((await env.deps.firestore.collection('users').doc(uid).collection('projects').doc('proj-1').get()).exists, true);

    // Scenario 5C + 8: Fresh auth_time -> succeeds and deletes projects + all workspace subcollections, preserves market_ledger
    const freshAuthSec = Math.floor(Date.now() / 1000) - 10;
    const res = await handleResetUserWorkspace(
      { auth: { uid, token: { email: 'nopin@proton.internal', auth_time: freshAuthSec } }, data: {} },
      env.deps
    );
    assert.equal(res.success, true);
    assert.equal(res.resetProfile.region, 'Tbilisi, GE');

    for (const sub of ['workflows', 'personas', 'chatHistory', 'tasks', 'projects', 'customAvatars']) {
      const snap = await env.deps.firestore.collection('users').doc(uid).collection(sub).get();
      assert.equal(snap.empty, true, `Expected subcollection ${sub} to be empty after reset`);
    }
    assert.equal((await env.deps.firestore.collection('users').doc(uid).collection('market_ledger').doc('tx-1').get()).exists, true);
    assert.equal((await env.deps.firestore.collection('users').doc(uid).collection('stats').doc('current').get()).data().spendingLimit, 5);
  });

  it('Scenarios 6 & 7: Legacy plaintext securityPin is treated as active PIN and migrated safely ONLY after new PBKDF2 metadata persists', async () => {
    const env = createInMemoryFirebaseEnv();
    const uid = 'uid-legacy';
    env.authUsers.set(uid, { uid, email: 'legacy@proton.internal' });
    // Legacy user doc with ONLY plaintext securityPin (no securityPinEnabled, no securityPinMeta)
    await env.deps.firestore.collection('users').doc(uid).set({
      email: 'legacy@proton.internal',
      securityPin: '4321',
    });

    // Scenario 6A: Cannot bypass Step-Up in updateSecurityPin without grantId
    await assert.rejects(
      () => handleUpdateSecurityPin({ auth: { uid }, data: { newPin: '9999' } }, env.deps),
      /Step-up verification required/
    );

    // Scenario 6B: Cannot bypass Step-Up in resetUserWorkspace even with fresh auth_time
    await assert.rejects(
      () =>
        handleResetUserWorkspace(
          { auth: { uid, token: { email: 'legacy@proton.internal', auth_time: Math.floor(Date.now() / 1000) } }, data: {} },
          env.deps
        ),
      /STEP_UP_REQUIRED/
    );

    // Wrong PIN does NOT migrate or delete legacy securityPin
    await assert.rejects(
      () => handleVerifyStepUpPin({ auth: { uid }, data: { pin: '0000', scope: 'updateSecurityPin' } }, env.deps),
      /Incorrect PIN code/
    );
    assert.equal((await env.deps.firestore.collection('users').doc(uid).get()).data().securityPin, '4321');

    // Scenario 7A: Inject failure while saving PBKDF2 securityPinMeta -> legacy securityPin MUST NOT be deleted!
    env.setFailNextSetPath(`users/${uid}`);
    await assert.rejects(
      () => handleVerifyStepUpPin({ auth: { uid }, data: { pin: '4321', scope: 'updateSecurityPin' } }, env.deps),
      /Injected Firestore write failure/
    );
    const afterFailedMetaSave = (await env.deps.firestore.collection('users').doc(uid).get()).data();
    assert.equal(afterFailedMetaSave.securityPin, '4321');
    assert.equal(afterFailedMetaSave.securityPinMeta, undefined);

    // Scenario 7B: Succeeds on valid PIN -> stores PBKDF2 meta AND deletes plaintext securityPin!
    const okVerify = await handleVerifyStepUpPin(
      { auth: { uid }, data: { pin: '4321', scope: 'updateSecurityPin' } },
      env.deps
    );
    assert.equal(okVerify.success, true);
    assert.equal(okVerify.migratedLegacyPin, true);

    const migratedDoc = (await env.deps.firestore.collection('users').doc(uid).get()).data();
    assert.equal('securityPin' in migratedDoc, false);
    assert.equal(migratedDoc.securityPinEnabled, true);
    assert.equal(migratedDoc.securityPinMeta.version, 1);
    assert.equal(migratedDoc.securityPinMeta.salt.length, 32);
    assert.equal(migratedDoc.securityPinMeta.verifier.length, 64);

    // Migrated PBKDF2 metadata now verifies the same PIN ('4321')
    const secondVerify = await handleVerifyStepUpPin(
      { auth: { uid }, data: { pin: '4321', scope: 'generalStepUp' } },
      env.deps
    );
    assert.equal(secondVerify.success, true);
  });

  it('Scenarios 9 & 10: Synchronized Auth+Firestore Email Change with rollback on Firestore failure and Auth-failure isolation', async () => {
    const env = createInMemoryFirebaseEnv();
    const uid = 'uid-email';
    env.authUsers.set(uid, { uid, email: 'old@proton.internal' });
    env.authUsers.set('other-uid', { uid: 'other-uid', email: 'taken@proton.internal' });
    await env.deps.firestore.collection('users').doc(uid).set({
      email: 'old@proton.internal',
      securityPinEnabled: false,
    });

    const freshAuthSec = Math.floor(Date.now() / 1000);

    // Case A: Stale auth_time on PIN-disabled account -> rejected; Auth & Firestore unchanged
    await assert.rejects(
      () =>
        handleUpdateUserEmail(
          { auth: { uid, token: { auth_time: freshAuthSec - 900 } }, data: { newEmail: 'new@proton.internal' } },
          env.deps
        ),
      /REAUTH_REQUIRED/
    );
    assert.equal((await env.deps.auth.getUser(uid)).email, 'old@proton.internal');
    assert.equal((await env.deps.firestore.collection('users').doc(uid).get()).data().email, 'old@proton.internal');

    // Case B: Firebase Auth fails (email already in use) -> Firestore stays unchanged
    await assert.rejects(
      () =>
        handleUpdateUserEmail(
          { auth: { uid, token: { auth_time: freshAuthSec } }, data: { newEmail: 'taken@proton.internal' } },
          env.deps
        ),
      /already in use/
    );
    assert.equal((await env.deps.auth.getUser(uid)).email, 'old@proton.internal');
    assert.equal((await env.deps.firestore.collection('users').doc(uid).get()).data().email, 'old@proton.internal');

    // Case C: Firestore write fails AFTER Firebase Auth update -> Auth MUST roll back to 'old@proton.internal'!
    env.setFailNextSetPath(`users/${uid}`);
    await assert.rejects(
      () =>
        handleUpdateUserEmail(
          { auth: { uid, token: { auth_time: freshAuthSec } }, data: { newEmail: 'rollback@proton.internal' } },
          env.deps
        ),
      /rolled back/
    );
    assert.equal((await env.deps.auth.getUser(uid)).email, 'old@proton.internal');
    assert.equal((await env.deps.firestore.collection('users').doc(uid).get()).data().email, 'old@proton.internal');

    // Case D: Valid change -> BOTH Auth & Firestore update synchronously
    const ok = await handleUpdateUserEmail(
      { auth: { uid, token: { auth_time: freshAuthSec } }, data: { newEmail: 'Synced@Proton.Internal' } },
      env.deps
    );
    assert.equal(ok.success, true);
    assert.equal(ok.email, 'synced@proton.internal');
    assert.equal((await env.deps.auth.getUser(uid)).email, 'synced@proton.internal');
    assert.equal((await env.deps.firestore.collection('users').doc(uid).get()).data().email, 'synced@proton.internal');
  });
});
