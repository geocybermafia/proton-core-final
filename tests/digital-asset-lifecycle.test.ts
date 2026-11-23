import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateListingForOrderCreation,
  buildVerifiedOrderPayload,
  shouldUnlockListingOnOrderCancel,
  shouldFinalizeListingSoldOnOrderComplete,
  buildListingSoldFinalizationUpdate,
  isCompletableDigitalAssetOrderStatus,
  isValidOrderStatusTransition,
  placeVerifiedOrderInTransaction,
  completeDigitalAssetOrderInTransaction,
  MarketOrderRuleError,
  shouldGenerateOrganizerFulfillmentTask,
  isProjectAssetLinkedTask,
  resolveOrganizerOrderToggleAction
} from '../src/lib/marketOrderRules';
import {
  isListingReserved,
  isListingSold,
  isListingUnavailableForPurchase,
  isPhysicalOrder,
  isProjectAssetOrder,
  isServiceOrder,
  isSellerActionRequired,
  canCancelOrder
} from '../src/lib/listingClassification';
import { processOrderUpdatedRestoration } from '../functions/src/index';

const DELETE_SENTINEL = Symbol('FieldValue.delete');

class InMemoryListingStore {
  public docs = new Map<string, Record<string, any>>();

  seed(path: string, data: Record<string, any>) {
    this.docs.set(path, { ...data });
  }

  get(path: string): Record<string, any> | undefined {
    const d = this.docs.get(path);
    return d ? { ...d } : undefined;
  }

  collection(name: string) {
    return {
      doc: (id: string) => ({
        path: `${name}/${id}`,
        id,
        get: async () => ({
          exists: this.docs.has(`${name}/${id}`),
          id,
          data: () => {
            const d = this.docs.get(`${name}/${id}`);
            return d ? { ...d } : undefined;
          }
        })
      })
    };
  }

  async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const stagedWrites = new Map<string, Record<string, any>>();
    const tx = {
      get: async (docRef: { path: string; id: string }) => {
        const d = this.docs.get(docRef.path);
        return {
          exists: d !== undefined,
          id: docRef.id,
          data: () => (d ? { ...d } : undefined)
        };
      },
      set: (docRef: { path: string }, data: Record<string, any>) => {
        stagedWrites.set(docRef.path, { ...data });
      },
      update: (docRef: { path: string }, patch: Record<string, any>) => {
        const current = stagedWrites.get(docRef.path) ?? this.docs.get(docRef.path);
        if (!current) {
          throw new Error(`Missing document at ${docRef.path}`);
        }
        const next = { ...current };
        for (const [k, v] of Object.entries(patch)) {
          if (v === DELETE_SENTINEL) {
            delete next[k];
          } else {
            next[k] = v;
          }
        }
        stagedWrites.set(docRef.path, next);
      }
    };

    // Throws abort before staging applies -> atomic rollback
    const result = await fn(tx);
    for (const [path, value] of stagedWrites.entries()) {
      this.docs.set(path, value);
    }
    return result;
  }
}

function getAffectedKeys(existing: Record<string, any>, patch: Record<string, any>): string[] {
  const keys = new Set<string>();
  for (const [k, v] of Object.entries(patch)) {
    if (v === DELETE_SENTINEL) {
      if (k in existing) keys.add(k);
    } else if (existing[k] !== v) {
      keys.add(k);
    }
  }
  return Array.from(keys).sort();
}

describe('P0 Digital Asset Lifecycle Integrity', () => {
  const shippingFixture = {
    recipientName: 'Nika Beridze',
    phone: '+995 599 112 233',
    city: 'Tbilisi',
    address: 'Rustaveli Ave 12',
    notes: 'Call on arrival'
  };

  it('1. Direct purchase of unique digital asset creates pending project order, omits shipping, and reserves listing', () => {
    for (const category of ['youtube-channels', 'social-accounts', 'digital-projects']) {
      const listing = {
        id: `lst-${category}`,
        sellerId: 'seller_1',
        price: 450,
        currency: 'USD',
        status: 'active',
        listingType: 'project',
        category
      };

      const validation = validateListingForOrderCreation(listing, 'buyer_1');
      assert.equal(validation.ok, true);
      if (!validation.ok) return;

      assert.equal(validation.mode, 'unique_digital_asset');
      assert.equal(validation.orderType, 'project');
      assert.equal(validation.initialOrderStatus, 'pending');
      assert.equal(validation.requiresShipping, false);
      assert.equal(validation.requiresAtomicListingLock, true);

      const orderId = `ord_${category}_1`;
      const orderPayload = buildVerifiedOrderPayload({
        listingId: listing.id,
        freshListing: listing,
        buyerId: 'buyer_1',
        itemTitle: 'Verified Channel',
        validation,
        buyerInstructions: 'Transfer to buyer@example.com',
        shippingDetails: shippingFixture,
        createdAt: 1700000000000
      });

      assert.equal(orderPayload.orderType, 'project');
      assert.equal(orderPayload.status, 'pending');
      assert.equal('shippingDetails' in orderPayload, false);
      assert.equal(orderPayload.buyerInstructions, 'Transfer to buyer@example.com');

      const lockUpdate = validation.buildListingLockUpdate(orderId);
      assert.deepEqual(lockUpdate, {
        status: 'reserved',
        activeOrderId: orderId
      });
    }
  });

  it('1b. Legacy digital listingType/category also enters unique_digital_asset lifecycle', () => {
    const legacyDigital = {
      id: 'lst-legacy-digital',
      sellerId: 'seller_1',
      price: 120,
      currency: 'USD',
      status: 'active',
      listingType: 'digital',
      category: 'digital'
    };
    const res = validateListingForOrderCreation(legacyDigital, 'buyer_1');
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.orderType, 'project');
    assert.equal(res.initialOrderStatus, 'pending');
    assert.deepEqual(res.buildListingLockUpdate('ord_legacy'), {
      status: 'reserved',
      activeOrderId: 'ord_legacy'
    });
  });

  it('2 & 3. Cart checkout handles digital asset, physical product, and repeatable service consistently', () => {
    const digitalItem = {
      id: 'lst-yt-cart',
      sellerId: 'seller_1',
      price: 800,
      currency: 'USD',
      status: 'active',
      listingType: 'project',
      category: 'youtube-channels'
    };
    const physicalItem = {
      id: 'lst-phone-cart',
      sellerId: 'seller_2',
      price: 500,
      currency: 'USD',
      status: 'active',
      listingType: 'product',
      category: 'phones'
    };
    const serviceItem = {
      id: 'lst-growth-cart',
      sellerId: 'seller_3',
      price: 150,
      currency: 'USD',
      status: 'active',
      listingType: 'project',
      category: 'audience-growth'
    };

    const vDigital = validateListingForOrderCreation(digitalItem, 'buyer_1');
    const vPhysical = validateListingForOrderCreation(physicalItem, 'buyer_1');
    const vService = validateListingForOrderCreation(serviceItem, 'buyer_1');

    assert.equal(vDigital.ok && vPhysical.ok && vService.ok, true);
    if (!vDigital.ok || !vPhysical.ok || !vService.ok) return;

    const pDigital = buildVerifiedOrderPayload({
      listingId: digitalItem.id,
      freshListing: digitalItem,
      buyerId: 'buyer_1',
      itemTitle: 'YT Channel',
      validation: vDigital,
      shippingDetails: shippingFixture,
      createdAt: 1
    });
    const pPhysical = buildVerifiedOrderPayload({
      listingId: physicalItem.id,
      freshListing: physicalItem,
      buyerId: 'buyer_1',
      itemTitle: 'Phone',
      validation: vPhysical,
      shippingDetails: shippingFixture,
      createdAt: 1
    });
    const pService = buildVerifiedOrderPayload({
      listingId: serviceItem.id,
      freshListing: serviceItem,
      buyerId: 'buyer_1',
      itemTitle: 'Audience Growth',
      validation: vService,
      buyerInstructions: 'Grow channel X',
      shippingDetails: shippingFixture,
      createdAt: 1
    });

    assert.equal(pDigital.orderType, 'project');
    assert.equal(pDigital.status, 'pending');
    assert.equal('shippingDetails' in pDigital, false);
    assert.equal(vDigital.buildListingLockUpdate('ord_d')?.status, 'reserved');

    assert.equal(pPhysical.orderType, 'product');
    assert.equal(pPhysical.status, 'pending');
    assert.ok(pPhysical.shippingDetails);
    assert.equal(vPhysical.buildListingLockUpdate('ord_p')?.status, 'sold');
    assert.equal(vPhysical.buildListingLockUpdate('ord_p')?.isSold, true);

    assert.equal(pService.orderType, 'service');
    assert.equal(pService.status, 'booked');
    assert.equal('shippingDetails' in pService, false);
    assert.equal(vService.requiresAtomicListingLock, false);
    assert.equal(vService.buildListingLockUpdate('ord_s'), null);
  });

  it('4. Listing lock update for listings without `isSold` only touches status and activeOrderId (matches firestore.rules)', () => {
    const newDocWithoutIsSold = {
      id: 'lst-no-issold',
      sellerId: 'seller_1',
      price: 300,
      currency: 'USD',
      status: 'active',
      listingType: 'project',
      category: 'social-accounts'
    };

    const validation = validateListingForOrderCreation(newDocWithoutIsSold, 'buyer_1');
    assert.equal(validation.ok, true);
    if (!validation.ok) return;

    const lockPatch = validation.buildListingLockUpdate('order_101')!;
    const affectedKeys = getAffectedKeys(newDocWithoutIsSold, lockPatch);
    assert.deepEqual(affectedKeys, ['activeOrderId', 'status']);
    assert.equal('isSold' in lockPatch, false);

    // After cancel restoration (`isSold: false`), re-reserving must ALSO only touch ['activeOrderId', 'status']
    const reactivatedDoc = {
      ...newDocWithoutIsSold,
      status: 'active',
      isSold: false
    };
    const affectedAfterReactivate = getAffectedKeys(reactivatedDoc, lockPatch);
    assert.deepEqual(affectedAfterReactivate, ['activeOrderId', 'status']);
  });

  it('5 & 6. Prevents buying already reserved or already sold digital assets', () => {
    const reservedAsset = {
      id: 'lst-res',
      sellerId: 'seller_1',
      price: 200,
      currency: 'USD',
      status: 'reserved',
      activeOrderId: 'order_existing',
      listingType: 'project',
      category: 'digital-projects'
    };
    const r1 = validateListingForOrderCreation(reservedAsset, 'buyer_2');
    assert.equal(r1.ok, false);
    if (!r1.ok) assert.equal(r1.code, 'ALREADY_RESERVED');

    const soldAsset = {
      ...reservedAsset,
      status: 'sold',
      isSold: true
    };
    const r2 = validateListingForOrderCreation(soldAsset, 'buyer_2');
    assert.equal(r2.ok, false);
    if (!r2.ok) assert.equal(r2.code, 'ALREADY_SOLD');
  });

  it('7 & 8. Rejects self-purchase and non-purchasable listings (project-jobs, collaboration)', () => {
    const ownAsset = {
      id: 'lst-own',
      sellerId: 'seller_1',
      price: 500,
      currency: 'USD',
      status: 'active',
      listingType: 'project',
      category: 'youtube-channels'
    };
    const rSelf = validateListingForOrderCreation(ownAsset, 'seller_1');
    assert.equal(rSelf.ok, false);
    if (!rSelf.ok) assert.equal(rSelf.code, 'SELF_PURCHASE');

    for (const category of ['project-jobs', 'collaboration']) {
      const nonPurchasable = {
        id: `lst-${category}`,
        sellerId: 'seller_1',
        price: 100,
        currency: 'USD',
        status: 'active',
        listingType: 'project',
        category
      };
      const rNon = validateListingForOrderCreation(nonPurchasable, 'buyer_1');
      assert.equal(rNon.ok, false);
      if (!rNon.ok) assert.equal(rNon.code, 'NON_PURCHASABLE_LISTING');
    }
  });

  it('9. Order role predicates separate project assets from services and finalize reserved -> sold on seller completion', () => {
    const projectOrder = {
      id: 'ord_proj_1',
      orderType: 'project',
      status: 'pending',
      listingId: 'lst_proj_1',
      sellerId: 'seller_1',
      buyerId: 'buyer_1'
    };
    const serviceOrder = {
      id: 'ord_srv_1',
      orderType: 'service',
      status: 'booked',
      listingId: 'lst_srv_1',
      sellerId: 'seller_1',
      buyerId: 'buyer_1'
    };
    const physicalOrder = {
      id: 'ord_phys_1',
      orderType: 'product',
      status: 'pending',
      listingId: 'lst_phys_1',
      sellerId: 'seller_1',
      buyerId: 'buyer_1',
      shippingDetails: shippingFixture
    };

    assert.equal(isProjectAssetOrder(projectOrder), true);
    assert.equal(isServiceOrder(projectOrder), false);
    assert.equal(isPhysicalOrder(projectOrder), false);
    assert.equal(isSellerActionRequired(projectOrder), true);
    assert.equal(canCancelOrder(projectOrder), true);

    assert.equal(isServiceOrder(serviceOrder), true);
    assert.equal(isProjectAssetOrder(serviceOrder), false);
    assert.equal(isPhysicalOrder(physicalOrder), true);

    const reservedListing = {
      id: 'lst_proj_1',
      sellerId: 'seller_1',
      status: 'reserved',
      activeOrderId: 'ord_proj_1'
    };

    assert.equal(shouldFinalizeListingSoldOnOrderComplete(reservedListing, 'ord_proj_1', 'seller_1'), true);
    assert.equal(shouldFinalizeListingSoldOnOrderComplete(reservedListing, 'ord_proj_1', 'other_user'), false);
    assert.equal(shouldFinalizeListingSoldOnOrderComplete(reservedListing, 'ord_other', 'seller_1'), false);

    const soldUpdate = buildListingSoldFinalizationUpdate('ord_proj_1');
    assert.deepEqual(soldUpdate, {
      status: 'sold',
      isSold: true,
      activeOrderId: 'ord_proj_1'
    });
    assert.deepEqual(getAffectedKeys(reservedListing, soldUpdate), ['isSold', 'status']);
  });

  it('10 & 11. Cancellation of pending project order restores reserved -> active, and NEVER restores a sold digital asset', async () => {
    const reservedListing = {
      id: 'lst_proj_cancel',
      sellerId: 'seller_1',
      status: 'reserved',
      activeOrderId: 'ord_cancel_1',
      listingType: 'project',
      category: 'youtube-channels'
    };

    assert.equal(shouldUnlockListingOnOrderCancel(reservedListing, 'ord_cancel_1', 'seller_1', 'project'), true);

    const soldDigitalListing = {
      ...reservedListing,
      status: 'sold',
      isSold: true
    };
    assert.equal(shouldUnlockListingOnOrderCancel(soldDigitalListing, 'ord_cancel_1', 'seller_1', 'project'), false);
    assert.equal(canCancelOrder({ id: 'ord_done', orderType: 'project', status: 'completed' }), false);

    // Physical sold listing IS eligible when cancelling a pending physical order matching activeOrderId
    const soldPhysicalListing = {
      id: 'lst_phys_cancel',
      sellerId: 'seller_1',
      status: 'sold',
      isSold: true,
      activeOrderId: 'ord_phys_cancel',
      listingType: 'product',
      category: 'phones'
    };
    assert.equal(shouldUnlockListingOnOrderCancel(soldPhysicalListing, 'ord_phys_cancel', 'seller_1', 'product'), true);

    // Cloud Function trigger test: reserved project -> restored
    const store = new InMemoryListingStore();
    store.seed('listings/lst_proj_cancel', reservedListing);

    const cfRes1 = await processOrderUpdatedRestoration({
      orderId: 'ord_cancel_1',
      beforeData: { status: 'pending', orderType: 'project', listingId: 'lst_proj_cancel', sellerId: 'seller_1' },
      afterData: { status: 'cancelled', orderType: 'project', listingId: 'lst_proj_cancel', sellerId: 'seller_1' },
      firestore: store,
      deleteSentinel: DELETE_SENTINEL
    });
    assert.deepEqual(cfRes1, { restored: true, reason: 'restored' });
    const afterRestore = store.get('listings/lst_proj_cancel')!;
    assert.equal(afterRestore.status, 'active');
    assert.equal(afterRestore.isSold, false);
    assert.equal('activeOrderId' in afterRestore, false);

    // Cloud Function trigger test: sold digital asset MUST NOT restore
    store.seed('listings/lst_proj_sold', soldDigitalListing);
    const cfResSold = await processOrderUpdatedRestoration({
      orderId: 'ord_cancel_1',
      beforeData: { status: 'pending', orderType: 'project', listingId: 'lst_proj_sold', sellerId: 'seller_1' },
      afterData: { status: 'cancelled', orderType: 'project', listingId: 'lst_proj_sold', sellerId: 'seller_1' },
      firestore: store,
      deleteSentinel: DELETE_SENTINEL
    });
    assert.deepEqual(cfResSold, { restored: false, reason: 'digital_asset_already_sold' });
    assert.equal(store.get('listings/lst_proj_sold')?.status, 'sold');
  });

  it('12. Mismatched activeOrderId cannot unlock or overwrite a listing held by another order', async () => {
    const heldListing = {
      id: 'lst_held_by_other',
      sellerId: 'seller_1',
      status: 'reserved',
      activeOrderId: 'ord_newer_order',
      listingType: 'project',
      category: 'digital-projects'
    };

    assert.equal(shouldUnlockListingOnOrderCancel(heldListing, 'ord_old_order', 'seller_1', 'project'), false);
    assert.equal(shouldUnlockListingOnOrderCancel({ ...heldListing, activeOrderId: undefined }, 'ord_old_order', 'seller_1', 'project'), false);

    const store = new InMemoryListingStore();
    store.seed('listings/lst_held_by_other', heldListing);

    const cfRes = await processOrderUpdatedRestoration({
      orderId: 'ord_old_order',
      beforeData: { status: 'pending', orderType: 'project', listingId: 'lst_held_by_other', sellerId: 'seller_1' },
      afterData: { status: 'cancelled', orderType: 'project', listingId: 'lst_held_by_other', sellerId: 'seller_1' },
      firestore: store,
      deleteSentinel: DELETE_SENTINEL
    });
    assert.deepEqual(cfRes, { restored: false, reason: 'active_order_mismatch' });
    assert.equal(store.get('listings/lst_held_by_other')?.status, 'reserved');
    assert.equal(store.get('listings/lst_held_by_other')?.activeOrderId, 'ord_newer_order');
  });

  it('13. Repeated cancellation / client-then-CF replay is safe, and transaction failure rolls back atomically', async () => {
    // Idempotency when client transaction already restored listing to active
    const store = new InMemoryListingStore();
    store.seed('listings/lst_already_active', {
      id: 'lst_already_active',
      sellerId: 'seller_1',
      status: 'active',
      isSold: false,
      listingType: 'project',
      category: 'social-accounts'
    });

    const replayAfterClientDelete = await processOrderUpdatedRestoration({
      orderId: 'ord_cancelled_1',
      beforeData: { status: 'pending', orderType: 'project', listingId: 'lst_already_active', sellerId: 'seller_1' },
      afterData: { status: 'cancelled', orderType: 'project', listingId: 'lst_already_active', sellerId: 'seller_1' },
      firestore: store,
      deleteSentinel: DELETE_SENTINEL
    });
    assert.equal(replayAfterClientDelete.restored, false);

    // Repeated cancelled -> cancelled update is ignored
    const duplicateCancelTransition = await processOrderUpdatedRestoration({
      orderId: 'ord_cancelled_1',
      beforeData: { status: 'cancelled', orderType: 'project', listingId: 'lst_already_active', sellerId: 'seller_1' },
      afterData: { status: 'cancelled', orderType: 'project', listingId: 'lst_already_active', sellerId: 'seller_1' },
      firestore: store,
      deleteSentinel: DELETE_SENTINEL
    });
    assert.deepEqual(duplicateCancelTransition, { restored: false, reason: 'non_cancellation_transition' });

    // Transactional rollback test: staged write before throw leaves store unchanged
    await assert.rejects(
      store.runTransaction(async (tx) => {
        tx.update({ path: 'listings/lst_already_active' }, { status: 'reserved', activeOrderId: 'ord_aborted' });
        throw new Error('Simulated concurrent conflict');
      }),
      /Simulated concurrent conflict/
    );
    assert.equal(store.get('listings/lst_already_active')?.status, 'active');
    assert.equal(store.get('listings/lst_already_active')?.activeOrderId, undefined);

    // UI availability & status badge helpers
    assert.equal(isListingReserved({ status: 'reserved', activeOrderId: 'ord_1' }), true);
    assert.equal(isListingSold({ status: 'reserved', activeOrderId: 'ord_1' }), false);
    assert.equal(isListingUnavailableForPurchase({ status: 'reserved', activeOrderId: 'ord_1' }), true);
    assert.equal(isListingUnavailableForPurchase({ status: 'active', activeOrderId: 'ord_1', listingType: 'project', category: 'youtube-channels' }), true);
    assert.equal(isListingUnavailableForPurchase({ status: 'active', listingType: 'project', category: 'youtube-channels' }), false);
    assert.equal(isListingSold({ status: 'sold', isSold: true }), true);
  });

  it('14. Clips checkout atomically reserves unique digital assets, handles products/services, and blocks invalid purchases', async () => {
    const store = new InMemoryListingStore();
    store.seed('listings/lst_clip_yt', {
      id: 'lst_clip_yt',
      sellerId: 'seller_clip',
      title: 'Monetized Tech Channel',
      price: 950,
      currency: 'USD',
      status: 'active',
      listingType: 'project',
      category: 'youtube-channels'
    });
    store.seed('listings/lst_clip_prod', {
      id: 'lst_clip_prod',
      sellerId: 'seller_clip',
      title: 'Studio Mic',
      price: 180,
      currency: 'USD',
      status: 'active',
      listingType: 'product',
      category: 'music'
    });
    store.seed('listings/lst_clip_srv', {
      id: 'lst_clip_srv',
      sellerId: 'seller_clip',
      title: 'Channel Growth Sprint',
      price: 120,
      currency: 'USD',
      status: 'active',
      listingType: 'project',
      category: 'audience-growth'
    });
    store.seed('listings/lst_clip_job', {
      id: 'lst_clip_job',
      sellerId: 'seller_clip',
      title: 'Looking for Editor',
      price: 500,
      currency: 'USD',
      status: 'active',
      listingType: 'project',
      category: 'project-jobs'
    });
    store.seed('listings/lst_clip_collab', {
      id: 'lst_clip_collab',
      sellerId: 'seller_clip',
      title: 'Co-founder Search',
      price: 500,
      currency: 'USD',
      status: 'active',
      listingType: 'project',
      category: 'collaboration'
    });

    // 1) Self-purchase blocked
    await assert.rejects(
      store.runTransaction((tx) =>
        placeVerifiedOrderInTransaction({
          tx,
          listingRef: store.collection('listings').doc('lst_clip_yt'),
          newOrderRef: store.collection('orders').doc('ord_self'),
          orderId: 'ord_self',
          listingId: 'lst_clip_yt',
          buyerId: 'seller_clip',
          createdAt: 100
        })
      ),
      (err: any) => err instanceof MarketOrderRuleError && err.code === 'SELF_PURCHASE'
    );

    // 2) project-jobs and collaboration blocked
    for (const badId of ['lst_clip_job', 'lst_clip_collab']) {
      await assert.rejects(
        store.runTransaction((tx) =>
          placeVerifiedOrderInTransaction({
            tx,
            listingRef: store.collection('listings').doc(badId),
            newOrderRef: store.collection('orders').doc(`ord_${badId}`),
            orderId: `ord_${badId}`,
            listingId: badId,
            buyerId: 'buyer_clip_1',
            createdAt: 100
          })
        ),
        (err: any) => err instanceof MarketOrderRuleError && err.code === 'NON_PURCHASABLE_LISTING'
      );
    }

    // 3) Digital asset purchase via Clips reserves listing atomically as orderType='project', status='pending'
    const digitalResult = await store.runTransaction((tx) =>
      placeVerifiedOrderInTransaction({
        tx,
        listingRef: store.collection('listings').doc('lst_clip_yt'),
        newOrderRef: store.collection('orders').doc('ord_clip_yt_1'),
        orderId: 'ord_clip_yt_1',
        listingId: 'lst_clip_yt',
        buyerId: 'buyer_clip_1',
        buyerInstructions: 'Transfer ownership to @buyer_clip',
        shippingDetails: null,
        createdAt: 101
      })
    );
    assert.equal(digitalResult.orderData.orderType, 'project');
    assert.equal(digitalResult.orderData.status, 'pending');
    assert.equal(digitalResult.orderData.buyerInstructions, 'Transfer ownership to @buyer_clip');
    assert.equal('shippingDetails' in digitalResult.orderData, false);
    assert.equal(store.get('listings/lst_clip_yt')?.status, 'reserved');
    assert.equal(store.get('listings/lst_clip_yt')?.activeOrderId, 'ord_clip_yt_1');
    assert.equal(store.get('orders/ord_clip_yt_1')?.orderType, 'project');

    // 4) Second buyer attempting to buy the now-reserved asset via Clips is blocked
    await assert.rejects(
      store.runTransaction((tx) =>
        placeVerifiedOrderInTransaction({
          tx,
          listingRef: store.collection('listings').doc('lst_clip_yt'),
          newOrderRef: store.collection('orders').doc('ord_clip_yt_2'),
          orderId: 'ord_clip_yt_2',
          listingId: 'lst_clip_yt',
          buyerId: 'buyer_clip_2',
          createdAt: 102
        })
      ),
      (err: any) => err instanceof MarketOrderRuleError && err.code === 'ALREADY_RESERVED'
    );

    // 5) Physical product via Clips without shippingDetails keeps delivery notes and marks sold
    const prodResult = await store.runTransaction((tx) =>
      placeVerifiedOrderInTransaction({
        tx,
        listingRef: store.collection('listings').doc('lst_clip_prod'),
        newOrderRef: store.collection('orders').doc('ord_clip_prod_1'),
        orderId: 'ord_clip_prod_1',
        listingId: 'lst_clip_prod',
        buyerId: 'buyer_clip_1',
        buyerInstructions: 'Deliver to Tbilisi, Tel: 599 112233',
        shippingDetails: null,
        createdAt: 103
      })
    );
    assert.equal(prodResult.orderData.orderType, 'product');
    assert.equal(prodResult.orderData.status, 'pending');
    assert.equal(prodResult.orderData.buyerInstructions, 'Deliver to Tbilisi, Tel: 599 112233');
    assert.equal(store.get('listings/lst_clip_prod')?.status, 'sold');
    assert.equal(store.get('listings/lst_clip_prod')?.isSold, true);

    // 6) Repeatable service via Clips leaves listing active and creates booked service order
    const srvResult = await store.runTransaction((tx) =>
      placeVerifiedOrderInTransaction({
        tx,
        listingRef: store.collection('listings').doc('lst_clip_srv'),
        newOrderRef: store.collection('orders').doc('ord_clip_srv_1'),
        orderId: 'ord_clip_srv_1',
        listingId: 'lst_clip_srv',
        buyerId: 'buyer_clip_1',
        buyerInstructions: 'Channel link included',
        shippingDetails: null,
        createdAt: 104
      })
    );
    assert.equal(srvResult.orderData.orderType, 'service');
    assert.equal(srvResult.orderData.status, 'booked');
    assert.equal(store.get('listings/lst_clip_srv')?.status, 'active');

    // 7) Atomic rollback when listing update throws mid-transaction
    store.seed('listings/lst_clip_rollback', {
      id: 'lst_clip_rollback',
      sellerId: 'seller_clip',
      title: 'Rollback Channel',
      price: 300,
      currency: 'USD',
      status: 'active',
      listingType: 'project',
      category: 'digital-projects'
    });
    await assert.rejects(
      store.runTransaction(async (tx) => {
        const res = await placeVerifiedOrderInTransaction({
          tx,
          listingRef: store.collection('listings').doc('lst_clip_rollback'),
          newOrderRef: store.collection('orders').doc('ord_rollback'),
          orderId: 'ord_rollback',
          listingId: 'lst_clip_rollback',
          buyerId: 'buyer_clip_1',
          createdAt: 105
        });
        assert.ok(res.lockUpdate);
        throw new Error('Injected network commit failure');
      }),
      /Injected network commit failure/
    );
    assert.equal(store.get('orders/ord_rollback'), undefined);
    assert.equal(store.get('listings/lst_clip_rollback')?.status, 'active');
  });

  it('15. CabinetView & SellerContext enforce role-safe transition rules and atomic project completion', async () => {
    // Transition matrix checks
    assert.equal(isValidOrderStatusTransition('pending', 'completed', true, false, 'project'), true);
    assert.equal(isValidOrderStatusTransition('booked', 'completed', true, false, 'project'), true);
    assert.equal(isValidOrderStatusTransition('pending', 'cancelled', true, true, 'project'), true);
    assert.equal(isValidOrderStatusTransition('booked', 'in_progress', true, false, 'project'), false);
    assert.equal(isValidOrderStatusTransition('in_progress', 'completed', true, false, 'project'), false);
    assert.equal(isValidOrderStatusTransition('pending', 'processing', true, false, 'project'), false);
    assert.equal(isValidOrderStatusTransition('pending', 'completed', false, true, 'project'), false); // buyer blocked
    assert.equal(isValidOrderStatusTransition('booked', 'completed', false, true, 'project'), false); // buyer blocked

    // Service & product regressions preserved
    assert.equal(isValidOrderStatusTransition('booked', 'in_progress', true, false, 'service'), true);
    assert.equal(isValidOrderStatusTransition('in_progress', 'completed', true, false, 'service'), true);
    assert.equal(isValidOrderStatusTransition('pending', 'processing', true, false, 'product'), true);
    assert.equal(isValidOrderStatusTransition('processing', 'shipped', true, false, 'product'), true);
    assert.equal(isValidOrderStatusTransition('shipped', 'completed', false, true, 'product'), true);

    // isSellerActionRequired excludes invalid 'in_progress' on project orders
    assert.equal(isSellerActionRequired({ orderType: 'project', status: 'pending' }), true);
    assert.equal(isSellerActionRequired({ orderType: 'project', status: 'booked' }), true);
    assert.equal(isSellerActionRequired({ orderType: 'project', status: 'in_progress' }), false);

    // Atomic transaction test for SellerContext / CabinetView completion
    const store = new InMemoryListingStore();
    store.seed('listings/lst_cab_1', {
      id: 'lst_cab_1',
      sellerId: 'seller_1',
      price: 600,
      currency: 'USD',
      status: 'reserved',
      activeOrderId: 'ord_cab_1',
      listingType: 'project',
      category: 'social-accounts'
    });
    store.seed('orders/ord_cab_1', {
      id: 'ord_cab_1',
      listingId: 'lst_cab_1',
      sellerId: 'seller_1',
      buyerId: 'buyer_1',
      orderType: 'project',
      status: 'pending',
      amount: 600,
      currency: 'USD'
    });

    // Buyer cannot complete
    await assert.rejects(
      store.runTransaction((tx) =>
        completeDigitalAssetOrderInTransaction({
          tx,
          orderRef: store.collection('orders').doc('ord_cab_1'),
          getListingRef: (id) => store.collection('listings').doc(id),
          orderId: 'ord_cab_1',
          callerUid: 'buyer_1'
        })
      ),
      (err: any) => err instanceof MarketOrderRuleError && err.code === 'UNAUTHORIZED_SELLER'
    );
    assert.equal(store.get('orders/ord_cab_1')?.status, 'pending');
    assert.equal(store.get('listings/lst_cab_1')?.status, 'reserved');

    // Mismatched activeOrderId cannot complete and aborts atomically
    store.seed('listings/lst_cab_wrong', {
      id: 'lst_cab_wrong',
      sellerId: 'seller_1',
      price: 600,
      currency: 'USD',
      status: 'reserved',
      activeOrderId: 'ord_other_active',
      listingType: 'project',
      category: 'social-accounts'
    });
    store.seed('orders/ord_cab_wrong', {
      id: 'ord_cab_wrong',
      listingId: 'lst_cab_wrong',
      sellerId: 'seller_1',
      buyerId: 'buyer_1',
      orderType: 'project',
      status: 'pending'
    });
    await assert.rejects(
      store.runTransaction((tx) =>
        completeDigitalAssetOrderInTransaction({
          tx,
          orderRef: store.collection('orders').doc('ord_cab_wrong'),
          getListingRef: (id) => store.collection('listings').doc(id),
          orderId: 'ord_cab_wrong',
          callerUid: 'seller_1'
        })
      ),
      (err: any) => err instanceof MarketOrderRuleError && err.code === 'ACTIVE_ORDER_MISMATCH'
    );
    assert.equal(store.get('orders/ord_cab_wrong')?.status, 'pending');
    assert.equal(store.get('listings/lst_cab_wrong')?.status, 'reserved');

    // Authorized seller completes atomically: order -> completed, listing -> sold + isSold: true
    const done = await store.runTransaction((tx) =>
      completeDigitalAssetOrderInTransaction({
        tx,
        orderRef: store.collection('orders').doc('ord_cab_1'),
        getListingRef: (id) => store.collection('listings').doc(id),
        orderId: 'ord_cab_1',
        callerUid: 'seller_1'
      })
    );
    assert.equal(done.listingId, 'lst_cab_1');
    assert.equal(store.get('orders/ord_cab_1')?.status, 'completed');
    assert.equal(store.get('listings/lst_cab_1')?.status, 'sold');
    assert.equal(store.get('listings/lst_cab_1')?.isSold, true);
    assert.equal(store.get('listings/lst_cab_1')?.activeOrderId, 'ord_cab_1');
  });

  it('16. Legacy booked project order completes safely when reserved+matched and rejects unreserved/mismatched records', async () => {
    const store = new InMemoryListingStore();

    // Valid legacy booked project order with reserved listing + matching activeOrderId
    store.seed('listings/lst_legacy_valid', {
      id: 'lst_legacy_valid',
      sellerId: 'seller_1',
      price: 400,
      currency: 'USD',
      status: 'reserved',
      activeOrderId: 'ord_legacy_booked_valid',
      listingType: 'project',
      category: 'youtube-channels'
    });
    store.seed('orders/ord_legacy_booked_valid', {
      id: 'ord_legacy_booked_valid',
      listingId: 'lst_legacy_valid',
      sellerId: 'seller_1',
      buyerId: 'buyer_1',
      orderType: 'project',
      status: 'booked'
    });

    assert.equal(isCompletableDigitalAssetOrderStatus('booked'), true);
    assert.equal(isCompletableDigitalAssetOrderStatus('in_progress'), false);

    await store.runTransaction((tx) =>
      completeDigitalAssetOrderInTransaction({
        tx,
        orderRef: store.collection('orders').doc('ord_legacy_booked_valid'),
        getListingRef: (id) => store.collection('listings').doc(id),
        orderId: 'ord_legacy_booked_valid',
        callerUid: 'seller_1'
      })
    );
    assert.equal(store.get('orders/ord_legacy_booked_valid')?.status, 'completed');
    assert.equal(store.get('listings/lst_legacy_valid')?.status, 'sold');
    assert.equal(store.get('listings/lst_legacy_valid')?.isSold, true);

    // Unsafe unreserved ('active') legacy booked project order MUST fail safely
    store.seed('listings/lst_legacy_active', {
      id: 'lst_legacy_active',
      sellerId: 'seller_1',
      price: 400,
      currency: 'USD',
      status: 'active',
      listingType: 'project',
      category: 'youtube-channels'
    });
    store.seed('orders/ord_legacy_booked_unreserved', {
      id: 'ord_legacy_booked_unreserved',
      listingId: 'lst_legacy_active',
      sellerId: 'seller_1',
      buyerId: 'buyer_1',
      orderType: 'project',
      status: 'booked'
    });

    await assert.rejects(
      store.runTransaction((tx) =>
        completeDigitalAssetOrderInTransaction({
          tx,
          orderRef: store.collection('orders').doc('ord_legacy_booked_unreserved'),
          getListingRef: (id) => store.collection('listings').doc(id),
          orderId: 'ord_legacy_booked_unreserved',
          callerUid: 'seller_1'
        })
      ),
      (err: any) => err instanceof MarketOrderRuleError && err.code === 'LISTING_NOT_RESERVED'
    );
    assert.equal(store.get('orders/ord_legacy_booked_unreserved')?.status, 'booked');
    assert.equal(store.get('listings/lst_legacy_active')?.status, 'active');

    // Legacy in_progress project order is NOT allowed through project completion path
    store.seed('orders/ord_legacy_in_progress', {
      id: 'ord_legacy_in_progress',
      listingId: 'lst_legacy_valid',
      sellerId: 'seller_1',
      buyerId: 'buyer_1',
      orderType: 'project',
      status: 'in_progress'
    });
    await assert.rejects(
      store.runTransaction((tx) =>
        completeDigitalAssetOrderInTransaction({
          tx,
          orderRef: store.collection('orders').doc('ord_legacy_in_progress'),
          getListingRef: (id) => store.collection('listings').doc(id),
          orderId: 'ord_legacy_in_progress',
          callerUid: 'seller_1'
        })
      ),
      (err: any) => err instanceof MarketOrderRuleError && err.code === 'INVALID_STATUS_TRANSITION'
    );
  });

  it('17. firestore.rules enforces strict P0 alignment across new pending and legacy booked project orders', () => {
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    const rulesText = fs.readFileSync(rulesPath, 'utf8');

    // in_progress transitions must explicitly exclude project orders
    assert.match(
      rulesText,
      /existing\(\)\.status == 'booked' && getStr\(existing\(\), 'orderType', 'product'\) != 'project' && incoming\(\)\.status == 'in_progress'/
    );
    assert.match(
      rulesText,
      /existing\(\)\.status == 'in_progress' && getStr\(existing\(\), 'orderType', 'product'\) != 'project' && incoming\(\)\.status == 'completed'/
    );

    // Project completion must allow ['pending', 'booked'] and strictly require existing reserved + activeOrderId == orderId + atomic sold
    assert.match(
      rulesText,
      /existing\(\)\.status in \['pending', 'booked'\][\s\S]*incoming\(\)\.status == 'completed'[\s\S]*getStr\(existing\(\), 'orderType', 'product'\) == 'project'[\s\S]*exists\(\/databases\/\$\(database\)\/documents\/listings\/\$\(existing\(\)\.listingId\)\)[\s\S]*\.data\.status == 'reserved'[\s\S]*activeOrderId', ''\) == orderId[\s\S]*getAfter\(\/databases\/\$\(database\)\/documents\/listings\/\$\(existing\(\)\.listingId\)\)\.data\.status == 'sold'[\s\S]*\.data\.isSold == true/
    );

    // Order create rule still enforces pending + atomic reserved for project digital assets
    assert.match(
      rulesText,
      /incoming\(\)\.orderType == 'project'[\s\S]*incoming\(\)\.status == 'pending'[\s\S]*getAfter\(\/databases\/\$\(database\)\/documents\/listings\/\$\(incoming\(\)\.listingId\)\)\.data\.status == 'reserved'/
    );
  });

  it('18. Organizer task sync and handleToggleTask separate project orders from service/product orders and block lifecycle bypass', () => {
    // 1. Task generation matrix
    assert.equal(shouldGenerateOrganizerFulfillmentTask({ orderType: 'project', status: 'pending' }), false);
    assert.equal(shouldGenerateOrganizerFulfillmentTask({ orderType: 'project', status: 'booked' }), false);
    assert.equal(shouldGenerateOrganizerFulfillmentTask({ orderType: 'service', status: 'booked' }), true);
    assert.equal(shouldGenerateOrganizerFulfillmentTask({ orderType: 'service', status: 'pending' }), false);
    assert.equal(shouldGenerateOrganizerFulfillmentTask({ orderType: 'product', status: 'pending' }), true);

    // 2. Organizer toggle action resolution
    assert.deepEqual(
      resolveOrganizerOrderToggleAction({ orderType: 'project', status: 'pending' }, true),
      { kind: 'blocked_project_asset', targetOrderStatus: null }
    );
    assert.deepEqual(
      resolveOrganizerOrderToggleAction({ orderType: 'project', status: 'booked' }, true),
      { kind: 'blocked_project_asset', targetOrderStatus: null }
    );
    assert.deepEqual(
      resolveOrganizerOrderToggleAction({ orderType: 'project', status: 'completed' }, false),
      { kind: 'blocked_project_asset', targetOrderStatus: null }
    );
    assert.deepEqual(
      resolveOrganizerOrderToggleAction({ orderType: 'service', status: 'booked' }, true),
      { kind: 'advance_order', orderCategory: 'service', targetOrderStatus: 'in_progress' }
    );
    assert.deepEqual(
      resolveOrganizerOrderToggleAction({ orderType: 'service', status: 'in_progress' }, true),
      { kind: 'advance_order', orderCategory: 'service', targetOrderStatus: 'completed' }
    );
    assert.deepEqual(
      resolveOrganizerOrderToggleAction({ orderType: 'product', status: 'pending' }, true),
      { kind: 'advance_order', orderCategory: 'product', targetOrderStatus: 'processing' }
    );
    assert.deepEqual(
      resolveOrganizerOrderToggleAction({ orderType: 'product', status: 'processing' }, true),
      { kind: 'advance_order', orderCategory: 'product', targetOrderStatus: 'shipped' }
    );
    assert.deepEqual(
      resolveOrganizerOrderToggleAction(undefined, true),
      { kind: 'standard_task', targetOrderStatus: null }
    );

    // 3. Legacy project order task visibility filter
    const orders = [
      { id: 'ord_proj_1', orderType: 'project' },
      { id: 'ord_srv_1', orderType: 'service' },
      { id: 'ord_prod_1', orderType: 'product' }
    ];
    assert.equal(isProjectAssetLinkedTask({ id: 'order-task-ord_proj_1' }, orders), true);
    assert.equal(isProjectAssetLinkedTask({ id: 't1', orderId: 'ord_proj_1' }, orders), true);
    assert.equal(isProjectAssetLinkedTask({ id: 't2', metadata: { orderId: 'ord_proj_1' } }, orders), true);
    assert.equal(isProjectAssetLinkedTask({ id: 'order-task-ord_srv_1', orderId: 'ord_srv_1' }, orders), false);
    assert.equal(isProjectAssetLinkedTask({ id: 'order-task-ord_prod_1', orderId: 'ord_prod_1' }, orders), false);
    assert.equal(isProjectAssetLinkedTask({ id: 'manual_task_1' }, orders), false);

    // 4. Verify App.tsx no longer treats project as service in handleToggleTask
    const appText = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    assert.equal(appText.includes("linkedOrder.orderType === 'service' || linkedOrder.orderType === 'project'"), false);
    assert.equal(appText.includes('resolveOrganizerOrderToggleAction'), true);
    assert.equal(appText.includes('shouldGenerateOrganizerFulfillmentTask'), true);
    assert.equal(appText.includes('isProjectAssetLinkedTask'), true);
  });
});


