import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateListingImageUrl,
  extractAndValidateListingPath,
} from '../src/lib/storageUtils.js';

// ============================================================================
// SIMULATION HARNESS FOR LISTING CREATION / EDITING WORKFLOWS
// Note: These unit tests execute in Node.js with isolated mock data structures.
// They are simulation tests, NOT Firebase Emulator tests.
// ============================================================================

interface MockListingDoc {
  id: string;
  sellerId: string;
  title: string;
  image?: string;
  images?: string[];
}

class MockFirestore {
  listings = new Map<string, MockListingDoc>();
  addDocCalls = 0;
  updateDocCalls = 0;

  async addDoc(data: any): Promise<string> {
    this.addDocCalls++;
    const id = `listing_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.listings.set(id, { id, ...data });
    return id;
  }

  async updateDoc(id: string, data: any): Promise<void> {
    this.updateDocCalls++;
    const existing = this.listings.get(id);
    if (!existing) throw new Error('Listing does not exist');
    this.listings.set(id, { ...existing, ...data });
  }
}

/**
 * Simulates the image validation and write workflow implemented in MarketHub.tsx handleSubmitListing
 */
async function simulateMarketHubSubmit(
  mode: 'create' | 'edit',
  editingListingId: string | null,
  currentUserId: string,
  rawImages: string[],
  db: MockFirestore,
  buckets?: string[]
): Promise<{ success: boolean; errorReason?: string; listingId?: string }> {
  // Step 1: Simulate base64 upload
  const processedImages = rawImages.map((img, idx) => {
    if (img.startsWith('data:image/')) {
      // Successfully uploaded to own storage bucket
      return `https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2F${currentUserId}%2Fprod_${Date.now()}_${idx}.png?alt=media&token=fresh`;
    }
    return img;
  });

  // Step 2: Validate each image URL using validateListingImageUrl
  for (const img of processedImages) {
    if (typeof img === 'string' && img.trim()) {
      const check = validateListingImageUrl(img, currentUserId, buckets);
      if (!check.isAllowed) {
        return { success: false, errorReason: check.reason };
      }
    }
  }

  // Step 3: Write to Firestore (only if validation passed)
  const listingData = {
    title: 'Test Listing',
    sellerId: currentUserId,
    image: processedImages[0] || '',
    images: processedImages,
  };

  if (mode === 'edit' && editingListingId) {
    await db.updateDoc(editingListingId, listingData);
    return { success: true, listingId: editingListingId };
  } else {
    const newId = await db.addDoc(listingData);
    return { success: true, listingId: newId };
  }
}

describe('Market Hub - Listing Image Ownership Security (Phase 3)', () => {
  const SELLER_ME = 'user_merchant_123';
  const VICTIM_SELLER = 'victim_seller_999';
  const BUCKETS = ['proton-core-ai.firebasestorage.app', 'proton-core-ai.appspot.com'];

  // Test 1: Other user's Firebase Storage image is BLOCKED
  it('1. Other user\'s Firebase Storage image URL is BLOCKED (ownership_mismatch)', async () => {
    const victimImageUrl = `https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2F${VICTIM_SELLER}%2Fsecret_item.png?alt=media&token=secret`;
    
    const check = validateListingImageUrl(victimImageUrl, SELLER_ME, BUCKETS);
    assert.strictEqual(check.isAllowed, false);
    assert.strictEqual(check.reason, 'ownership_mismatch');

    // Verify raw relative path as well
    const rawCheck = validateListingImageUrl(`listings/${VICTIM_SELLER}/photo.png`, SELLER_ME, BUCKETS);
    assert.strictEqual(rawCheck.isAllowed, false);
    assert.strictEqual(rawCheck.reason, 'ownership_mismatch');
  });

  // Test 2: Own Firebase Storage image is ALLOWED
  it('2. Own Firebase Storage image URL is ALLOWED (isAllowed: true)', async () => {
    const myImageUrl = `https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2F${SELLER_ME}%2Fmy_item_123.png?alt=media&token=valid`;
    
    const check = validateListingImageUrl(myImageUrl, SELLER_ME, BUCKETS);
    assert.strictEqual(check.isAllowed, true);

    const relativeCheck = validateListingImageUrl(`listings/${SELLER_ME}/my_item_123.png`, SELLER_ME, BUCKETS);
    assert.strictEqual(relativeCheck.isAllowed, true);
  });

  // Test 3: Unsplash and legitimate external images ALLOWED
  it('3. Unsplash and legitimate external CDN URLs are ALLOWED (external_host)', async () => {
    const unsplashUrl = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80';
    const cdnUrl = 'https://cdn.example.com/assets/product_456.jpg';

    const check1 = validateListingImageUrl(unsplashUrl, SELLER_ME, BUCKETS);
    assert.strictEqual(check1.isAllowed, true);
    assert.strictEqual(check1.reason, 'external_host');

    const check2 = validateListingImageUrl(cdnUrl, SELLER_ME, BUCKETS);
    assert.strictEqual(check2.isAllowed, true);
    assert.strictEqual(check2.reason, 'external_host');
  });

  // Test 4: avatars/ and clips/ storage paths BLOCKED
  it('4. Internal directories (avatars/, clips/) are BLOCKED as listing images (not_a_listing_path)', async () => {
    const avatarUrl = `https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/avatars%2F${SELLER_ME}%2Favatar.png?alt=media`;
    const clipUrl = `https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/clips%2F${SELLER_ME}%2Fshort.mp4?alt=media`;

    const avatarCheck = validateListingImageUrl(avatarUrl, SELLER_ME, BUCKETS);
    assert.strictEqual(avatarCheck.isAllowed, false);
    assert.strictEqual(avatarCheck.reason, 'not_a_listing_path');

    const clipCheck = validateListingImageUrl(clipUrl, SELLER_ME, BUCKETS);
    assert.strictEqual(clipCheck.isAllowed, false);
    assert.strictEqual(clipCheck.reason, 'not_a_listing_path');
  });

  // Test 5: data:image/... upload flow converts to valid owned storage URL
  it('5. data:image/... upload flow produces allowed storage URL', async () => {
    const db = new MockFirestore();
    const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY44YAAAAASUVORK5CYII=';

    const result = await simulateMarketHubSubmit(
      'create',
      null,
      SELLER_ME,
      [base64Data],
      db,
      BUCKETS
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(db.addDocCalls, 1);
    const created = db.listings.get(result.listingId!);
    assert.ok(created?.image?.includes(`listings%2F${SELLER_ME}%2F`));
  });

  // Test 6: Malformed, path traversal, or spoofed buckets BLOCKED
  it('6. Malformed URLs, directory traversal attacks and spoofed buckets are BLOCKED', async () => {
    // Path traversal
    const traversal = `https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2F${SELLER_ME}%2F..%2F${VICTIM_SELLER}%2Fstolen.png?alt=media`;
    const traversalCheck = validateListingImageUrl(traversal, SELLER_ME, BUCKETS);
    assert.strictEqual(traversalCheck.isAllowed, false);
    assert.strictEqual(traversalCheck.reason, 'path_traversal_or_malformed');

    // Spoofed bucket claiming to be storage
    const spoofedBucket = `https://firebasestorage.googleapis.com/v0/b/malicious-attacker.appspot.com/o/listings%2F${SELLER_ME}%2Fphoto.png`;
    const spoofCheck = validateListingImageUrl(spoofedBucket, SELLER_ME, BUCKETS);
    assert.strictEqual(spoofCheck.isAllowed, false);
    assert.strictEqual(spoofCheck.reason, 'unrecognized_storage_bucket');

    // Empty/invalid string
    const emptyCheck = validateListingImageUrl('', SELLER_ME, BUCKETS);
    assert.strictEqual(emptyCheck.isAllowed, false);
  });

  // Test 7: Creation AND editing paths both enforce protection
  it('7. Creation and editing paths both enforce image ownership protection', async () => {
    const db = new MockFirestore();
    const stolenUrl = `https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2F${VICTIM_SELLER}%2Fphoto.png`;

    // Attempt creation with stolen URL
    const createResult = await simulateMarketHubSubmit(
      'create',
      null,
      SELLER_ME,
      [stolenUrl],
      db,
      BUCKETS
    );
    assert.strictEqual(createResult.success, false);
    assert.strictEqual(createResult.errorReason, 'ownership_mismatch');
    assert.strictEqual(db.addDocCalls, 0, 'Firestore addDoc must NOT be called on create failure');

    // Seed existing listing owned by SELLER_ME with valid image
    const validUrl = `https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2F${SELLER_ME}%2Foriginal.png`;
    const initialId = await db.addDoc({
      title: 'Original Listing',
      sellerId: SELLER_ME,
      image: validUrl,
      images: [validUrl],
    });

    // Attempt edit replacing image with stolen URL
    const editResult = await simulateMarketHubSubmit(
      'edit',
      initialId,
      SELLER_ME,
      [stolenUrl],
      db,
      BUCKETS
    );
    assert.strictEqual(editResult.success, false);
    assert.strictEqual(editResult.errorReason, 'ownership_mismatch');
    assert.strictEqual(db.updateDocCalls, 0, 'Firestore updateDoc must NOT be called on edit failure');
    // Ensure original listing image remains intact
    const originalListing = db.listings.get(initialId);
    assert.strictEqual(originalListing?.image, validUrl);
  });

  // Test 8: On error, Firestore is NOT modified
  it('8. When validation fails, Firestore state remains 100% unmodified', async () => {
    const db = new MockFirestore();
    const badUrls = [
      'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/avatars%2Fuser%2Fav.png',
      `https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2F${VICTIM_SELLER}%2Fitem.png`,
    ];

    for (const badUrl of badUrls) {
      const res = await simulateMarketHubSubmit('create', null, SELLER_ME, [badUrl], db, BUCKETS);
      assert.strictEqual(res.success, false);
    }

    assert.strictEqual(db.listings.size, 0, 'Zero listings should exist in Firestore after failed submissions');
    assert.strictEqual(db.addDocCalls, 0);
    assert.strictEqual(db.updateDocCalls, 0);
  });
});
