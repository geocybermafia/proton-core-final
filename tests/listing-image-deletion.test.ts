import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeStorageUrlForLogging,
  extractAndValidateListingPath,
  deleteListingImagesFromStorage,
} from '../src/lib/storageUtils.js';

describe('Market Hub - Listing Image Deletion Helper (Phase 2A)', () => {
  const TEST_USER = 'seller_user_123';
  const OTHER_USER = 'other_user_456';
  const BUCKETS = ['proton-core-ai.firebasestorage.app', 'proton-core-ai.appspot.com'];

  // --------------------------------------------------------------------------
  // TEST SUITE 1: URL Token Sanitization & Privacy
  // --------------------------------------------------------------------------
  describe('sanitizeStorageUrlForLogging', () => {
    it('strips query parameters including auth tokens from Firebase Storage URLs', () => {
      const sensitiveUrl = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fseller_user_123%2Fitem.png?alt=media&token=secret-uuid-token-12345';
      const sanitized = sanitizeStorageUrlForLogging(sensitiveUrl);
      assert.strictEqual(sanitized, 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fseller_user_123%2Fitem.png');
      assert.strictEqual(sanitized.includes('token='), false);
      assert.strictEqual(sanitized.includes('secret-uuid'), false);
    });

    it('strips query parameters from relative paths', () => {
      const relPath = 'listings/seller_user_123/prod_1.png?v=2&auth=token123';
      const sanitized = sanitizeStorageUrlForLogging(relPath);
      assert.strictEqual(sanitized, 'listings/seller_user_123/prod_1.png');
    });

    it('handles empty or malformed inputs gracefully without throwing', () => {
      assert.strictEqual(sanitizeStorageUrlForLogging(''), '');
      assert.strictEqual(sanitizeStorageUrlForLogging(null as any), '');
      assert.strictEqual(sanitizeStorageUrlForLogging(undefined as any), '');
    });
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 2: Storage Path Extraction & Ownership Validation
  // --------------------------------------------------------------------------
  describe('extractAndValidateListingPath', () => {
    it('validates and decodes legitimate Firebase Storage URL belonging to current user', () => {
      const url = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fseller_user_123%2Fprod_999.png?alt=media&token=tok';
      const res = extractAndValidateListingPath(url, TEST_USER, BUCKETS);
      assert.strictEqual(res.isValidListingPath, true);
      assert.strictEqual(res.path, 'listings/seller_user_123/prod_999.png');
    });

    it('validates legitimate GCS URL belonging to current user', () => {
      const url = 'https://storage.googleapis.com/proton-core-ai.firebasestorage.app/listings/seller_user_123/photo.jpg';
      const res = extractAndValidateListingPath(url, TEST_USER, BUCKETS);
      assert.strictEqual(res.isValidListingPath, true);
      assert.strictEqual(res.path, 'listings/seller_user_123/photo.jpg');
    });

    it('validates legitimate raw relative path', () => {
      const raw = 'listings/seller_user_123/prod_123.png';
      const res = extractAndValidateListingPath(raw, TEST_USER, BUCKETS);
      assert.strictEqual(res.isValidListingPath, true);
      assert.strictEqual(res.path, 'listings/seller_user_123/prod_123.png');
    });

    it('validates legitimate gs:// URI', () => {
      const gs = 'gs://proton-core-ai.firebasestorage.app/listings/seller_user_123/prod_123.png';
      const res = extractAndValidateListingPath(gs, TEST_USER, BUCKETS);
      assert.strictEqual(res.isValidListingPath, true);
      assert.strictEqual(res.path, 'listings/seller_user_123/prod_123.png');
    });

    it('REJECTS ownership mismatch (another seller’s listing image)', () => {
      const url = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/listings%2Fother_user_456%2Fprod_999.png?alt=media';
      const res = extractAndValidateListingPath(url, TEST_USER, BUCKETS);
      assert.strictEqual(res.isValidListingPath, false);
      assert.strictEqual(res.reason, 'ownership_mismatch');
    });

    it('REJECTS directory traversal attacks', () => {
      const traversal = 'listings/seller_user_123/../other_user_456/private.png';
      const res = extractAndValidateListingPath(traversal, TEST_USER, BUCKETS);
      assert.strictEqual(res.isValidListingPath, false);
      assert.strictEqual(res.reason, 'path_traversal_or_malformed');
    });

    it('REJECTS paths from other application folders (avatars, clips)', () => {
      const avatarUrl = 'https://firebasestorage.googleapis.com/v0/b/proton-core-ai.firebasestorage.app/o/avatars%2Fseller_user_123%2Favatar.png';
      const res = extractAndValidateListingPath(avatarUrl, TEST_USER, BUCKETS);
      assert.strictEqual(res.isValidListingPath, false);
      assert.strictEqual(res.reason, 'not_a_listing_path');
    });

    it('SKIPS external CDN and Unsplash URLs safely without throwing', () => {
      const unsplash = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80';
      const res = extractAndValidateListingPath(unsplash, TEST_USER, BUCKETS);
      assert.strictEqual(res.isValidListingPath, false);
      assert.strictEqual(res.reason, 'external_host');
    });

    it('REJECTS unrecognized storage bucket (spoofed external bucket)', () => {
      const spoofed = 'https://firebasestorage.googleapis.com/v0/b/malicious-attacker-bucket.appspot.com/o/listings%2Fseller_user_123%2Fitem.png';
      const res = extractAndValidateListingPath(spoofed, TEST_USER, BUCKETS);
      assert.strictEqual(res.isValidListingPath, false);
      assert.strictEqual(res.reason, 'unrecognized_storage_bucket');
    });

    it('SKIPS data URIs safely', () => {
      const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY44YAAAAASUVORK5CYII=';
      const res = extractAndValidateListingPath(dataUri, TEST_USER, BUCKETS);
      assert.strictEqual(res.isValidListingPath, false);
      assert.strictEqual(res.reason, 'data_uri_skipped');
    });
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 3: Input Deduplication & Authentication Guard
  // --------------------------------------------------------------------------
  describe('deleteListingImagesFromStorage - Input Handling & Safety Guards', () => {
    it('returns clean zero result when given null, empty or undefined input', async () => {
      const res1 = await deleteListingImagesFromStorage(null, TEST_USER);
      assert.strictEqual(res1.total, 0);
      assert.strictEqual(res1.deleted, 0);
      assert.strictEqual(res1.skipped, 0);
      assert.strictEqual(res1.failed, 0);
      assert.deepStrictEqual(res1.details, []);

      const res2 = await deleteListingImagesFromStorage([], TEST_USER);
      assert.strictEqual(res2.total, 0);
    });

    it('aborts safely with skipped status when currentUserId is missing or empty', async () => {
      const images = ['https://images.unsplash.com/photo-1', 'listings/user/item.png'];
      const res = await deleteListingImagesFromStorage(images, '');
      assert.strictEqual(res.total, 2);
      assert.strictEqual(res.deleted, 0);
      assert.strictEqual(res.skipped, 2);
      assert.strictEqual(res.failed, 0);
      assert.strictEqual(res.details[0].reason, 'unauthenticated_or_invalid_user_id');
    });

    it('safely skips external URLs without attempting network calls or errors', async () => {
      const mixed = [
        'https://images.unsplash.com/photo-1?q=80',
        'https://images.unsplash.com/photo-1?q=80', // duplicate
        'https://api.dicebear.com/7.x/identicon/svg?seed=listing',
      ];
      const res = await deleteListingImagesFromStorage(mixed, TEST_USER);
      assert.strictEqual(res.total, 2); // deduplicated from 3 to 2
      assert.strictEqual(res.deleted, 0);
      assert.strictEqual(res.skipped, 2);
      assert.strictEqual(res.failed, 0);
      assert.strictEqual(res.details[0].reason, 'external_host');
      assert.strictEqual(res.details[1].reason, 'external_host');
    });

    it('accepts listing object with image and images properties and deduplicates', async () => {
      const listingObj = {
        image: 'https://images.unsplash.com/photo-main',
        images: [
          'https://images.unsplash.com/photo-main', // duplicate of main image
          'https://images.unsplash.com/photo-gallery-1',
          null as any,
          '',
        ],
      };
      const res = await deleteListingImagesFromStorage(listingObj, TEST_USER);
      assert.strictEqual(res.total, 2);
      assert.strictEqual(res.skipped, 2);
    });
  });
});
