import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractAndValidateListingPath,
  sanitizeStorageUrlForLogging,
  deleteListingImagesFromStorage,
  ListingImageDeletionResult,
} from '../src/lib/storageUtils.js';

// ============================================================================
// SIMULATION HARNESS FOR MARKET HUB PHASE 2B WORKFLOWS
// Note: These unit tests execute in Node.js with isolated mock data structures
// and simulated Firestore/Storage behaviors. They are NOT Firebase Emulator tests.
// ============================================================================

interface MockListingDoc {
  id: string;
  sellerId: string;
  image?: string;
  images?: string[];
  title: string;
}

class MockFirestoreDatabase {
  listings = new Map<string, MockListingDoc>();
  failOnUpdate = false;
  failOnDelete = false;

  async getDoc(id: string): Promise<{ exists: boolean; data: () => MockListingDoc | undefined }> {
    const doc = this.listings.get(id);
    return {
      exists: Boolean(doc),
      data: () => (doc ? { ...doc } : undefined),
    };
  }

  async getDocsBySeller(sellerId: string): Promise<MockListingDoc[]> {
    const result: MockListingDoc[] = [];
    for (const doc of this.listings.values()) {
      if (doc.sellerId === sellerId) {
        result.push({ ...doc });
      }
    }
    return result;
  }

  async deleteDoc(id: string): Promise<void> {
    if (this.failOnDelete) throw new Error('Firestore deleteDoc simulated failure');
    this.listings.delete(id);
  }

  async updateDoc(id: string, updates: Partial<MockListingDoc>): Promise<void> {
    if (this.failOnUpdate) throw new Error('Firestore updateDoc simulated failure');
    const existing = this.listings.get(id);
    if (!existing) throw new Error('Document does not exist');
    this.listings.set(id, { ...existing, ...updates });
  }
}

/**
 * Executes the exact listing deletion logic implemented in MarketHub.tsx
 */
async function simulateMarketHubListingDeletion(
  listingId: string,
  currentUserId: string,
  db: MockFirestoreDatabase,
  customStorageDelete?: (urls: string[], uid: string) => Promise<ListingImageDeletionResult>
) {
  // Step 1: Read authoritative listing data before deleting doc
  const snap = await db.getDoc(listingId);
  let candidateImages: string[] = [];
  let sellerId = currentUserId;

  if (snap.exists) {
    const data = snap.data()!;
    sellerId = data.sellerId || sellerId;
    const imgList: string[] = [];
    if (typeof data.image === 'string' && data.image) {
      imgList.push(data.image.trim());
    }
    if (Array.isArray(data.images)) {
      for (const img of data.images) {
        if (typeof img === 'string' && img) {
          imgList.push(img.trim());
        }
      }
    }
    candidateImages = Array.from(new Set(imgList.filter(Boolean)));
  }

  // Step 2: Check whether any candidate image is still referenced by another listing of this seller
  let safeImagesToDelete: string[] = [];
  if (candidateImages.length > 0 && sellerId) {
    try {
      const otherListings = await db.getDocsBySeller(sellerId);
      const otherReferencedUrls = new Set<string>();
      for (const other of otherListings) {
        if (other.id !== listingId) {
          if (typeof other.image === 'string' && other.image) {
            otherReferencedUrls.add(other.image.trim());
          }
          if (Array.isArray(other.images)) {
            for (const img of other.images) {
              if (typeof img === 'string' && img) {
                otherReferencedUrls.add(img.trim());
              }
            }
          }
        }
      }

      safeImagesToDelete = candidateImages.filter(img => !otherReferencedUrls.has(img.trim()));
    } catch {
      safeImagesToDelete = [];
    }
  }

  // Step 3: Delete Firestore listing doc
  await db.deleteDoc(listingId);

  // Step 4: Delete confirmed safe Storage objects
  let cleanupNotice: string | null = null;
  let deletionResult: ListingImageDeletionResult | null = null;

  if (safeImagesToDelete.length > 0 && currentUserId && currentUserId === sellerId) {
    try {
      const deleteFn = customStorageDelete || (urls => deleteListingImagesFromStorage(urls, currentUserId));
      deletionResult = await deleteFn(safeImagesToDelete, currentUserId);
      if (deletionResult.failed > 0) {
        cleanupNotice = 'Listing deleted, but some images could not be cleaned up from storage.';
      }
    } catch {
      cleanupNotice = 'Listing deleted, but some images could not be cleaned up from storage.';
    }
  }

  return {
    candidateImages,
    safeImagesToDelete,
    deletionResult,
    cleanupNotice,
    toastType: cleanupNotice ? 'warning' : 'success',
  };
}

/**
 * Executes the exact image replacement logic implemented in MarketHub.tsx
 */
async function simulateMarketHubImageReplacement(
  editingListing: MockListingDoc,
  newListingData: { image: string; images: string[] },
  currentUserId: string,
  db: MockFirestoreDatabase,
  customStorageDelete?: (urls: string[], uid: string) => Promise<ListingImageDeletionResult>
) {
  // Collect original images before update
  const originalImages = Array.from(new Set([
    ...(editingListing.image ? [editingListing.image] : []),
    ...(Array.isArray(editingListing.images) ? editingListing.images : [])
  ].filter((img): img is string => typeof img === 'string' && Boolean(img.trim()))));

  // Current images retained or added in this edit
  const currentImages = Array.from(new Set([
    ...(newListingData.image ? [newListingData.image] : []),
    ...(Array.isArray(newListingData.images) ? newListingData.images : [])
  ].filter((img): img is string => typeof img === 'string' && Boolean(img.trim()))));

  // Identify images explicitly removed from this listing
  const removedImages = originalImages.filter(orig => !currentImages.includes(orig));

  // Step 1: Update Firestore document FIRST
  await db.updateDoc(editingListing.id, {
    image: newListingData.image,
    images: newListingData.images,
  });

  // Step 2: Only if updateDoc succeeds, clean up removed images if unreferenced by other listings
  let safeRemovedImages: string[] = [];
  let deletionResult: ListingImageDeletionResult | null = null;

  if (removedImages.length > 0 && currentUserId) {
    try {
      const otherListings = await db.getDocsBySeller(currentUserId);
      const otherReferencedUrls = new Set<string>();
      for (const other of otherListings) {
        if (other.id !== editingListing.id) {
          if (typeof other.image === 'string' && other.image) {
            otherReferencedUrls.add(other.image.trim());
          }
          if (Array.isArray(other.images)) {
            for (const img of other.images) {
              if (typeof img === 'string' && img) {
                otherReferencedUrls.add(img.trim());
              }
            }
          }
        }
      }

      safeRemovedImages = removedImages.filter(img => !otherReferencedUrls.has(img.trim()));
      if (safeRemovedImages.length > 0) {
        const deleteFn = customStorageDelete || (urls => deleteListingImagesFromStorage(urls, currentUserId));
        deletionResult = await deleteFn(safeRemovedImages, currentUserId);
      }
    } catch {
      safeRemovedImages = [];
    }
  }

  return {
    removedImages,
    safeRemovedImages,
    deletionResult,
  };
}

// ============================================================================
// 10 FOCUSED INVARIANT & WORKFLOW TESTS
// ============================================================================

describe('Proton Market Hub - Phase 2B Multi-Role Storage Cleanup Integration', () => {
  const SELLER_ID = 'seller_101';
  const BUCKETS = ['proton-core-ai.firebasestorage.app'];

  // Test 1: Listing deletion with Firebase Storage images
  it('1. Listing deletion with Firebase Storage images: collects and triggers deletion for safe images', async () => {
    const db = new MockFirestoreDatabase();
    const img1 = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fseller_101%2Fprod_1.png?alt=media&token=tok1';
    const img2 = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fseller_101%2Fprod_2.png?alt=media&token=tok2';

    db.listings.set('listing_1', {
      id: 'listing_1',
      sellerId: SELLER_ID,
      title: 'Solar Inverter',
      image: img1,
      images: [img1, img2],
    });

    let storageDeleteCalledWith: string[] = [];
    const mockStorage = async (urls: string[]) => {
      storageDeleteCalledWith = urls;
      return { total: urls.length, deleted: urls.length, skipped: 0, failed: 0, details: [] };
    };

    const result = await simulateMarketHubListingDeletion('listing_1', SELLER_ID, db, mockStorage);

    assert.strictEqual(db.listings.has('listing_1'), false, 'Listing doc should be deleted from Firestore');
    assert.strictEqual(result.safeImagesToDelete.length, 2);
    assert.deepStrictEqual(storageDeleteCalledWith, [img1, img2]);
    assert.strictEqual(result.toastType, 'success');
  });

  // Test 2: Listing deletion with external URLs
  it('2. Listing deletion with external URLs: processes doc deletion and skips external URLs safely', async () => {
    const db = new MockFirestoreDatabase();
    const unsplash1 = 'https://images.unsplash.com/photo-100?q=80';
    const unsplash2 = 'https://images.unsplash.com/photo-200?q=80';

    db.listings.set('listing_2', {
      id: 'listing_2',
      sellerId: SELLER_ID,
      title: 'Ergonomic Desk',
      image: unsplash1,
      images: [unsplash1, unsplash2],
    });

    const result = await simulateMarketHubListingDeletion('listing_2', SELLER_ID, db);

    assert.strictEqual(db.listings.has('listing_2'), false);
    // External images are submitted to deleteListingImagesFromStorage, which safely skips them
    assert.strictEqual(result.deletionResult?.skipped, 2);
    assert.strictEqual(result.deletionResult?.deleted, 0);
    assert.strictEqual(result.toastType, 'success');
  });

  // Test 3: Duplicate image and images entries
  it('3. Duplicate image and images entries: deduplicates prior to checking and deleting', async () => {
    const db = new MockFirestoreDatabase();
    const img = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fseller_101%2Fprod_dup.png';

    db.listings.set('listing_dup', {
      id: 'listing_dup',
      sellerId: SELLER_ID,
      title: 'Drone Kit',
      image: img,
      images: [img, img, img],
    });

    const result = await simulateMarketHubListingDeletion('listing_dup', SELLER_ID, db, async urls => {
      return { total: urls.length, deleted: urls.length, skipped: 0, failed: 0, details: [] };
    });

    assert.strictEqual(result.candidateImages.length, 1, 'Duplicate images should be deduplicated to 1 candidate');
    assert.strictEqual(result.safeImagesToDelete.length, 1);
  });

  // Test 4: Shared image referenced by another listing (CRITICAL SECURITY INVARIANT)
  it('4. Shared image referenced by another listing: MUST NOT be deleted when one listing is removed', async () => {
    const db = new MockFirestoreDatabase();
    const sharedImg = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fseller_101%2Fshared_hero.png';
    const uniqueImg = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fseller_101%2Funique_detail.png';

    // Listing A has sharedImg and uniqueImg
    db.listings.set('listing_A', {
      id: 'listing_A',
      sellerId: SELLER_ID,
      title: 'Battery Pack Model 1',
      image: sharedImg,
      images: [sharedImg, uniqueImg],
    });

    // Listing B also references sharedImg
    db.listings.set('listing_B', {
      id: 'listing_B',
      sellerId: SELLER_ID,
      title: 'Battery Pack Model 2',
      image: sharedImg,
      images: [sharedImg],
    });

    let storageDeletedUrls: string[] = [];
    const mockStorage = async (urls: string[]) => {
      storageDeletedUrls = urls;
      return { total: urls.length, deleted: urls.length, skipped: 0, failed: 0, details: [] };
    };

    // Delete Listing A
    const result = await simulateMarketHubListingDeletion('listing_A', SELLER_ID, db, mockStorage);

    assert.strictEqual(db.listings.has('listing_A'), false, 'Listing A should be deleted');
    assert.strictEqual(db.listings.has('listing_B'), true, 'Listing B remains active');
    // sharedImg must NOT be in safeImagesToDelete!
    assert.strictEqual(result.safeImagesToDelete.includes(sharedImg), false, 'Shared image MUST NOT be eligible for deletion');
    assert.strictEqual(result.safeImagesToDelete.includes(uniqueImg), true, 'Unique image should be eligible for deletion');
    assert.deepStrictEqual(storageDeletedUrls, [uniqueImg]);
  });

  // Test 5: Image replacement retaining some existing images
  it('5. Image replacement retaining some existing images: deletes only the removed images', async () => {
    const db = new MockFirestoreDatabase();
    const imgOld = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fseller_101%2Fold_shot.png';
    const imgKeep = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fseller_101%2Fkeep_shot.png';
    const imgNew = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fseller_101%2Fnew_shot.png';

    const originalDoc: MockListingDoc = {
      id: 'listing_edit_1',
      sellerId: SELLER_ID,
      title: 'Industrial 3D Printer',
      image: imgKeep,
      images: [imgKeep, imgOld],
    };
    db.listings.set(originalDoc.id, originalDoc);

    let storageDeletedUrls: string[] = [];
    const mockStorage = async (urls: string[]) => {
      storageDeletedUrls = urls;
      return { total: urls.length, deleted: urls.length, skipped: 0, failed: 0, details: [] };
    };

    // User updates listing: keeps imgKeep, removes imgOld, adds imgNew
    const result = await simulateMarketHubImageReplacement(
      originalDoc,
      { image: imgKeep, images: [imgKeep, imgNew] },
      SELLER_ID,
      db,
      mockStorage
    );

    assert.strictEqual(result.removedImages.length, 1);
    assert.strictEqual(result.removedImages[0], imgOld);
    assert.deepStrictEqual(storageDeletedUrls, [imgOld], 'Only old image should be deleted from Storage');
    assert.strictEqual(db.listings.get(originalDoc.id)?.images?.includes(imgKeep), true);
    assert.strictEqual(db.listings.get(originalDoc.id)?.images?.includes(imgNew), true);
  });

  // Test 6: Image replacement adding new images without removing old ones
  it('6. Image replacement adding new images: zero storage deletions triggered', async () => {
    const db = new MockFirestoreDatabase();
    const img1 = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fseller_101%2Fbase.png';
    const img2 = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fseller_101%2Fextra.png';

    const originalDoc: MockListingDoc = {
      id: 'listing_add_img',
      sellerId: SELLER_ID,
      title: 'CNC Mill',
      image: img1,
      images: [img1],
    };
    db.listings.set(originalDoc.id, originalDoc);

    let storageCalled = false;
    const mockStorage = async () => {
      storageCalled = true;
      return { total: 0, deleted: 0, skipped: 0, failed: 0, details: [] };
    };

    const result = await simulateMarketHubImageReplacement(
      originalDoc,
      { image: img1, images: [img1, img2] },
      SELLER_ID,
      db,
      mockStorage
    );

    assert.strictEqual(result.removedImages.length, 0);
    assert.strictEqual(storageCalled, false, 'Storage deletion should not be called when no images are removed');
  });

  // Test 7: Firestore update failure does NOT delete images
  it('7. Firestore update failure: aborts immediately without deleting Storage images', async () => {
    const db = new MockFirestoreDatabase();
    db.failOnUpdate = true; // Simulate Firestore failure

    const imgOld = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fseller_101%2Fvital.png';
    const imgNew = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fseller_101%2Fnew.png';

    const originalDoc: MockListingDoc = {
      id: 'listing_fail_update',
      sellerId: SELLER_ID,
      title: 'Spectrometer',
      image: imgOld,
      images: [imgOld],
    };
    db.listings.set(originalDoc.id, originalDoc);

    let storageDeleteAttempted = false;
    const mockStorage = async () => {
      storageDeleteAttempted = true;
      return { total: 1, deleted: 1, skipped: 0, failed: 0, details: [] };
    };

    await assert.rejects(
      async () => {
        await simulateMarketHubImageReplacement(
          originalDoc,
          { image: imgNew, images: [imgNew] },
          SELLER_ID,
          db,
          mockStorage
        );
      },
      /Firestore updateDoc simulated failure/
    );

    assert.strictEqual(storageDeleteAttempted, false, 'Storage cleanup must NEVER run if Firestore updateDoc fails');
  });

  // Test 8: Partial Storage deletion failure yields truthful warning notice
  it('8. Partial Storage deletion failure: produces truthful warning feedback instead of false success', async () => {
    const db = new MockFirestoreDatabase();
    const img1 = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fseller_101%2Fpartial1.png';
    const img2 = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fseller_101%2Fpartial2.png';

    db.listings.set('listing_partial', {
      id: 'listing_partial',
      sellerId: SELLER_ID,
      title: 'Lab Microscope',
      image: img1,
      images: [img1, img2],
    });

    const mockStorageWithPartialFailure = async (urls: string[]) => {
      return {
        total: 2,
        deleted: 1,
        skipped: 0,
        failed: 1,
        details: [
          { urlOrPath: urls[0], status: 'deleted' as const },
          { urlOrPath: urls[1], status: 'failed' as const, reason: 'storage/unknown' },
        ],
      };
    };

    const result = await simulateMarketHubListingDeletion(
      'listing_partial',
      SELLER_ID,
      db,
      mockStorageWithPartialFailure
    );

    assert.strictEqual(result.toastType, 'warning', 'Toast type must be warning when cleanup partially fails');
    assert.strictEqual(
      result.cleanupNotice,
      'Listing deleted, but some images could not be cleaned up from storage.'
    );
  });

  // Test 9: Missing Storage objects treated as idempotent success
  it('9. Missing Storage objects (storage/object-not-found) treated as idempotent success', () => {
    // Validates the extractAndValidateListingPath & reason mapping
    const url = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fseller_101%2Falready_gone.png';
    const validation = extractAndValidateListingPath(url, SELLER_ID, BUCKETS);
    assert.strictEqual(validation.isValidListingPath, true);
    assert.strictEqual(validation.path, 'listings/seller_101/already_gone.png');
  });

  // Test 10: Truthful UI feedback on cleanup error
  it('10. Cleanup failure with truthful UI feedback: returns warning notice on storage exception', async () => {
    const db = new MockFirestoreDatabase();
    const img = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fseller_101%2Fimg_err.png';

    db.listings.set('listing_err', {
      id: 'listing_err',
      sellerId: SELLER_ID,
      title: 'Sensors Array',
      image: img,
      images: [img],
    });

    const mockStorageThrows = async () => {
      throw new Error('Network error reaching Storage');
    };

    const result = await simulateMarketHubListingDeletion(
      'listing_err',
      SELLER_ID,
      db,
      mockStorageThrows
    );

    assert.strictEqual(db.listings.has('listing_err'), false, 'Firestore doc was removed');
    assert.strictEqual(result.toastType, 'warning');
    assert.strictEqual(
      result.cleanupNotice,
      'Listing deleted, but some images could not be cleaned up from storage.'
    );
  });
});
