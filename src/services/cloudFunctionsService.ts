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

export interface VerifyStepUpPinParams {
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
 * Verifies Security PIN server-side via `verifyStepUpPin` Cloud Function.
 */
export async function verifyStepUpPinCall(params: VerifyStepUpPinParams): Promise<VerifyStepUpPinResponse> {
  const callable = httpsCallable<VerifyStepUpPinParams, VerifyStepUpPinResponse>(
    functions,
    'verifyStepUpPin'
  );

  const result = await callable(params);
  return result.data;
}

export interface UpdateSecurityPinParams {
  newPin?: string;
  disable?: boolean;
  grantId?: string;
}

/**
 * Updates or disables Security PIN metadata server-side via `updateSecurityPin` Cloud Function.
 */
export async function updateSecurityPinCall(params: UpdateSecurityPinParams): Promise<{ success: boolean }> {
  const callable = httpsCallable<UpdateSecurityPinParams, { success: boolean }>(
    functions,
    'updateSecurityPin'
  );

  const result = await callable(params);
  return result.data;
}

export interface ResetUserWorkspaceParams {
  grantId: string;
}

/**
 * Resets user workspace subcollections server-side via `resetUserWorkspace` Cloud Function.
 */
export async function resetUserWorkspaceCall(params: ResetUserWorkspaceParams): Promise<{ success: boolean; message: string }> {
  const callable = httpsCallable<ResetUserWorkspaceParams, { success: boolean; message: string }>(
    functions,
    'resetUserWorkspace'
  );

  const result = await callable(params);
  return result.data;
}

