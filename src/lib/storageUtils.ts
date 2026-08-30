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
 * Helper specifically for uploading Proton Clips videos to Firebase Storage
 */
export async function uploadClipVideo(
  userId: string,
  clipId: string,
  file: File | Blob,
  onProgress?: (progress: number) => void,
  timeoutMs: number = 30000
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
  }, timeoutMs);

  return result.downloadUrl;
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
