import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  OPTIONAL_PRICE_CATEGORIES,
  getListingPriceDisplayMode,
  getListingPriceValidationMessage,
  isZeroOrEmptyPriceAllowed,
  validateAndNormalizeListingPrice,
} from '../src/lib/listingPricing.js';
import { validateListingForOrderCreation } from '../src/lib/marketOrderRules.js';

describe('PROTON Market Hub — TASK-03 Listing Pricing Rules', () => {
  it('identifies categories and negotiability rules that allow 0 or empty price', () => {
    assert.ok(OPTIONAL_PRICE_CATEGORIES.has('project-jobs'));
    assert.ok(OPTIONAL_PRICE_CATEGORIES.has('collaboration'));

    assert.equal(isZeroOrEmptyPriceAllowed({ category: 'project-jobs', isNegotiable: false }), true);
    assert.equal(isZeroOrEmptyPriceAllowed({ category: 'collaboration', isNegotiable: false }), true);
    assert.equal(isZeroOrEmptyPriceAllowed({ category: 'technics', isNegotiable: true }), true);
    assert.equal(isZeroOrEmptyPriceAllowed({ category: 'service', isNegotiable: true }), true);

    assert.equal(isZeroOrEmptyPriceAllowed({ category: 'technics', isNegotiable: false }), false);
    assert.equal(isZeroOrEmptyPriceAllowed({ category: 'phones', isNegotiable: false }), false);
    assert.equal(isZeroOrEmptyPriceAllowed({ category: 'service', isNegotiable: false }), false);
    assert.equal(isZeroOrEmptyPriceAllowed({ category: 'digital-projects', isNegotiable: false }), false);
  });

  it('Scenarios 1-4: allows 0 and empty price on project-jobs and collaboration', () => {
    for (const cat of ['project-jobs', 'collaboration']) {
      // Explicit zero
      const zeroNum = validateAndNormalizeListingPrice({ rawPrice: 0, category: cat, isNegotiable: false });
      assert.deepEqual(zeroNum, { valid: true, price: 0, priceUnspecified: false });

      const zeroStr = validateAndNormalizeListingPrice({ rawPrice: '0', category: cat, isNegotiable: false });
      assert.deepEqual(zeroStr, { valid: true, price: 0, priceUnspecified: false });

      // Empty price
      for (const emptyVal of ['', '   ', null, undefined]) {
        const emptyRes = validateAndNormalizeListingPrice({ rawPrice: emptyVal, category: cat, isNegotiable: false });
        assert.deepEqual(emptyRes, { valid: true, price: 0, priceUnspecified: true });
      }
    }
  });

  it('Scenarios 5-6: allows 0 and empty price when isNegotiable is true in any category', () => {
    const zeroNeg = validateAndNormalizeListingPrice({ rawPrice: 0, category: 'technics', isNegotiable: true });
    assert.deepEqual(zeroNeg, { valid: true, price: 0, priceUnspecified: false });

    const emptyNeg = validateAndNormalizeListingPrice({ rawPrice: '', category: 'vehicles', isNegotiable: true });
    assert.deepEqual(emptyNeg, { valid: true, price: 0, priceUnspecified: true });

    const nullNeg = validateAndNormalizeListingPrice({ rawPrice: null, category: 'service', isNegotiable: true });
    assert.deepEqual(nullNeg, { valid: true, price: 0, priceUnspecified: true });
  });

  it('Scenario 7: accepts positive numbers and comma decimals in all categories', () => {
    assert.deepEqual(
      validateAndNormalizeListingPrice({ rawPrice: '19,50', category: 'technics', isNegotiable: false }),
      { valid: true, price: 19.5, priceUnspecified: false }
    );
    assert.deepEqual(
      validateAndNormalizeListingPrice({ rawPrice: 2500, category: 'project-jobs', isNegotiable: false }),
      { valid: true, price: 2500, priceUnspecified: false }
    );
  });

  it('Scenario 8: rejects 0 and empty price on standard fixed-price listings', () => {
    for (const cat of ['technics', 'phones', 'service', 'rent', 'digital-projects']) {
      const zeroRes = validateAndNormalizeListingPrice({ rawPrice: 0, category: cat, isNegotiable: false });
      assert.deepEqual(zeroRes, { valid: false, reason: 'must_be_positive' });

      const emptyRes = validateAndNormalizeListingPrice({ rawPrice: '', category: cat, isNegotiable: false });
      assert.deepEqual(emptyRes, { valid: false, reason: 'required' });
    }
  });

  it('Scenarios 9-10: strictly rejects negative numbers and malformed strings in ALL categories', () => {
    const badInputs: Array<{ rawPrice: unknown; expectedReason: 'negative' | 'invalid_format' }> = [
      { rawPrice: -1, expectedReason: 'negative' },
      { rawPrice: '-10.5', expectedReason: 'negative' },
      { rawPrice: 'abc', expectedReason: 'invalid_format' },
      { rawPrice: '12abc', expectedReason: 'invalid_format' },
      { rawPrice: '$50', expectedReason: 'invalid_format' },
      { rawPrice: NaN, expectedReason: 'invalid_format' },
      { rawPrice: Infinity, expectedReason: 'invalid_format' },
      { rawPrice: true, expectedReason: 'invalid_format' },
      { rawPrice: { amount: 10 }, expectedReason: 'invalid_format' },
    ];

    for (const { rawPrice, expectedReason } of badInputs) {
      for (const combo of [
        { category: 'technics', isNegotiable: false },
        { category: 'technics', isNegotiable: true },
        { category: 'project-jobs', isNegotiable: false },
        { category: 'collaboration', isNegotiable: false },
      ]) {
        const res = validateAndNormalizeListingPrice({ rawPrice, ...combo });
        assert.equal(res.valid, false);
        if (!res.valid) {
          assert.equal(res.reason, expectedReason);
          assert.ok(getListingPriceValidationMessage(res.reason, 'ka').length > 5);
          assert.ok(getListingPriceValidationMessage(res.reason, 'en').length > 5);
        }
      }
    }
  });

  it('resolves display modes cleanly without showing 0 GEL / 0 USD for free, negotiable, or unspecified listings', () => {
    assert.equal(getListingPriceDisplayMode({ price: 150, priceUnspecified: false, isNegotiable: false }), 'amount');
    assert.equal(getListingPriceDisplayMode({ price: 150, priceUnspecified: false, isNegotiable: true }), 'amount');
    assert.equal(getListingPriceDisplayMode({ price: 0, priceUnspecified: false, isNegotiable: false }), 'free');
    assert.equal(getListingPriceDisplayMode({ price: 0, priceUnspecified: true, isNegotiable: false }), 'unspecified');
    assert.equal(getListingPriceDisplayMode({ price: 0, priceUnspecified: false, isNegotiable: true }), 'negotiable');
    assert.equal(getListingPriceDisplayMode({ price: 0, priceUnspecified: true, isNegotiable: true }), 'negotiable');
  });

  it('blocks direct purchase / order creation when price is 0 or category is project-jobs/collaboration', () => {
    const freeNegotiableProductOrder = validateListingForOrderCreation(
      { id: 'l1', sellerId: 'seller1', price: 0, category: 'technics', listingType: 'product', status: 'active' },
      'buyer1'
    );
    assert.equal(freeNegotiableProductOrder.ok, false);
    if (!freeNegotiableProductOrder.ok) {
      assert.equal(freeNegotiableProductOrder.code, 'INVALID_PRICE');
    }

    const jobOrder = validateListingForOrderCreation(
      { id: 'l2', sellerId: 'seller1', price: 1000, category: 'project-jobs', listingType: 'project', status: 'active' },
      'buyer1'
    );
    assert.equal(jobOrder.ok, false);
    if (!jobOrder.ok) {
      assert.equal(jobOrder.code, 'NON_PURCHASABLE_LISTING');
    }
  });
});
