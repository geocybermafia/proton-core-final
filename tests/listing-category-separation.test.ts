import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ALL_ACTIVE_CATEGORY_IDS,
  CATEGORY_IDS_BY_TYPE,
  COLLABORATION_CATEGORY_IDS,
  JOB_CATEGORY_IDS,
  PRODUCT_CATEGORY_IDS,
  PROJECT_ASSET_CATEGORY_IDS,
  PROJECT_CATEGORY_IDS,
  SERVICE_CATEGORY_IDS,
  canInferListingTypeFromCategory,
  classifyListing,
  inferListingType,
  isCategoryValidForType,
  isCollaborationListing,
  isJobListing,
  isNonPurchasableListing,
  isProductListing,
  isProjectAssetListing,
  isProjectListing,
  isRepeatableServiceListing,
  isServiceListing,
  isUniqueDigitalAssetListing,
} from '../src/lib/listingClassification.js';
import {
  getCategoriesForListingType,
  getGroupedCategoriesForListingType,
  getListingDirectionsMeta,
} from '../src/components/market-hub/MarketConstants.js';
import {
  getOrderCreationMode,
  validateListingForOrderCreation,
} from '../src/lib/marketOrderRules.js';

describe('Marketplace 3-Direction Category Separation & Strict Partitioning', () => {
  it('maintains exact category counts (17 Product, 3 Service, 5 Project = 25) with zero overlap', () => {
    assert.equal(PRODUCT_CATEGORY_IDS.length, 19);
    assert.equal(SERVICE_CATEGORY_IDS.length, 3);
    assert.equal(PROJECT_CATEGORY_IDS.length, 5);
    assert.equal(ALL_ACTIVE_CATEGORY_IDS.length, 27);

    const productSet = new Set<string>(PRODUCT_CATEGORY_IDS);
    const serviceSet = new Set<string>(SERVICE_CATEGORY_IDS);
    const projectSet = new Set<string>(PROJECT_CATEGORY_IDS);

    assert.equal(new Set(ALL_ACTIVE_CATEGORY_IDS).size, 27);

    for (const id of productSet) {
      assert.equal(serviceSet.has(id), false, `${id} leaked into service`);
      assert.equal(projectSet.has(id), false, `${id} leaked into project`);
    }
    for (const id of serviceSet) {
      assert.equal(projectSet.has(id), false, `${id} leaked into project`);
    }

    assert.deepEqual(CATEGORY_IDS_BY_TYPE.product, PRODUCT_CATEGORY_IDS);
    assert.deepEqual(CATEGORY_IDS_BY_TYPE.service, SERVICE_CATEGORY_IDS);
    assert.deepEqual(CATEGORY_IDS_BY_TYPE.project, PROJECT_CATEGORY_IDS);
  });

  it('keeps audience-growth strictly in Service (never Product or Project)', () => {
    assert.equal(SERVICE_CATEGORY_IDS.includes('audience-growth'), true);
    assert.equal((PROJECT_CATEGORY_IDS as readonly string[]).includes('audience-growth'), false);
    assert.equal((PRODUCT_CATEGORY_IDS as readonly string[]).includes('audience-growth'), false);

    // Even if legacy doc had listingType='project' or 'product', audience-growth must classify as service
    for (const legacyType of [undefined, null, 'product', 'service', 'project']) {
      const input = { category: 'audience-growth', listingType: legacyType };
      assert.equal(classifyListing(input), 'service');
      assert.equal(inferListingType('audience-growth', legacyType), 'service');
      assert.equal(isServiceListing(input), true);
      assert.equal(isRepeatableServiceListing(input), true);
      assert.equal(isProjectListing(input), false);
      assert.equal(isProductListing(input), false);
      assert.equal(getOrderCreationMode(input), 'service');
    }
  });

  it('separates Project into Digital Assets vs Jobs & Collaboration and preserves non-purchasable flow', () => {
    // Digital Assets (youtube-channels, social-accounts, digital-projects)
    assert.equal(PROJECT_ASSET_CATEGORY_IDS.length, 3);
    for (const cat of PROJECT_ASSET_CATEGORY_IDS) {
      const listing = { id: `l_${cat}`, sellerId: 'seller_1', price: 500, currency: 'USD', status: 'active', category: cat, listingType: 'project' };
      assert.equal(classifyListing(listing), 'project_asset');
      assert.equal(isProjectListing(listing), true);
      assert.equal(isProjectAssetListing(listing), true);
      assert.equal(isUniqueDigitalAssetListing(listing), true);
      assert.equal(isNonPurchasableListing(listing), false);
      assert.equal(getOrderCreationMode(listing), 'unique_digital_asset');

      const orderCheck = validateListingForOrderCreation(listing, 'buyer_1');
      assert.equal(orderCheck.ok, true);
      if (orderCheck.ok) {
        assert.equal(orderCheck.orderType, 'project');
        assert.equal(orderCheck.requiresAtomicListingLock, true);
      }
    }

    // Jobs & Collaboration (project-jobs, collaboration)
    assert.deepEqual([...JOB_CATEGORY_IDS], ['project-jobs']);
    assert.deepEqual([...COLLABORATION_CATEGORY_IDS], ['collaboration']);

    const jobListing = { id: 'l_job', sellerId: 'seller_1', price: 1200, currency: 'USD', status: 'active', category: 'project-jobs', listingType: 'project' };
    assert.equal(classifyListing(jobListing), 'job');
    assert.equal(isJobListing(jobListing), true);
    assert.equal(isProjectListing(jobListing), true);
    assert.equal(isNonPurchasableListing(jobListing), true);
    assert.equal(isUniqueDigitalAssetListing(jobListing), false);
    assert.equal(getOrderCreationMode(jobListing), 'non_purchasable');
    const jobOrderCheck = validateListingForOrderCreation(jobListing, 'buyer_1');
    assert.equal(jobOrderCheck.ok, false);
    if (!jobOrderCheck.ok) {
      assert.equal(jobOrderCheck.code, 'NON_PURCHASABLE_LISTING');
    }

    const collabListing = { id: 'l_collab', sellerId: 'seller_1', price: 0, currency: 'USD', status: 'active', category: 'collaboration', listingType: 'project' };
    assert.equal(classifyListing(collabListing), 'collaboration');
    assert.equal(isCollaborationListing(collabListing), true);
    assert.equal(isProjectListing(collabListing), true);
    assert.equal(isNonPurchasableListing(collabListing), true);
    assert.equal(isUniqueDigitalAssetListing(collabListing), false);
    assert.equal(getOrderCreationMode(collabListing), 'non_purchasable');
  });

  it('builds separated, strictly disjoint grouped categories and localized direction metadata', () => {
    for (const lang of ['en', 'ka'] as const) {
      const directions = getListingDirectionsMeta(lang);
      assert.deepEqual(directions.map(d => d.id), ['product', 'service', 'project']);
      for (const dir of directions) {
        assert.ok(dir.title.trim().length > 0);
        assert.ok(dir.description.trim().length > 0);
      }

      const productGroups = getGroupedCategoriesForListingType('product', undefined, lang);
      const serviceGroups = getGroupedCategoriesForListingType('service', undefined, lang);
      const projectGroups = getGroupedCategoriesForListingType('project', undefined, lang);

      assert.equal(productGroups.length, 4);
      assert.equal(serviceGroups.length, 1);
      assert.equal(projectGroups.length, 2);
      assert.deepEqual(projectGroups.map(g => g.groupId), ['digital_assets', 'jobs_collaboration']);

      const flatProductIds = productGroups.flatMap(g => g.categories.map(c => c.id));
      const flatServiceIds = serviceGroups.flatMap(g => g.categories.map(c => c.id));
      const flatProjectIds = projectGroups.flatMap(g => g.categories.map(c => c.id));

      assert.equal(flatProductIds.length, 19);
      assert.deepEqual(new Set(flatProductIds), new Set(PRODUCT_CATEGORY_IDS));
      assert.deepEqual(flatServiceIds, [...SERVICE_CATEGORY_IDS]);
      assert.deepEqual(flatProjectIds, [...PROJECT_ASSET_CATEGORY_IDS, ...JOB_CATEGORY_IDS, ...COLLABORATION_CATEGORY_IDS]);

      assert.equal(getCategoriesForListingType('product', undefined, lang).length, 19);
      assert.equal(getCategoriesForListingType('service', undefined, lang).length, 3);
      assert.equal(getCategoriesForListingType('project', undefined, lang).length, 5);
      assert.equal(getCategoriesForListingType('all', undefined, lang).length, 27);
    }
  });

  it('prevents cross-direction category leaks when switching directions', () => {
    assert.equal(isCategoryValidForType('phones', 'product'), true);
    assert.equal(isCategoryValidForType('phones', 'service'), false);
    assert.equal(isCategoryValidForType('phones', 'project'), false);

    assert.equal(isCategoryValidForType('audience-growth', 'service'), true);
    assert.equal(isCategoryValidForType('audience-growth', 'product'), false);
    assert.equal(isCategoryValidForType('audience-growth', 'project'), false);

    assert.equal(isCategoryValidForType('youtube-channels', 'project'), true);
    assert.equal(isCategoryValidForType('youtube-channels', 'product'), false);
    assert.equal(isCategoryValidForType('youtube-channels', 'service'), false);

    assert.equal(isCategoryValidForType('all', 'product'), true);
    assert.equal(isCategoryValidForType('all', 'service'), true);
    assert.equal(isCategoryValidForType('all', 'project'), true);
  });

  it('preserves full backward compatibility with legacy categories without migration', () => {
    // Legacy digital category & listingType classify as unique digital asset ('project_asset')
    assert.equal(classifyListing({ category: 'digital' }), 'project_asset');
    assert.equal(classifyListing({ category: 'other', listingType: 'digital' }), 'project_asset');
    assert.equal(inferListingType('digital'), 'project');
    assert.equal(isUniqueDigitalAssetListing({ category: 'digital' }), true);
    assert.equal(getOrderCreationMode({ category: 'digital' }), 'unique_digital_asset');

    // Legacy generic 'project' category
    assert.equal(canInferListingTypeFromCategory('project'), true);
    assert.equal(classifyListing({ category: 'project' }), 'project');
    assert.equal(inferListingType('project'), 'project');

    // Legacy categories that require explicit listingType fallback if provided
      it('verifies realestate and auto infer product type directly', () => {
    for (const cat of ['realestate', 'auto']) {
      assert.equal(canInferListingTypeFromCategory(cat), true);
      assert.equal(inferListingType(cat), 'product');
      assert.equal(classifyListing({ category: cat }), 'product');
    }
  });

  for (const legacyCat of ['crypto', 'hobby', 'home']) {
      assert.equal(canInferListingTypeFromCategory(legacyCat), false);
      assert.equal(inferListingType(legacyCat, 'product'), 'product');
      assert.equal(inferListingType(legacyCat, 'service'), 'service');
      assert.equal(inferListingType(legacyCat, 'project'), 'project');
      assert.equal(classifyListing({ category: legacyCat }), 'product');
    }
  });

  it('verifies Stage 3 structural safeguards in MarketHub and CreateListingWizard', () => {
    const marketHubSrc = fs.readFileSync(path.resolve('src/components/MarketHub.tsx'), 'utf8');
    const wizardSrc = fs.readFileSync(path.resolve('src/components/market-hub/CreateListingWizard.tsx'), 'utf8');

    // Firestore-backed fail-closed orphan photo verification before Storage delete
    assert.match(marketHubSrc, /fetchSellerProtectedPhotoUrls/);
    assert.match(marketHubSrc, /if \(!protectedUrls\)/);
    // Upload session epoch + UID-switch wizard reset
    assert.match(marketHubSrc, /uploadSessionEpochRef/);
    assert.match(marketHubSrc, /prevAuthUidForWizardRef/);
    // CreateListingWizard upfront 3-direction selection + separated category section + UID reset
    assert.match(wizardSrc, /data-testid="direction-selector-section"/);
    assert.match(wizardSrc, /direction-card-/);
    assert.match(wizardSrc, /data-testid="separated-category-section"/);
    assert.match(wizardSrc, /prevEffectiveUserIdRef/);
  });
});
