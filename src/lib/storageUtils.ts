import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, auth } from '../firebase';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

export interface UploadOptions {
  path: string;
  file: File | Blob;
  metadata?: {
    contentType?: string;
    customMetadata?: Record<string, string>;
  };
  onProgress?: (progress: number) => void;
}

export interface UploadResult {
  downloadUrl: string;
  fullPath: string;
}

function dispatchProtonDebugEvent(detail: any) {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('proton-debug-event', { detail }));
    } catch {
      // Non-blocking debug dispatcher
    }
  }
}

/**
 * Uploads a file or Blob to Firebase Storage using uploadBytesResumable with progress tracking and timeout protection.
 */
export async function uploadFileToStorage(
  options: UploadOptions,
  timeoutMs: number = 45000
): Promise<UploadResult> {
  const { path, file, metadata, onProgress } = options;

  if (!storage) {
    console.error('[StorageUtils] Firebase Storage instance is not initialized in firebase.ts!');
    dispatchProtonDebugEvent({
      type: 'storage-error',
      path,
      code: 'storage/uninitialized',
      message: 'Firebase Storage instance is not initialized.'
    });
    throw new Error('Firebase Storage instance is not initialized.');
  }

  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file, metadata);

  return new Promise((resolve, reject) => {
    let isSettled = false;

    const settleResolve = (downloadUrl: string, fullPath: string) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeoutId);
      dispatchProtonDebugEvent({
        type: 'storage-success',
        path,
        downloadUrl
      });
      resolve({ downloadUrl, fullPath });
    };

    const settleReject = (error: any) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeoutId);
      console.error(`[StorageUtils] Upload rejected for path "${path}":`, error);
      dispatchProtonDebugEvent({
        type: 'storage-error',
        path,
        code: error?.code || 'UNKNOWN_ERROR',
        message: error?.message || String(error)
      });
      reject(error);
    };

    // Timeout guard to prevent infinite hanging
    const timeoutId = setTimeout(() => {
      if (!isSettled) {
        console.error(`[StorageUtils] Upload timed out after ${timeoutMs}ms for path "${path}". Canceling task...`);
        try {
          uploadTask.cancel();
        } catch (e) {
          console.warn('[StorageUtils] Failed to cancel upload task:', e);
        }
        settleReject(new Error(`Firebase Storage upload timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
      }
    }, timeoutMs);

    // Observer for progress and completion
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0) {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          dispatchProtonDebugEvent({
            type: 'storage-progress',
            path,
            progress
          });
          if (onProgress && !isSettled) {
            onProgress(progress);
          }
        }
      },
      (error) => {
        settleReject(error);
      },
      async () => {
        if (isSettled) return;
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          settleResolve(downloadUrl, uploadTask.snapshot.ref.fullPath);
        } catch (err) {
          settleReject(err);
        }
      }
    );

    // Secondary backup: Promise handler on uploadTask
    uploadTask.then(
      async (snapshot) => {
        if (isSettled) return;
        try {
          const downloadUrl = await getDownloadURL(snapshot.ref);
          settleResolve(downloadUrl, snapshot.ref.fullPath);
        } catch (err) {
          settleReject(err);
        }
      },
      (error) => {
        settleReject(error);
      }
    );
  });
}

/**
 * Helper specifically for uploading Proton Clips videos to Supabase Storage ('clips' bucket)
 */
export async function uploadClipVideo(
  userId: string,
  clipId: string,
  file: File | Blob,
  onProgress?: (progress: number) => void,
  timeoutMs?: number
): Promise<string> {
  const fileExt = file instanceof File && file.name.includes('.') ? file.name.split('.').pop() : 'mp4';
  const filePath = `${userId}/${clipId}.${fileExt}`;

  // File-size-aware timeout for mobile resilience:
  // - small videos (<=5MB): at least 60 seconds
  // - medium videos (5MB-20MB): at least 120 seconds
  // - larger mobile videos (>20MB): up to 180 seconds
  let computedTimeout = 120000;
  if (file && typeof file.size === 'number' && file.size > 0) {
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB <= 5) {
      computedTimeout = 60000;
    } else if (sizeMB <= 20) {
      computedTimeout = 120000;
    } else {
      computedTimeout = 180000;
    }
  }

  const effectiveTimeoutMs = timeoutMs ?? computedTimeout;

  dispatchProtonDebugEvent({
    type: 'storage-start',
    provider: 'supabase',
    bucket: 'clips',
    path: filePath,
    size: (file as any).size,
  });

  return new Promise((resolve, reject) => {
    let isSettled = false;
    let xhr: XMLHttpRequest | null = null;

    const timeoutId = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        if (xhr) {
          try { xhr.abort(); } catch {}
        }
        const timeoutError = new Error(`Supabase Storage upload timed out after ${Math.round(effectiveTimeoutMs / 1000)} seconds.`);
        dispatchProtonDebugEvent({
          type: 'storage-error',
          provider: 'supabase',
          path: filePath,
          code: 'storage/timeout',
          message: timeoutError.message,
        });
        reject(timeoutError);
      }
    }, effectiveTimeoutMs);

    const handleSuccess = (downloadUrl: string) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeoutId);
      if (onProgress) onProgress(100);
      dispatchProtonDebugEvent({
        type: 'storage-success',
        provider: 'supabase',
        bucket: 'clips',
        path: filePath,
        downloadUrl,
      });
      resolve(downloadUrl);
    };

    const handleError = (error: any) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeoutId);
      console.error(`[StorageUtils] Supabase upload failed for path "${filePath}":`, error);
      dispatchProtonDebugEvent({
        type: 'storage-error',
        provider: 'supabase',
        bucket: 'clips',
        path: filePath,
        code: error?.code || error?.statusCode || 'STORAGE_ERROR',
        message: error?.message || String(error),
      });
      reject(error);
    };

    // In browser environment with XMLHttpRequest, use XHR for accurate upload progress
    if (typeof window !== 'undefined' && typeof XMLHttpRequest !== 'undefined') {
      try {
        xhr = new XMLHttpRequest();
        const uploadUrl = `${SUPABASE_URL}/storage/v1/object/clips/${filePath}`;
        xhr.open('POST', uploadUrl, true);
        xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
        xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
        xhr.setRequestHeader('x-upsert', 'true');
        if (file.type) {
          xhr.setRequestHeader('Content-Type', file.type);
        } else {
          xhr.setRequestHeader('Content-Type', 'video/mp4');
        }

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && e.total > 0) {
              const pct = Math.round((e.loaded / e.total) * 100);
              onProgress(Math.min(99, pct));
              dispatchProtonDebugEvent({
                type: 'storage-progress',
                provider: 'supabase',
                path: filePath,
                progress: pct,
              });
            }
          };
        }

        xhr.onload = () => {
          if (xhr!.status >= 200 && xhr!.status < 300) {
            const { data } = supabase.storage.from('clips').getPublicUrl(filePath);
            handleSuccess(data.publicUrl);
          } else {
            let errorJson: any = null;
            try {
              errorJson = JSON.parse(xhr!.responseText);
            } catch {}
            const errorMsg = errorJson?.message || errorJson?.error || `HTTP ${xhr!.status}: ${xhr!.statusText}`;
            const err: any = new Error(errorMsg);
            err.statusCode = errorJson?.statusCode || xhr!.status;
            err.code = errorJson?.code || `HTTP_${xhr!.status}`;
            handleError(err);
          }
        };

        xhr.onerror = () => {
          handleError(new Error('Network error during Supabase upload. Check your internet connection.'));
        };

        xhr.send(file);
        return;
      } catch (xhrErr) {
        console.warn('[StorageUtils] XHR failed, falling back to Supabase client SDK:', xhrErr);
      }
    }

    // Fallback: Supabase JS Client SDK upload
    (async () => {
      try {
        if (onProgress) onProgress(20);
        const { error } = await supabase.storage.from('clips').upload(filePath, file, {
          contentType: file.type || 'video/mp4',
          cacheControl: '3600',
          upsert: true,
        });

        if (error) {
          handleError(error);
          return;
        }

        if (onProgress) onProgress(90);
        const { data: publicData } = supabase.storage.from('clips').getPublicUrl(filePath);
        handleSuccess(publicData.publicUrl);
      } catch (err) {
        handleError(err);
      }
    })();
  });
}

/**
 * Safely deletes a clip's video file from cloud storage.
 * Supports:
 * 1. Supabase Storage ('clips' bucket) - Extracts file path from Supabase URL and deletes via Supabase SDK.
 * 2. Firebase Storage - Fallback for legacy clips stored in Firebase Storage.
 * 3. External / preset loops - Safely ignores without throwing.
 */
export async function deleteClipVideoFromStorage(
  videoUrlOrPath: string | undefined | null,
  userId?: string
): Promise<boolean> {
  if (!videoUrlOrPath || typeof videoUrlOrPath !== 'string') {
    return false;
  }

  // 1. Check for Supabase Storage URL
  const isSupabaseStorageUrl = 
    videoUrlOrPath.includes('supabase.co/storage/v1/object/public/clips/') ||
    videoUrlOrPath.includes('supabase.co/storage/v1/object/clips/') ||
    (videoUrlOrPath.includes('supabase.co') && videoUrlOrPath.includes('/clips/'));

  if (isSupabaseStorageUrl) {
    try {
      let storagePath = '';
      if (videoUrlOrPath.includes('/storage/v1/object/public/clips/')) {
        storagePath = videoUrlOrPath.split('/storage/v1/object/public/clips/')[1];
      } else if (videoUrlOrPath.includes('/storage/v1/object/clips/')) {
        storagePath = videoUrlOrPath.split('/storage/v1/object/clips/')[1];
      } else {
        const parts = videoUrlOrPath.split('/clips/');
        storagePath = parts[1] || '';
      }

      // Remove query parameters if present
      if (storagePath.includes('?')) {
        storagePath = storagePath.split('?')[0];
      }

      if (storagePath) {
        const { error } = await supabase.storage.from('clips').remove([storagePath]);
        if (error) {
          console.warn('[StorageUtils] Supabase storage deletion notice:', error);
          dispatchProtonDebugEvent({
            type: 'storage-warning',
            provider: 'supabase',
            action: 'deleteClipVideo',
            path: storagePath,
            message: error.message,
          });
        } else {
          dispatchProtonDebugEvent({
            type: 'storage-success',
            provider: 'supabase',
            action: 'deleteClipVideo',
            path: storagePath,
          });
        }
      }
      return true;
    } catch (err: any) {
      console.warn('[StorageUtils] Supabase deletion error:', err);
      return false;
    }
  }

  // 2. Check for Firebase Storage URL
  const isFirebaseStorageUrl = videoUrlOrPath.includes('firebasestorage.googleapis.com');
  const isStoragePath = videoUrlOrPath.startsWith('clips/') || (Boolean(userId) && videoUrlOrPath.startsWith(`clips/${userId}`));

  if (isFirebaseStorageUrl || isStoragePath) {
    if (!storage) {
      console.warn('[StorageUtils] Firebase Storage is not initialized, cannot delete object.');
      return false;
    }

    try {
      const storageRef = ref(storage, videoUrlOrPath);
      await deleteObject(storageRef);

      dispatchProtonDebugEvent({
        type: 'storage-success',
        provider: 'firebase',
        action: 'deleteClipVideo',
        path: storageRef.fullPath
      });
      return true;
    } catch (err: any) {
      if (err?.code === 'storage/object-not-found') {
        console.info(`[StorageUtils] Storage file already removed: ${videoUrlOrPath}`);
        return true;
      }
      console.warn('[StorageUtils] Failed to delete clip video from Firebase Storage:', err);
      dispatchProtonDebugEvent({
        type: 'storage-error',
        provider: 'firebase',
        action: 'deleteClipVideo',
        code: err?.code || 'UNKNOWN_STORAGE_ERROR',
        message: err?.message || String(err)
      });
      return false;
    }
  }

  // 3. External MP4 URL, local asset, or preset loop — safely ignore
  dispatchProtonDebugEvent({
    type: 'storage-info',
    action: 'deleteClipVideo-skipped',
    message: 'Video URL is external or preset; cloud storage deletion skipped.',
    url: videoUrlOrPath
  });
  return true;
}

/**
 * Helper specifically for uploading product images securely via Proton's server route
 * to Supabase Storage ('listings' bucket) authenticated with Firebase ID token.
 * Accepts File, Blob, or Base64 string and returns the HTTPS download URL.
 */
export async function uploadProductImage(
  userId: string,
  image: File | Blob | string,
  productId?: string
): Promise<string> {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('A valid user UID is required to upload listing images.');
  }

  // If already an HTTP/HTTPS URL, return as-is
  if (typeof image === 'string') {
    if (image.startsWith('http://') || image.startsWith('https://')) {
      return image;
    }
  }

  // Convert File/Blob to Base64 data URI string if needed
  let dataUri: string;
  if (typeof image === 'string') {
    dataUri = image;
  } else {
    dataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(image);
    });
  }

  // Ensure user is authenticated with Firebase
  if (!auth?.currentUser) {
    throw new Error('User must be authenticated with Firebase to upload listing images.');
  }

  dispatchProtonDebugEvent({
    type: 'storage-start',
    provider: 'supabase-server',
    bucket: 'listings',
    productId,
  });

  const requestPayload = JSON.stringify({
    image: dataUri,
    productId: productId || 'prod',
  });

  const MAX_ATTEMPTS = 2;
  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const activeUser = auth?.currentUser;
    if (!activeUser) {
      throw new Error('User must be authenticated with Firebase to upload listing images.');
    }

    // Force-refresh token before request to guarantee freshness and prevent expired token rejections
    const idToken = await activeUser.getIdToken(true);

    const response = await fetch('/api/storage/upload-listing-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: requestPayload,
    });

    if (response.ok) {
      const result = await response.json();
      if (!result.publicUrl) {
        throw new Error('Invalid response from upload service: missing publicUrl.');
      }

      dispatchProtonDebugEvent({
        type: 'storage-success',
        provider: 'supabase-server',
        bucket: 'listings',
        path: result.path,
        downloadUrl: result.publicUrl,
      });

      return result.publicUrl;
    }

    let errorData: any = null;
    try {
      errorData = await response.json();
    } catch {}
    const errorMessage = errorData?.error || errorData?.message || `HTTP ${response.status}: ${response.statusText}`;

    const error: any = new Error(errorMessage);
    error.statusCode = response.status;
    lastError = error;

    // Retry once if and only if HTTP 401 is encountered
    if (response.status === 401 && attempt < MAX_ATTEMPTS) {
      dispatchProtonDebugEvent({
        type: 'storage-retry',
        provider: 'supabase-server',
        bucket: 'listings',
        attempt,
        code: `HTTP_${response.status}`,
      });
      continue;
    }

    // Do not retry on other status codes (e.g. 400, 403, 500) or if max attempts reached
    break;
  }

  dispatchProtonDebugEvent({
    type: 'storage-error',
    provider: 'supabase-server',
    bucket: 'listings',
    code: `HTTP_${lastError?.statusCode || 'UNKNOWN'}`,
    message: lastError?.message || 'Upload failed',
  });

  throw lastError;
}

/**
 * Helper specifically for uploading user avatar images to Firebase Storage.
 * Accepts File, Blob, or string (Base64 or existing HTTP/HTTPS URL).
 * Returns the HTTPS download URL.
 */
export async function uploadAvatarImage(
  userId: string,
  avatar: File | Blob | string
): Promise<string> {
  if (typeof avatar === 'string') {
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return avatar;
    }
    const { blob, contentType } = base64ToBlob(avatar);
    const timestamp = Date.now();
    const path = `avatars/${userId}/avatar_${timestamp}.png`;
    const result = await uploadFileToStorage({
      path,
      file: blob,
      metadata: {
        contentType,
        customMetadata: {
          uploadedBy: userId,
          type: 'avatar',
        },
      },
    });
    return result.downloadUrl;
  } else {
    const contentType = avatar.type || 'image/png';
    const timestamp = Date.now();
    const path = `avatars/${userId}/avatar_${timestamp}.png`;
    const result = await uploadFileToStorage({
      path,
      file: avatar,
      metadata: {
        contentType,
        customMetadata: {
          uploadedBy: userId,
          type: 'avatar',
        },
      },
    });
    return result.downloadUrl;
  }
}

function base64ToBlob(base64Data: string): { blob: Blob; contentType: string } {
  let contentType = 'image/png';
  let dataPart = base64Data;
  if (base64Data.startsWith('data:')) {
    const parts = base64Data.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    if (mimeMatch) {
      contentType = mimeMatch[1];
    }
    dataPart = parts[1] || '';
  }
  const byteCharacters = atob(dataPart);
  const byteArrays: Uint8Array[] = [];
  const sliceSize = 512;
  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  const blob = new Blob(byteArrays as BlobPart[], { type: contentType });
  return { blob, contentType };
}

/**
 * Result details for an individual image deletion attempt.
 */
export interface ListingImageDeletionDetail {
  /** Sanitized URL or path with sensitive query parameters (e.g. auth tokens) removed */
  urlOrPath: string;
  /** Decoded Firebase Storage object path within the bucket (if valid) */
  path?: string;
  /** Status of the deletion attempt */
  status: 'deleted' | 'skipped' | 'failed';
  /** Reason for skip or failure (e.g., 'external_host', 'ownership_mismatch', 'already_deleted') */
  reason?: string;
}

/**
 * Summary result returned by deleteListingImagesFromStorage.
 */
export interface ListingImageDeletionResult {
  total: number;
  deleted: number;
  skipped: number;
  failed: number;
  details: ListingImageDeletionDetail[];
}

/**
 * Allowed input types for listing images:
 * Single string, array of strings, or listing object with image/images properties.
 */
export type ListingImageInput =
  | string
  | (string | null | undefined)[]
  | { image?: string | null; images?: (string | null | undefined)[] | null }
  | null
  | undefined;

/**
 * Sanitizes a storage URL or path by removing sensitive query parameters (such as `token=...`)
 * and fragments to prevent sensitive download token leakage in logs and return structures.
 */
export function sanitizeStorageUrlForLogging(urlOrPath: string): string {
  if (!urlOrPath || typeof urlOrPath !== 'string') return '';
  try {
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      const parsed = new URL(urlOrPath);
      return `${parsed.origin}${parsed.pathname}`;
    }
    return urlOrPath.split('?')[0].split('#')[0];
  } catch {
    return urlOrPath.split('?')[0].split('#')[0];
  }
}

/**
 * Retrieves the recognized bucket names configured for this Firebase app instance.
 */
function getConfiguredStorageBuckets(): string[] {
  const buckets = new Set<string>();
  try {
    const appBucket = storage?.app?.options?.storageBucket;
    if (appBucket && typeof appBucket === 'string') {
      const trimmed = appBucket.trim().toLowerCase();
      if (trimmed) {
        buckets.add(trimmed);
        if (trimmed.endsWith('.firebasestorage.app')) {
          buckets.add(trimmed.replace('.firebasestorage.app', '.appspot.com'));
        } else if (trimmed.endsWith('.appspot.com')) {
          buckets.add(trimmed.replace('.appspot.com', '.firebasestorage.app'));
        }
      }
    }
    const projectId = storage?.app?.options?.projectId;
    if (projectId && typeof projectId === 'string') {
      const trimmedId = projectId.trim().toLowerCase();
      if (trimmedId) {
        buckets.add(`${trimmedId}.firebasestorage.app`);
        buckets.add(`${trimmedId}.appspot.com`);
      }
    }
  } catch {
    // Non-blocking fallback
  }
  return Array.from(buckets);
}

/**
 * Safely parses and validates whether an image URL or path belongs to the configured Firebase Storage
 * bucket and is owned by the current authenticated user under `listings/${currentUserId}/`.
 */
export function extractAndValidateListingPath(
  urlOrPath: string,
  currentUserId: string,
  configuredBuckets?: string[]
): { 
  isValidListingPath: boolean; 
  path?: string; 
  reason?: string;
  provider?: 'supabase' | 'firebase';
  storagePath?: string;
} {
  if (!urlOrPath || typeof urlOrPath !== 'string') {
    return { isValidListingPath: false, reason: 'invalid_input' };
  }

  const trimmed = urlOrPath.trim();
  if (!trimmed) {
    return { isValidListingPath: false, reason: 'empty_input' };
  }

  if (trimmed.startsWith('data:')) {
    return { isValidListingPath: false, reason: 'data_uri_skipped' };
  }

  if (!currentUserId || typeof currentUserId !== 'string' || !currentUserId.trim()) {
    return { isValidListingPath: false, reason: 'missing_user_id' };
  }

  const buckets = (configuredBuckets && configuredBuckets.length > 0)
    ? configuredBuckets
    : getConfiguredStorageBuckets();

  let rawPath = '';
  let provider: 'supabase' | 'firebase' = 'firebase';
  let storagePath: string | undefined = undefined;

  let supabaseHost = '';
  try {
    if (SUPABASE_URL) {
      supabaseHost = new URL(SUPABASE_URL).hostname.toLowerCase();
    }
  } catch {}

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return { isValidListingPath: false, reason: 'malformed_url' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 1. Check Supabase Storage URL
    if (supabaseHost && hostname === supabaseHost) {
      // Matches /storage/v1/object/public/<bucket>/<path> or /storage/v1/object/<bucket>/<path>
      const match = parsed.pathname.match(/^\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)$/);
      if (!match) {
        return { isValidListingPath: false, reason: 'invalid_supabase_storage_url_format' };
      }
      const urlBucket = decodeURIComponent(match[1]).toLowerCase();
      if (urlBucket !== 'listings') {
        return { isValidListingPath: false, reason: 'not_a_listing_path' };
      }
      try {
        const decodedInnerPath = decodeURIComponent(match[2]);
        rawPath = `listings/${decodedInnerPath}`;
        provider = 'supabase';
        storagePath = decodedInnerPath;
      } catch {
        return { isValidListingPath: false, reason: 'uri_decode_failed' };
      }
    } else if (hostname.endsWith('.supabase.co')) {
      // Unrecognized/foreign Supabase project attempting to spoof our bucket
      return { isValidListingPath: false, reason: 'unrecognized_storage_bucket' };
    } else if (hostname === 'firebasestorage.googleapis.com') {
      // Firebase Storage default endpoint:
      // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encodedPath>
      const match = parsed.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (!match) {
        return { isValidListingPath: false, reason: 'invalid_firebase_storage_url_format' };
      }
      const urlBucket = decodeURIComponent(match[1]).toLowerCase();
      if (buckets.length > 0 && !buckets.includes(urlBucket)) {
        return { isValidListingPath: false, reason: 'unrecognized_storage_bucket' };
      }
      try {
        rawPath = decodeURIComponent(match[2]);
        provider = 'firebase';
        storagePath = rawPath;
      } catch {
        return { isValidListingPath: false, reason: 'uri_decode_failed' };
      }
    } else if (hostname === 'storage.googleapis.com') {
      // Direct GCS endpoint: https://storage.googleapis.com/<bucket>/<path>
      const match = parsed.pathname.match(/^\/([^/]+)\/(.+)$/);
      if (!match) {
        return { isValidListingPath: false, reason: 'invalid_gcs_url_format' };
      }
      const urlBucket = decodeURIComponent(match[1]).toLowerCase();
      if (buckets.length > 0 && !buckets.includes(urlBucket)) {
        return { isValidListingPath: false, reason: 'unrecognized_storage_bucket' };
      }
      try {
        rawPath = decodeURIComponent(match[2]);
        provider = 'firebase';
        storagePath = rawPath;
      } catch {
        return { isValidListingPath: false, reason: 'uri_decode_failed' };
      }
    } else {
      // External host (e.g., Unsplash, Cloudinary, CDN) - safe to skip
      return { isValidListingPath: false, reason: 'external_host' };
    }
  } else if (trimmed.startsWith('gs://')) {
    // gs://bucket/path
    const withoutGs = trimmed.slice(5);
    const slashIdx = withoutGs.indexOf('/');
    if (slashIdx === -1) {
      return { isValidListingPath: false, reason: 'invalid_gs_path' };
    }
    const gsBucket = withoutGs.substring(0, slashIdx).toLowerCase();
    if (buckets.length > 0 && !buckets.includes(gsBucket)) {
      return { isValidListingPath: false, reason: 'unrecognized_storage_bucket' };
    }
    rawPath = withoutGs.substring(slashIdx + 1);
    provider = 'firebase';
    storagePath = rawPath;
  } else {
    // Raw relative path
    rawPath = trimmed;
    storagePath = rawPath;
  }

  // Strip any lingering query params or fragment
  rawPath = rawPath.split('?')[0].split('#')[0];
  if (storagePath) {
    storagePath = storagePath.split('?')[0].split('#')[0];
  }

  // Strip leading slashes
  rawPath = rawPath.replace(/^\/+/, '');
  if (storagePath) {
    storagePath = storagePath.replace(/^\/+/, '');
  }

  // Prevent path traversal and malformed segments
  const segments = rawPath.split('/');
  if (segments.some(s => s === '..' || s === '.' || s === '')) {
    return { isValidListingPath: false, reason: 'path_traversal_or_malformed' };
  }

  // Must strictly start with listings/${currentUserId}/
  const requiredPrefix = `listings/${currentUserId.trim()}/`;
  if (!rawPath.startsWith(requiredPrefix)) {
    if (rawPath.startsWith('listings/')) {
      return { isValidListingPath: false, reason: 'ownership_mismatch' };
    }
    return { isValidListingPath: false, reason: 'not_a_listing_path' };
  }

  // Must have a filename after the prefix
  const fileName = rawPath.substring(requiredPrefix.length);
  if (!fileName || fileName.trim().length === 0) {
    return { isValidListingPath: false, reason: 'missing_filename' };
  }

  return { 
    isValidListingPath: true, 
    path: rawPath,
    provider,
    storagePath: storagePath || fileName
  };
}

/**
 * Validates whether an image URL is safe to be stored in a marketplace listing.
 * Safe images are:
 * 1. Legitimate Supabase Storage images owned by the user under listings/${userId}/ -> isAllowed: true
 * 2. Legitimate Firebase Storage images owned by the user under listings/${userId}/ -> isAllowed: true
 * 3. External web images (Unsplash, external CDNs) -> isAllowed: true
 *
 * Prohibited images:
 * - Images in storage belonging to other users -> isAllowed: false (ownership_mismatch)
 * - Images in storage in other internal directories (avatars/, clips/) -> isAllowed: false (not_a_listing_path)
 * - Path traversal attempts -> isAllowed: false (path_traversal_or_malformed)
 * - Unrecognized/spoofed storage buckets -> isAllowed: false (unrecognized_storage_bucket)
 */
export function validateListingImageUrl(
  urlOrPath: string,
  currentUserId: string,
  configuredBuckets?: string[]
): { isAllowed: boolean; reason?: string } {
  if (!urlOrPath || typeof urlOrPath !== 'string') {
    return { isAllowed: false, reason: 'empty_or_invalid_url' };
  }

  const trimmed = urlOrPath.trim();
  if (!trimmed) {
    return { isAllowed: false, reason: 'empty_url' };
  }

  // Data URIs are not final URLs; they must be uploaded to Storage first
  if (trimmed.startsWith('data:')) {
    return { isAllowed: false, reason: 'unprocessed_data_uri' };
  }

  const check = extractAndValidateListingPath(trimmed, currentUserId, configuredBuckets);

  // 1. If it's the user's own listing image in Storage -> ALLOWED
  if (check.isValidListingPath) {
    return { isAllowed: true };
  }

  // 2. If it's an external web host (e.g. Unsplash, external CDN) -> ALLOWED
  if (check.reason === 'external_host') {
    return { isAllowed: true, reason: 'external_host' };
  }

  // 3. Any other reason means it targeted our storage bucket or internal paths illegally -> PROHIBITED
  return {
    isAllowed: false,
    reason: check.reason || 'unauthorized_image_source',
  };
}

/**
 * Safely deletes verified, owner-controlled listing images from Storage.
 * Supports both Supabase Storage ('listings' bucket) and fallback Firebase Storage.
 *
 * Requirements enforced:
 * 1. Safely filters and deduplicates input URLs (handles single string, string[], or listing objects).
 * 2. Verifies URL belongs to the project's configured Storage bucket.
 * 3. Decodes and verifies storage path strictly begins with `listings/${currentUserId}/`.
 * 4. Rejects other users' paths, paths outside `listings/`, directory traversals, and ignores external URLs without throwing.
 * 5. Uses Promise.allSettled so individual failures do not interrupt others.
 * 6. Treats `storage/object-not-found` as success (already cleaned up / idempotent).
 * 7. Never leaks auth tokens in return details or logs.
 */
export async function deleteListingImagesFromStorage(
  imagesInput: ListingImageInput,
  currentUserId: string
): Promise<ListingImageDeletionResult> {
  // 1. Flatten and extract non-empty candidate strings
  const rawCandidates: string[] = [];

  if (typeof imagesInput === 'string') {
    rawCandidates.push(imagesInput);
  } else if (Array.isArray(imagesInput)) {
    for (const item of imagesInput) {
      if (typeof item === 'string') {
        rawCandidates.push(item);
      }
    }
  } else if (imagesInput && typeof imagesInput === 'object') {
    if (typeof (imagesInput as any).image === 'string') {
      rawCandidates.push((imagesInput as any).image);
    }
    if (Array.isArray((imagesInput as any).images)) {
      for (const item of (imagesInput as any).images) {
        if (typeof item === 'string') {
          rawCandidates.push(item);
        }
      }
    }
  }

  // Deduplicate and filter empty/whitespace
  const uniqueUrls: string[] = [];
  const seen = new Set<string>();
  for (const item of rawCandidates) {
    const trimmed = item.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      uniqueUrls.push(trimmed);
    }
  }

  if (uniqueUrls.length === 0) {
    return {
      total: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
      details: [],
    };
  }

  // 2. Validate user identity
  const sanitizedUserId = typeof currentUserId === 'string' ? currentUserId.trim() : '';
  if (!sanitizedUserId) {
    const details: ListingImageDeletionDetail[] = uniqueUrls.map(url => ({
      urlOrPath: sanitizeStorageUrlForLogging(url),
      status: 'skipped',
      reason: 'unauthenticated_or_invalid_user_id',
    }));

    dispatchProtonDebugEvent({
      type: 'storage-warning',
      action: 'deleteListingImages',
      message: 'Aborted listing image deletion: missing or invalid authenticated UID',
      details,
    });

    return {
      total: details.length,
      deleted: 0,
      skipped: details.length,
      failed: 0,
      details,
    };
  }

  const configuredBuckets = getConfiguredStorageBuckets();

  // 3. Process each URL/path independently with Promise.allSettled
  const deletionPromises = uniqueUrls.map(async (urlOrPath): Promise<ListingImageDeletionDetail> => {
    const sanitizedUrl = sanitizeStorageUrlForLogging(urlOrPath);
    const validation = extractAndValidateListingPath(urlOrPath, sanitizedUserId, configuredBuckets);

    if (!validation.isValidListingPath || !validation.path) {
      return {
        urlOrPath: sanitizedUrl,
        status: 'skipped',
        reason: validation.reason || 'skipped',
      };
    }

    const objectPath = validation.path;
    const isSupabase = validation.provider === 'supabase' ||
      urlOrPath.includes('supabase.co/storage/v1/object/public/listings/') ||
      urlOrPath.includes('supabase.co/storage/v1/object/listings/');

    if (isSupabase) {
      // In Supabase 'listings' bucket, path is `${userId}/${fileName}`
      const storagePath = objectPath.startsWith('listings/')
        ? objectPath.substring('listings/'.length)
        : objectPath;

      try {
        const { error: supErr } = await supabase.storage.from('listings').remove([storagePath]);
        if (supErr) {
          console.warn(`[StorageUtils] Supabase deletion notice for ${storagePath}:`, supErr.message);
          return {
            urlOrPath: sanitizedUrl,
            path: objectPath,
            status: 'failed',
            reason: supErr.message || 'supabase_deletion_error',
          };
        }
        return {
          urlOrPath: sanitizedUrl,
          path: objectPath,
          status: 'deleted',
        };
      } catch (err: any) {
        console.warn(`[StorageUtils] Supabase deletion error for ${storagePath}:`, err);
        return {
          urlOrPath: sanitizedUrl,
          path: objectPath,
          status: 'failed',
          reason: err?.message || 'supabase_deletion_exception',
        };
      }
    }

    // Fallback: Legacy Firebase Storage URL
    if (!storage) {
      return {
        urlOrPath: sanitizedUrl,
        path: objectPath,
        status: 'failed',
        reason: 'storage_uninitialized',
      };
    }

    try {
      const storageRef = ref(storage, objectPath);
      await deleteObject(storageRef);
      return {
        urlOrPath: sanitizedUrl,
        path: objectPath,
        status: 'deleted',
      };
    } catch (err: any) {
      const errorCode = err?.code || '';
      // Object not found means it is already removed, which satisfies desired end-state (idempotent success)
      if (errorCode === 'storage/object-not-found') {
        return {
          urlOrPath: sanitizedUrl,
          path: objectPath,
          status: 'deleted',
          reason: 'already_deleted',
        };
      }

      console.warn(`[StorageUtils] Failed to delete listing image at ${objectPath}:`, err);
      return {
        urlOrPath: sanitizedUrl,
        path: objectPath,
        status: 'failed',
        reason: errorCode || err?.message || 'unknown_deletion_error',
      };
    }
  });

  const settledResults = await Promise.allSettled(deletionPromises);

  const details: ListingImageDeletionDetail[] = settledResults.map((result, idx) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    const sanitized = sanitizeStorageUrlForLogging(uniqueUrls[idx]);
    return {
      urlOrPath: sanitized,
      status: 'failed',
      reason: result.reason?.message || 'promise_rejection',
    };
  });

  const deleted = details.filter(d => d.status === 'deleted').length;
  const skipped = details.filter(d => d.status === 'skipped').length;
  const failed = details.filter(d => d.status === 'failed').length;

  dispatchProtonDebugEvent({
    type: 'listing-images-deletion',
    userId: sanitizedUserId,
    total: details.length,
    deleted,
    skipped,
    failed,
    details,
  });

  return {
    total: details.length,
    deleted,
    skipped,
    failed,
    details,
  };
}

