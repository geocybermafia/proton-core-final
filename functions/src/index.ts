import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import * as crypto from "crypto";

// Initialize Firebase Admin SDK (Only once)
if (!getApps().length) {
  initializeApp();
}

const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || "ai-studio-01dfb83a-da41-4952-8647-6368b0e05d51";
const db = (() => {
  try {
    return getFirestore(DATABASE_ID);
  } catch {
    return getFirestore();
  }
})();

const adminAuth = getAuth();

export interface SecureTransactionRequest {
  buyerId: string;
  sellerId: string;
  amount: number;
  itemTitle: string;
  listingId?: string;
  type?: 'PURCHASE' | 'DEPOSIT' | 'TRANSFER' | 'PAYOUT';
}

/**
 * Serverless Callable Function: processSecureTransaction
 * 
 * Securely writes financial transaction records to the `market_ledger` collection.
 * Uses Firebase Admin SDK to bypass client-side Firestore Security Rules (which keep `market_ledger` read-only for clients).
 */
export const processSecureTransaction = onCall<SecureTransactionRequest>(async (request) => {
  // 1. STRICT AUTHENTICATION GUARD
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Authentication required. Only logged-in users can execute financial transactions."
    );
  }

  const callerUid = request.auth.uid;
  const { buyerId, sellerId, amount, itemTitle, listingId, type = 'PURCHASE' } = request.data;

  // 2. IDENTITY & PERMISSION VALIDATION
  if (!buyerId || typeof buyerId !== 'string') {
    throw new HttpsError("invalid-argument", "buyerId must be a valid non-empty string.");
  }

  // Enforce that the authenticated user can only perform transactions on their own behalf as the buyer
  if (callerUid !== buyerId) {
    throw new HttpsError(
      "permission-denied",
      "Unauthorized transaction. Calling user ID must match the buyer ID."
    );
  }

  if (!sellerId || typeof sellerId !== 'string') {
    throw new HttpsError("invalid-argument", "sellerId must be a valid non-empty string.");
  }

  // Prevent arbitrary cross-user ledger injection for self-directed operations
  if (type === 'DEPOSIT' || type === 'PAYOUT') {
    if (sellerId !== buyerId) {
      throw new HttpsError(
        "invalid-argument",
        `sellerId must match buyerId for ${type} transactions. Cross-user ${type} operations are not permitted.`
      );
    }
  }

  // Prevent self-dealing for PURCHASE transactions
  if (buyerId === sellerId && type === 'PURCHASE') {
    throw new HttpsError("invalid-argument", "Buyer and seller IDs cannot be identical for purchase transactions.");
  }

  // 3. FINANCIAL DATA SANITIZATION
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || amount <= 0) {
    throw new HttpsError("invalid-argument", "Amount must be a positive finite number greater than 0.");
  }

  if (!itemTitle || typeof itemTitle !== 'string' || itemTitle.trim().length === 0) {
    throw new HttpsError("invalid-argument", "itemTitle is required and must be a non-empty string.");
  }

  try {
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = FieldValue.serverTimestamp();
    const sanitizedAmount = Number(amount.toFixed(2));
    const nowIso = new Date().toISOString();
    const dateStr = nowIso.split('T')[0];
    const cleanTitle = itemTitle.trim().substring(0, 200);

    // Harmonize ledger schema with frontend LedgerItem and useSellerStats
    const basePayload = {
      id: transactionId,
      buyerId,
      sellerId,
      userId: buyerId,
      amount: sanitizedAmount,
      total: sanitizedAmount,
      value: sanitizedAmount,
      volume: 1,
      currency: 'USD',
      itemTitle: cleanTitle,
      description: cleanTitle,
      category: type === 'PAYOUT' ? 'Payout Withdrawal' : type === 'DEPOSIT' ? 'Deposit' : 'Marketplace Trade',
      date: dateStr,
      listingId: listingId || null,
      status: 'completed',
      statusUpper: 'COMPLETED',
      createdAt: timestamp,
      updatedAt: timestamp,
      serverVerified: true,
      processedBy: 'processSecureTransaction_v1',
      operator: 'processSecureTransaction_v1',
      transactionType: type
    };

    // 4. ATOMIC ADMIN WRITE (Bypasses Firestore Rules)
    const batch = db.batch();

    // Determine direction for single-party vs two-party transactions
    const isSelfTransaction = buyerId === sellerId;
    const selfDirection: 'OUTGOING' | 'INCOMING' = type === 'PAYOUT' ? 'OUTGOING' : 'INCOMING';

    // Global Root Ledger Entry
    const globalLedgerRef = db.collection('market_ledger').doc(transactionId);
    batch.set(globalLedgerRef, {
      ...basePayload,
      direction: isSelfTransaction ? selfDirection : 'MULTI_PARTY',
      type: isSelfTransaction ? (selfDirection === 'OUTGOING' ? 'outbound' : 'inbound') : type
    });

    if (isSelfTransaction) {
      // Exactly ONE user ledger document is written for self-transactions
      const userLedgerRef = db
        .collection('users')
        .doc(buyerId)
        .collection('market_ledger')
        .doc(transactionId);

      batch.set(userLedgerRef, {
        ...basePayload,
        direction: selfDirection,
        type: selfDirection === 'OUTGOING' ? 'outbound' : 'inbound'
      });
    } else {
      // Two-party transaction (buyer !== seller)
      // Buyer Subcollection Ledger Entry (OUTGOING / outbound)
      const buyerLedgerRef = db
        .collection('users')
        .doc(buyerId)
        .collection('market_ledger')
        .doc(transactionId);
      batch.set(buyerLedgerRef, {
        ...basePayload,
        direction: 'OUTGOING',
        type: 'outbound'
      });

      // Seller Subcollection Ledger Entry (INCOMING / inbound)
      const sellerLedgerRef = db
        .collection('users')
        .doc(sellerId)
        .collection('market_ledger')
        .doc(transactionId);
      batch.set(sellerLedgerRef, {
        ...basePayload,
        direction: 'INCOMING',
        type: 'inbound'
      });
    }

    await batch.commit();

    return {
      success: true,
      transactionId,
      status: 'COMPLETED',
      timestamp: new Date().toISOString(),
      message: 'Financial transaction securely recorded via Admin SDK.'
    };
  } catch (err: any) {
    console.error('[processSecureTransaction] Internal Error:', err);
    throw new HttpsError(
      "internal",
      `Failed to record transaction: ${err?.message || 'Server error'}`
    );
  }
});

// =======================================================
// ZERO-TRUST STEP-UP VERIFICATION & PIN FUNCTIONS
// =======================================================

export type StepUpScope = 'updateSecurityPin' | 'resetUserWorkspace' | 'changeEmail' | 'generalStepUp';

const ALLOWED_STEP_UP_SCOPES: readonly StepUpScope[] = [
  'updateSecurityPin',
  'resetUserWorkspace',
  'changeEmail',
  'generalStepUp',
];

const MAX_REAUTH_AGE_SEC = 300; // 5 minutes freshness for Firebase reauthentication

export interface PinServerDependencies {
  firestore: any;
  auth: {
    getUser: (uid: string) => Promise<{ email?: string }>;
    updateUser: (uid: string, props: { email?: string }) => Promise<any>;
  };
  fieldValueDelete: () => any;
  nowMs?: () => number;
}

const defaultPinDeps: PinServerDependencies = {
  firestore: db,
  auth: adminAuth,
  fieldValueDelete: () => FieldValue.delete(),
  nowMs: () => Date.now(),
};

function hasLegacyPlaintextPin(userData: any): boolean {
  return typeof userData?.securityPin === 'string' && userData.securityPin.length > 0;
}

function isUserPinActive(userData: any): boolean {
  return !!(
    userData?.securityPinEnabled ||
    userData?.securityPinMeta?.enabled ||
    hasLegacyPlaintextPin(userData)
  );
}

function derivePbkdf2PinMeta(pin: string, nowTimestamp: number) {
  const saltBuf = crypto.randomBytes(16);
  const saltHex = saltBuf.toString('hex');
  const verifierBuf = crypto.pbkdf2Sync(pin, saltBuf, 100000, 32, 'sha256');
  const verifierHex = verifierBuf.toString('hex');

  return {
    enabled: true,
    salt: saltHex,
    verifier: verifierHex,
    version: 1,
    updatedAt: nowTimestamp,
  };
}

function verifyPinAgainstMeta(pin: string, meta: any): boolean {
  if (!meta || !meta.enabled || !meta.salt || !meta.verifier) {
    return false;
  }
  const saltBuf = Buffer.from(meta.salt, 'hex');
  const derivedBuf = crypto.pbkdf2Sync(pin, saltBuf, 100000, 32, 'sha256');
  const storedVerifierBuf = Buffer.from(meta.verifier, 'hex');
  return (
    derivedBuf.length === storedVerifierBuf.length &&
    crypto.timingSafeEqual(derivedBuf, storedVerifierBuf)
  );
}

function verifyPinAgainstLegacy(pin: string, legacyPin: string): boolean {
  const a = crypto.createHash('sha256').update(pin, 'utf8').digest();
  const b = crypto.createHash('sha256').update(legacyPin, 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

async function consumeScopedStepUpGrant(
  firestore: any,
  userRef: any,
  uid: string,
  grantId: string | undefined,
  expectedScope: StepUpScope,
  now: number,
  missingMessage: string
): Promise<void> {
  if (!grantId || typeof grantId !== 'string') {
    throw new HttpsError("permission-denied", missingMessage);
  }

  const grantRef = userRef.collection('security').doc(`grant_${grantId}`);

  await firestore.runTransaction(async (transaction: any) => {
    const grantSnap = await transaction.get(grantRef);

    if (!grantSnap.exists) {
      throw new HttpsError("permission-denied", "Invalid or expired step-up authorization grant.");
    }

    const grant = grantSnap.data()!;

    if (
      grant.consumed ||
      grant.uid !== uid ||
      grant.expiresAt <= now ||
      grant.scope !== expectedScope
    ) {
      throw new HttpsError("permission-denied", "Step-up grant is expired, consumed, or invalid for this scope.");
    }

    transaction.update(grantRef, { consumed: true, consumedAt: now });
  });
}

function assertRecentFirebaseReauth(authContext: { uid: string; token?: Record<string, any> }, nowMs: number): void {
  const authTimeSec = Number(authContext?.token?.auth_time || 0);
  const nowSec = Math.floor(nowMs / 1000);
  if (!authTimeSec || (nowSec - authTimeSec) > MAX_REAUTH_AGE_SEC) {
    throw new HttpsError(
      "permission-denied",
      "REAUTH_REQUIRED: Recent authentication is required to perform this sensitive action."
    );
  }
}

export interface VerifyStepUpPinRequest {
  pin: string;
  scope?: StepUpScope;
}

export interface VerifyStepUpPinResponse {
  success: boolean;
  grantId: string;
  scope: string;
  expiresAt: number;
  migratedLegacyPin?: boolean;
}

export async function handleVerifyStepUpPin(
  request: { auth?: { uid: string; token?: Record<string, any> } | null; data?: VerifyStepUpPinRequest },
  deps: PinServerDependencies = defaultPinDeps
): Promise<VerifyStepUpPinResponse> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required for step-up verification.");
  }

  const uid = request.auth.uid;
  const rawScope = request.data?.scope || 'generalStepUp';
  const scope: StepUpScope = (ALLOWED_STEP_UP_SCOPES as readonly string[]).includes(rawScope)
    ? (rawScope as StepUpScope)
    : 'generalStepUp';
  const pin = request.data?.pin;

  if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    throw new HttpsError("invalid-argument", "PIN must be a valid 4-digit numeric string.");
  }

  const userRef = deps.firestore.collection('users').doc(uid);
  const lockoutRef = userRef.collection('security').doc('lockout');

  const now = deps.nowMs ? deps.nowMs() : Date.now();
  const lockoutSnap = await lockoutRef.get();
  const lockoutData = lockoutSnap.data() || { attempts: 0, lockedUntil: 0 };

  if (lockoutData.lockedUntil && lockoutData.lockedUntil > now) {
    const remainingSeconds = Math.ceil((lockoutData.lockedUntil - now) / 1000);
    throw new HttpsError(
      "resource-exhausted",
      `Too many failed attempts. Please wait ${remainingSeconds} seconds.`
    );
  }

  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  const userData = userSnap.data() || {};
  const meta = userData?.securityPinMeta;
  const hasMeta = !!(meta && meta.enabled && meta.salt && meta.verifier);
  const hasLegacy = hasLegacyPlaintextPin(userData);

  if (!hasMeta && !hasLegacy) {
    throw new HttpsError("failed-precondition", "Security PIN is not set up or disabled.");
  }

  // Verify against PBKDF2 meta when present, otherwise verify against legacy plaintext PIN
  const isValid = hasMeta
    ? verifyPinAgainstMeta(pin, meta)
    : verifyPinAgainstLegacy(pin, String(userData.securityPin));

  if (!isValid) {
    // Atomic lockout counter update; legacy PIN is NEVER migrated or deleted on failed PIN
    await deps.firestore.runTransaction(async (transaction: any) => {
      const snap = await transaction.get(lockoutRef);
      const curr = snap.data() || { attempts: 0, lockedUntil: 0 };
      const attempts = (curr.attempts || 0) + 1;
      let lockedUntil = 0;

      if (attempts >= 5) {
        lockedUntil = now + 60000; // 60s lockout after 5 failures
      } else if (attempts >= 3) {
        lockedUntil = now + 15000; // 15s delay after 3 failures
      }

      transaction.set(lockoutRef, { attempts, lockedUntil, updatedAt: now }, { merge: true });
    });

    throw new HttpsError("permission-denied", "Incorrect PIN code.");
  }

  let migratedLegacyPin = false;

  // Secure two-step server-side legacy PIN migration:
  // 1. Store PBKDF2 metadata first; 2. Delete plaintext securityPin ONLY AFTER metadata save succeeds.
  if (hasLegacy) {
    if (!hasMeta) {
      const migratedMeta = derivePbkdf2PinMeta(pin, now);
      await userRef.set(
        {
          securityPinEnabled: true,
          securityPinMeta: migratedMeta,
        },
        { merge: true }
      );
      migratedLegacyPin = true;
    }
    await userRef.update({
      securityPin: deps.fieldValueDelete(),
    });
  }

  // Success: Reset lockout attempts & create server-side scoped grant
  await lockoutRef.set({ attempts: 0, lockedUntil: 0, updatedAt: now }, { merge: true });

  const grantId = crypto.randomBytes(32).toString('hex');
  const expiresAt = now + 5 * 60 * 1000; // 5 minute TTL

  const grantRef = userRef.collection('security').doc(`grant_${grantId}`);
  await grantRef.set({
    grantId,
    uid,
    scope,
    issuedAt: now,
    expiresAt,
    consumed: false
  });

  return {
    success: true,
    grantId,
    scope,
    expiresAt,
    migratedLegacyPin,
  };
}

/**
 * Serverless Callable Function: verifyStepUpPin
 * 
 * Verifies user Security PIN server-side using PBKDF2 (100k iterations, SHA-256).
 * Enforces atomic server-side lockout, migrates legacy plaintext PINs safely after verification,
 * and generates short-lived scoped step-up grants.
 */
export const verifyStepUpPin = onCall<VerifyStepUpPinRequest, Promise<VerifyStepUpPinResponse>>(async (request) => {
  return handleVerifyStepUpPin(request, defaultPinDeps);
});

export interface UpdateSecurityPinRequest {
  newPin?: string;
  disable?: boolean;
  grantId?: string;
}

export async function handleUpdateSecurityPin(
  request: { auth?: { uid: string; token?: Record<string, any> } | null; data?: UpdateSecurityPinRequest },
  deps: PinServerDependencies = defaultPinDeps
): Promise<{ success: boolean }> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required to update Security PIN.");
  }

  const uid = request.auth.uid;
  const { newPin, disable, grantId } = request.data || {};
  const now = deps.nowMs ? deps.nowMs() : Date.now();

  const userRef = deps.firestore.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() || {};
  const hasLegacy = hasLegacyPlaintextPin(userData);
  const isCurrentlyEnabled = isUserPinActive(userData);

  // If user already has PIN (including legacy plaintext securityPin), require valid scoped step-up grant
  if (isCurrentlyEnabled) {
    await consumeScopedStepUpGrant(
      deps.firestore,
      userRef,
      uid,
      grantId,
      'updateSecurityPin',
      now,
      "Step-up verification required to change Security PIN."
    );
  }

  if (disable) {
    await userRef.set(
      {
        securityPinEnabled: false,
        securityPinMeta: {
          enabled: false,
          updatedAt: now
        }
      },
      { merge: true }
    );
    if (hasLegacy) {
      await userRef.update({ securityPin: deps.fieldValueDelete() });
    }
    return { success: true };
  }

  if (!newPin || typeof newPin !== 'string' || !/^\d{4}$/.test(newPin)) {
    throw new HttpsError("invalid-argument", "New PIN must be a valid 4-digit numeric string.");
  }

  // Derive PBKDF2 metadata server-side (16-byte salt, 100k iterations, 32-byte SHA-256)
  const newMeta = derivePbkdf2PinMeta(newPin, now);

  // Persist new metadata FIRST; delete legacy plaintext field ONLY AFTER metadata save succeeds
  await userRef.set(
    {
      securityPinEnabled: true,
      securityPinMeta: newMeta
    },
    { merge: true }
  );

  if (hasLegacy) {
    await userRef.update({ securityPin: deps.fieldValueDelete() });
  }

  return { success: true };
}

/**
 * Serverless Callable Function: updateSecurityPin
 * 
 * Safely sets, updates, or disables Security PIN metadata.
 * Server derives salt and verifier using PBKDF2. Requires valid step-up grant if PIN (including legacy securityPin) is currently active.
 */
export const updateSecurityPin = onCall<UpdateSecurityPinRequest, Promise<{ success: boolean }>>(async (request) => {
  return handleUpdateSecurityPin(request, defaultPinDeps);
});

export interface ResetUserWorkspaceRequest {
  grantId?: string;
}

export interface ResetUserWorkspaceResponse {
  success: boolean;
  message: string;
  resetProfile: {
    name: string;
    email: string;
    language: 'en';
    region: string;
    preferredCurrency: 'USD';
    notifications: boolean;
    notificationsEnabled: boolean;
    phoneNumber: string;
    avatar: string;
    role: string;
    theme: 'proton';
    showCommercialHub: boolean;
    securityPinEnabled: boolean;
  };
}

export async function handleResetUserWorkspace(
  request: { auth?: { uid: string; token?: Record<string, any> } | null; data?: ResetUserWorkspaceRequest },
  deps: PinServerDependencies = defaultPinDeps
): Promise<ResetUserWorkspaceResponse> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required to reset workspace.");
  }

  const uid = request.auth.uid;
  const { grantId } = request.data || {};
  const now = deps.nowMs ? deps.nowMs() : Date.now();

  const userRef = deps.firestore.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() || {};

  // Server-authoritative authorization check strictly from Firestore (NEVER trusts client flags)
  const isPinActive = isUserPinActive(userData);

  if (isPinActive) {
    await consumeScopedStepUpGrant(
      deps.firestore,
      userRef,
      uid,
      grantId,
      'resetUserWorkspace',
      now,
      "STEP_UP_REQUIRED: Step-up verification required to reset workspace."
    );
  } else {
    // PIN is disabled on server: enforce recent Firebase Auth re-authentication (auth_time within 5 minutes)
    assertRecentFirebaseReauth(request.auth, now);
  }

  // Server-side batch deletion of all user workspace subcollections (including projects)
  const subcollections = ['workflows', 'personas', 'chatHistory', 'tasks', 'projects', 'customAvatars'];

  for (const sub of subcollections) {
    const colRef = userRef.collection(sub);
    const snap = await colRef.get();
    if (!snap.empty) {
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 450) {
        const batch = deps.firestore.batch();
        docs.slice(i, i + 450).forEach((d: any) => batch.delete(d.ref));
        await batch.commit();
      }
    }
  }

  // Reset stats and base user profile fields authoritatively on server
  await userRef.collection('stats').doc('current').set({
    storageGB: 0,
    computeTimeHours: 0,
    aiTokens: 0,
    dailyGenerationsCount: 0,
    dailyGenerationsDate: '',
    spendingLimit: 5.00
  });

  const defaultEmail = String(request.auth.token?.email || userData.email || '');
  const defaultName = defaultEmail ? defaultEmail.split('@')[0] : 'User';
  const preservedRole = userData.role === 'admin' ? 'admin' : 'System Architect';

  const resetProfile = {
    name: defaultName,
    email: defaultEmail,
    language: 'en' as const,
    region: 'Tbilisi, GE',
    preferredCurrency: 'USD' as const,
    notifications: true,
    notificationsEnabled: true,
    phoneNumber: '',
    avatar: '',
    role: preservedRole,
    theme: 'proton' as const,
    showCommercialHub: false,
  };

  await userRef.set(resetProfile, { merge: true });

  return {
    success: true,
    message: "Workspace subcollections and profile defaults securely reset via Admin SDK.",
    resetProfile: {
      ...resetProfile,
      securityPinEnabled: isPinActive,
    }
  };
}

/**
 * Serverless Callable Function: resetUserWorkspace
 * 
 * Server-authoritative destructive workspace reset.
 * Checks Firestore server state to enforce step-up grant (when PIN active) or recent reauth (when PIN disabled).
 */
export const resetUserWorkspace = onCall<ResetUserWorkspaceRequest, Promise<ResetUserWorkspaceResponse>>(async (request) => {
  return handleResetUserWorkspace(request, defaultPinDeps);
});

export interface UpdateUserEmailRequest {
  newEmail: string;
  grantId?: string;
}

export interface UpdateUserEmailResponse {
  success: boolean;
  email: string;
}

export async function handleUpdateUserEmail(
  request: { auth?: { uid: string; token?: Record<string, any> } | null; data?: UpdateUserEmailRequest },
  deps: PinServerDependencies = defaultPinDeps
): Promise<UpdateUserEmailResponse> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required to change email address.");
  }

  const uid = request.auth.uid;
  const rawEmail = request.data?.newEmail;
  const grantId = request.data?.grantId;
  const now = deps.nowMs ? deps.nowMs() : Date.now();

  if (!rawEmail || typeof rawEmail !== 'string') {
    throw new HttpsError("invalid-argument", "A valid email address is required.");
  }

  const normalizedEmail = rawEmail.trim().toLowerCase();
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new HttpsError("invalid-argument", "Invalid email address format.");
  }

  const userRef = deps.firestore.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() || {};

  // Server-authoritative authorization check strictly from Firestore
  const isPinActive = isUserPinActive(userData);

  if (isPinActive) {
    await consumeScopedStepUpGrant(
      deps.firestore,
      userRef,
      uid,
      grantId,
      'changeEmail',
      now,
      "STEP_UP_REQUIRED: Step-up verification required to change email address."
    );
  } else {
    // PIN is disabled on server: require recent Firebase Authentication (reauthentication)
    assertRecentFirebaseReauth(request.auth, now);
  }

  const authRecord = await deps.auth.getUser(uid);
  const previousAuthEmail = authRecord?.email ? String(authRecord.email).trim().toLowerCase() : '';

  if (previousAuthEmail === normalizedEmail) {
    if (String(userData.email || '').trim().toLowerCase() !== normalizedEmail) {
      await userRef.set({ email: normalizedEmail }, { merge: true });
    }
    return { success: true, email: normalizedEmail };
  }

  // Step 1: Update Firebase Authentication email first
  try {
    await deps.auth.updateUser(uid, { email: normalizedEmail });
  } catch (authErr: any) {
    const code = String(authErr?.code || '');
    if (code === 'auth/email-already-exists') {
      throw new HttpsError("already-exists", "Email address is already in use by another account.");
    }
    if (code === 'auth/invalid-email') {
      throw new HttpsError("invalid-argument", "Invalid email address format.");
    }
    throw new HttpsError(
      "failed-precondition",
      `Firebase Authentication email update failed: ${authErr?.message || code || 'operation denied'}`
    );
  }

  // Step 2: Synchronize Firestore profile email; rollback Firebase Auth if Firestore write fails
  try {
    await userRef.set({ email: normalizedEmail }, { merge: true });
  } catch (fsErr: any) {
    if (previousAuthEmail) {
      try {
        await deps.auth.updateUser(uid, { email: previousAuthEmail });
      } catch (rollbackErr) {
        console.error("CRITICAL: Failed to rollback Firebase Auth email after Firestore failure:", rollbackErr);
      }
    }
    throw new HttpsError("internal", "Failed to synchronize email to user profile; Auth email change was rolled back.");
  }

  return {
    success: true,
    email: normalizedEmail,
  };
}

/**
 * Serverless Callable Function: updateUserEmail
 * 
 * Synchronizes Firebase Auth email and Firestore users/{uid}.email atomically with rollback protection.
 */
export const updateUserEmail = onCall<UpdateUserEmailRequest, Promise<UpdateUserEmailResponse>>(async (request) => {
  return handleUpdateUserEmail(request, defaultPinDeps);
});

/**
 * Backend Event Trigger: onOrderCreated
 * 
 * Automatically and reliably notifies the seller when a buyer places a new order.
 * - Validates order fields and seller ID
 * - Uses orderId for deterministic document identity (idempotent, no duplicates)
 * - Writes to users/{sellerId}/notifications/{notificationId} via Admin SDK (bypasses client security rules)
 * - Safe against failures (does not fail order transaction)
 */
export const onOrderCreated = onDocumentCreated(
  {
    document: "orders/{orderId}",
    database: DATABASE_ID
  },
  async (event) => {
    try {
      const snapshot = event.data;
      if (!snapshot) {
        console.warn("[onOrderCreated] No snapshot data available in event.");
        return;
      }

      const orderData = snapshot.data();
      if (!orderData) {
        console.warn("[onOrderCreated] Document data is empty.");
        return;
      }

      const orderId = event.params.orderId || snapshot.id;
      const { sellerId, buyerId, listingId, itemTitle } = orderData;

      // 1. Validate required order fields & identify seller
      if (!sellerId || typeof sellerId !== "string" || !sellerId.trim()) {
        console.warn(`[onOrderCreated] Order ${orderId} missing or invalid sellerId.`);
        return;
      }

      // Avoid self-notifications
      if (buyerId && buyerId === sellerId) {
        console.log(`[onOrderCreated] Order ${orderId} buyer matches seller (${sellerId}). Skipping notification.`);
        return;
      }

      const cleanSellerId = sellerId.trim();
      const firestore = snapshot.ref.firestore || db;

      // 2. Deterministic notification ID for strict idempotency
      const notificationId = `market_order_${orderId}`;
      const notifRef = firestore
        .collection("users")
        .doc(cleanSellerId)
        .collection("notifications")
        .doc(notificationId);

      // Check if already created (duplicate event protection)
      const existingSnap = await notifRef.get();
      if (existingSnap.exists) {
        console.log(`[onOrderCreated] Order notification ${notificationId} already exists. Skipping.`);
        return;
      }

      const title = "New Order Received";
      const titleKa = "მიღებულია ახალი შეკვეთა";
      const shortId = orderId.length > 6 ? orderId.slice(-6).toUpperCase() : orderId;
      const itemLabel = itemTitle || "an item";
      const message = `You received a new order for "${itemLabel}" (#${shortId}).`;
      const messageKa = `თქვენ მიიღეთ ახალი შეკვეთა: "${itemLabel}" (#${shortId}).`;

      const notificationDoc = {
        id: notificationId,
        title,
        titleKa,
        message,
        messageKa,
        timestamp: Date.now(),
        read: false,
        category: "market",
        type: "market_order",
        targetView: "market",
        orderId: orderId,
        listingId: listingId || "",
        buyerId: buyerId || "",
        sellerId: cleanSellerId,
        metadata: {
          type: "market_order",
          orderId: orderId,
          listingId: listingId || "",
          buyerId: buyerId || "",
          sellerId: cleanSellerId
        }
      };

      await notifRef.set(notificationDoc);
      console.log(`[onOrderCreated] Successfully created seller notification ${notificationId} for seller ${cleanSellerId}`);
    } catch (error) {
      // Failure safety: Log error clearly without throwing to prevent cascading failures
      console.error(`[onOrderCreated] Error creating seller notification for order ${event.params?.orderId}:`, error);
    }
  }
);

export interface MarketMessageNotificationDeps {
  messageId: string;
  messageData: Record<string, any> | undefined | null;
  firestore: {
    collection: (name: string) => any;
  };
  now?: () => number;
  logger?: Pick<Console, "log" | "warn" | "error">;
}

export interface MarketMessageNotificationResult {
  created: boolean;
  recipientId?: string;
  notificationId?: string;
  reason?: string;
}

const getTrimmedNonEmptyString = (val: unknown): string => {
  return typeof val === "string" ? val.trim() : "";
};

export async function processMarketMessageNotification({
  messageId,
  messageData,
  firestore,
  now = () => Date.now(),
  logger = console
}: MarketMessageNotificationDeps): Promise<MarketMessageNotificationResult> {
  const cleanMessageId = getTrimmedNonEmptyString(messageId);
  if (!cleanMessageId) {
    logger.warn("[onMarketMessageCreated] Missing or invalid messageId.");
    return { created: false, reason: "invalid_message_id" };
  }

  if (!messageData || typeof messageData !== "object") {
    logger.warn(`[onMarketMessageCreated] Document data is empty for message ${cleanMessageId}.`);
    return { created: false, reason: "empty_message_data" };
  }

  const cleanSenderId = getTrimmedNonEmptyString(messageData.senderId);
  const cleanSellerId = getTrimmedNonEmptyString(messageData.sellerId);
  const cleanBuyerId = getTrimmedNonEmptyString(messageData.buyerId);
  const cleanListingId = getTrimmedNonEmptyString(messageData.listingId);
  const cleanConversationId = getTrimmedNonEmptyString(messageData.conversationId);

  // 1. Validate required identity and routing fields
  if (!cleanSenderId || !cleanSellerId || !cleanBuyerId || !cleanListingId || !cleanConversationId) {
    logger.warn(`[onMarketMessageCreated] Message ${cleanMessageId} missing required identity/routing fields.`);
    return { created: false, reason: "missing_required_fields" };
  }

  // 2. Prevent self-messaging / self-notifications
  if (cleanBuyerId === cleanSellerId) {
    logger.warn(`[onMarketMessageCreated] Message ${cleanMessageId} rejected: buyerId matches sellerId (${cleanSellerId}).`);
    return { created: false, reason: "self_messaging_forbidden" };
  }

  // 3. Enforce canonical conversationId = listingId + "_" + buyerId
  const canonicalConversationId = `${cleanListingId}_${cleanBuyerId}`;
  if (cleanConversationId !== canonicalConversationId) {
    logger.warn(
      `[onMarketMessageCreated] Message ${cleanMessageId} conversationId mismatch: ` +
      `got=${cleanConversationId}, expected=${canonicalConversationId}.`
    );
    return { created: false, reason: "conversation_id_mismatch" };
  }

  // 4. Verify sender is strictly one of the two declared participants
  if (cleanSenderId !== cleanBuyerId && cleanSenderId !== cleanSellerId) {
    logger.warn(`[onMarketMessageCreated] Message ${cleanMessageId} senderId ${cleanSenderId} is neither buyer nor seller.`);
    return { created: false, reason: "sender_not_participant" };
  }

  // 5. Verify participants array strictly matches [buyerId, sellerId]
  const rawParticipants = messageData.participants;
  if (!Array.isArray(rawParticipants) || rawParticipants.length !== 2) {
    logger.warn(`[onMarketMessageCreated] Message ${cleanMessageId} missing or invalid participants array.`);
    return { created: false, reason: "participants_invalid" };
  }
  const cleanParticipants = rawParticipants.map((p) => getTrimmedNonEmptyString(p));
  const participantSet = new Set(cleanParticipants);
  if (
    participantSet.size !== 2 ||
    !participantSet.has(cleanBuyerId) ||
    !participantSet.has(cleanSellerId)
  ) {
    logger.warn(`[onMarketMessageCreated] Message ${cleanMessageId} participants mismatch.`);
    return { created: false, reason: "participants_mismatch" };
  }

  // 6. Verify listing existence and authoritative seller ownership
  const listingSnap = await firestore.collection("listings").doc(cleanListingId).get();
  if (!listingSnap.exists) {
    logger.warn(`[onMarketMessageCreated] Listing ${cleanListingId} does not exist for message ${cleanMessageId}. Skipping notification.`);
    return { created: false, reason: "listing_not_found" };
  }

  const listingData = listingSnap.data() || {};
  const authoritativeSellerId = getTrimmedNonEmptyString(listingData.sellerId);
  if (!authoritativeSellerId || authoritativeSellerId !== cleanSellerId) {
    logger.warn(
      `[onMarketMessageCreated] Forged or mismatched sellerId for message ${cleanMessageId}: ` +
      `claimed=${cleanSellerId}, authoritative=${authoritativeSellerId || "missing"}. Skipping notification.`
    );
    return { created: false, reason: "seller_mismatch" };
  }

  // 7. Determine two-way recipient (never notify sender)
  const isBuyerSending = cleanSenderId === cleanBuyerId;
  const recipientId = isBuyerSending ? cleanSellerId : cleanBuyerId;
  if (!recipientId || recipientId === cleanSenderId) {
    logger.warn(`[onMarketMessageCreated] Could not resolve distinct recipient for message ${cleanMessageId}.`);
    return { created: false, reason: "invalid_recipient" };
  }

  // Validate receiverId if present on document
  if (messageData.receiverId !== undefined) {
    const cleanReceiverId = getTrimmedNonEmptyString(messageData.receiverId);
    if (!cleanReceiverId || cleanReceiverId !== recipientId) {
      logger.warn(
        `[onMarketMessageCreated] receiverId mismatch for message ${cleanMessageId}: ` +
        `got=${cleanReceiverId || "invalid"}, expected=${recipientId}. Skipping notification.`
      );
      return { created: false, reason: "receiver_mismatch" };
    }
  }

  // 8. Deterministic notification ID & atomic idempotency
  const notificationId = `market_msg_${cleanMessageId}`;
  const notifRef = firestore
    .collection("users")
    .doc(recipientId)
    .collection("notifications")
    .doc(notificationId);

  const existingSnap = await notifRef.get();
  if (existingSnap.exists) {
    logger.log(`[onMarketMessageCreated] Message notification ${notificationId} already exists for ${recipientId}. Skipping.`);
    return { created: false, recipientId, notificationId, reason: "already_exists" };
  }

  const itemLabel =
    getTrimmedNonEmptyString(messageData.listingTitle) ||
    getTrimmedNonEmptyString(listingData.title) ||
    "Marketplace Item";
  const senderLabel =
    getTrimmedNonEmptyString(messageData.senderName) ||
    (isBuyerSending ? "Buyer" : getTrimmedNonEmptyString(listingData.sellerName) || "Seller");
  const rawText = typeof messageData.text === "string" ? messageData.text.trim() : "";
  const snippet = rawText.length > 80 ? `${rawText.slice(0, 77)}...` : (rawText || "New message");
  const cleanOrderId = getTrimmedNonEmptyString(messageData.orderId);

  const title = `New Message: ${itemLabel}`;
  const titleKa = `ახალი შეტყობინება: ${itemLabel}`;
  const message = `${senderLabel}: "${snippet}"`;
  const messageKa = `${senderLabel}: "${snippet}"`;

  const notificationDoc = {
    id: notificationId,
    title,
    titleKa,
    message,
    messageKa,
    timestamp: now(),
    read: false,
    category: "market",
    type: "market_message",
    targetView: "market",
    sellerId: cleanSellerId,
    buyerId: cleanBuyerId,
    listingId: cleanListingId,
    conversationId: canonicalConversationId,
    ...(cleanOrderId ? { orderId: cleanOrderId } : {}),
    metadata: {
      type: "market_message",
      sellerId: cleanSellerId,
      buyerId: cleanBuyerId,
      listingId: cleanListingId,
      conversationId: canonicalConversationId,
      messageId: cleanMessageId,
      senderId: cleanSenderId,
      recipientId,
      ...(cleanOrderId ? { orderId: cleanOrderId } : {})
    }
  };

  try {
    await notifRef.create(notificationDoc);
  } catch (createError: any) {
    if (
      createError?.code === 6 ||
      createError?.code === "already-exists" ||
      /already exists/i.test(createError?.message || "")
    ) {
      logger.log(`[onMarketMessageCreated] Message notification ${notificationId} already created concurrently for ${recipientId}. Skipping.`);
      return { created: false, recipientId, notificationId, reason: "already_exists" };
    }
    throw createError;
  }

  logger.log(`[onMarketMessageCreated] Successfully created notification ${notificationId} for recipient ${recipientId} (${isBuyerSending ? "buyer->seller" : "seller->buyer"})`);
  return { created: true, recipientId, notificationId };
}

// ============================================================================
// CHAT-AUD-02 STAGE 1: UNREAD MESSAGES & READ CURSOR BACKEND FOUNDATION
// ============================================================================

export const DEFAULT_UNREAD_RECONCILE_CHUNK_SIZE = 200;

export interface MarketConversationDocument {
  conversationId: string;
  listingId: string;
  listingTitle: string;
  orderId: string | null;
  buyerId: string;
  sellerId: string;
  buyerName: string;
  sellerName: string;
  participants: string[];
  lastMessageId: string | null;
  lastMessageText: string;
  lastMessageAt: number | null;
  lastSenderId: string | null;
  buyerUnreadCount: number;
  sellerUnreadCount: number;
  buyerLastReadAt: number | null;
  sellerLastReadAt: number | null;
  buyerLastReadMessageId: string | null;
  sellerLastReadMessageId: string | null;
  updatedAt: number;
}

export function extractTimestampMs(val: unknown): number | null {
  if (typeof val === "number" && Number.isFinite(val)) {
    return val;
  }
  if (!val) return null;
  if (val instanceof Date) {
    const ms = val.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof val === "object") {
    const obj = val as Record<string, any>;
    if (typeof obj.toMillis === "function") {
      const ms = obj.toMillis();
      return typeof ms === "number" && Number.isFinite(ms) ? ms : null;
    }
    if (typeof obj.seconds === "number") {
      const nanos = typeof obj.nanoseconds === "number" ? obj.nanoseconds : 0;
      return obj.seconds * 1000 + Math.floor(nanos / 1e6);
    }
    if (typeof obj._seconds === "number") {
      const nanos = typeof obj._nanoseconds === "number" ? obj._nanoseconds : 0;
      return obj._seconds * 1000 + Math.floor(nanos / 1e6);
    }
  }
  if (typeof val === "string") {
    const parsed = Date.parse(val);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function compareMessageOrder(
  aCreatedAtMs: number,
  aMessageId: string,
  bCreatedAtMs: number,
  bMessageId: string
): number {
  if (aCreatedAtMs !== bCreatedAtMs) {
    return aCreatedAtMs > bCreatedAtMs ? 1 : -1;
  }
  if (aMessageId === bMessageId) return 0;
  return aMessageId > bMessageId ? 1 : -1;
}

export interface MarketConversationUpdateDeps {
  messageId: string;
  messageData: Record<string, any> | undefined | null;
  firestore: {
    collection: (name: string) => any;
    runTransaction: <T>(updateFunction: (transaction: any) => Promise<T>) => Promise<T>;
  };
  now?: () => number;
  logger?: Pick<Console, "log" | "warn" | "error">;
}

export interface MarketConversationUpdateResult {
  updated: boolean;
  duplicate?: boolean;
  markedUnread?: boolean;
  conversationId?: string;
  recipientId?: string;
  reason?: string;
}

export async function processMarketMessageConversationUpdate({
  messageId,
  messageData,
  firestore,
  now = () => Date.now(),
  logger = console
}: MarketConversationUpdateDeps): Promise<MarketConversationUpdateResult> {
  const cleanMessageId = getTrimmedNonEmptyString(messageId);
  if (!cleanMessageId) {
    logger.warn("[onMarketMessageCreated:conv] Missing or invalid messageId.");
    return { updated: false, reason: "invalid_message_id" };
  }

  if (!messageData || typeof messageData !== "object") {
    logger.warn(`[onMarketMessageCreated:conv] Document data is empty for message ${cleanMessageId}.`);
    return { updated: false, reason: "empty_message_data" };
  }

  const cleanSenderId = getTrimmedNonEmptyString(messageData.senderId);
  const cleanSellerId = getTrimmedNonEmptyString(messageData.sellerId);
  const cleanBuyerId = getTrimmedNonEmptyString(messageData.buyerId);
  const cleanListingId = getTrimmedNonEmptyString(messageData.listingId);
  const cleanConversationId = getTrimmedNonEmptyString(messageData.conversationId);

  if (!cleanSenderId || !cleanSellerId || !cleanBuyerId || !cleanListingId || !cleanConversationId) {
    logger.warn(`[onMarketMessageCreated:conv] Message ${cleanMessageId} missing required identity/routing fields.`);
    return { updated: false, reason: "missing_required_fields" };
  }

  if (cleanBuyerId === cleanSellerId) {
    logger.warn(`[onMarketMessageCreated:conv] Message ${cleanMessageId} rejected: buyerId matches sellerId (${cleanSellerId}).`);
    return { updated: false, reason: "self_messaging_forbidden" };
  }

  const canonicalConversationId = `${cleanListingId}_${cleanBuyerId}`;
  if (cleanConversationId !== canonicalConversationId) {
    logger.warn(
      `[onMarketMessageCreated:conv] Message ${cleanMessageId} conversationId mismatch: ` +
      `got=${cleanConversationId}, expected=${canonicalConversationId}.`
    );
    return { updated: false, reason: "conversation_id_mismatch" };
  }

  if (cleanSenderId !== cleanBuyerId && cleanSenderId !== cleanSellerId) {
    logger.warn(`[onMarketMessageCreated:conv] Message ${cleanMessageId} senderId ${cleanSenderId} is neither buyer nor seller.`);
    return { updated: false, reason: "sender_not_participant" };
  }

  const rawParticipants = messageData.participants;
  if (!Array.isArray(rawParticipants) || rawParticipants.length !== 2) {
    logger.warn(`[onMarketMessageCreated:conv] Message ${cleanMessageId} missing or invalid participants array.`);
    return { updated: false, reason: "participants_invalid" };
  }
  const cleanParticipants = rawParticipants.map((p) => getTrimmedNonEmptyString(p));
  const participantSet = new Set(cleanParticipants);
  if (
    participantSet.size !== 2 ||
    !participantSet.has(cleanBuyerId) ||
    !participantSet.has(cleanSellerId)
  ) {
    logger.warn(`[onMarketMessageCreated:conv] Message ${cleanMessageId} participants mismatch.`);
    return { updated: false, reason: "participants_mismatch" };
  }

  const listingSnap = await firestore.collection("listings").doc(cleanListingId).get();
  if (!listingSnap.exists) {
    logger.warn(`[onMarketMessageCreated:conv] Listing ${cleanListingId} does not exist for message ${cleanMessageId}.`);
    return { updated: false, reason: "listing_not_found" };
  }

  const listingData = listingSnap.data() || {};
  const authoritativeSellerId = getTrimmedNonEmptyString(listingData.sellerId);
  if (!authoritativeSellerId || authoritativeSellerId !== cleanSellerId) {
    logger.warn(
      `[onMarketMessageCreated:conv] Forged or mismatched sellerId for message ${cleanMessageId}: ` +
      `claimed=${cleanSellerId}, authoritative=${authoritativeSellerId || "missing"}.`
    );
    return { updated: false, reason: "seller_mismatch" };
  }

  const isBuyerSending = cleanSenderId === cleanBuyerId;
  const recipientId = isBuyerSending ? cleanSellerId : cleanBuyerId;
  if (!recipientId || recipientId === cleanSenderId) {
    return { updated: false, reason: "invalid_recipient" };
  }

  if (messageData.receiverId !== undefined) {
    const cleanReceiverId = getTrimmedNonEmptyString(messageData.receiverId);
    if (!cleanReceiverId || cleanReceiverId !== recipientId) {
      return { updated: false, reason: "receiver_mismatch" };
    }
  }

  const nowMs = now();
  const messageCreatedAtMs = extractTimestampMs(messageData.createdAt) ?? nowMs;
  const rawText = typeof messageData.text === "string" ? messageData.text.trim() : "";
  const previewText = rawText.length > 500 ? `${rawText.slice(0, 497)}...` : rawText;
  const incomingOrderId = getTrimmedNonEmptyString(messageData.orderId) || null;
  const incomingListingTitle =
    getTrimmedNonEmptyString(messageData.listingTitle) ||
    getTrimmedNonEmptyString(listingData.title) ||
    "Marketplace Item";

  const convRef = firestore.collection("market_conversations").doc(canonicalConversationId);
  const procRef = convRef.collection("processed_messages").doc(cleanMessageId);
  const unreadMsgRef = convRef.collection("unread").doc(recipientId).collection("messages").doc(cleanMessageId);

  return firestore.runTransaction(async (tx) => {
    const convSnap = await tx.get(convRef);
    const procSnap = await tx.get(procRef);

    if (procSnap.exists) {
      logger.log(`[onMarketMessageCreated:conv] Message ${cleanMessageId} already processed for ${canonicalConversationId}. Skipping.`);
      return {
        updated: false,
        duplicate: true,
        conversationId: canonicalConversationId,
        recipientId,
        reason: "already_processed"
      };
    }

    const existingConv = convSnap.exists ? ((convSnap.data() || {}) as Partial<MarketConversationDocument>) : null;
    if (existingConv) {
      const existingBuyer = getTrimmedNonEmptyString(existingConv.buyerId);
      const existingSeller = getTrimmedNonEmptyString(existingConv.sellerId);
      const existingListing = getTrimmedNonEmptyString(existingConv.listingId);
      if (
        (existingBuyer && existingBuyer !== cleanBuyerId) ||
        (existingSeller && existingSeller !== cleanSellerId) ||
        (existingListing && existingListing !== cleanListingId)
      ) {
        logger.warn(`[onMarketMessageCreated:conv] Conversation ${canonicalConversationId} participant mismatch on existing doc.`);
        return { updated: false, reason: "conversation_participant_conflict" };
      }
    }

    const prevBuyerUnread =
      typeof existingConv?.buyerUnreadCount === "number" && existingConv.buyerUnreadCount >= 0
        ? existingConv.buyerUnreadCount
        : 0;
    const prevSellerUnread =
      typeof existingConv?.sellerUnreadCount === "number" && existingConv.sellerUnreadCount >= 0
        ? existingConv.sellerUnreadCount
        : 0;

    const recipientLastReadAt = isBuyerSending
      ? (typeof existingConv?.sellerLastReadAt === "number" ? existingConv.sellerLastReadAt : null)
      : (typeof existingConv?.buyerLastReadAt === "number" ? existingConv.buyerLastReadAt : null);
    const recipientLastReadMessageId = isBuyerSending
      ? getTrimmedNonEmptyString(existingConv?.sellerLastReadMessageId)
      : getTrimmedNonEmptyString(existingConv?.buyerLastReadMessageId);

    const isAlreadyReadByCursor =
      recipientLastReadAt !== null &&
      compareMessageOrder(
        messageCreatedAtMs,
        cleanMessageId,
        recipientLastReadAt,
        recipientLastReadMessageId
      ) <= 0;

    const shouldMarkUnread = !isAlreadyReadByCursor;

    const nextBuyerUnread = !isBuyerSending && shouldMarkUnread ? prevBuyerUnread + 1 : prevBuyerUnread;
    const nextSellerUnread = isBuyerSending && shouldMarkUnread ? prevSellerUnread + 1 : prevSellerUnread;

    const prevLastMessageAt = typeof existingConv?.lastMessageAt === "number" ? existingConv.lastMessageAt : null;
    const prevLastMessageId = getTrimmedNonEmptyString(existingConv?.lastMessageId);

    const isNewerLastMessage =
      prevLastMessageAt === null ||
      compareMessageOrder(messageCreatedAtMs, cleanMessageId, prevLastMessageAt, prevLastMessageId) > 0;

    const nextSellerName =
      (!isBuyerSending ? getTrimmedNonEmptyString(messageData.senderName) : "") ||
      getTrimmedNonEmptyString(listingData.sellerName) ||
      getTrimmedNonEmptyString(existingConv?.sellerName) ||
      "Seller";

    const nextBuyerName =
      (isBuyerSending ? getTrimmedNonEmptyString(messageData.senderName) : "") ||
      getTrimmedNonEmptyString(messageData.buyerName) ||
      getTrimmedNonEmptyString(existingConv?.buyerName) ||
      "Buyer";

    const existingOrderId = getTrimmedNonEmptyString(existingConv?.orderId) || null;
    const nextOrderId = isNewerLastMessage
      ? (incomingOrderId || existingOrderId)
      : (existingOrderId || incomingOrderId);

    const nextConvDoc: MarketConversationDocument = {
      conversationId: canonicalConversationId,
      listingId: cleanListingId,
      listingTitle: isNewerLastMessage
        ? incomingListingTitle
        : (getTrimmedNonEmptyString(existingConv?.listingTitle) || incomingListingTitle),
      orderId: nextOrderId,
      buyerId: cleanBuyerId,
      sellerId: cleanSellerId,
      buyerName: nextBuyerName,
      sellerName: nextSellerName,
      participants: [cleanBuyerId, cleanSellerId],
      lastMessageId: isNewerLastMessage ? cleanMessageId : (prevLastMessageId || cleanMessageId),
      lastMessageText: isNewerLastMessage
        ? previewText
        : (typeof existingConv?.lastMessageText === "string" ? existingConv.lastMessageText : previewText),
      lastMessageAt: isNewerLastMessage ? messageCreatedAtMs : prevLastMessageAt,
      lastSenderId: isNewerLastMessage
        ? cleanSenderId
        : (getTrimmedNonEmptyString(existingConv?.lastSenderId) || cleanSenderId),
      buyerUnreadCount: nextBuyerUnread,
      sellerUnreadCount: nextSellerUnread,
      buyerLastReadAt: typeof existingConv?.buyerLastReadAt === "number" ? existingConv.buyerLastReadAt : null,
      sellerLastReadAt: typeof existingConv?.sellerLastReadAt === "number" ? existingConv.sellerLastReadAt : null,
      buyerLastReadMessageId: getTrimmedNonEmptyString(existingConv?.buyerLastReadMessageId) || null,
      sellerLastReadMessageId: getTrimmedNonEmptyString(existingConv?.sellerLastReadMessageId) || null,
      updatedAt: now()
    };

    tx.set(procRef, {
      messageId: cleanMessageId,
      conversationId: canonicalConversationId,
      senderId: cleanSenderId,
      recipientId,
      createdAt: messageCreatedAtMs,
      processedAt: nextConvDoc.updatedAt
    });

    if (shouldMarkUnread) {
      tx.set(unreadMsgRef, {
        messageId: cleanMessageId,
        conversationId: canonicalConversationId,
        senderId: cleanSenderId,
        recipientId,
        createdAt: messageCreatedAtMs,
        recordedAt: nextConvDoc.updatedAt
      });
    }

    tx.set(convRef, nextConvDoc, { merge: true });

    return {
      updated: true,
      duplicate: false,
      markedUnread: shouldMarkUnread,
      conversationId: canonicalConversationId,
      recipientId
    };
  });
}

export async function processMarketMessageCreated(
  deps: MarketConversationUpdateDeps
): Promise<{
  conversation: MarketConversationUpdateResult;
  notification: MarketMessageNotificationResult;
}> {
  let conversation: MarketConversationUpdateResult = { updated: false, reason: "not_run" };
  let notification: MarketMessageNotificationResult = { created: false, reason: "not_run" };

  try {
    conversation = await processMarketMessageConversationUpdate(deps);
  } catch (err) {
    (deps.logger || console).error(
      `[onMarketMessageCreated] Error updating conversation state for message ${deps.messageId}:`,
      err
    );
    conversation = { updated: false, reason: "error" };
  }

  try {
    notification = await processMarketMessageNotification(deps);
  } catch (err) {
    (deps.logger || console).error(
      `[onMarketMessageCreated] Error creating message notification for message ${deps.messageId}:`,
      err
    );
    notification = { created: false, reason: "error" };
  }

  return { conversation, notification };
}

export interface MarkMarketConversationReadRequest {
  conversationId: string;
  lastVisibleMessageId: string;
}

export interface MarkMarketConversationReadDeps {
  callerUid: string | null | undefined;
  conversationId: unknown;
  lastVisibleMessageId: unknown;
  firestore: {
    collection: (name: string) => any;
    runTransaction: <T>(updateFunction: (transaction: any) => Promise<T>) => Promise<T>;
  };
  now?: () => number;
  chunkSize?: number;
  logger?: Pick<Console, "log" | "warn" | "error">;
}

export interface MarkMarketConversationReadResult {
  success: boolean;
  conversationId: string;
  role: "buyer" | "seller";
  unreadCount: number;
  lastReadAt: number;
  lastReadMessageId: string;
  clearedCount: number;
}

export async function processMarkMarketConversationRead({
  callerUid,
  conversationId,
  lastVisibleMessageId,
  firestore,
  now = () => Date.now(),
  chunkSize = DEFAULT_UNREAD_RECONCILE_CHUNK_SIZE,
  logger = console
}: MarkMarketConversationReadDeps): Promise<MarkMarketConversationReadResult> {
  const cleanCallerUid = getTrimmedNonEmptyString(callerUid);
  if (!cleanCallerUid) {
    throw new HttpsError("unauthenticated", "Authentication required to mark conversation as read.");
  }

  const cleanConversationId = getTrimmedNonEmptyString(conversationId);
  const cleanLastVisibleMessageId = getTrimmedNonEmptyString(lastVisibleMessageId);
  if (!cleanConversationId || cleanConversationId.length > 260) {
    throw new HttpsError("invalid-argument", "conversationId must be a valid non-empty string.");
  }
  if (!cleanLastVisibleMessageId || cleanLastVisibleMessageId.length > 128) {
    throw new HttpsError("invalid-argument", "lastVisibleMessageId must be a valid non-empty string.");
  }

  const convRef = firestore.collection("market_conversations").doc(cleanConversationId);
  const initialConvSnap = await convRef.get();
  if (!initialConvSnap.exists) {
    throw new HttpsError("not-found", "Conversation not found.");
  }

  const initialConvData = (initialConvSnap.data() || {}) as Partial<MarketConversationDocument>;
  const convBuyerId = getTrimmedNonEmptyString(initialConvData.buyerId);
  const convSellerId = getTrimmedNonEmptyString(initialConvData.sellerId);
  if (!convBuyerId || !convSellerId || convBuyerId === convSellerId) {
    throw new HttpsError("failed-precondition", "Conversation participant metadata is invalid.");
  }
  if (cleanCallerUid !== convBuyerId && cleanCallerUid !== convSellerId) {
    throw new HttpsError("permission-denied", "Only conversation participants can mark messages as read.");
  }

  const msgSnap = await firestore.collection("market_messages").doc(cleanLastVisibleMessageId).get();
  if (!msgSnap.exists) {
    throw new HttpsError("not-found", "Target message not found.");
  }

  const msgData = msgSnap.data() || {};
  const msgListingId = getTrimmedNonEmptyString(msgData.listingId);
  const msgBuyerId = getTrimmedNonEmptyString(msgData.buyerId);
  const msgConversationId =
    getTrimmedNonEmptyString(msgData.conversationId) ||
    (msgListingId && msgBuyerId ? `${msgListingId}_${msgBuyerId}` : "");

  if (!msgConversationId || msgConversationId !== cleanConversationId) {
    throw new HttpsError(
      "permission-denied",
      "Target message does not belong to the specified conversation."
    );
  }

  if (Array.isArray(msgData.participants)) {
    const cleanMsgParticipants = msgData.participants.map((p: unknown) => getTrimmedNonEmptyString(p));
    if (!cleanMsgParticipants.includes(cleanCallerUid)) {
      throw new HttpsError("permission-denied", "Caller is not a participant of the target message.");
    }
  }

  const role: "buyer" | "seller" = cleanCallerUid === convBuyerId ? "buyer" : "seller";
  const targetCreatedAtMs = extractTimestampMs(msgData.createdAt) ?? now();
  const safeChunkSize = Math.max(1, Math.min(chunkSize, 250));
  const unreadMsgsCol = convRef.collection("unread").doc(cleanCallerUid).collection("messages");

  let totalCleared = 0;
  let finalUnreadCount = 0;
  let finalLastReadAt = targetCreatedAtMs;
  let finalLastReadMessageId = cleanLastVisibleMessageId;

  const MAX_CHUNKS = 100;
  for (let iteration = 0; iteration < MAX_CHUNKS; iteration++) {
    const stepOutcome = await firestore.runTransaction(async (tx) => {
      const freshConvSnap = await tx.get(convRef);
      if (!freshConvSnap.exists) {
        throw new HttpsError("not-found", "Conversation not found.");
      }

      const freshConv = (freshConvSnap.data() || {}) as Partial<MarketConversationDocument>;
      const freshBuyerId = getTrimmedNonEmptyString(freshConv.buyerId);
      const freshSellerId = getTrimmedNonEmptyString(freshConv.sellerId);
      if (cleanCallerUid !== freshBuyerId && cleanCallerUid !== freshSellerId) {
        throw new HttpsError("permission-denied", "Caller is no longer a participant in this conversation.");
      }

      const activeRole: "buyer" | "seller" = cleanCallerUid === freshBuyerId ? "buyer" : "seller";
      const prevReadAt = activeRole === "buyer"
        ? (typeof freshConv.buyerLastReadAt === "number" ? freshConv.buyerLastReadAt : null)
        : (typeof freshConv.sellerLastReadAt === "number" ? freshConv.sellerLastReadAt : null);
      const prevReadMsgId = activeRole === "buyer"
        ? getTrimmedNonEmptyString(freshConv.buyerLastReadMessageId)
        : getTrimmedNonEmptyString(freshConv.sellerLastReadMessageId);

      // Monotonic cursor progression: never regress read cursor if an older messageId arrives late
      const useIncomingCursor =
        prevReadAt === null ||
        compareMessageOrder(targetCreatedAtMs, cleanLastVisibleMessageId, prevReadAt, prevReadMsgId) > 0;

      const effectiveCursorMs = useIncomingCursor ? targetCreatedAtMs : (prevReadAt as number);
      const effectiveCursorMsgId = useIncomingCursor ? cleanLastVisibleMessageId : prevReadMsgId;

      const unreadQuery = unreadMsgsCol.orderBy("createdAt", "asc").limit(safeChunkSize + 1);
      const unreadSnap = await tx.get(unreadQuery);
      const docs = unreadSnap?.docs || [];

      const toDelete: any[] = [];
      const remainingUnread: any[] = [];

      for (const docSnap of docs) {
        const dData = typeof docSnap.data === "function" ? (docSnap.data() || {}) : {};
        const dCreatedAtMs = extractTimestampMs(dData.createdAt) ?? 0;
        const dMsgId = getTrimmedNonEmptyString(dData.messageId) || docSnap.id;

        if (compareMessageOrder(dCreatedAtMs, dMsgId, effectiveCursorMs, effectiveCursorMsgId) <= 0) {
          toDelete.push(docSnap);
        } else {
          remainingUnread.push(docSnap);
        }
      }

      const batchToDelete = toDelete.slice(0, safeChunkSize);
      for (const docSnap of batchToDelete) {
        tx.delete(docSnap.ref);
      }

      const lastReturnedDoc = docs.length > 0 ? docs[docs.length - 1] : null;
      const lastReturnedData = lastReturnedDoc && typeof lastReturnedDoc.data === "function"
        ? (lastReturnedDoc.data() || {})
        : null;
      const lastReturnedMs = lastReturnedData ? (extractTimestampMs(lastReturnedData.createdAt) ?? 0) : 0;
      const hasMoreAtOrBeforeCursor =
        docs.length > safeChunkSize &&
        batchToDelete.length === safeChunkSize &&
        lastReturnedMs <= effectiveCursorMs;

      const currentUnreadCount = activeRole === "buyer"
        ? (typeof freshConv.buyerUnreadCount === "number" ? freshConv.buyerUnreadCount : 0)
        : (typeof freshConv.sellerUnreadCount === "number" ? freshConv.sellerUnreadCount : 0);

      const nextUnreadCount =
        !hasMoreAtOrBeforeCursor && docs.length <= safeChunkSize
          ? remainingUnread.length
          : Math.max(remainingUnread.length, currentUnreadCount - batchToDelete.length);

      const updatedAt = now();
      const updatePatch: Record<string, any> =
        activeRole === "buyer"
          ? {
              buyerUnreadCount: nextUnreadCount,
              buyerLastReadAt: effectiveCursorMs,
              buyerLastReadMessageId: effectiveCursorMsgId,
              updatedAt
            }
          : {
              sellerUnreadCount: nextUnreadCount,
              sellerLastReadAt: effectiveCursorMs,
              sellerLastReadMessageId: effectiveCursorMsgId,
              updatedAt
            };

      tx.update(convRef, updatePatch);

      return {
        clearedThisChunk: batchToDelete.length,
        hasMore: hasMoreAtOrBeforeCursor,
        unreadCount: nextUnreadCount,
        lastReadAt: effectiveCursorMs,
        lastReadMessageId: effectiveCursorMsgId
      };
    });

    totalCleared += stepOutcome.clearedThisChunk;
    finalUnreadCount = stepOutcome.unreadCount;
    finalLastReadAt = stepOutcome.lastReadAt;
    finalLastReadMessageId = stepOutcome.lastReadMessageId;

    if (!stepOutcome.hasMore || stepOutcome.clearedThisChunk === 0) {
      break;
    }
  }

  logger.log(
    `[markMarketConversationRead] ${role} (${cleanCallerUid}) read ${cleanConversationId} ` +
    `up to ${finalLastReadMessageId} (${finalLastReadAt}); cleared=${totalCleared}, remaining=${finalUnreadCount}`
  );

  return {
    success: true,
    conversationId: cleanConversationId,
    role,
    unreadCount: finalUnreadCount,
    lastReadAt: finalLastReadAt,
    lastReadMessageId: finalLastReadMessageId,
    clearedCount: totalCleared
  };
}

/**
 * Callable Cloud Function: markMarketConversationRead
 *
 * Allows an authenticated buyer or seller participant to advance their read cursor
 * up to a verified message in that conversation and clear their unread markers.
 */
export const markMarketConversationRead = onCall<MarkMarketConversationReadRequest>(
  async (request) => {
    return processMarkMarketConversationRead({
      callerUid: request.auth?.uid,
      conversationId: request.data?.conversationId,
      lastVisibleMessageId: request.data?.lastVisibleMessageId,
      firestore: db
    });
  }
);

/**
 * Backend Event Trigger: onMarketMessageCreated
 * 
 * - Transactionally maintains server-authoritative `market_conversations/{conversationId}`
 *   unread counts, lastMessage ordering, and per-message idempotency markers.
 * - Preserves verified two-way buyer <-> seller notifications in `users/{recipientId}/notifications`.
 */
export const onMarketMessageCreated = onDocumentCreated(
  {
    document: "market_messages/{messageId}",
    database: DATABASE_ID
  },
  async (event) => {
    try {
      const snapshot = event.data;
      if (!snapshot) {
        console.warn("[onMarketMessageCreated] No snapshot data available in event.");
        return;
      }

      const messageData = snapshot.data();
      const messageId = event.params.messageId || snapshot.id;
      const firestore = snapshot.ref.firestore || db;

      await processMarketMessageCreated({
        messageId,
        messageData,
        firestore
      });
    } catch (error) {
      // Failure safety: Do not fail core message transaction
      console.error(`[onMarketMessageCreated] Error processing market message ${event.params?.messageId}:`, error);
    }
  }
);

export interface OrderUpdatedRestorationDeps {
  orderId: string;
  beforeData: Record<string, any> | undefined | null;
  afterData: Record<string, any> | undefined | null;
  firestore: {
    collection: (name: string) => any;
    runTransaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
  };
  deleteSentinel?: unknown;
  logger?: Pick<Console, "log" | "warn" | "error">;
}

export interface OrderUpdatedRestorationResult {
  restored: boolean;
  reason: string;
}

export async function processOrderUpdatedRestoration({
  orderId,
  beforeData,
  afterData,
  firestore,
  deleteSentinel = FieldValue.delete(),
  logger = console
}: OrderUpdatedRestorationDeps): Promise<OrderUpdatedRestorationResult> {
  if (!beforeData || !afterData) {
    return { restored: false, reason: "missing_snapshot" };
  }

  const oldStatus = beforeData.status;
  const newStatus = afterData.status;

  if (
    (oldStatus !== "pending" && oldStatus !== "booked") ||
    (newStatus !== "cancelled" && newStatus !== "refunded")
  ) {
    return { restored: false, reason: "non_cancellation_transition" };
  }

  const listingId = getTrimmedNonEmptyString(afterData.listingId || beforeData.listingId);
  const sellerId = getTrimmedNonEmptyString(afterData.sellerId || beforeData.sellerId);
  if (!listingId || !sellerId) {
    logger.warn(`[onOrderUpdated] Order ${orderId} cancelled but missing listingId or sellerId.`);
    return { restored: false, reason: "missing_order_metadata" };
  }

  const orderType = afterData.orderType || beforeData.orderType || "product";
  const isPhysical = orderType === "product" && Boolean(afterData.shippingDetails || beforeData.shippingDetails);
  const isProjectAsset = orderType === "project";

  if (!isPhysical && !isProjectAsset) {
    logger.log(`[onOrderUpdated] Order ${orderId} cancelled for repeatable/non-exclusive order (${orderType}). No listing restoration needed.`);
    return { restored: false, reason: "non_restorable_order_type" };
  }

  const listingRef = firestore.collection("listings").doc(listingId);

  return await firestore.runTransaction(async (tx: any) => {
    const freshListingSnap = await tx.get(listingRef);
    if (!freshListingSnap.exists) {
      logger.log(`[onOrderUpdated] Order ${orderId} cancelled, but associated listing ${listingId} no longer exists.`);
      return { restored: false, reason: "listing_not_found" };
    }

    const freshListing = freshListingSnap.data();
    if (!freshListing) {
      return { restored: false, reason: "empty_listing" };
    }

    if (freshListing.sellerId !== sellerId) {
      logger.warn(`[onOrderUpdated] Transaction aborted: sellerId mismatch for listing ${listingId}.`);
      return { restored: false, reason: "seller_mismatch" };
    }

    if (freshListing.activeOrderId !== orderId) {
      logger.warn(
        `[onOrderUpdated] Restoration skipped/aborted for listing ${listingId}: ` +
        `activeOrderId '${freshListing.activeOrderId || ""}' does not match order '${orderId}'.`
      );
      return { restored: false, reason: "active_order_mismatch" };
    }

    const currentListingStatus = typeof freshListing.status === "string"
      ? freshListing.status.trim().toLowerCase()
      : "";

    if (currentListingStatus === "active") {
      // Already restored atomically by client transaction; safe no-op prevents duplicate writes.
      return { restored: false, reason: "already_active" };
    }

    if (isProjectAsset) {
      if (currentListingStatus === "sold" || freshListing.isSold === true) {
        logger.warn(`[onOrderUpdated] Protected sold digital asset ${listingId} from restoration on order ${orderId}.`);
        return { restored: false, reason: "digital_asset_already_sold" };
      }
      if (currentListingStatus !== "reserved") {
        logger.log(`[onOrderUpdated] Digital asset ${listingId} status is '${freshListing.status}' (not reserved). No action taken.`);
        return { restored: false, reason: "unexpected_status" };
      }
    } else if (currentListingStatus !== "sold" && currentListingStatus !== "reserved") {
      logger.log(`[onOrderUpdated] Physical listing ${listingId} status is '${freshListing.status}'. No action taken.`);
      return { restored: false, reason: "unexpected_status" };
    }

    tx.update(listingRef, {
      status: "active",
      isSold: false,
      activeOrderId: deleteSentinel
    });
    logger.log(`[onOrderUpdated] Safely restored listing ${listingId} to active for verified order ${orderId}.`);
    return { restored: true, reason: "restored" };
  });
}

/**
 * Backend Event Trigger: onOrderUpdated
 *
 * Safe Order Cancellation Audit & Transactional Listing Restoration:
 * - Handles cancellations/refunds from 'pending' or 'booked' state.
 * - Supports physical 'product' orders and unique digital asset 'project' orders.
 * - Requires strict sellerId + activeOrderId provenance match inside Firestore transaction.
 * - NEVER restores a 'sold' digital asset and safely no-ops if client transaction already restored 'active'.
 */
export const onOrderUpdated = onDocumentUpdated(
  {
    document: "orders/{orderId}",
    database: DATABASE_ID
  },
  async (event) => {
    try {
      const beforeSnap = event.data?.before;
      const afterSnap = event.data?.after;
      if (!beforeSnap || !afterSnap) return;

      const orderId = event.params.orderId || afterSnap.id;
      const firestore = afterSnap.ref.firestore || db;

      await processOrderUpdatedRestoration({
        orderId,
        beforeData: beforeSnap.data(),
        afterData: afterSnap.data(),
        firestore
      });
    } catch (error) {
      console.error(`[onOrderUpdated] Error handling cancellation event for order ${event.params?.orderId}:`, error);
    }
  }
);



