import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_LISTING_PHOTO_BYTES,
  MAX_LISTING_PHOTOS,
  appendUploadedPhotoUrl,
  getAvailablePhotoSlots,
  isSafeHttpPhotoUrl,
  normalizePhotoUrlList,
  removePhotoAtIndex,
  reorderPhotosByIndex,
  resolveListingPrimaryAndGalleryImages,
  sanitizeDraftPhotoUrls,
  setPrimaryPhotoAtIndex,
  validateExternalPhotoUrl,
} from '../src/lib/listingPhotos.js';
import {
  DraftStorageLike,
  LEGACY_LISTING_DRAFT_KEY,
  UNIFIED_LISTING_DRAFT_PREFIX,
  clampWizardStep,
  clearUnifiedListingDraft,
  createDefaultListingFormData,
  getUnifiedDraftStorageKey,
  hasMeaningfulDraftContent,
  normalizeDraftOwnerUid,
  readAndMigrateListingDraft,
  saveUnifiedListingDraft,
} from '../src/lib/listingDrafts.js';
import {
  extractAndValidateListingPath,
  validateListingImageUrl,
} from '../src/lib/storageUtils.js';

function createMockStorage(initial: Record<string, string> = {}, options?: { throwOnSet?: boolean }): DraftStorageLike & { dump: () => Record<string, string> } {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      if (options?.throwOnSet) {
        throw new Error('QuotaExceededError: Storage full');
      }
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    dump() {
      return Object.fromEntries(store.entries());
    },
  };
}

describe('Stage 3 — Multi-Photo Management (listingPhotos.ts)', () => {
  it('enforces MAX_LISTING_PHOTOS === 10 and 5MB cap constants', () => {
    assert.equal(MAX_LISTING_PHOTOS, 10);
    assert.equal(MAX_LISTING_PHOTO_BYTES, 5 * 1024 * 1024);

    const eleven = Array.from({ length: 11 }, (_, i) => `https://cdn.example.com/photo-${i + 1}.jpg`);
    const normalized = normalizePhotoUrlList(eleven);
    assert.equal(normalized.length, 10);
    assert.equal(normalized[9], 'https://cdn.example.com/photo-10.jpg');

    const afterAppendAtCap = appendUploadedPhotoUrl(normalized, 'https://cdn.example.com/photo-11.jpg');
    assert.equal(afterAppendAtCap.length, 10);
    assert.equal(afterAppendAtCap.includes('https://cdn.example.com/photo-11.jpg'), false);
  });

  it('deduplicates, trims whitespace, and calculates remaining upload slots accurately', () => {
    const raw = [
      ' https://cdn.example.com/a.jpg ',
      'https://cdn.example.com/a.jpg',
      '',
      '   ',
      'https://cdn.example.com/b.jpg',
    ];
    const normalized = normalizePhotoUrlList(raw);
    assert.deepEqual(normalized, [
      'https://cdn.example.com/a.jpg',
      'https://cdn.example.com/b.jpg',
    ]);

    assert.equal(getAvailablePhotoSlots(normalized, 0), 8);
    assert.equal(getAvailablePhotoSlots(normalized, 3), 5);
    assert.equal(getAvailablePhotoSlots(normalized, 12), 0);

    // Duplicate append is a no-op
    assert.deepEqual(appendUploadedPhotoUrl(normalized, 'https://cdn.example.com/a.jpg'), normalized);
  });

  it('supports photo deletion, reordering, and primary cover promotion', () => {
    const initial = [
      'https://cdn.example.com/1.jpg',
      'https://cdn.example.com/2.jpg',
      'https://cdn.example.com/3.jpg',
    ];

    // Make #3 cover photo -> moves to index 0 while preserving remaining order
    const withNewCover = setPrimaryPhotoAtIndex(initial, 2);
    assert.deepEqual(withNewCover, [
      'https://cdn.example.com/3.jpg',
      'https://cdn.example.com/1.jpg',
      'https://cdn.example.com/2.jpg',
    ]);

    // Reorder index 0 -> index 1
    const reordered = reorderPhotosByIndex(withNewCover, 0, 1);
    assert.deepEqual(reordered, [
      'https://cdn.example.com/1.jpg',
      'https://cdn.example.com/3.jpg',
      'https://cdn.example.com/2.jpg',
    ]);

    // Delete current cover (#0) -> next photo (#3) automatically becomes cover
    const afterDelete = removePhotoAtIndex(reordered, 0);
    assert.deepEqual(afterDelete, [
      'https://cdn.example.com/3.jpg',
      'https://cdn.example.com/2.jpg',
    ]);

    const resolved = resolveListingPrimaryAndGalleryImages(afterDelete);
    assert.equal(resolved.image, 'https://cdn.example.com/3.jpg');
    assert.deepEqual(resolved.images, afterDelete);

    // Empty fallback
    assert.deepEqual(resolveListingPrimaryAndGalleryImages([]), { image: '', images: [] });
  });

  it('validates external URLs strictly and strips data:/javascript: from drafts', () => {
    const existing = ['https://cdn.example.com/existing.jpg'];

    assert.deepEqual(validateExternalPhotoUrl('', existing), { valid: false, reason: 'empty' });
    assert.deepEqual(
      validateExternalPhotoUrl('data:image/png;base64,AAAA', existing),
      { valid: false, reason: 'invalid_protocol' }
    );
    assert.deepEqual(
      validateExternalPhotoUrl('javascript:alert(1)', existing),
      { valid: false, reason: 'invalid_protocol' }
    );
    assert.deepEqual(
      validateExternalPhotoUrl('ftp://cdn.example.com/img.png', existing),
      { valid: false, reason: 'invalid_protocol' }
    );
    assert.deepEqual(
      validateExternalPhotoUrl('not-a-valid-url', existing),
      { valid: false, reason: 'malformed' }
    );
    assert.deepEqual(
      validateExternalPhotoUrl('https://cdn.example.com/existing.jpg', existing),
      { valid: false, reason: 'duplicate' }
    );
    assert.deepEqual(
      validateExternalPhotoUrl('  https://cdn.example.com/new.webp  ', existing),
      { valid: true, normalizedUrl: 'https://cdn.example.com/new.webp' }
    );

    const tenExisting = Array.from({ length: 10 }, (_, i) => `https://cdn.example.com/${i}.jpg`);
    assert.deepEqual(
      validateExternalPhotoUrl('https://cdn.example.com/11.jpg', tenExisting),
      { valid: false, reason: 'limit_reached' }
    );

    assert.equal(isSafeHttpPhotoUrl('data:image/jpeg;base64,xyz'), false);
    assert.equal(isSafeHttpPhotoUrl('https://cdn.example.com/ok.jpg'), true);

    const sanitized = sanitizeDraftPhotoUrls([
      'data:image/png;base64,HUGE_BASE64',
      'https://cdn.example.com/safe-1.jpg',
      'http://cdn.example.com/safe-2.jpg',
      'javascript:void(0)',
    ]);
    assert.deepEqual(sanitized, [
      'https://cdn.example.com/safe-1.jpg',
      'http://cdn.example.com/safe-2.jpg',
    ]);
  });

  it('enforces photo ownership validation on storage paths & URLs', () => {
    const ownerUid = 'seller_owner_1';
    const attackerUid = 'attacker_99';
    const buckets = ['proton-core-ai.firebasestorage.app'];

    const ownFbUrl = `https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2F${ownerUid}%2Fphoto.webp?alt=media&token=secret`;
    const otherFbUrl = `https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2F${attackerUid}%2Fphoto.webp?alt=media&token=secret`;
    const ownProxyUrl = `https://proton.example.com/api/storage/file/${ownerUid}/photo.webp`;
    const otherProxyUrl = `https://proton.example.com/api/storage/file/${attackerUid}/photo.webp`;

    assert.equal(extractAndValidateListingPath(ownFbUrl, ownerUid, buckets).isValidListingPath, true);
    assert.equal(extractAndValidateListingPath(otherFbUrl, ownerUid, buckets).isValidListingPath, false);
    assert.equal(extractAndValidateListingPath(otherFbUrl, ownerUid, buckets).reason, 'ownership_mismatch');

    assert.equal(validateListingImageUrl(ownProxyUrl, ownerUid, buckets).isAllowed, true);
    assert.equal(validateListingImageUrl(otherProxyUrl, ownerUid, buckets).isAllowed, false);
    assert.equal(validateListingImageUrl(`listings/${ownerUid}/../../etc/passwd`, ownerUid, buckets).isAllowed, false);
  });
});

describe('Stage 3 — Unified Draft System & Cross-UID Isolation (listingDrafts.ts)', () => {
  it('generates user-scoped unified draft keys cleanly', () => {
    assert.equal(normalizeDraftOwnerUid(undefined), 'guest');
    assert.equal(normalizeDraftOwnerUid('   '), 'guest');
    assert.equal(normalizeDraftOwnerUid('uid:abc/123'), 'uid_abc_123');
    assert.equal(
      getUnifiedDraftStorageKey('user_123'),
      `${UNIFIED_LISTING_DRAFT_PREFIX}user_123`
    );
  });

  it('saves, restores, and clears unified drafts while stripping Base64 images', () => {
    const storage = createMockStorage();
    const formData = {
      ...createDefaultListingFormData('ka'),
      title: 'MacBook Pro M3 Max',
      titleGe: 'მაკბუკ პრო M3 Max',
      price: '4500',
      currency: 'GEL',
      listingType: 'product' as const,
      category: 'technics',
      city: 'Tbilisi',
      images: [
        'https://cdn.example.com/mac-1.webp',
        'data:image/jpeg;base64,SHOULD_BE_STRIPPED',
        'https://cdn.example.com/mac-2.webp',
      ],
      attributes: { conditionGrade: 'mint' },
    };

    const saveRes = saveUnifiedListingDraft(
      'user_alpha',
      { formData, formStep: 3, mode: 'create', source: 'wizard' },
      'ka',
      storage
    );
    assert.equal(saveRes.ok, true);
    assert.ok(saveRes.draft);
    assert.equal(saveRes.draft!.ownerUid, 'user_alpha');
    assert.deepEqual(saveRes.draft!.formData.images, [
      'https://cdn.example.com/mac-1.webp',
      'https://cdn.example.com/mac-2.webp',
    ]);

    const restored = readAndMigrateListingDraft('user_alpha', 'ka', storage);
    assert.ok(restored);
    assert.equal(restored!.formStep, 3);
    assert.equal(restored!.formData.title, 'MacBook Pro M3 Max');
    assert.equal(restored!.formData.listingType, 'product');
    assert.equal(restored!.formData.category, 'technics');
    assert.deepEqual(restored!.formData.images, [
      'https://cdn.example.com/mac-1.webp',
      'https://cdn.example.com/mac-2.webp',
    ]);

    // User Beta must not see User Alpha's draft
    assert.equal(readAndMigrateListingDraft('user_beta', 'ka', storage), null);

    clearUnifiedListingDraft('user_alpha', storage);
    assert.equal(readAndMigrateListingDraft('user_alpha', 'ka', storage), null);
  });

  it('migrates legacy draft key ONLY after verified unified write and preserves legacy key on write failure', () => {
    const legacyPayload = JSON.stringify({
      updatedAt: 1700000000000,
      formStep: 2,
      data: {
        title: 'Legacy Camera Rig',
        price: '900',
        currency: 'USD',
        category: 'technics',
        listingType: 'product',
        images: ['https://cdn.example.com/cam.jpg'],
      },
    });

    // 1. Failing write preserves legacy key so user draft is never lost
    const failingStorage = createMockStorage(
      { [LEGACY_LISTING_DRAFT_KEY]: legacyPayload },
      { throwOnSet: true }
    );
    const migratedAttempt = readAndMigrateListingDraft('user_fail', 'en', failingStorage);
    assert.ok(migratedAttempt);
    assert.equal(migratedAttempt!.formData.title, 'Legacy Camera Rig');
    assert.equal(Boolean(failingStorage.getItem(LEGACY_LISTING_DRAFT_KEY)), true);
    assert.equal(failingStorage.getItem(getUnifiedDraftStorageKey('user_fail')), null);

    // 2. Successful write migrates into user-scoped unified key and removes legacy key
    const healthyStorage = createMockStorage({ [LEGACY_LISTING_DRAFT_KEY]: legacyPayload });
    const migrated = readAndMigrateListingDraft('user_ok', 'en', healthyStorage);
    assert.ok(migrated);
    assert.equal(migrated!.source, 'migrated_legacy');
    assert.equal(migrated!.formStep, 2);
    assert.equal(migrated!.formData.title, 'Legacy Camera Rig');
    assert.equal(healthyStorage.getItem(LEGACY_LISTING_DRAFT_KEY), null);
    assert.ok(healthyStorage.getItem(getUnifiedDraftStorageKey('user_ok')));
  });

  it('rejects cross-user tampered drafts, ignores empty defaults, and clamps steps to [1..4]', () => {
    const storage = createMockStorage({
      [getUnifiedDraftStorageKey('user_victim')]: JSON.stringify({
        version: 1,
        ownerUid: 'user_other',
        mode: 'create',
        editingId: null,
        updatedAt: Date.now(),
        formStep: 2,
        formData: {
          ...createDefaultListingFormData('en'),
          title: 'Stolen Draft Content',
        },
      }),
    });

    assert.equal(readAndMigrateListingDraft('user_victim', 'en', storage), null);

    const blankDefaults = createDefaultListingFormData('en');
    assert.equal(hasMeaningfulDraftContent(blankDefaults), false);
    const blankSave = saveUnifiedListingDraft('user_clean', { formData: blankDefaults, formStep: 1 }, 'en', storage);
    assert.equal(blankSave.ok, false);
    assert.equal(blankSave.draft, null);

    assert.equal(clampWizardStep(-5), 1);
    assert.equal(clampWizardStep(0), 1);
    assert.equal(clampWizardStep(2.6), 3);
    assert.equal(clampWizardStep(99), 4);
    assert.equal(clampWizardStep('invalid'), 1);
  });
});
