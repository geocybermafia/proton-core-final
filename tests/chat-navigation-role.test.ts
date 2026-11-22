import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  extractBuyerIdFromConversationId,
  extractListingIdFromConversationId,
  extractNavigationLookupHints,
  resolveMarketChatNavigation,
  validateActiveChatContext,
} from '../src/lib/marketChatNavigation.js';
import type { Listing, Order } from '../src/types.js';

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-alpha',
    title: 'Precision Thermal Sensor',
    description: 'Industrial sensor unit',
    price: 250,
    currency: 'USD',
    sellerId: 'seller-uid-1',
    sellerName: 'Giorgi Seller',
    category: 'Electronics',
    country: 'GE',
    city: 'Tbilisi',
    location: 'Tbilisi, GE',
    createdAt: 1700000000000,
    status: 'active',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-999',
    listingId: 'listing-alpha',
    buyerId: 'buyer-uid-1',
    sellerId: 'seller-uid-1',
    amount: 250,
    currency: 'USD',
    itemTitle: 'Precision Thermal Sensor',
    status: 'pending',
    buyerName: 'Nino Buyer',
    createdAt: 1700000005000,
    ...overrides,
  };
}

describe('CHAT-AUD-04: Notification -> Chat Navigation & Participant Role Resolution', () => {
  it('1 & 3. Buyer receives seller notification and opens chat as buyer (never assigned sellerId)', () => {
    const listing = makeListing({
      id: 'listing-alpha',
      sellerId: 'seller-uid-1',
      sellerName: 'Giorgi Seller',
    });

    const result = resolveMarketChatNavigation({
      target: {
        type: 'market_message',
        listingId: 'listing-alpha',
        conversationId: 'listing-alpha_buyer-uid-1',
        buyerId: 'buyer-uid-1',
        sellerId: 'seller-uid-1',
      },
      currentUserId: 'buyer-uid-1',
      currentUserDisplayName: 'Nino Buyer',
      fetchedListing: listing,
      knownListings: [],
      groupedChats: [], // empty initial groupedChats (the exact bug scenario!)
      orders: [],
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.userRole, 'buyer');
    assert.equal(result.sellerId, 'seller-uid-1');
    assert.equal(result.buyerId, 'buyer-uid-1');
    assert.equal(result.listing.sellerId, 'seller-uid-1');
    assert.notEqual(result.sellerId, 'buyer-uid-1');
    assert.equal(result.conversationId, 'listing-alpha_buyer-uid-1');
    assert.equal(result.buyerName, 'Nino Buyer');
    assert.equal(result.sellerName, 'Giorgi Seller');
  });

  it('1b. Buyer notification works even when legacy notification omits target.sellerId (uses authoritative listing.sellerId)', () => {
    const listing = makeListing({
      id: 'listing-alpha',
      sellerId: 'seller-uid-1',
      sellerName: 'Giorgi Seller',
    });

    const result = resolveMarketChatNavigation({
      target: {
        type: 'market_message',
        listingId: 'listing-alpha',
        conversationId: 'listing-alpha_buyer-uid-1',
        buyerId: 'buyer-uid-1',
      },
      currentUserId: 'buyer-uid-1',
      currentUserDisplayName: 'Nino Buyer',
      fetchedListing: listing,
      knownListings: [],
      groupedChats: [],
      orders: [],
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.userRole, 'buyer');
    assert.equal(result.sellerId, 'seller-uid-1');
    assert.equal(result.listing.sellerId, 'seller-uid-1');
  });

  it('2 & 4. Seller receives buyer notification and opens chat as seller (never assigned buyer role)', () => {
    const listing = makeListing({
      id: 'listing-alpha',
      sellerId: 'seller-uid-1',
      sellerName: 'Giorgi Seller',
    });

    const result = resolveMarketChatNavigation({
      target: {
        type: 'market_message',
        listingId: 'listing-alpha',
        conversationId: 'listing-alpha_buyer-uid-1',
        buyerId: 'buyer-uid-1',
        sellerId: 'seller-uid-1',
      },
      currentUserId: 'seller-uid-1',
      currentUserDisplayName: 'Giorgi Seller',
      fetchedListing: listing,
      knownListings: [listing],
      groupedChats: [
        {
          conversationId: 'listing-alpha_buyer-uid-1',
          listingId: 'listing-alpha',
          listingTitle: listing.title,
          sellerId: 'seller-uid-1',
          sellerName: 'Giorgi Seller',
          buyerId: 'buyer-uid-1',
          buyerName: 'Nino Buyer',
        },
      ],
      orders: [],
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.userRole, 'seller');
    assert.equal(result.sellerId, 'seller-uid-1');
    assert.equal(result.buyerId, 'buyer-uid-1');
    assert.notEqual(result.buyerId, 'seller-uid-1');
    assert.equal(result.buyerName, 'Nino Buyer');
  });

  it('5a. Missing sellerId across all sources blocks opening chat and never assigns currentUserId as seller', () => {
    const result = resolveMarketChatNavigation({
      target: {
        type: 'market_message',
        listingId: 'deleted-listing-1',
        conversationId: 'deleted-listing-1_buyer-uid-1',
        buyerId: 'buyer-uid-1',
      },
      currentUserId: 'buyer-uid-1',
      currentUserDisplayName: 'Nino Buyer',
      fetchedListing: null,
      knownListings: [],
      groupedChats: [],
      orders: [],
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, 'missing_seller');
    assert.equal(result.canRetryWhenChatsLoad, true);
  });

  it('5b. Conflicting sellerId between listings/{listingId}.sellerId and target.sellerId blocks opening chat', () => {
    const listing = makeListing({
      id: 'listing-alpha',
      sellerId: 'seller-uid-real',
    });

    const result = resolveMarketChatNavigation({
      target: {
        type: 'market_message',
        listingId: 'listing-alpha',
        conversationId: 'listing-alpha_buyer-uid-1',
        buyerId: 'buyer-uid-1',
        sellerId: 'seller-uid-forged',
      },
      currentUserId: 'buyer-uid-1',
      fetchedListing: listing,
      knownListings: [listing],
      groupedChats: [],
      orders: [],
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, 'seller_conflict');
    assert.equal(result.canRetryWhenChatsLoad, false);
  });

  it('5c. Self-chat (buyerId === sellerId) and non-participant access are blocked', () => {
    const listingSelf = makeListing({ id: 'listing-self', sellerId: 'user-1' });
    const selfResult = resolveMarketChatNavigation({
      target: {
        type: 'market_message',
        listingId: 'listing-self',
        conversationId: 'listing-self_user-1',
        buyerId: 'user-1',
        sellerId: 'user-1',
      },
      currentUserId: 'user-1',
      fetchedListing: listingSelf,
    });
    assert.equal(selfResult.ok, false);
    if (!selfResult.ok) {
      assert.equal(selfResult.reason, 'self_chat_not_allowed');
    }

    const listingNormal = makeListing({ id: 'listing-normal', sellerId: 'seller-uid-1' });
    const outsiderResult = resolveMarketChatNavigation({
      target: {
        type: 'market_message',
        listingId: 'listing-normal',
        conversationId: 'listing-normal_buyer-uid-1',
        buyerId: 'buyer-uid-1',
        sellerId: 'seller-uid-1',
      },
      currentUserId: 'random-other-uid',
      fetchedListing: listingNormal,
    });
    assert.equal(outsiderResult.ok, false);
    if (!outsiderResult.ok) {
      assert.equal(outsiderResult.reason, 'user_not_participant');
    }
  });

  it('5d. validateActiveChatContext disables sending when buyerId/sellerId missing, conflicting, or mismatched', () => {
    const listing = makeListing({ id: 'listing_1', sellerId: 'seller-1' });

    const validBuyer = validateActiveChatContext({
      context: {
        conversationId: 'listing_1_buyer-1',
        listing,
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
      },
      listing,
      currentUserId: 'buyer-1',
    });
    assert.equal(validBuyer.ok, true);
    if (validBuyer.ok) {
      assert.equal(validBuyer.userRole, 'buyer');
    }

    const missingSeller = validateActiveChatContext({
      context: {
        conversationId: 'listing_1_buyer-1',
        listing: { ...listing, sellerId: '' },
        buyerId: 'buyer-1',
        sellerId: '',
      },
      listing: { ...listing, sellerId: '' },
      currentUserId: 'buyer-1',
    });
    assert.equal(missingSeller.ok, false);

    const roleMismatch = validateActiveChatContext({
      context: {
        conversationId: 'listing_1_buyer-1',
        listing: { ...listing, sellerId: 'buyer-1' }, // corrupted listing
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
      },
      listing,
      currentUserId: 'buyer-1',
    });
    assert.equal(roleMismatch.ok, false);

    const selfSend = validateActiveChatContext({
      context: {
        conversationId: 'listing_1_buyer-1',
        listing: { ...listing, sellerId: 'buyer-1' },
        buyerId: 'buyer-1',
        sellerId: 'buyer-1',
      },
      listing: { ...listing, sellerId: 'buyer-1' },
      currentUserId: 'buyer-1',
    });
    assert.equal(selfSend.ok, false);
  });

  it('6. listingId containing underscores (_) is resolved cleanly without split("_")[0]', () => {
    const underscoreListingId = 'prod_macbook_pro_16_m3_max';
    const buyerId = 'buyer_uid_77';
    const convId = `${underscoreListingId}_${buyerId}`;
    const listing = makeListing({
      id: underscoreListingId,
      sellerId: 'seller_uid_88',
      sellerName: 'Pro Studio',
    });

    // Case A: target omits listingId, supplies conversationId + buyerId
    const hintsA = extractNavigationLookupHints({
      target: {
        type: 'market_message',
        conversationId: convId,
        buyerId,
        sellerId: 'seller_uid_88',
      },
    });
    assert.equal(hintsA.lookupListingId, underscoreListingId);
    assert.equal(hintsA.lookupBuyerId, buyerId);

    const resA = resolveMarketChatNavigation({
      target: {
        type: 'market_message',
        conversationId: convId,
        buyerId,
        sellerId: 'seller_uid_88',
      },
      currentUserId: buyerId,
      fetchedListing: listing,
    });
    assert.equal(resA.ok, true);
    if (resA.ok) {
      assert.equal(resA.listingId, underscoreListingId);
      assert.equal(resA.buyerId, buyerId);
      assert.equal(resA.sellerId, 'seller_uid_88');
      assert.equal(resA.userRole, 'buyer');
      assert.equal(resA.conversationId, convId);
    }

    // Case B: target supplies listingId with underscores, omits buyerId
    const resB = resolveMarketChatNavigation({
      target: {
        type: 'market_message',
        listingId: underscoreListingId,
        conversationId: convId,
        sellerId: 'seller_uid_88',
      },
      currentUserId: 'seller_uid_88',
      fetchedListing: listing,
    });
    assert.equal(resB.ok, true);
    if (resB.ok) {
      assert.equal(resB.buyerId, buyerId);
      assert.equal(resB.userRole, 'seller');
    }

    // Case C: helper functions preserve underscores
    assert.equal(extractListingIdFromConversationId(convId, buyerId), underscoreListingId);
    assert.equal(extractBuyerIdFromConversationId(convId, underscoreListingId), buyerId);
  });

  it('7. Order-linked chat notification preserves order context and blocks mismatched orders', () => {
    const listing = makeListing({ id: 'prod_order_1', sellerId: 'seller-uid-1' });
    const order = makeOrder({
      id: 'order-555',
      listingId: 'prod_order_1',
      buyerId: 'buyer-uid-1',
      sellerId: 'seller-uid-1',
      buyerName: 'Nino Buyer',
    });

    const okRes = resolveMarketChatNavigation({
      target: {
        type: 'market_message',
        orderId: 'order-555',
        listingId: 'prod_order_1',
        conversationId: 'prod_order_1_buyer-uid-1',
        buyerId: 'buyer-uid-1',
        sellerId: 'seller-uid-1',
      },
      currentUserId: 'buyer-uid-1',
      fetchedListing: listing,
      orders: [order],
    });

    assert.equal(okRes.ok, true);
    if (okRes.ok) {
      assert.equal(okRes.orderId, 'order-555');
      assert.equal(okRes.matchedOrder?.id, 'order-555');
      assert.equal(okRes.userRole, 'buyer');
      assert.equal(okRes.sellerId, 'seller-uid-1');
    }

    // Mismatched order pointing to different buyer
    const badOrder = makeOrder({
      id: 'order-other',
      listingId: 'prod_order_1',
      buyerId: 'different-buyer',
      sellerId: 'seller-uid-1',
    });
    const badRes = resolveMarketChatNavigation({
      target: {
        type: 'market_message',
        orderId: 'order-other',
        listingId: 'prod_order_1',
        conversationId: 'prod_order_1_buyer-uid-1',
        buyerId: 'buyer-uid-1',
        sellerId: 'seller-uid-1',
      },
      currentUserId: 'buyer-uid-1',
      fetchedListing: listing,
      orders: [badOrder],
    });
    assert.equal(badRes.ok, false);
    if (!badRes.ok) {
      assert.equal(badRes.reason, 'order_mismatch');
    }
  });

  it('8. Deleted listing opens safely when existing conversation or target metadata identifies participants (without user.uid fallback)', () => {
    // Deleted listing (fetchedListing = null, knownListings = []), resolved via existing groupedChats
    const resFromThread = resolveMarketChatNavigation({
      target: {
        type: 'market_message',
        listingId: 'deleted_prod_9',
        conversationId: 'deleted_prod_9_buyer-uid-1',
        buyerId: 'buyer-uid-1',
      },
      currentUserId: 'buyer-uid-1',
      currentUserDisplayName: 'Nino Buyer',
      fetchedListing: null,
      knownListings: [],
      groupedChats: [
        {
          conversationId: 'deleted_prod_9_buyer-uid-1',
          listingId: 'deleted_prod_9',
          listingTitle: 'Archived GPU',
          sellerId: 'seller-uid-1',
          sellerName: 'Giorgi Seller',
          buyerId: 'buyer-uid-1',
          buyerName: 'Nino Buyer',
        },
      ],
      orders: [],
    });

    assert.equal(resFromThread.ok, true);
    if (!resFromThread.ok) return;
    assert.equal(resFromThread.isDeletedListingFallback, true);
    assert.equal(resFromThread.userRole, 'buyer');
    assert.equal(resFromThread.sellerId, 'seller-uid-1');
    assert.equal(resFromThread.listing.sellerId, 'seller-uid-1');
    assert.equal(resFromThread.listing.title, 'Archived GPU');

    // Deleted listing resolved via notification target.sellerId when groupedChats is empty
    const resFromTarget = resolveMarketChatNavigation({
      target: {
        type: 'market_message',
        listingId: 'deleted_prod_9',
        conversationId: 'deleted_prod_9_buyer-uid-1',
        buyerId: 'buyer-uid-1',
        sellerId: 'seller-uid-1',
      },
      currentUserId: 'buyer-uid-1',
      currentUserDisplayName: 'Nino Buyer',
      fetchedListing: null,
      knownListings: [],
      groupedChats: [],
      orders: [],
    });

    assert.equal(resFromTarget.ok, true);
    if (!resFromTarget.ok) return;
    assert.equal(resFromTarget.isDeletedListingFallback, true);
    assert.equal(resFromTarget.userRole, 'buyer');
    assert.equal(resFromTarget.sellerId, 'seller-uid-1');
    assert.equal(resFromTarget.listing.sellerId, 'seller-uid-1');
  });

  it('9. MarketHub, MarketChatDrawer, and ChatComposer maintain safety invariants across Drawer, Desktop, and Mobile UI', () => {
    const marketHubSrc = fs.readFileSync(
      path.resolve('src/components/MarketHub.tsx'),
      'utf8'
    );
    const drawerSrc = fs.readFileSync(
      path.resolve('src/components/market-hub/MarketChatDrawer.tsx'),
      'utf8'
    );
    const composerSrc = fs.readFileSync(
      path.resolve('src/components/market-hub/chat/ChatComposer.tsx'),
      'utf8'
    );

    // Ensure unsafe fallbacks were completely removed from MarketHub.tsx
    assert.equal(marketHubSrc.includes("sellerId: user?.uid || ''"), false);
    assert.equal(marketHubSrc.includes("sellerId: matchedChat.sellerId || user?.uid || ''"), false);
    assert.equal(marketHubSrc.includes("sellerId: found.sellerId || user?.uid || ''"), false);
    assert.equal(marketHubSrc.includes("targetConvId.split('_')[0]"), false);
    assert.equal(marketHubSrc.includes("msg.conversationId.split('_').slice(1).join('_')"), false);

    // Ensure MarketHub wires strict resolver, disabled state, and conversationId across Desktop, Mobile, and Drawer
    assert.equal(marketHubSrc.includes('resolveMarketChatNavigation('), true);
    assert.equal(marketHubSrc.includes('validateActiveChatContext('), true);
    assert.equal(marketHubSrc.includes('disabled={!isActiveChatSendAllowed}'), true);
    assert.equal(marketHubSrc.includes('isSendDisabled={!isActiveChatSendAllowed}'), true);
    assert.equal(marketHubSrc.includes('conversationId={activeChatContext?.conversationId}'), true);

    // Ensure Drawer and Composer expose send-disable and conversationKey support
    assert.equal(drawerSrc.includes('isSendDisabled'), true);
    assert.equal(drawerSrc.includes('conversationId'), true);
    assert.equal(composerSrc.includes('disabled = false'), true);
  });
});
