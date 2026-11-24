export const MAX_LISTING_PHOTOS = 10;
export const MAX_LISTING_PHOTO_BYTES = 5 * 1024 * 1024;

export type ListingPhotoUploadStatus = 'resizing' | 'uploading' | 'success' | 'error';

export interface ListingPhotoUploadTask {
  id: string;
  fileName: string;
  previewUrl: string;
  status: ListingPhotoUploadStatus;
  progress: number;
  errorMessage?: string;
  uploadedUrl?: string;
  file?: File;
  resizedDataUri?: string;
}

export function isSafeHttpPhotoUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.toLowerCase().startsWith('data:')) return false;
  return trimmed.startsWith('https://') || trimmed.startsWith('http://');
}

export function normalizePhotoUrlList(
  images: unknown,
  maxPhotos: number = MAX_LISTING_PHOTOS
): string[] {
  if (!Array.isArray(images)) return [];
  const cap = Math.max(0, maxPhotos);
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of images) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
    if (normalized.length >= cap) break;
  }

  return normalized;
}

export function sanitizeDraftPhotoUrls(
  images: unknown,
  maxPhotos: number = MAX_LISTING_PHOTOS
): string[] {
  if (!Array.isArray(images)) return [];
  const safeUrls = images.filter(isSafeHttpPhotoUrl);
  return normalizePhotoUrlList(safeUrls, maxPhotos);
}

export function getAvailablePhotoSlots(
  currentImages: unknown,
  inFlightTasksCount: number = 0,
  maxPhotos: number = MAX_LISTING_PHOTOS
): number {
  const existingCount = Array.isArray(currentImages)
    ? currentImages.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).length
    : 0;
  const activeCount = Math.max(0, Math.floor(inFlightTasksCount));
  return Math.max(0, maxPhotos - existingCount - activeCount);
}

export function appendUploadedPhotoUrl(
  currentImages: string[],
  uploadedUrl: string,
  maxPhotos: number = MAX_LISTING_PHOTOS
): string[] {
  const cleanUrl = typeof uploadedUrl === 'string' ? uploadedUrl.trim() : '';
  const currentNormalized = normalizePhotoUrlList(currentImages, maxPhotos);
  if (!cleanUrl) return currentNormalized;
  if (currentNormalized.includes(cleanUrl)) return currentNormalized;
  if (currentNormalized.length >= maxPhotos) return currentNormalized;
  return [...currentNormalized, cleanUrl];
}

export function removePhotoAtIndex(currentImages: string[], index: number): string[] {
  if (!Array.isArray(currentImages)) return [];
  if (index < 0 || index >= currentImages.length) {
    return normalizePhotoUrlList(currentImages);
  }
  const next = currentImages.filter((_, idx) => idx !== index);
  return normalizePhotoUrlList(next);
}

export function setPrimaryPhotoAtIndex(currentImages: string[], index: number): string[] {
  const normalized = normalizePhotoUrlList(currentImages);
  if (index <= 0 || index >= normalized.length) {
    return normalized;
  }
  const chosen = normalized[index];
  const rest = normalized.filter((_, idx) => idx !== index);
  return [chosen, ...rest];
}

export function reorderPhotosByIndex(
  currentImages: string[],
  fromIndex: number,
  toIndex: number
): string[] {
  const normalized = normalizePhotoUrlList(currentImages);
  if (
    fromIndex < 0 ||
    fromIndex >= normalized.length ||
    toIndex < 0 ||
    toIndex >= normalized.length ||
    fromIndex === toIndex
  ) {
    return normalized;
  }

  const next = [...normalized];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function validateExternalPhotoUrl(
  rawUrl: string,
  currentImages: string[] = [],
  maxPhotos: number = MAX_LISTING_PHOTOS
): { valid: boolean; normalizedUrl?: string; reason?: 'empty' | 'limit_reached' | 'duplicate' | 'invalid_protocol' | 'malformed' } {
  const normalizedExisting = normalizePhotoUrlList(currentImages, maxPhotos);
  if (normalizedExisting.length >= maxPhotos) {
    return { valid: false, reason: 'limit_reached' };
  }

  const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!trimmed) {
    return { valid: false, reason: 'empty' };
  }

  if (trimmed.toLowerCase().startsWith('data:') || trimmed.toLowerCase().startsWith('javascript:')) {
    return { valid: false, reason: 'invalid_protocol' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: 'malformed' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, reason: 'invalid_protocol' };
  }

  if (normalizedExisting.includes(trimmed)) {
    return { valid: false, reason: 'duplicate' };
  }

  return { valid: true, normalizedUrl: trimmed };
}

export function resolveListingPrimaryAndGalleryImages(
  images: unknown,
  maxPhotos: number = MAX_LISTING_PHOTOS
): { image: string; images: string[] } {
  const normalized = normalizePhotoUrlList(images, maxPhotos);
  return {
    image: normalized[0] || '',
    images: normalized,
  };
}
