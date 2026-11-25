import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

describe('PROTON — Controlled Freshness Protection & Server-Side Listing Creation', () => {
  it('1. Normalizes titles correctly for freshness registry key', () => {
    const title1 = 'Handcrafted Emerald Velvet Kiss-Lock Handbag!!';
    const title2 = '  handcrafted  emerald  velvet   kisslock  handbag  ';
    const norm1 = title1.toLowerCase().replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ').trim();
    const norm2 = title2.toLowerCase().replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ').trim();
    assert.equal(norm1, 'handcrafted emerald velvet kisslock handbag');
    assert.equal(norm2, 'handcrafted emerald velvet kisslock handbag');
  });

  it('2. Computes deterministic registry hash for seller + category + normalized title', () => {
    const sellerId = 'seller_123';
    const category = 'fashion';
    const title = 'Leather Backpack';
    const norm = title.toLowerCase().replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ').trim();
    const key = crypto.createHash('sha256').update(`${sellerId}_${category}_${norm}`).digest('hex');
    
    const keyRepeat = crypto.createHash('sha256').update(`${sellerId}_${category}_${norm}`).digest('hex');
    assert.equal(key, keyRepeat);
    assert.equal(key.length, 64);
  });

  it('3. Simulates Controlled Freshness Registry transaction logic', async () => {
    const mockRegistry = new Map<string, { firstPublishedAt: number; originalListingId: string }>();
    const mockListings = new Map<string, any>();

    async function createListingSim(sellerId: string, category: string, title: string, nowMs: number) {
      const normalizedTitle = title.toLowerCase().replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ').trim();
      const registryKey = crypto.createHash('sha256').update(`${sellerId}_${category}_${normalizedTitle}`).digest('hex');
      const listingId = `list-${Math.random().toString(36).substring(2, 9)}`;

      let firstPublishedAt = nowMs;
      if (mockRegistry.has(registryKey)) {
        firstPublishedAt = mockRegistry.get(registryKey)!.firstPublishedAt;
      } else {
        mockRegistry.set(registryKey, {
          firstPublishedAt: nowMs,
          originalListingId: listingId,
        });
      }

      const listingData = {
        id: listingId,
        sellerId,
        category,
        title,
        createdAt: firstPublishedAt,
      };
      mockListings.set(listingId, listingData);
      return listingData;
    }

    const t1 = 1000000;
    const l1 = await createListingSim('seller_A', 'fashion', 'Silk Scarf', t1);
    assert.equal(l1.createdAt, t1);

    // Simulate deletion (registry remains, listing doc removed)
    mockListings.delete(l1.id);

    // Recreate same product 2 days later (t2 = t1 + 172800000)
    const t2 = t1 + 172800000;
    const l2 = await createListingSim('seller_A', 'fashion', 'Silk Scarf', t2);
    // Freshness timestamp must be preserved from original publication!
    assert.equal(l2.createdAt, t1);

    // Publish a different product
    const l3 = await createListingSim('seller_A', 'fashion', 'Cotton T-Shirt', t2);
    // Different product gets new timestamp
    assert.equal(l3.createdAt, t2);
  });
});
