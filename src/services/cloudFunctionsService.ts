import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export interface SecureTransactionParams {
  buyerId: string;
  sellerId: string;
  amount: number;
  itemTitle: string;
  listingId?: string;
  type?: 'PURCHASE' | 'DEPOSIT' | 'TRANSFER' | 'PAYOUT';
}

export interface SecureTransactionResponse {
  success: boolean;
  transactionId: string;
  status: string;
  timestamp: string;
  message: string;
}

/**
 * Executes a financial transaction via the secure Serverless Callable Cloud Function `processSecureTransaction`.
 * 
 * Bypasses client-side Firestore rules securely through the Firebase Admin SDK on Cloud Functions.
 */
export async function executeSecureTransaction(params: SecureTransactionParams): Promise<SecureTransactionResponse> {
  const processSecureTxCallable = httpsCallable<SecureTransactionParams, SecureTransactionResponse>(
    functions,
    'processSecureTransaction'
  );

  const result = await processSecureTxCallable(params);
  return result.data;
}
