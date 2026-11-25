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
  scope?: 'updateSecurityPin' | 'resetUserWorkspace' | 'changeEmail' | 'generalStepUp';
}

export interface VerifyStepUpPinResponse {
  success: boolean;
  grantId: string;
  scope: string;
  expiresAt: number;
  migratedLegacyPin?: boolean;
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
  grantId?: string;
}

export interface ResetUserWorkspaceResponse {
  success: boolean;
  message: string;
  resetProfile?: Record<string, any>;
}

/**
 * Resets user workspace subcollections and defaults server-side via `resetUserWorkspace` Cloud Function.
 */
export async function resetUserWorkspaceCall(params: ResetUserWorkspaceParams = {}): Promise<ResetUserWorkspaceResponse> {
  const callable = httpsCallable<ResetUserWorkspaceParams, ResetUserWorkspaceResponse>(
    functions,
    'resetUserWorkspace'
  );

  const result = await callable(params);
  return result.data;
}

export interface UpdateUserEmailParams {
  newEmail: string;
  grantId?: string;
}

export interface UpdateUserEmailResponse {
  success: boolean;
  email: string;
}

/**
 * Synchronizes Firebase Auth email and Firestore profile email server-side via `updateUserEmail` Cloud Function.
 */
export async function updateUserEmailCall(params: UpdateUserEmailParams): Promise<UpdateUserEmailResponse> {
  const callable = httpsCallable<UpdateUserEmailParams, UpdateUserEmailResponse>(
    functions,
    'updateUserEmail'
  );

  const result = await callable(params);
  return result.data;
}

export interface MarkMarketConversationReadParams {
  conversationId: string;
  lastVisibleMessageId: string;
}

export interface MarkMarketConversationReadResponse {
  success: boolean;
  conversationId: string;
  role: 'buyer' | 'seller';
  unreadCount: number;
  lastReadAt: number;
  lastReadMessageId: string;
  clearedCount: number;
}

/**
 * Advances the authenticated participant's read cursor up to `lastVisibleMessageId`
 * and reconciles their server-authoritative unread count via `markMarketConversationRead`.
 */
export async function markMarketConversationReadCall(
  params: MarkMarketConversationReadParams
): Promise<MarkMarketConversationReadResponse> {
  const callable = httpsCallable<MarkMarketConversationReadParams, MarkMarketConversationReadResponse>(
    functions,
    'markMarketConversationRead'
  );

  const result = await callable(params);
  return result.data;
}


