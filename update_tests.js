const fs = require('fs');

let test1 = fs.readFileSync('tests/listing-category-separation.test.ts', 'utf8');
test1 = test1
  .replace('assert.equal(PRODUCT_CATEGORY_IDS.length, 17);', 'assert.equal(PRODUCT_CATEGORY_IDS.length, 19);')
  .replace('assert.equal(ALL_ACTIVE_CATEGORY_IDS.length, 25);', 'assert.equal(ALL_ACTIVE_CATEGORY_IDS.length, 27);')
  .replace('assert.equal(new Set(ALL_ACTIVE_CATEGORY_IDS).size, 25);', 'assert.equal(new Set(ALL_ACTIVE_CATEGORY_IDS).size, 27);')
  .replace('assert.equal(productGroups.length, 3);', 'assert.equal(productGroups.length, 4);')
  .replace('assert.equal(flatProductIds.length, 17);', 'assert.equal(flatProductIds.length, 19);')
  .replace("assert.equal(getCategoriesForListingType('product', undefined, lang).length, 17);", "assert.equal(getCategoriesForListingType('product', undefined, lang).length, 19);")
  .replace("assert.equal(getCategoriesForListingType('all', undefined, lang).length, 25);", "assert.equal(getCategoriesForListingType('all', undefined, lang).length, 27);")
  .replace(
    "for (const legacyCat of ['realestate', 'auto', 'crypto', 'hobby', 'home']) {",
    `  it('verifies realestate and auto infer product type directly', () => {
    for (const cat of ['realestate', 'auto']) {
      assert.equal(canInferListingTypeFromCategory(cat), true);
      assert.equal(inferListingType(cat), 'product');
      assert.equal(classifyListing({ category: cat }), 'product');
    }
  });

  for (const legacyCat of ['crypto', 'hobby', 'home']) {`
  );

fs.writeFileSync('tests/listing-category-separation.test.ts', test1, 'utf8');
console.log('listing-category-separation.test.ts updated');

let test2 = fs.readFileSync('tests/listing-wizard-stage2.test.ts', 'utf8');
test2 = test2.replace(
  "for (const legacyCat of ['', 'other', 'realestate', 'auto', 'crypto', 'hobby', 'home']) {",
  "for (const legacyCat of ['', 'other', 'crypto', 'hobby', 'home']) {"
);
fs.writeFileSync('tests/listing-wizard-stage2.test.ts', test2, 'utf8');
console.log('listing-wizard-stage2.test.ts updated');
