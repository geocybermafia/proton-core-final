import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  extractAndValidateListingPath,
  validateListingImageUrl,
  deleteListingImagesFromStorage,
} from '../src/lib/storageUtils';

const SELLER_1 = 'seller_supabase_101';
const SELLER_2 = 'seller_supabase_202';
const SUPABASE_BASE = 'https://ntndwrpruyrttlpjptzf.supabase.co/storage/v1/object/public';

describe('Market Hub - Supabase Listing Storage Integration', () => {
  it('1. Own Supabase listing image URL is ALLOWED (isAllowed: true)', () => {
    const ownUrl = `${SUPABASE_BASE}/listings/${SELLER_1}/prod_1793145500_abc12.jpg`;
    const check = validateListingImageUrl(ownUrl, SELLER_1);
    assert.strictEqual(check.isAllowed, true);

    const pathCheck = extractAndValidateListingPath(ownUrl, SELLER_1);
    assert.strictEqual(pathCheck.isValidListingPath, true);
    assert.strictEqual(pathCheck.provider, 'supabase');
    assert.strictEqual(pathCheck.path, `listings/${SELLER_1}/prod_1793145500_abc12.jpg`);
    assert.strictEqual(pathCheck.storagePath, `${SELLER_1}/prod_1793145500_abc12.jpg`);
  });

  it('2. Another seller’s Supabase listing image URL is STRICTLY BLOCKED (ownership_mismatch)', () => {
    const victimUrl = `${SUPABASE_BASE}/listings/${SELLER_2}/private_item.jpg`;
    const check = validateListingImageUrl(victimUrl, SELLER_1);
    assert.strictEqual(check.isAllowed, false);
    assert.strictEqual(check.reason, 'ownership_mismatch');

    const pathCheck = extractAndValidateListingPath(victimUrl, SELLER_1);
    assert.strictEqual(pathCheck.isValidListingPath, false);
    assert.strictEqual(pathCheck.reason, 'ownership_mismatch');
  });

  it('3. Supabase clips bucket is BLOCKED from being used as listing image (not_a_listing_path)', () => {
    const clipUrl = `${SUPABASE_BASE}/clips/${SELLER_1}/video_clip.mp4`;
    const check = validateListingImageUrl(clipUrl, SELLER_1);
    assert.strictEqual(check.isAllowed, false);
    assert.strictEqual(check.reason, 'not_a_listing_path');

    const pathCheck = extractAndValidateListingPath(clipUrl, SELLER_1);
    assert.strictEqual(pathCheck.isValidListingPath, false);
    assert.strictEqual(pathCheck.reason, 'not_a_listing_path');
  });

  it('4. Spoofed Supabase project URL is REJECTED (unrecognized_storage_bucket)', () => {
    const spoofedUrl = 'https://malicious-project.supabase.co/storage/v1/object/public/listings/seller_supabase_101/photo.jpg';
    const check = validateListingImageUrl(spoofedUrl, SELLER_1);
    assert.strictEqual(check.isAllowed, false);
    assert.strictEqual(check.reason, 'unrecognized_storage_bucket');
  });

  it('5. Path traversal attempt in Supabase URL is BLOCKED', () => {
    // When URL normalizes SELLER_1/../SELLER_2, it attempts to access SELLER_2's image and is BLOCKED
    const traversalUrl = `${SUPABASE_BASE}/listings/${SELLER_1}/../${SELLER_2}/stolen.jpg`;
    const check1 = validateListingImageUrl(traversalUrl, SELLER_1);
    assert.strictEqual(check1.isAllowed, false);
    assert.strictEqual(check1.reason, 'ownership_mismatch');

    // When encoded traversal is attempted, it is caught as path_traversal_or_malformed
    const encodedTraversalUrl = `${SUPABASE_BASE}/listings/${SELLER_1}%2f..%2f${SELLER_2}/stolen.jpg`;
    const check2 = validateListingImageUrl(encodedTraversalUrl, SELLER_1);
    assert.strictEqual(check2.isAllowed, false);
    assert.strictEqual(check2.reason, 'path_traversal_or_malformed');
  });

  it('6. Unsplash and external CDN URLs remain ALLOWED alongside Supabase URLs', () => {
    const unsplash = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800';
    const check = validateListingImageUrl(unsplash, SELLER_1);
    assert.strictEqual(check.isAllowed, true);
    assert.strictEqual(check.reason, 'external_host');
  });

  it('7. deleteListingImagesFromStorage safely rejects other seller’s Supabase images', async () => {
    const foreignImage = `${SUPABASE_BASE}/listings/${SELLER_2}/prod_999.jpg`;
    const res = await deleteListingImagesFromStorage(foreignImage, SELLER_1);
    assert.strictEqual(res.total, 1);
    assert.strictEqual(res.deleted, 0);
    assert.strictEqual(res.skipped, 1);
    assert.strictEqual(res.failed, 0);
    assert.strictEqual(res.details[0].reason, 'ownership_mismatch');
  });
});
