import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

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
