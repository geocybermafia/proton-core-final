import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

// Initialize Firebase Admin SDK (Only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

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

  // Prevent self-dealing unless explicitly specified for a self-deposit
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
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    const ledgerPayload = {
      id: transactionId,
      buyerId,
      sellerId,
      userId: buyerId,
      amount: Number(amount.toFixed(2)),
      currency: 'USD',
      itemTitle: itemTitle.trim().substring(0, 200),
      listingId: listingId || null,
      type,
      status: 'COMPLETED',
      createdAt: timestamp,
      updatedAt: timestamp,
      serverVerified: true,
      processedBy: 'processSecureTransaction_v1'
    };

    // 4. ATOMIC ADMIN WRITE (Bypasses Firestore Rules)
    const batch = db.batch();

    // Global Root Ledger Entry
    const globalLedgerRef = db.collection('market_ledger').doc(transactionId);
    batch.set(globalLedgerRef, ledgerPayload);

    // Buyer Subcollection Ledger Entry
    const buyerLedgerRef = db
      .collection('users')
      .doc(buyerId)
      .collection('market_ledger')
      .doc(transactionId);
    batch.set(buyerLedgerRef, {
      ...ledgerPayload,
      direction: 'OUTGOING'
    });

    // Seller Subcollection Ledger Entry
    const sellerLedgerRef = db
      .collection('users')
      .doc(sellerId)
      .collection('market_ledger')
      .doc(transactionId);
    batch.set(sellerLedgerRef, {
      ...ledgerPayload,
      direction: 'INCOMING'
    });

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

export interface VerifyStepUpPinRequest {
  pin: string;
  scope?: 'updateSecurityPin' | 'resetUserWorkspace' | 'generalStepUp';
}

export interface VerifyStepUpPinResponse {
  success: boolean;
  grantId: string;
  scope: string;
  expiresAt: number;
}

/**
 * Serverless Callable Function: verifyStepUpPin
 * 
 * Verifies user Security PIN server-side using PBKDF2 (100k iterations, SHA-256).
 * Enforces atomic server-side lockout and generates short-lived scoped step-up grants.
 */
export const verifyStepUpPin = onCall<VerifyStepUpPinRequest, Promise<VerifyStepUpPinResponse>>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required for step-up verification.");
  }

  const uid = request.auth.uid;
  const { pin, scope = 'generalStepUp' } = request.data || {};

  if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    throw new HttpsError("invalid-argument", "PIN must be a valid 4-digit numeric string.");
  }

  const userRef = db.collection('users').doc(uid);
  const lockoutRef = userRef.collection('security').doc('lockout');

  // Server-side lockout check
  const now = Date.now();
  const lockoutSnap = await lockoutRef.get();
  const lockoutData = lockoutSnap.data() || { attempts: 0, lockedUntil: 0 };

  if (lockoutData.lockedUntil && lockoutData.lockedUntil > now) {
    const remainingSeconds = Math.ceil((lockoutData.lockedUntil - now) / 1000);
    throw new HttpsError(
      "resource-exhausted",
      `Too many failed attempts. Please wait ${remainingSeconds} seconds.`
    );
  }

  // Load PIN metadata from users/{uid}
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  const userData = userSnap.data();
  const meta = userData?.securityPinMeta;

  if (!meta || !meta.enabled || !meta.salt || !meta.verifier) {
    throw new HttpsError("failed-precondition", "Security PIN is not set up or disabled.");
  }

  // Perform PBKDF2 derivation (HMAC-SHA-256, 100,000 iterations, 32-byte key)
  const saltBuf = Buffer.from(meta.salt, 'hex');
  const derivedBuf = crypto.pbkdf2Sync(pin, saltBuf, 100000, 32, 'sha256');
  const storedVerifierBuf = Buffer.from(meta.verifier, 'hex');

  const isValid =
    derivedBuf.length === storedVerifierBuf.length &&
    crypto.timingSafeEqual(derivedBuf, storedVerifierBuf);

  if (!isValid) {
    // Atomic lockout counter update
    await db.runTransaction(async (transaction) => {
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
    expiresAt
  };
});

export interface UpdateSecurityPinRequest {
  newPin?: string;
  disable?: boolean;
  grantId?: string;
}

/**
 * Serverless Callable Function: updateSecurityPin
 * 
 * Safely sets, updates, or disables Security PIN metadata.
 * Server derives salt and verifier using PBKDF2. Requires valid step-up grant if PIN is currently active.
 */
export const updateSecurityPin = onCall<UpdateSecurityPinRequest, Promise<{ success: boolean }>>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required to update Security PIN.");
  }

  const uid = request.auth.uid;
  const { newPin, disable, grantId } = request.data || {};

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() || {};
  const isCurrentlyEnabled = !!(userData.securityPinEnabled || userData.securityPinMeta?.enabled);

  // If user already has PIN enabled, require a valid scoped step-up grant
  if (isCurrentlyEnabled) {
    if (!grantId) {
      throw new HttpsError("permission-denied", "Step-up verification required to change Security PIN.");
    }

    const grantRef = userRef.collection('security').doc(`grant_${grantId}`);
    const grantSnap = await grantRef.get();

    if (!grantSnap.exists) {
      throw new HttpsError("permission-denied", "Invalid or expired step-up authorization grant.");
    }

    const grant = grantSnap.data()!;
    const now = Date.now();

    if (
      grant.consumed ||
      grant.uid !== uid ||
      grant.expiresAt <= now ||
      !['updateSecurityPin', 'generalStepUp'].includes(grant.scope)
    ) {
      throw new HttpsError("permission-denied", "Step-up grant is expired, consumed, or invalid for this scope.");
    }

    // Mark grant as consumed (one-time use)
    await grantRef.update({ consumed: true, consumedAt: now });
  }

  if (disable) {
    await userRef.set(
      {
        securityPinEnabled: false,
        securityPinMeta: {
          enabled: false,
          updatedAt: Date.now()
        }
      },
      { merge: true }
    );
    return { success: true };
  }

  if (!newPin || typeof newPin !== 'string' || !/^\d{4}$/.test(newPin)) {
    throw new HttpsError("invalid-argument", "New PIN must be a valid 4-digit numeric string.");
  }

  // Derive PBKDF2 metadata server-side
  const saltBuf = crypto.randomBytes(16);
  const saltHex = saltBuf.toString('hex');
  const verifierBuf = crypto.pbkdf2Sync(newPin, saltBuf, 100000, 32, 'sha256');
  const verifierHex = verifierBuf.toString('hex');

  const newMeta = {
    enabled: true,
    salt: saltHex,
    verifier: verifierHex,
    version: 1,
    updatedAt: Date.now()
  };

  await userRef.set(
    {
      securityPinEnabled: true,
      securityPinMeta: newMeta
    },
    { merge: true }
  );

  return { success: true };
});

export interface ResetUserWorkspaceRequest {
  grantId: string;
}

/**
 * Serverless Callable Function: resetUserWorkspace
 * 
 * Server-authoritative destructive workspace reset.
 * Requires valid step-up grant for scope `resetUserWorkspace`.
 */
export const resetUserWorkspace = onCall<ResetUserWorkspaceRequest, Promise<{ success: boolean; message: string }>>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required to reset workspace.");
  }

  const uid = request.auth.uid;
  const { grantId } = request.data || {};

  if (!grantId) {
    throw new HttpsError("permission-denied", "Step-up verification required to reset workspace.");
  }

  const userRef = db.collection('users').doc(uid);
  const grantRef = userRef.collection('security').doc(`grant_${grantId}`);
  const grantSnap = await grantRef.get();

  if (!grantSnap.exists) {
    throw new HttpsError("permission-denied", "Invalid or expired step-up authorization grant.");
  }

  const grant = grantSnap.data()!;
  const now = Date.now();

  if (
    grant.consumed ||
    grant.uid !== uid ||
    grant.expiresAt <= now ||
    !['resetUserWorkspace', 'generalStepUp'].includes(grant.scope)
  ) {
    throw new HttpsError("permission-denied", "Step-up grant is expired, consumed, or invalid for this scope.");
  }

  // Mark grant as consumed immediately
  await grantRef.update({ consumed: true, consumedAt: now });

  // Server-side batch deletion of user subcollections
  const subcollections = ['workflows', 'personas', 'chatHistory', 'tasks', 'customAvatars'];

  for (const sub of subcollections) {
    const colRef = userRef.collection(sub);
    const snap = await colRef.get();
    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  }

  return {
    success: true,
    message: "Workspace subcollections securely reset via Admin SDK."
  };
});

