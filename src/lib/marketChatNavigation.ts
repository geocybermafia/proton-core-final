import type { Listing, Order } from '../types';

export interface MarketNavigationTarget {
  type?: string;
  orderId?: string;
  listingId?: string;
  conversationId?: string;
  buyerId?: string;
  sellerId?: string;
}

export interface MarketChatThreadLookupItem {
  conversationId: string;
  listingId: string;
  listingTitle?: string;
  sellerId: string;
  sellerName?: string;
  buyerId: string;
  buyerName?: string;
  orderId?: string | null;
}

export type MarketChatUserRole = 'buyer' | 'seller';

export type MarketChatResolutionFailureReason =
  | 'unauthenticated'
  | 'missing_target'
  | 'missing_listing_or_conversation'
  | 'missing_buyer'
  | 'missing_seller'
  | 'seller_conflict'
  | 'buyer_conflict'
  | 'conversation_mismatch'
  | 'self_chat_not_allowed'
  | 'user_not_participant'
  | 'order_mismatch';

export interface ResolveMarketChatNavigationInput {
  target: MarketNavigationTarget | null | undefined;
  currentUserId: string | null | undefined;
  currentUserDisplayName?: string | null;
  fetchedListing?: Listing | null;
  knownListings?: Listing[];
  groupedChats?: MarketChatThreadLookupItem[];
  orders?: Order[];
}

export type ResolveMarketChatNavigationResult =
  | {
      ok: true;
      conversationId: string;
      listingId: string;
      listing: Listing;
      buyerId: string;
      sellerId: string;
      buyerName: string;
      sellerName: string;
      userRole: MarketChatUserRole;
      orderId: string | null;
      matchedOrder: Order | null;
      isDeletedListingFallback: boolean;
    }
  | {
      ok: false;
      reason: MarketChatResolutionFailureReason;
      canRetryWhenChatsLoad: boolean;
      messageEn: string;
      messageKa: string;
    };

export interface MarketChatActiveContextShape {
  conversationId: string;
  listing: Listing;
  buyerId: string;
  sellerId: string;
  orderId?: string | null;
}

export type ActiveChatValidationResult =
  | { ok: true; buyerId: string; sellerId: string; userRole: MarketChatUserRole; conversationId: string }
  | { ok: false; reason: MarketChatResolutionFailureReason; messageEn: string; messageKa: string };

export function cleanChatId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function extractBuyerIdFromConversationId(
  conversationId: string | null | undefined,
  listingId: string | null | undefined
): string {
  const conv = cleanChatId(conversationId);
  const lid = cleanChatId(listingId);
  if (!conv || !lid) return '';
  const prefix = `${lid}_`;
  if (conv.startsWith(prefix) && conv.length > prefix.length) {
    return conv.slice(prefix.length);
  }
  return '';
}

export function extractListingIdFromConversationId(
  conversationId: string | null | undefined,
  buyerId: string | null | undefined
): string {
  const conv = cleanChatId(conversationId);
  const bid = cleanChatId(buyerId);
  if (!conv || !bid) return '';
  const suffix = `_${bid}`;
  if (conv.endsWith(suffix) && conv.length > suffix.length) {
    return conv.slice(0, conv.length - suffix.length);
  }
  return '';
}

function findMatchingListingByPrefix(
  conversationId: string,
  knownListings: Listing[]
): { listing: Listing; buyerId: string } | null {
  if (!conversationId || knownListings.length === 0) return null;
  const matches: Array<{ listing: Listing; buyerId: string }> = [];
  for (const listing of knownListings) {
    const lid = cleanChatId(listing?.id);
    if (!lid) continue;
    const prefix = `${lid}_`;
    if (conversationId.startsWith(prefix) && conversationId.length > prefix.length) {
      matches.push({
        listing,
        buyerId: conversationId.slice(prefix.length),
      });
    }
  }
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    // Prefer longest listing ID if one is a strict prefix of another; fail if ambiguous same-length
    matches.sort((a, b) => b.listing.id.length - a.listing.id.length);
    if (matches[0].listing.id.length > matches[1].listing.id.length) {
      return matches[0];
    }
  }
  return null;
}

export interface NavigationLookupHints {
  lookupListingId: string;
  lookupBuyerId: string;
  lookupConversationId: string;
  lookupOrderId: string;
  matchedChat: MarketChatThreadLookupItem | null;
  matchedOrder: Order | null;
}

export function extractNavigationLookupHints(params: {
  target: MarketNavigationTarget | null | undefined;
  knownListings?: Listing[];
  groupedChats?: MarketChatThreadLookupItem[];
  orders?: Order[];
}): NavigationLookupHints {
  const target = params.target || {};
  const knownListings = params.knownListings || [];
  const groupedChats = params.groupedChats || [];
  const orders = params.orders || [];

  const tOrderId = cleanChatId(target.orderId);
  const tListingId = cleanChatId(target.listingId);
  const tConvId = cleanChatId(target.conversationId);
  const tBuyerId = cleanChatId(target.buyerId);

  const initialConvId =
    tConvId || (tListingId && tBuyerId ? `${tListingId}_${tBuyerId}` : '');

  let matchedChat: MarketChatThreadLookupItem | null = null;
  if (initialConvId) {
    matchedChat = groupedChats.find((c) => c.conversationId === initialConvId) || null;
  }
  if (!matchedChat && tOrderId) {
    const byOrder = groupedChats.filter((c) => cleanChatId(c.orderId) === tOrderId);
    if (byOrder.length === 1) {
      matchedChat = byOrder[0];
    }
  }

  let matchedOrder: Order | null = null;
  const orderIdToFind = tOrderId || cleanChatId(matchedChat?.orderId);
  if (orderIdToFind) {
    matchedOrder = orders.find((o) => o.id === orderIdToFind) || null;
  } else if (initialConvId) {
    const matchingOrders = orders.filter(
      (o) => `${cleanChatId(o.listingId)}_${cleanChatId(o.buyerId)}` === initialConvId
    );
    if (matchingOrders.length === 1) {
      matchedOrder = matchingOrders[0];
    }
  }

  let lookupBuyerId =
    tBuyerId || cleanChatId(matchedChat?.buyerId) || cleanChatId(matchedOrder?.buyerId);
  let lookupListingId =
    tListingId || cleanChatId(matchedChat?.listingId) || cleanChatId(matchedOrder?.listingId);

  if (!lookupListingId && initialConvId && lookupBuyerId) {
    lookupListingId = extractListingIdFromConversationId(initialConvId, lookupBuyerId);
  }
  if (!lookupBuyerId && initialConvId && lookupListingId) {
    lookupBuyerId = extractBuyerIdFromConversationId(initialConvId, lookupListingId);
  }
  if ((!lookupListingId || !lookupBuyerId) && initialConvId) {
    const prefixMatch = findMatchingListingByPrefix(initialConvId, knownListings);
    if (prefixMatch) {
      if (!lookupListingId) lookupListingId = prefixMatch.listing.id;
      if (!lookupBuyerId) lookupBuyerId = prefixMatch.buyerId;
    }
  }

  const lookupConversationId =
    initialConvId ||
    (lookupListingId && lookupBuyerId ? `${lookupListingId}_${lookupBuyerId}` : '');

  return {
    lookupListingId,
    lookupBuyerId,
    lookupConversationId,
    lookupOrderId: tOrderId || cleanChatId(matchedChat?.orderId) || cleanChatId(matchedOrder?.id),
    matchedChat,
    matchedOrder,
  };
}

function failureResult(
  reason: MarketChatResolutionFailureReason,
  canRetryWhenChatsLoad = false
): ResolveMarketChatNavigationResult {
  switch (reason) {
    case 'unauthenticated':
      return {
        ok: false,
        reason,
        canRetryWhenChatsLoad: false,
        messageEn: 'Please sign in to open this conversation.',
        messageKa: 'საუბრის გასახსნელად გთხოვთ გაიაროთ ავტორიზაცია.',
      };
    case 'seller_conflict':
    case 'buyer_conflict':
    case 'conversation_mismatch':
    case 'order_mismatch':
      return {
        ok: false,
        reason,
        canRetryWhenChatsLoad: false,
        messageEn:
          'Conversation participants could not be verified due to conflicting chat data. Sending is disabled.',
        messageKa:
          'საუბრის მონაცემებს შორის შეუსაბამობის გამო მონაწილეების დადგენა ვერ მოხერხდა. გაგზავნა გამორთულია.',
      };
    case 'self_chat_not_allowed':
    case 'user_not_participant':
      return {
        ok: false,
        reason,
        canRetryWhenChatsLoad: false,
        messageEn: 'You do not have a valid participant role for this conversation.',
        messageKa: 'ამ საუბარში თქვენი მონაწილის როლის დადასტურება ვერ მოხერხდა.',
      };
    default:
      return {
        ok: false,
        reason,
        canRetryWhenChatsLoad,
        messageEn: 'Conversation details could not be determined safely. Sending is disabled.',
        messageKa: 'საუბრის მონაცემების უსაფრთხოდ დადგენა ვერ მოხერხდა. გაგზავნა გამორთულია.',
      };
  }
}

export function resolveMarketChatNavigation(
  input: ResolveMarketChatNavigationInput
): ResolveMarketChatNavigationResult {
  const uid = cleanChatId(input.currentUserId);
  if (!uid) {
    return failureResult('unauthenticated');
  }

  if (!input.target) {
    return failureResult('missing_target');
  }

  const knownListings = input.knownListings || [];
  const groupedChats = input.groupedChats || [];
  const orders = input.orders || [];

  const tOrderId = cleanChatId(input.target.orderId);
  const tListingId = cleanChatId(input.target.listingId);
  const tConvId = cleanChatId(input.target.conversationId);
  const tBuyerId = cleanChatId(input.target.buyerId);
  const tSellerId = cleanChatId(input.target.sellerId);

  const hints = extractNavigationLookupHints({
    target: input.target,
    knownListings,
    groupedChats,
    orders,
  });

  const fetchedListing =
    input.fetchedListing && cleanChatId(input.fetchedListing.id)
      ? input.fetchedListing
      : null;

  // Collect listingId candidates without splitting conversationId on '_'
  const listingIdSet = new Set<string>();
  if (tListingId) listingIdSet.add(tListingId);
  if (fetchedListing && (!tListingId || fetchedListing.id === tListingId || !hints.lookupListingId || fetchedListing.id === hints.lookupListingId)) {
    listingIdSet.add(cleanChatId(fetchedListing.id));
  }
  if (hints.matchedChat?.listingId) listingIdSet.add(cleanChatId(hints.matchedChat.listingId));
  if (listingIdSet.size === 0 && hints.matchedOrder?.listingId) {
    listingIdSet.add(cleanChatId(hints.matchedOrder.listingId));
  }
  if (listingIdSet.size === 0 && hints.lookupListingId) {
    listingIdSet.add(hints.lookupListingId);
  }

  if (listingIdSet.size > 1) {
    return failureResult('conversation_mismatch');
  }
  const resolvedListingId = listingIdSet.size === 1 ? Array.from(listingIdSet)[0] : '';
  if (!resolvedListingId) {
    return failureResult('missing_listing_or_conversation');
  }

  // Collect buyerId candidates safely
  const buyerIdSet = new Set<string>();
  if (tBuyerId) buyerIdSet.add(tBuyerId);
  if (hints.matchedChat?.buyerId) buyerIdSet.add(cleanChatId(hints.matchedChat.buyerId));
  if (buyerIdSet.size === 0 && tConvId) {
    const derivedBuyer = extractBuyerIdFromConversationId(tConvId, resolvedListingId);
    if (derivedBuyer) buyerIdSet.add(derivedBuyer);
  }
  if (buyerIdSet.size === 0 && hints.matchedOrder?.buyerId) {
    buyerIdSet.add(cleanChatId(hints.matchedOrder.buyerId));
  }
  if (buyerIdSet.size === 0 && hints.lookupBuyerId) {
    buyerIdSet.add(hints.lookupBuyerId);
  }

  if (buyerIdSet.size > 1) {
    return failureResult('buyer_conflict');
  }
  const resolvedBuyerId = buyerIdSet.size === 1 ? Array.from(buyerIdSet)[0] : '';
  if (!resolvedBuyerId) {
    return failureResult('missing_buyer');
  }

  const canonicalConversationId = `${resolvedListingId}_${resolvedBuyerId}`;
  if (tConvId && tConvId !== canonicalConversationId) {
    return failureResult('conversation_mismatch');
  }

  const exactMatchedChat =
    groupedChats.find((c) => c.conversationId === canonicalConversationId) || null;
  if (hints.matchedChat && hints.matchedChat.conversationId !== canonicalConversationId) {
    return failureResult('conversation_mismatch');
  }

  const resolvedOrderId =
    tOrderId ||
    cleanChatId(exactMatchedChat?.orderId) ||
    cleanChatId(hints.matchedOrder?.id) ||
    null;

  let exactMatchedOrder: Order | null = null;
  if (resolvedOrderId) {
    exactMatchedOrder = orders.find((o) => o.id === resolvedOrderId) || null;
    if (!exactMatchedOrder && hints.matchedOrder?.id === resolvedOrderId) {
      exactMatchedOrder = hints.matchedOrder;
    }
    if (exactMatchedOrder) {
      if (
        cleanChatId(exactMatchedOrder.listingId) !== resolvedListingId ||
        cleanChatId(exactMatchedOrder.buyerId) !== resolvedBuyerId
      ) {
        return failureResult('order_mismatch');
      }
    }
  } else {
    const convOrders = orders.filter(
      (o) =>
        cleanChatId(o.listingId) === resolvedListingId &&
        cleanChatId(o.buyerId) === resolvedBuyerId
    );
    if (convOrders.length === 1) {
      exactMatchedOrder = convOrders[0];
    } else if (convOrders.length > 1) {
      // Check if multiple orders for this buyer+listing disagree on sellerId
      const orderSellers = new Set(convOrders.map((o) => cleanChatId(o.sellerId)).filter(Boolean));
      if (orderSellers.size > 1) {
        return failureResult('seller_conflict');
      }
    }
  }

  // Authoritative listing from Firestore fetch or in-memory catalog
  const authoritativeListing =
    (fetchedListing && fetchedListing.id === resolvedListingId ? fetchedListing : null) ||
    knownListings.find((l) => l.id === resolvedListingId) ||
    null;

  // Priority 1: listings/{listingId}.sellerId
  const listingSellerId = cleanChatId(authoritativeListing?.sellerId);
  // Priority 2: target.sellerId
  const targetSellerId = tSellerId;
  // Priority 3: exact matched groupedChats or order
  const chatSellerId = exactMatchedChat ? cleanChatId(exactMatchedChat.sellerId) : '';
  const orderSellerId = exactMatchedOrder ? cleanChatId(exactMatchedOrder.sellerId) : '';

  const sellerCandidates = [
    listingSellerId,
    targetSellerId,
    chatSellerId,
    orderSellerId,
  ].filter(Boolean);

  const distinctSellerIds = new Set(sellerCandidates);
  if (distinctSellerIds.size > 1) {
    return failureResult('seller_conflict');
  }
  if (distinctSellerIds.size === 0) {
    // Allow retry once when groupedChats finishes loading if listing was deleted & target omitted sellerId
    return failureResult('missing_seller', !exactMatchedChat);
  }

  const resolvedSellerId =
    listingSellerId || targetSellerId || chatSellerId || orderSellerId;

  if (resolvedBuyerId === resolvedSellerId) {
    return failureResult('self_chat_not_allowed');
  }

  const isSeller = uid === resolvedSellerId;
  const isBuyer = uid === resolvedBuyerId;
  if (!isSeller && !isBuyer) {
    return failureResult('user_not_participant');
  }

  const userRole: MarketChatUserRole = isSeller ? 'seller' : 'buyer';
  const isDeletedListingFallback = !authoritativeListing;

  const resolvedSellerName =
    cleanChatId(authoritativeListing?.sellerName) ||
    cleanChatId(exactMatchedChat?.sellerName) ||
    cleanChatId((exactMatchedOrder as any)?.sellerName) ||
    (isSeller ? cleanChatId(input.currentUserDisplayName) : '') ||
    'Seller';

  const resolvedBuyerName =
    cleanChatId(exactMatchedChat?.buyerName) ||
    cleanChatId(exactMatchedOrder?.buyerName) ||
    cleanChatId(exactMatchedOrder?.shippingDetails?.recipientName) ||
    (isBuyer ? cleanChatId(input.currentUserDisplayName) : '') ||
    'Buyer';

  const finalListing: Listing =
    authoritativeListing ||
    ({
      id: resolvedListingId,
      title:
        cleanChatId(exactMatchedChat?.listingTitle) ||
        cleanChatId(exactMatchedOrder?.itemTitle) ||
        'Marketplace Item',
      description: '',
      price: exactMatchedOrder?.amount || 0,
      currency: exactMatchedOrder?.currency || 'USD',
      sellerId: resolvedSellerId,
      sellerName: resolvedSellerName,
      category: 'General',
      country: '',
      city: '',
      location: '',
      createdAt: Date.now(),
      condition: 'new',
      isNegotiable: false,
      status: 'active',
    } as Listing);

  return {
    ok: true,
    conversationId: canonicalConversationId,
    listingId: resolvedListingId,
    listing: finalListing,
    buyerId: resolvedBuyerId,
    sellerId: resolvedSellerId,
    buyerName: resolvedBuyerName,
    sellerName: resolvedSellerName,
    userRole,
    orderId: resolvedOrderId,
    matchedOrder: exactMatchedOrder,
    isDeletedListingFallback,
  };
}

export function validateActiveChatContext(params: {
  context: MarketChatActiveContextShape | null | undefined;
  listing: Listing | null | undefined;
  order?: Order | null;
  currentUserId: string | null | undefined;
}): ActiveChatValidationResult {
  const uid = cleanChatId(params.currentUserId);
  if (!uid) {
    return {
      ok: false,
      reason: 'unauthenticated',
      messageEn: 'Please sign in to send messages.',
      messageKa: 'შეტყობინების გასაგზავნად გთხოვთ გაიაროთ ავტორიზაცია.',
    };
  }

  const ctx = params.context;
  const listingId = cleanChatId(ctx?.listing?.id || params.listing?.id);
  const buyerId = cleanChatId(ctx?.buyerId);
  const sellerId = cleanChatId(ctx?.sellerId);

  if (!ctx || !listingId) {
    return {
      ok: false,
      reason: 'missing_listing_or_conversation',
      messageEn: 'Conversation details could not be determined.',
      messageKa: 'საუბრის მონაცემების დადგენა ვერ მოხერხდა.',
    };
  }

  if (!buyerId || !sellerId) {
    return {
      ok: false,
      reason: !sellerId ? 'missing_seller' : 'missing_buyer',
      messageEn: 'Conversation participants could not be determined.',
      messageKa: 'საუბრის მონაწილეების დადგენა ვერ მოხერხდა.',
    };
  }

  if (buyerId === sellerId) {
    return {
      ok: false,
      reason: 'self_chat_not_allowed',
      messageEn: 'Cannot send a message to yourself.',
      messageKa: 'საკუთარ თავთან შეტყობინების გაგზავნა შეუძლებელია.',
    };
  }

  const ctxListingSeller = cleanChatId(ctx.listing?.sellerId);
  const activeListingSeller = cleanChatId(params.listing?.sellerId);
  if (
    (ctxListingSeller && ctxListingSeller !== sellerId) ||
    (activeListingSeller && activeListingSeller !== sellerId)
  ) {
    return {
      ok: false,
      reason: 'seller_conflict',
      messageEn: 'Seller identity mismatch detected. Sending is disabled.',
      messageKa: 'გამყიდველის იდენტიფიკატორის შეუსაბამობა დაფიქსირდა. გაგზავნა გამორთულია.',
    };
  }

  const canonicalConvId = `${listingId}_${buyerId}`;
  if (cleanChatId(ctx.conversationId) !== canonicalConvId) {
    return {
      ok: false,
      reason: 'conversation_mismatch',
      messageEn: 'Conversation identifier mismatch detected.',
      messageKa: 'საუბრის იდენტიფიკატორის შეუსაბამობა დაფიქსირდა.',
    };
  }

  if (params.order) {
    const oBuyer = cleanChatId(params.order.buyerId);
    const oSeller = cleanChatId(params.order.sellerId);
    const oListing = cleanChatId(params.order.listingId);
    if (
      (oBuyer && oBuyer !== buyerId) ||
      (oSeller && oSeller !== sellerId) ||
      (oListing && oListing !== listingId)
    ) {
      return {
        ok: false,
        reason: 'order_mismatch',
        messageEn: 'Order participant mismatch detected.',
        messageKa: 'შეკვეთის მონაწილეების შეუსაბამობა დაფიქსირდა.',
      };
    }
  }

  if (uid !== buyerId && uid !== sellerId) {
    return {
      ok: false,
      reason: 'user_not_participant',
      messageEn: 'You are not a verified participant in this conversation.',
      messageKa: 'თქვენ არ ხართ ამ საუბრის დადასტურებული მონაწილე.',
    };
  }

  return {
    ok: true,
    buyerId,
    sellerId,
    userRole: uid === sellerId ? 'seller' : 'buyer',
    conversationId: canonicalConvId,
  };
}
