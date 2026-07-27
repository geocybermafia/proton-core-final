import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

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

/**
 * Uploads a file or Blob to Firebase Storage using uploadBytesResumable with progress tracking and timeout protection.
 */
export async function uploadFileToStorage(
  options: UploadOptions,
  timeoutMs: number = 45000
): Promise<UploadResult> {
  const { path, file, metadata, onProgress } = options;

  console.log(`[StorageUtils] Initializing upload to path "${path}" (Size: ${file.size} bytes, Type: ${file.type || 'unknown'})`);

  if (!storage) {
    console.error('[StorageUtils] Firebase Storage instance is not initialized in firebase.ts!');
    throw new Error('Firebase Storage instance is not initialized.');
  }

  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file, metadata);

  return new Promise((resolve, reject) => {
    let isSettled = false;

    // Timeout guard to prevent infinite hanging
    const timeoutId = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        console.error(`[StorageUtils] Upload timed out after ${timeoutMs}ms for path "${path}". Canceling task...`);
        try {
          uploadTask.cancel();
        } catch (e) {
          console.warn('[StorageUtils] Failed to cancel upload task:', e);
        }
        reject(new Error(`Firebase Storage upload timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
      }
    }, timeoutMs);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0) {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          console.log(`[StorageUtils] Progress for "${path}": ${progress}% (${snapshot.bytesTransferred}/${snapshot.totalBytes} bytes)`);
          if (onProgress && !isSettled) {
            onProgress(progress);
          }
        }
      },
      (error) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timeoutId);
        console.error(`[StorageUtils] uploadTask error state for path "${path}":`, error);
        reject(error);
      },
      async () => {
        if (isSettled) return;
        console.log(`[StorageUtils] File bytes transferred successfully for "${path}". Fetching download URL...`);
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          if (isSettled) return;
          isSettled = true;
          clearTimeout(timeoutId);
          console.log(`[StorageUtils] Successfully obtained download URL for "${path}":`, downloadUrl);
          resolve({
            downloadUrl,
            fullPath: uploadTask.snapshot.ref.fullPath,
          });
        } catch (err) {
          if (isSettled) return;
          isSettled = true;
          clearTimeout(timeoutId);
          console.error(`[StorageUtils] getDownloadURL failed for path "${path}":`, err);
          reject(err);
        }
      }
    );
  });
}

/**
 * Helper specifically for uploading Proton Clips videos to Firebase Storage
 */
export async function uploadClipVideo(
  userId: string,
  clipId: string,
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<string> {
  const fileExt = file instanceof File && file.name.includes('.') ? file.name.split('.').pop() : 'mp4';
  const path = `clips/${userId}/${clipId}.${fileExt}`;

  const result = await uploadFileToStorage({
    path,
    file,
    metadata: {
      contentType: file.type || 'video/mp4',
      customMetadata: {
        uploadedBy: userId,
        clipId,
      },
    },
    onProgress,
  });

  return result.downloadUrl;
}
