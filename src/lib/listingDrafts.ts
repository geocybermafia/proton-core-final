import {
  getDefaultCategoryForType,
  inferListingType,
  isCategoryValidForType,
} from './listingClassification.js';
import { MAX_LISTING_PHOTOS, sanitizeDraftPhotoUrls } from './listingPhotos.js';

export interface ListingFormData {
  title: string;
  titleGe: string;
  primaryLanguage?: 'ka' | 'en';
  description: string;
  descriptionGe: string;
  price: string;
  currency: string;
  category: string;
  country: string;
  city: string;
  location: string;
  images: string[];
  lat?: number;
  lng?: number;
  condition: string;
  isNegotiable: boolean;
  listingType: 'product' | 'service' | 'project';
  isRemote: boolean;
  attributes: Record<string, string | number | boolean>;
  serviceDuration: string;
  serviceTerms: string;
}

export const UNIFIED_LISTING_DRAFT_PREFIX = 'proton_markethub_draft_v1_';
export const LEGACY_LISTING_DRAFT_KEY = 'proton_markethub_draft_form_data';

export interface UnifiedListingDraft {
  version: 1;
  ownerUid: string;
  mode: 'create' | 'edit';
  editingId: string | null;
  updatedAt: number;
  formStep: number;
  formData: ListingFormData;
  source?: 'wizard' | 'creative_ad' | 'migrated_legacy';
}

export type DraftStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function normalizeDraftOwnerUid(userId?: string | null): string {
  if (typeof userId !== 'string') return 'guest';
  const trimmed = userId.trim();
  if (!trimmed) return 'guest';
  return trimmed.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function getUnifiedDraftStorageKey(userId?: string | null): string {
  return `${UNIFIED_LISTING_DRAFT_PREFIX}${normalizeDraftOwnerUid(userId)}`;
}

export function createDefaultListingFormData(language: string = 'en'): ListingFormData {
  const isKa = language === 'ka';
  return {
    title: '',
    titleGe: '',
    primaryLanguage: isKa ? 'ka' : 'en',
    description: '',
    descriptionGe: '',
    price: '',
    currency: isKa ? 'GEL' : 'USD',
    category: 'technics',
    country: 'GEO',
    city: '',
    location: '',
    images: [],
    lat: undefined,
    lng: undefined,
    condition: 'new',
    isNegotiable: false,
    listingType: 'product',
    isRemote: false,
    attributes: {},
    serviceDuration: '',
    serviceTerms: '',
  };
}

export function clampWizardStep(step: unknown): number {
  const num = typeof step === 'number' ? step : Number(step);
  if (!Number.isFinite(num)) return 1;
  return Math.min(4, Math.max(1, Math.round(num)));
}

export function sanitizeDraftFormData(
  raw: any,
  language: string = 'en'
): ListingFormData {
  const defaults = createDefaultListingFormData(language);
  const src = raw && typeof raw === 'object' ? raw : {};

  const rawCategory = typeof src.category === 'string' && src.category.trim()
    ? src.category.trim()
    : defaults.category;
  const resolvedType = inferListingType(rawCategory, src.listingType);
  const resolvedCategory =
    rawCategory && (isCategoryValidForType(rawCategory, resolvedType) || rawCategory === 'other')
      ? rawCategory
      : getDefaultCategoryForType(resolvedType);

  const safeImages = sanitizeDraftPhotoUrls(src.images, MAX_LISTING_PHOTOS);

  const rawAttributes =
    src.attributes && typeof src.attributes === 'object' && !Array.isArray(src.attributes)
      ? { ...src.attributes }
      : {};

  const parsedLat = typeof src.lat === 'number' && Number.isFinite(src.lat) ? src.lat : undefined;
  const parsedLng = typeof src.lng === 'number' && Number.isFinite(src.lng) ? src.lng : undefined;

  return {
    title: typeof src.title === 'string' ? src.title : defaults.title,
    titleGe: typeof src.titleGe === 'string' ? src.titleGe : defaults.titleGe,
    primaryLanguage:
      src.primaryLanguage === 'ka' || src.primaryLanguage === 'en'
        ? src.primaryLanguage
        : defaults.primaryLanguage,
    description: typeof src.description === 'string' ? src.description : defaults.description,
    descriptionGe: typeof src.descriptionGe === 'string' ? src.descriptionGe : defaults.descriptionGe,
    price: typeof src.price === 'string' || typeof src.price === 'number' ? String(src.price) : defaults.price,
    currency: typeof src.currency === 'string' && src.currency.trim() ? src.currency.trim() : defaults.currency,
    category: resolvedCategory,
    country: typeof src.country === 'string' ? src.country : defaults.country,
    city: typeof src.city === 'string' ? src.city : defaults.city,
    location: typeof src.location === 'string' ? src.location : defaults.location,
    images: safeImages,
    lat: parsedLat,
    lng: parsedLng,
    condition: typeof src.condition === 'string' && src.condition ? src.condition : defaults.condition,
    isNegotiable: Boolean(src.isNegotiable),
    listingType: resolvedType,
    isRemote: Boolean(src.isRemote),
    attributes: rawAttributes,
    serviceDuration: typeof src.serviceDuration === 'string' ? src.serviceDuration : '',
    serviceTerms: typeof src.serviceTerms === 'string' ? src.serviceTerms : '',
  };
}

export function hasMeaningfulDraftContent(formData: Partial<ListingFormData> | null | undefined): boolean {
  if (!formData || typeof formData !== 'object') return false;
  const hasAttrs = Boolean(
    formData.attributes &&
    typeof formData.attributes === 'object' &&
    Object.values(formData.attributes).some(v => v !== undefined && v !== null && String(v).trim() !== '')
  );
  const priceNum = Number(String(formData.price || '').replace(',', '.'));
  const hasPrice = Boolean(String(formData.price || '').trim() && Number.isFinite(priceNum) && priceNum > 0);
  const hasImages = Array.isArray(formData.images) && formData.images.some(img => typeof img === 'string' && Boolean(img.trim()));

  return Boolean(
    (formData.title && formData.title.trim()) ||
    (formData.titleGe && formData.titleGe.trim()) ||
    (formData.description && formData.description.trim()) ||
    hasPrice ||
    hasImages ||
    hasAttrs ||
    (formData.city && formData.city.trim()) ||
    (formData.location && formData.location.trim()) ||
    (formData.serviceDuration && formData.serviceDuration.trim()) ||
    (formData.serviceTerms && formData.serviceTerms.trim())
  );
}

function getDefaultStorage(): DraftStorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function parseUnifiedDraftPayload(
  rawJson: string | null,
  expectedOwnerUid: string,
  language: string
): UnifiedListingDraft | null {
  if (!rawJson) return null;
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== 1 || !parsed.formData) return null;

    // Cross-user isolation guard: reject if stored ownerUid does not match active user
    if (typeof parsed.ownerUid === 'string' && parsed.ownerUid && parsed.ownerUid !== expectedOwnerUid) {
      return null;
    }

    const sanitizedData = sanitizeDraftFormData(parsed.formData, language);
    if (!hasMeaningfulDraftContent(sanitizedData)) {
      return null;
    }

    return {
      version: 1,
      ownerUid: expectedOwnerUid,
      mode: parsed.mode === 'edit' ? 'edit' : 'create',
      editingId: typeof parsed.editingId === 'string' && parsed.editingId ? parsed.editingId : null,
      updatedAt: typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : Date.now(),
      formStep: clampWizardStep(parsed.formStep),
      formData: sanitizedData,
      source: parsed.source,
    };
  } catch {
    return null;
  }
}

function parseLegacyDraftPayload(
  rawJson: string | null,
  ownerUid: string,
  language: string
): UnifiedListingDraft | null {
  if (!rawJson) return null;
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') return null;

    const rawForm = parsed.data || parsed.formData;
    if (!rawForm || typeof rawForm !== 'object') return null;

    const sanitizedData = sanitizeDraftFormData(rawForm, language);
    if (!hasMeaningfulDraftContent(sanitizedData)) {
      return null;
    }

    return {
      version: 1,
      ownerUid,
      mode: parsed.mode === 'edit' ? 'edit' : 'create',
      editingId: typeof parsed.editingId === 'string' && parsed.editingId ? parsed.editingId : null,
      updatedAt: typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : Date.now(),
      formStep: clampWizardStep(parsed.formStep ?? 1),
      formData: sanitizedData,
      source: 'migrated_legacy',
    };
  } catch {
    return null;
  }
}

export function saveUnifiedListingDraft(
  userId: string | null | undefined,
  params: {
    formData: ListingFormData;
    formStep?: number;
    mode?: 'create' | 'edit';
    editingId?: string | null;
    source?: UnifiedListingDraft['source'];
  },
  language: string = 'en',
  storage: DraftStorageLike | null = getDefaultStorage()
): { ok: boolean; draft: UnifiedListingDraft | null } {
  const ownerUid = normalizeDraftOwnerUid(userId);
  const key = getUnifiedDraftStorageKey(ownerUid);
  const sanitizedData = sanitizeDraftFormData(params.formData, language);

  if (!hasMeaningfulDraftContent(sanitizedData)) {
    return { ok: false, draft: null };
  }

  const draft: UnifiedListingDraft = {
    version: 1,
    ownerUid,
    mode: params.mode === 'edit' ? 'edit' : 'create',
    editingId: params.mode === 'edit' ? (params.editingId || null) : null,
    updatedAt: Date.now(),
    formStep: clampWizardStep(params.formStep ?? 1),
    formData: sanitizedData,
    source: params.source || 'wizard',
  };

  if (!storage) {
    return { ok: false, draft };
  }

  try {
    storage.setItem(key, JSON.stringify(draft));
    return { ok: true, draft };
  } catch (err) {
    console.warn('[ListingDrafts] Failed to persist unified listing draft:', err);
    return { ok: false, draft };
  }
}

/**
 * Reads the current user's unified draft. If a legacy `proton_markethub_draft_form_data`
 * exists, safely migrates it to the unified user-scoped key first and removes the legacy
 * key ONLY after persistence to the unified key succeeds.
 */
export function readAndMigrateListingDraft(
  userId: string | null | undefined,
  language: string = 'en',
  storage: DraftStorageLike | null = getDefaultStorage()
): UnifiedListingDraft | null {
  if (!storage) return null;

  const ownerUid = normalizeDraftOwnerUid(userId);
  const unifiedKey = getUnifiedDraftStorageKey(ownerUid);

  let unifiedRaw: string | null = null;
  try {
    unifiedRaw = storage.getItem(unifiedKey);
  } catch {
    unifiedRaw = null;
  }

  const existingUnified = parseUnifiedDraftPayload(unifiedRaw, ownerUid, language);

  let legacyRaw: string | null = null;
  try {
    legacyRaw = storage.getItem(LEGACY_LISTING_DRAFT_KEY);
  } catch {
    legacyRaw = null;
  }

  if (existingUnified) {
    // Unified draft is already present & valid; clean up stale legacy key if any
    if (legacyRaw) {
      try {
        storage.removeItem(LEGACY_LISTING_DRAFT_KEY);
      } catch {}
    }
    return existingUnified;
  }

  if (!legacyRaw) {
    return null;
  }

  const migrated = parseLegacyDraftPayload(legacyRaw, ownerUid, language);
  if (!migrated) {
    return null;
  }

  // Persist migrated draft into unified user-scoped key BEFORE deleting legacy key
  try {
    storage.setItem(unifiedKey, JSON.stringify(migrated));
    const verification = storage.getItem(unifiedKey);
    if (verification) {
      storage.removeItem(LEGACY_LISTING_DRAFT_KEY);
    }
  } catch (err) {
    console.warn('[ListingDrafts] Legacy draft migration write failed; preserving legacy draft:', err);
  }

  return migrated;
}

export function clearUnifiedListingDraft(
  userId: string | null | undefined,
  storage: DraftStorageLike | null = getDefaultStorage(),
  options: { removeLegacy?: boolean } = { removeLegacy: true }
): void {
  if (!storage) return;
  const key = getUnifiedDraftStorageKey(userId);
  try {
    storage.removeItem(key);
  } catch (err) {
    console.warn('[ListingDrafts] Failed to remove unified listing draft:', err);
  }

  if (options.removeLegacy !== false) {
    try {
      storage.removeItem(LEGACY_LISTING_DRAFT_KEY);
    } catch {}
  }
}
