import { pathToFileURL } from 'node:url';
import {
  compareMessageOrder,
  extractTimestampMs,
  type MarketConversationDocument,
} from '../functions/src/index';

export interface LegacyMarketMessageRecord {
  id: string;
  conversationId?: unknown;
  listingId?: unknown;
  listingTitle?: unknown;
  orderId?: unknown;
  buyerId?: unknown;
  sellerId?: unknown;
  senderId?: unknown;
  senderName?: unknown;
  buyerName?: unknown;
  sellerName?: unknown;
  participants?: unknown;
  text?: unknown;
  createdAt?: unknown;
}

export interface LegacyListingInfo {
  id: string;
  sellerId?: string;
  sellerName?: string;
  title?: string;
}

export interface BackfillPlanInput {
  messages: LegacyMarketMessageRecord[];
  existingConversationIds?: Iterable<string>;
  listingsById?: Map<string, LegacyListingInfo>;
  nowMs?: number;
}

export interface PlannedProcessedMessageMarker {
  conversationId: string;
  messageId: string;
  data: {
    messageId: string;
    conversationId: string;
    senderId: string;
    recipientId: string;
    createdAt: number;
    processedAt: number;
    backfilled: true;
  };
}

export interface SkippedLegacyMessage {
  messageId: string;
  reason: string;
}

export interface BackfillPlanResult {
  dryRunOnly: true;
  scannedMessages: number;
  eligibleMessages: number;
  skippedMessages: SkippedLegacyMessage[];
  skippedExistingConversations: string[];
  plannedConversations: MarketConversationDocument[];
  plannedProcessedMarkers: PlannedProcessedMessageMarker[];
}

function cleanStr(val: unknown): string {
  return typeof val === 'string' ? val.trim() : '';
}

function clipPreview(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 500 ? `${trimmed.slice(0, 497)}...` : trimmed;
}

/**
 * Pure dry-run planner for reconstructing `market_conversations/{conversationId}`
 * and `processed_messages/{messageId}` from historical `market_messages`.
 *
 * Guarantees:
 * - Zero mutations / zero writes (pure computation only).
 * - Preserves historical `buyerUnreadCount = 0` & `sellerUnreadCount = 0` so old chats
 *   do not flood users with phantom unread counters.
 * - Uses explicit `listingId` + `buyerId` fields (never naive `split('_')[0]`), supporting
 *   underscores inside `listingId` or `buyerId`.
 * - Never overwrites conversations already present in `existingConversationIds`.
 */
export function planMarketConversationsBackfill({
  messages,
  existingConversationIds = [],
  listingsById,
  nowMs = Date.now(),
}: BackfillPlanInput): BackfillPlanResult {
  const existingSet = new Set(existingConversationIds);
  const skippedMessages: SkippedLegacyMessage[] = [];
  const skippedExistingConvSet = new Set<string>();

  type ValidatedMsg = {
    id: string;
    conversationId: string;
    listingId: string;
    listingTitle: string;
    orderId: string | null;
    buyerId: string;
    sellerId: string;
    senderId: string;
    recipientId: string;
    senderName: string;
    buyerName: string;
    sellerName: string;
    text: string;
    createdAtMs: number;
  };

  const grouped = new Map<string, ValidatedMsg[]>();
  let eligibleMessages = 0;

  for (const raw of messages) {
    const messageId = cleanStr(raw?.id);
    if (!messageId) {
      skippedMessages.push({ messageId: '(missing)', reason: 'missing_message_id' });
      continue;
    }

    const listingId = cleanStr(raw.listingId);
    const buyerId = cleanStr(raw.buyerId);
    const sellerId = cleanStr(raw.sellerId);
    const senderId = cleanStr(raw.senderId);

    if (!listingId || !buyerId || !sellerId || !senderId) {
      skippedMessages.push({ messageId, reason: 'missing_required_fields' });
      continue;
    }

    if (buyerId === sellerId) {
      skippedMessages.push({ messageId, reason: 'self_chat_forbidden' });
      continue;
    }

    if (senderId !== buyerId && senderId !== sellerId) {
      skippedMessages.push({ messageId, reason: 'sender_not_participant' });
      continue;
    }

    const canonicalConversationId = `${listingId}_${buyerId}`;
    const rawConvId = cleanStr(raw.conversationId);
    if (rawConvId && rawConvId !== canonicalConversationId) {
      skippedMessages.push({ messageId, reason: 'conversation_id_mismatch' });
      continue;
    }

    if (Array.isArray(raw.participants)) {
      const pSet = new Set(raw.participants.map(cleanStr).filter(Boolean));
      if (pSet.size !== 2 || !pSet.has(buyerId) || !pSet.has(sellerId)) {
        skippedMessages.push({ messageId, reason: 'participants_mismatch' });
        continue;
      }
    }

    const listingInfo = listingsById?.get(listingId);
    if (listingsById) {
      if (!listingInfo) {
        skippedMessages.push({ messageId, reason: 'listing_not_found' });
        continue;
      }
      const authSeller = cleanStr(listingInfo.sellerId);
      if (authSeller && authSeller !== sellerId) {
        skippedMessages.push({ messageId, reason: 'seller_mismatch' });
        continue;
      }
    }

    if (existingSet.has(canonicalConversationId)) {
      skippedExistingConvSet.add(canonicalConversationId);
      continue;
    }

    const createdAtMs = extractTimestampMs(raw.createdAt);
    if (createdAtMs === null) {
      skippedMessages.push({ messageId, reason: 'missing_created_at' });
      continue;
    }

    const isBuyerSending = senderId === buyerId;
    const recipientId = isBuyerSending ? sellerId : buyerId;

    const validated: ValidatedMsg = {
      id: messageId,
      conversationId: canonicalConversationId,
      listingId,
      listingTitle: cleanStr(raw.listingTitle) || cleanStr(listingInfo?.title) || 'Marketplace Item',
      orderId: cleanStr(raw.orderId) || null,
      buyerId,
      sellerId,
      senderId,
      recipientId,
      senderName: cleanStr(raw.senderName),
      buyerName: cleanStr(raw.buyerName),
      sellerName: cleanStr(raw.sellerName) || cleanStr(listingInfo?.sellerName),
      text: typeof raw.text === 'string' ? raw.text : '',
      createdAtMs,
    };

    const bucket = grouped.get(canonicalConversationId) || [];
    bucket.push(validated);
    grouped.set(canonicalConversationId, bucket);
    eligibleMessages += 1;
  }

  const plannedConversations: MarketConversationDocument[] = [];
  const plannedProcessedMarkers: PlannedProcessedMessageMarker[] = [];

  for (const [conversationId, bucket] of grouped.entries()) {
    bucket.sort((a, b) => compareMessageOrder(a.createdAtMs, a.id, b.createdAtMs, b.id));

    const latest = bucket[bucket.length - 1];
    let resolvedBuyerName = 'Buyer';
    let resolvedSellerName = 'Seller';
    let resolvedOrderId: string | null = null;
    let resolvedTitle = 'Marketplace Item';

    for (const msg of bucket) {
      if (msg.senderId === msg.buyerId && msg.senderName) {
        resolvedBuyerName = msg.senderName;
      } else if (msg.buyerName) {
        resolvedBuyerName = msg.buyerName;
      }

      if (msg.senderId === msg.sellerId && msg.senderName) {
        resolvedSellerName = msg.senderName;
      } else if (msg.sellerName) {
        resolvedSellerName = msg.sellerName;
      }

      if (msg.orderId) {
        resolvedOrderId = msg.orderId;
      }
      if (msg.listingTitle) {
        resolvedTitle = msg.listingTitle;
      }

      plannedProcessedMarkers.push({
        conversationId,
        messageId: msg.id,
        data: {
          messageId: msg.id,
          conversationId,
          senderId: msg.senderId,
          recipientId: msg.recipientId,
          createdAt: msg.createdAtMs,
          processedAt: nowMs,
          backfilled: true,
        },
      });
    }

    plannedConversations.push({
      conversationId,
      listingId: latest.listingId,
      listingTitle: resolvedTitle,
      orderId: resolvedOrderId,
      buyerId: latest.buyerId,
      sellerId: latest.sellerId,
      buyerName: resolvedBuyerName,
      sellerName: resolvedSellerName,
      participants: [latest.buyerId, latest.sellerId],
      lastMessageId: latest.id,
      lastMessageText: clipPreview(latest.text),
      lastMessageAt: latest.createdAtMs,
      lastSenderId: latest.senderId,
      // Safe default: historical threads start at 0 unread so users aren't flooded
      buyerUnreadCount: 0,
      sellerUnreadCount: 0,
      buyerLastReadAt: latest.createdAtMs,
      sellerLastReadAt: latest.createdAtMs,
      buyerLastReadMessageId: latest.id,
      sellerLastReadMessageId: latest.id,
      updatedAt: nowMs,
    });
  }

  plannedConversations.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));

  return {
    dryRunOnly: true,
    scannedMessages: messages.length,
    eligibleMessages,
    skippedMessages,
    skippedExistingConversations: Array.from(skippedExistingConvSet).sort(),
    plannedConversations,
    plannedProcessedMarkers,
  };
}

function runDryRunCli(): void {
  const sampleMessages: LegacyMarketMessageRecord[] = [
    {
      id: 'msg_hist_1',
      conversationId: 'lst_cnc_01_buyer_alice',
      listingId: 'lst_cnc_01',
      listingTitle: 'CNC Milling Kit',
      buyerId: 'buyer_alice',
      sellerId: 'seller_bob',
      senderId: 'buyer_alice',
      senderName: 'Alice',
      participants: ['buyer_alice', 'seller_bob'],
      text: 'Is this still in stock?',
      createdAt: 1700000001000,
    },
    {
      id: 'msg_hist_2',
      conversationId: 'lst_cnc_01_buyer_alice',
      listingId: 'lst_cnc_01',
      listingTitle: 'CNC Milling Kit',
      buyerId: 'buyer_alice',
      sellerId: 'seller_bob',
      senderId: 'seller_bob',
      senderName: 'Bob Studio',
      participants: ['buyer_alice', 'seller_bob'],
      text: 'Yes, ships tomorrow.',
      createdAt: 1700000002000,
    },
  ];

  const plan = planMarketConversationsBackfill({
    messages: sampleMessages,
    existingConversationIds: [],
  });

  console.log('[DRY-RUN ONLY] market_conversations backfill planner summary (ZERO Firestore writes):');
  console.log(
    JSON.stringify(
      {
        dryRunOnly: plan.dryRunOnly,
        scannedMessages: plan.scannedMessages,
        eligibleMessages: plan.eligibleMessages,
        plannedConversationsCount: plan.plannedConversations.length,
        plannedProcessedMarkersCount: plan.plannedProcessedMarkers.length,
        skippedExistingCount: plan.skippedExistingConversations.length,
        skippedMessagesCount: plan.skippedMessages.length,
        previewConversation: plan.plannedConversations[0] ?? null,
      },
      null,
      2
    )
  );
}

const isDirectEntry =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectEntry) {
  runDryRunCli();
}
