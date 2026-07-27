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
 * Uploads a file or Blob to Firebase Storage using uploadBytesResumable with progress tracking.
 */
export async function uploadFileToStorage(options: UploadOptions): Promise<UploadResult> {
  const { path, file, metadata, onProgress } = options;

  if (!storage) {
    throw new Error('Firebase Storage instance is not initialized.');
  }

  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file, metadata);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0) {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (onProgress) {
            onProgress(progress);
          }
        }
      },
      (error) => {
        console.error(`Firebase Storage upload error at ${path}:`, error);
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            downloadUrl,
            fullPath: uploadTask.snapshot.ref.fullPath,
          });
        } catch (err) {
          console.error(`Error getting download URL for ${path}:`, err);
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
