import { auth } from '../firebase';
import { collection, query, orderBy, limit, getDocs, Firestore } from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(
  error: any, 
  operationType: OperationType | string, 
  path: string | null,
  addLog?: (type: 'info' | 'error' | 'warning', message: string, data?: any) => void
) {
  const errorInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType: operationType as OperationType,
    path
  };

  console.error('[Firestore Error]', JSON.stringify(errorInfo, null, 2));
  
  if (addLog) {
    addLog('error', `Firestore ${operationType} failed on ${path}`, errorInfo);
  }

  const rawErrorMsg = errorInfo.error || 'Unknown Firestore error';
  const cleanMessage = `Firestore ${operationType} failed${path ? ` on '${path}'` : ''}: ${rawErrorMsg}`;
  const customError = new Error(cleanMessage);
  (customError as any).firestoreErrorInfo = errorInfo;
  throw customError;
}

/**
 * Standard collection paths according to Firebase Security Rules:
 * 1. Root collection `listings` (was market_listings)
 * 2. Nested personas path `/users/{userId}/personas` (was user_personas)
 * 3. Root collection `system_logs` with fallback handling
 */
export const FIRESTORE_COLLECTIONS = {
  LISTINGS: 'listings',
  PERSONAS: (userId: string) => `users/${userId}/personas`,
  SYSTEM_LOGS: 'system_logs',
} as const;

/**
 * Helper to fetch system logs with fallback handling for permission boundaries.
 * If system_logs is restricted or inaccessible via Firestore security rules,
 * catches permission errors and returns an empty array gracefully.
 */
export async function fetchSystemLogsFallback(
  db: Firestore,
  limitCount = 50
): Promise<any[]> {
  try {
    const logsRef = collection(db, FIRESTORE_COLLECTIONS.SYSTEM_LOGS);
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error: any) {
    console.warn('[SystemLogs Fallback] Gracefully caught permission boundary or inaccessible collection:', error?.message || error);
    return [];
  }
}

