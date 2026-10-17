import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';
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
 * Helper specifically for uploading product images to Firebase Storage.
 * Accepts File, Blob, or Base64 string and returns the HTTPS download URL.
 */
export async function uploadProductImage(
  userId: string,
  image: File | Blob | string,
  productId?: string
): Promise<string> {
  if (typeof image === 'string') {
    if (image.startsWith('http://') || image.startsWith('https://')) {
      return image;
    }
    const { blob, contentType } = base64ToBlob(image);
    const timestamp = Date.now();
    const path = `listings/${userId}/${productId || 'prod'}_${timestamp}.png`;
    const result = await uploadFileToStorage({
      path,
      file: blob,
      metadata: {
        contentType,
        customMetadata: {
          uploadedBy: userId,
          type: 'listing-image',
        },
      },
    });
    return result.downloadUrl;
  } else {
    const contentType = image.type || 'image/png';
    const timestamp = Date.now();
    const path = `listings/${userId}/${productId || 'prod'}_${timestamp}.png`;
    const result = await uploadFileToStorage({
      path,
      file: image,
      metadata: {
        contentType,
        customMetadata: {
          uploadedBy: userId,
          type: 'listing-image',
        },
      },
    });
    return result.downloadUrl;
  }
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
