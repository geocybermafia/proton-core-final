import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_ACTIVE_CATEGORY_IDS,
  PRODUCT_CATEGORY_IDS,
  PROJECT_CATEGORY_IDS,
  SERVICE_CATEGORY_IDS,
  canInferListingTypeFromCategory,
  classifyListing,
  inferListingType,
} from '../src/lib/listingClassification.js';
import {
  filterAttributesForSchema,
  getCategoryFormSchema,
  getFormattedListingAttributes,
  isDynamicFieldCore,
  isDynamicFieldVisible,
  sanitizeListingAttributes,
  validateSchemaAttributes,
} from '../src/components/market-hub/ListingSchemas.js';
import { getListingTitle } from '../src/components/market-hub/MarketConstants.js';

describe('Stage 2 Smart Listing Wizard — Classification & Auto ListingType', () => {
  it('deterministically infers listingType for all 25 active categories', () => {
    for (const cat of ALL_ACTIVE_CATEGORY_IDS) {
      assert.equal(canInferListingTypeFromCategory(cat), true, `Expected ${cat} to be inferable`);
    }
    for (const cat of PRODUCT_CATEGORY_IDS) {
      assert.equal(classifyListing({ category: cat, listingType: 'service' }), 'product');
      assert.equal(inferListingType(cat), 'product');
    }
    for (const cat of SERVICE_CATEGORY_IDS) {
      assert.equal(classifyListing({ category: cat, listingType: 'product' }), 'service');
      assert.equal(inferListingType(cat), 'service');
    }
    for (const cat of PROJECT_CATEGORY_IDS) {
      assert.equal(inferListingType(cat, 'product'), 'project');
      assert.equal(inferListingType(cat), 'project');
    }
    assert.equal(classifyListing({ category: 'project-jobs', listingType: 'product' }), 'job');
    assert.equal(classifyListing({ category: 'collaboration', listingType: 'product' }), 'collaboration');
    assert.equal(classifyListing({ category: 'youtube-channels', listingType: 'product' }), 'project_asset');
  });

  it('requires manual listingType fallback only for ambiguous or legacy categories', () => {
    for (const legacyCat of ['', 'other', 'crypto', 'hobby', 'home']) {
      assert.equal(canInferListingTypeFromCategory(legacyCat), false, `Expected ${legacyCat} to require fallback`);
    }
    assert.equal(inferListingType('crypto', 'service'), 'service');
    assert.equal(inferListingType('crypto', 'product'), 'product');
    assert.equal(inferListingType('realestate'), 'product');
    assert.equal(inferListingType('auto'), 'product');
  });
});

describe('Stage 2 Smart Listing Wizard — Core vs Additional & Conditional Fields', () => {
  it('keeps at most 3-4 core visible fields for complex schemas and moves optional specs to additional', () => {
    const phonesSchema = getCategoryFormSchema('product', 'phones');
    const coreKeys = phonesSchema.fields.filter(isDynamicFieldCore).map(f => f.key);
    assert.deepEqual(coreKeys, ['brand', 'model', 'storageGb']);

    // For phones with storageGb = accessory, ramGb/batteryHealth/simType must hide
    const accessoryAttrs = { brand: 'Apple', model: 'MagSafe Case', storageGb: 'accessory', ramGb: '8', batteryHealth: 99 };
    const visibleForAccessory = phonesSchema.fields.filter(f => isDynamicFieldVisible(f, accessoryAttrs)).map(f => f.key);
    assert.deepEqual(visibleForAccessory, ['brand', 'model', 'storageGb']);

    // For phones with storageGb = 256GB, additional specs become visible
    const phoneAttrs = { brand: 'Apple', model: 'iPhone 15 Pro', storageGb: '256GB' };
    const visibleForPhone = phonesSchema.fields.filter(f => isDynamicFieldVisible(f, phoneAttrs)).map(f => f.key);
    assert.equal(visibleForPhone.includes('ramGb'), true);
    assert.equal(visibleForPhone.includes('batteryHealth'), true);
    assert.equal(visibleForPhone.includes('simType'), true);

    // Validation & sanitization skip hidden accessory fields even if stale invalid values existed
    const invalidAccessory = { brand: 'Apple', model: 'Case', storageGb: 'accessory', batteryHealth: 999 };
    assert.equal(validateSchemaAttributes(phonesSchema, invalidAccessory, 'ka').valid, true);
    const sanitized = sanitizeListingAttributes('product', 'phones', invalidAccessory);
    assert.equal('batteryHealth' in sanitized, false);
  });

  it('controls YouTube monthlyRevenue conditionally on monetizationStatus === monetized', () => {
    const ytSchema = getCategoryFormSchema('project', 'youtube-channels');
    const revField = ytSchema.fields.find(f => f.key === 'monthlyRevenue');
    assert.ok(revField);

    assert.equal(isDynamicFieldVisible(revField, { monetizationStatus: 'not_monetized' }), false);
    assert.equal(isDynamicFieldVisible(revField, { monetizationStatus: 'eligible' }), false);
    assert.equal(isDynamicFieldVisible(revField, { monetizationStatus: 'monetized' }), true);

    // Hidden negative monthlyRevenue shouldn't fail validation or leak to Firestore
    const notMonetizedAttrs = {
      channelNiche: 'Tech',
      subscribersCount: 5000,
      monetizationStatus: 'not_monetized',
      monthlyRevenue: -50,
    };
    assert.equal(validateSchemaAttributes(ytSchema, notMonetizedAttrs, 'en').valid, true);
    const sanitized = sanitizeListingAttributes('project', 'youtube-channels', notMonetizedAttrs);
    assert.equal('monthlyRevenue' in sanitized, false);
  });

  it('controls Rent depositAmount conditionally and hydrates legacy depositAmount records cleanly', () => {
    const rentSchema = getCategoryFormSchema('service', 'rent');
    const depositAmountField = rentSchema.fields.find(f => f.key === 'depositAmount');
    assert.ok(depositAmountField);

    assert.equal(isDynamicFieldVisible(depositAmountField, { depositRequired: false }), false);
    assert.equal(isDynamicFieldVisible(depositAmountField, { depositRequired: true }), true);

    // Legacy listing hydration: had depositAmount > 0 without boolean depositRequired
    const hydrated = filterAttributesForSchema(rentSchema, {
      rentalCategory: 'equipment',
      rentalPeriod: 'daily',
      depositAmount: 250,
    });
    assert.equal(hydrated.depositRequired, true);
    assert.equal(hydrated.depositAmount, 250);
    assert.equal(isDynamicFieldVisible(depositAmountField, hydrated), true);
  });

  it('controls Digital Projects monthlyRevenue via isMonetized with legacy hydration and hides synthetic flag from card specs', () => {
    const dpSchema = getCategoryFormSchema('project', 'digital-projects');
    const revField = dpSchema.fields.find(f => f.key === 'monthlyRevenue');
    assert.ok(revField);

    assert.equal(isDynamicFieldVisible(revField, {}), false);
    assert.equal(isDynamicFieldVisible(revField, { isMonetized: true }), true);

    const hydrated = filterAttributesForSchema(dpSchema, {
      projectType: 'saas',
      assetsIncluded: 'Code + Domain',
      monthlyRevenue: 1500,
    });
    assert.equal(hydrated.isMonetized, true);
    assert.equal(hydrated.monthlyRevenue, 1500);

    const formatted = getFormattedListingAttributes({
      listingType: 'project',
      category: 'digital-projects',
      attributes: hydrated,
    }, 'en');
    assert.equal(formatted.some(item => item.key === 'isMonetized'), false);
    assert.equal(formatted.some(item => item.key === 'monthlyRevenue'), true);
  });

  it('hides Collaboration equityOrSharePercent for content_collab or unset partnershipModel', () => {
    const collabSchema = getCategoryFormSchema('project', 'collaboration');
    const equityField = collabSchema.fields.find(f => f.key === 'equityOrSharePercent');
    assert.ok(equityField);

    assert.equal(isDynamicFieldVisible(equityField, {}), false);
    assert.equal(isDynamicFieldVisible(equityField, { partnershipModel: 'content_collab' }), false);
    assert.equal(isDynamicFieldVisible(equityField, { partnershipModel: 'equity' }), true);
  });
});

describe('Stage 2 Smart Listing Wizard — Single-Language Titles & Location Modes', () => {
  it('resolves single-language titles gracefully without requiring dual title translation', () => {
    const kaOnlyListing = {
      title: 'მაკბუკი M3',
      titleGe: 'მაკბუკი M3',
      primaryLanguage: 'ka' as const,
    };
    assert.equal(getListingTitle(kaOnlyListing, 'ka'), 'მაკბუკი M3');
    assert.equal(getListingTitle(kaOnlyListing, 'en'), 'მაკბუკი M3');

    const enOnlyListing = {
      title: 'Sony Camera Kit',
      titleEn: 'Sony Camera Kit',
      primaryLanguage: 'en' as const,
    };
    assert.equal(getListingTitle(enOnlyListing, 'en'), 'Sony Camera Kit');
    assert.equal(getListingTitle(enOnlyListing, 'ka'), 'Sony Camera Kit');
  });

  it('assigns expected locationMode for physical, flexible, and remote schemas', () => {
    assert.equal(getCategoryFormSchema('product', 'phones').locationMode, 'physical');
    assert.equal(getCategoryFormSchema('service', 'rent').locationMode, 'physical');
    assert.equal(getCategoryFormSchema('service', 'service').locationMode, 'flexible');
    assert.equal(getCategoryFormSchema('project', 'project-jobs').locationMode, 'flexible');
    assert.equal(getCategoryFormSchema('project', 'collaboration').locationMode, 'flexible');
    assert.equal(getCategoryFormSchema('project', 'youtube-channels').locationMode, 'remote');
    assert.equal(getCategoryFormSchema('project', 'social-accounts').locationMode, 'remote');
    assert.equal(getCategoryFormSchema('project', 'audience-growth').locationMode, 'remote');
    assert.equal(getCategoryFormSchema('project', 'digital-projects').locationMode, 'remote');
  });
});
