import type { Listing } from '../types';
import type { ChatThreadSummary } from '../components/market-hub/chat/ChatThreadList';
import { cleanChatId } from './marketChatNavigation';

export interface MarketConversationRecord {
  conversationId: string;
  listingId: string;
  listingTitle: string;
  orderId?: string | null;
  buyerId: string;
  sellerId: string;
  buyerName: string;
  sellerName: string;
  participants: string[];
  lastMessageId?: string | null;
  lastMessageText?: string;
  lastMessageAt?: unknown;
  lastSenderId?: string | null;
  buyerUnreadCount: number;
  sellerUnreadCount: number;
  buyerLastReadAt?: number | null;
  sellerLastReadAt?: number | null;
  buyerLastReadMessageId?: string | null;
  sellerLastReadMessageId?: string | null;
  updatedAt?: number;
}

export interface MarketChatUnreadSnapshot {
  conversations: MarketConversationRecord[];
  conversationsById: Record<string, MarketConversationRecord>;
  unreadByConversationId: Record<string, number>;
  totalUnreadCount: number;
}

export interface MarketChatUnreadState extends MarketChatUnreadSnapshot {
  currentUserId: string | null;
  loading: boolean;
  error: string | null;
}

export const INITIAL_MARKET_CHAT_UNREAD_STATE: MarketChatUnreadState = {
  currentUserId: null,
  loading: false,
  conversations: [],
  conversationsById: {},
  unreadByConversationId: {},
  totalUnreadCount: 0,
  error: null,
};

export function parseUnreadTimestampMs(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (!val) return 0;
  if (val instanceof Date) {
    const ms = val.getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, any>;
    if (typeof obj.toMillis === 'function') {
      const ms = obj.toMillis();
      return typeof ms === 'number' && Number.isFinite(ms) ? ms : 0;
    }
    if (typeof obj.seconds === 'number') {
      const nanos = typeof obj.nanoseconds === 'number' ? obj.nanoseconds : 0;
      return obj.seconds * 1000 + Math.floor(nanos / 1e6);
    }
    if (typeof obj._seconds === 'number') {
      const nanos = typeof obj._nanoseconds === 'number' ? obj._nanoseconds : 0;
      return obj._seconds * 1000 + Math.floor(nanos / 1e6);
    }
  }
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function sanitizeNonNegativeInt(val: unknown): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return 0;
  return Math.max(0, Math.floor(val));
}

/**
 * Resolves the authoritative unread count for `currentUserId` on a single `market_conversations` document.
 * Returns `null` when the document does not belong to `currentUserId` or fails participant integrity checks.
 */
export function getConversationUnreadForUser(
  conv: Partial<MarketConversationRecord> | null | undefined,
  currentUserId: string | null | undefined
): number | null {
  const uid = cleanChatId(currentUserId);
  if (!uid || !conv) return null;

  const buyerId = cleanChatId(conv.buyerId);
  const sellerId = cleanChatId(conv.sellerId);
  const convId = cleanChatId(conv.conversationId);

  if (!convId || !buyerId || !sellerId || buyerId === sellerId) {
    return null;
  }

  if (uid !== buyerId && uid !== sellerId) {
    return null;
  }

  if (Array.isArray(conv.participants)) {
    const cleanParticipants = conv.participants.map(cleanChatId).filter(Boolean);
    if (!cleanParticipants.includes(uid)) {
      return null;
    }
  }

  if (uid === buyerId) {
    return sanitizeNonNegativeInt(conv.buyerUnreadCount);
  }
  return sanitizeNonNegativeInt(conv.sellerUnreadCount);
}

/**
 * Builds the deduplicated unread snapshot for the active user from raw `market_conversations` docs.
 * Excludes non-participant docs, malformed docs, and deduplicates by `conversationId`.
 */
export function buildMarketChatUnreadSnapshot(
  rawDocs: Array<Partial<MarketConversationRecord> & { id?: string }>,
  currentUserId: string | null | undefined
): MarketChatUnreadSnapshot {
  const uid = cleanChatId(currentUserId);
  if (!uid) {
    return {
      conversations: [],
      conversationsById: {},
      unreadByConversationId: {},
      totalUnreadCount: 0,
    };
  }

  const dedupedMap = new Map<string, MarketConversationRecord>();

  for (const raw of rawDocs) {
    if (!raw || typeof raw !== 'object') continue;
    const convId = cleanChatId(raw.conversationId || raw.id);
    const listingId = cleanChatId(raw.listingId);
    const buyerId = cleanChatId(raw.buyerId);
    const sellerId = cleanChatId(raw.sellerId);

    const normalized: MarketConversationRecord = {
      conversationId: convId,
      listingId,
      listingTitle: cleanChatId(raw.listingTitle) || 'Marketplace Item',
      orderId: cleanChatId(raw.orderId) || null,
      buyerId,
      sellerId,
      buyerName: cleanChatId(raw.buyerName) || 'Buyer',
      sellerName: cleanChatId(raw.sellerName) || 'Seller',
      participants: Array.isArray(raw.participants)
        ? raw.participants.map(cleanChatId).filter(Boolean)
        : buyerId && sellerId
        ? [buyerId, sellerId]
        : [],
      lastMessageId: cleanChatId(raw.lastMessageId) || null,
      lastMessageText: typeof raw.lastMessageText === 'string' ? raw.lastMessageText : '',
      lastMessageAt: raw.lastMessageAt ?? null,
      lastSenderId: cleanChatId(raw.lastSenderId) || null,
      buyerUnreadCount: sanitizeNonNegativeInt(raw.buyerUnreadCount),
      sellerUnreadCount: sanitizeNonNegativeInt(raw.sellerUnreadCount),
      buyerLastReadAt: typeof raw.buyerLastReadAt === 'number' ? raw.buyerLastReadAt : null,
      sellerLastReadAt: typeof raw.sellerLastReadAt === 'number' ? raw.sellerLastReadAt : null,
      buyerLastReadMessageId: cleanChatId(raw.buyerLastReadMessageId) || null,
      sellerLastReadMessageId: cleanChatId(raw.sellerLastReadMessageId) || null,
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : undefined,
    };

    if (getConversationUnreadForUser(normalized, uid) === null) {
      continue;
    }

    const prev = dedupedMap.get(convId);
    if (!prev) {
      dedupedMap.set(convId, normalized);
    } else {
      const prevTs = Math.max(prev.updatedAt ?? 0, parseUnreadTimestampMs(prev.lastMessageAt));
      const nextTs = Math.max(normalized.updatedAt ?? 0, parseUnreadTimestampMs(normalized.lastMessageAt));
      if (nextTs >= prevTs) {
        dedupedMap.set(convId, normalized);
      }
    }
  }

  const conversations = Array.from(dedupedMap.values()).sort(
    (a, b) => parseUnreadTimestampMs(b.lastMessageAt) - parseUnreadTimestampMs(a.lastMessageAt)
  );

  const conversationsById: Record<string, MarketConversationRecord> = {};
  const unreadByConversationId: Record<string, number> = {};
  let totalUnreadCount = 0;

  for (const conv of conversations) {
    const unread = getConversationUnreadForUser(conv, uid) ?? 0;
    conversationsById[conv.conversationId] = conv;
    unreadByConversationId[conv.conversationId] = unread;
    totalUnreadCount += unread;
  }

  return {
    conversations,
    conversationsById,
    unreadByConversationId,
    totalUnreadCount,
  };
}

export function formatUnreadBadgeCount(count: number): string | null {
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) {
    return null;
  }
  const normalized = Math.floor(count);
  if (normalized > 99) return '99+';
  return String(normalized);
}

export interface LegacyGroupedChatInput {
  conversationId: string;
  listingId: string;
  listingTitle: string;
  sellerId: string;
  sellerName: string;
  buyerId: string;
  buyerName: string;
  orderId?: string | null;
  lastMessage: string;
  lastTime: unknown;
  lastTimeMillis?: number;
  messages?: Array<{ senderId?: string; orderId?: string }>;
}

/**
 * Merges server-authoritative `market_conversations` with legacy `groupedChats`
 * so older chats lacking a `market_conversations` document remain visible with `unreadCount = 0`
 * and never vanish or lose access.
 */
export function mergeConversationThreadsWithLegacy(params: {
  serverConversations: MarketConversationRecord[];
  legacyThreads: LegacyGroupedChatInput[];
  listings?: Listing[];
  currentUserId: string | null | undefined;
}): ChatThreadSummary[] {
  const uid = cleanChatId(params.currentUserId);
  if (!uid) return [];

  const listings = params.listings || [];
  const listingById = new Map<string, Listing>();
  for (const l of listings) {
    if (l?.id) listingById.set(l.id, l);
  }

  const legacyById = new Map<string, LegacyGroupedChatInput>();
  for (const legacy of params.legacyThreads) {
    const convId = cleanChatId(legacy?.conversationId);
    if (!convId) continue;
    legacyById.set(convId, legacy);
  }

  const mergedById = new Map<string, { thread: ChatThreadSummary; sortMs: number }>();

  // 1. Server conversations take precedence for authoritative unread counts and latest preview
  for (const conv of params.serverConversations) {
    const unreadCount = getConversationUnreadForUser(conv, uid);
    if (unreadCount === null) continue;

    const legacy = legacyById.get(conv.conversationId);
    const relListing = listingById.get(conv.listingId);
    const lastMs = parseUnreadTimestampMs(conv.lastMessageAt);
    const legacyLastMsg = legacy?.messages?.[legacy.messages.length - 1];

    mergedById.set(conv.conversationId, {
      sortMs: Math.max(lastMs, legacy?.lastTimeMillis ?? 0),
      thread: {
        conversationId: conv.conversationId,
        listingId: conv.listingId,
        listingTitle: relListing?.title || conv.listingTitle || legacy?.listingTitle || 'Marketplace Item',
        titleGe: relListing?.titleGe,
        titleEn: relListing?.titleEn,
        primaryLanguage: relListing?.primaryLanguage,
        sellerId: conv.sellerId,
        sellerName: relListing?.sellerName || conv.sellerName || legacy?.sellerName || 'Seller',
        buyerId: conv.buyerId,
        buyerName: conv.buyerName || legacy?.buyerName || 'Buyer',
        orderId: conv.orderId || legacy?.orderId || null,
        lastMessage: conv.lastMessageText || legacy?.lastMessage || '',
        lastTime: conv.lastMessageAt ?? legacy?.lastTime ?? null,
        lastSenderId: conv.lastSenderId || legacyLastMsg?.senderId || undefined,
        unreadCount,
        hasServerConversation: true,
      },
    });
  }

  // 2. Preserve legacy groupedChats that do not yet have a `market_conversations` document (unreadCount = 0)
  for (const legacy of params.legacyThreads) {
    const convId = cleanChatId(legacy?.conversationId);
    if (!convId || mergedById.has(convId)) continue;

    const buyerId = cleanChatId(legacy.buyerId);
    const sellerId = cleanChatId(legacy.sellerId);
    if (!buyerId || !sellerId || buyerId === sellerId) continue;
    if (uid !== buyerId && uid !== sellerId) continue;

    const relListing = listingById.get(legacy.listingId);
    const lastMsg = legacy.messages?.[legacy.messages.length - 1];
    const sortMs = legacy.lastTimeMillis ?? parseUnreadTimestampMs(legacy.lastTime);

    mergedById.set(convId, {
      sortMs,
      thread: {
        conversationId: convId,
        listingId: legacy.listingId,
        listingTitle: relListing?.title || legacy.listingTitle || 'Marketplace Item',
        titleGe: relListing?.titleGe,
        titleEn: relListing?.titleEn,
        primaryLanguage: relListing?.primaryLanguage,
        sellerId,
        sellerName: relListing?.sellerName || legacy.sellerName || 'Seller',
        buyerId,
        buyerName: legacy.buyerName || 'Buyer',
        orderId: legacy.orderId || null,
        lastMessage: legacy.lastMessage || '',
        lastTime: legacy.lastTime ?? null,
        lastSenderId: lastMsg?.senderId,
        unreadCount: 0,
        hasServerConversation: false,
      },
    });
  }

  return Array.from(mergedById.values())
    .sort((a, b) => b.sortMs - a.sortMs)
    .map((item) => item.thread);
}

export interface UnreadSubscriptionCallbacks {
  onState: (state: MarketChatUnreadState) => void;
}

export type UnreadSubscribeFn = (
  uid: string,
  onDocs: (docs: Array<Partial<MarketConversationRecord> & { id?: string }>) => void,
  onError: (err: unknown) => void
) => () => void;

/**
 * Pure lifecycle coordinator for global `market_conversations` subscriptions.
 * Guarantees immediate state wipe and stale-listener suppression on logout/UID switching.
 */
export function createMarketConversationsSubscriptionCoordinator(
  subscribeFn: UnreadSubscribeFn,
  onStateChange: (state: MarketChatUnreadState) => void
) {
  let activeUid: string | null = null;
  let generation = 0;
  let unsubscribeCurrent: (() => void) | null = null;

  const setUser = (nextUid: string | null | undefined) => {
    const cleanUid = cleanChatId(nextUid) || null;
    if (cleanUid === activeUid && unsubscribeCurrent) {
      return;
    }

    generation += 1;
    const myGen = generation;

    if (unsubscribeCurrent) {
      try {
        unsubscribeCurrent();
      } catch {}
      unsubscribeCurrent = null;
    }

    activeUid = cleanUid;

    if (!cleanUid) {
      onStateChange({ ...INITIAL_MARKET_CHAT_UNREAD_STATE });
      return;
    }

    // Immediate clean reset before new UID snapshots arrive
    onStateChange({
      ...INITIAL_MARKET_CHAT_UNREAD_STATE,
      currentUserId: cleanUid,
      loading: true,
    });

    unsubscribeCurrent = subscribeFn(
      cleanUid,
      (docs) => {
        if (myGen !== generation || activeUid !== cleanUid) return;
        const snapshot = buildMarketChatUnreadSnapshot(docs, cleanUid);
        onStateChange({
          currentUserId: cleanUid,
          loading: false,
          ...snapshot,
          error: null,
        });
      },
      (err) => {
        if (myGen !== generation || activeUid !== cleanUid) return;
        const message = err instanceof Error ? err.message : 'Failed to sync unread conversations';
        onStateChange({
          ...INITIAL_MARKET_CHAT_UNREAD_STATE,
          currentUserId: cleanUid,
          loading: false,
          error: message,
        });
      }
    );
  };

  const dispose = () => {
    generation += 1;
    activeUid = null;
    if (unsubscribeCurrent) {
      try {
        unsubscribeCurrent();
      } catch {}
      unsubscribeCurrent = null;
    }
    onStateChange({ ...INITIAL_MARKET_CHAT_UNREAD_STATE });
  };

  return { setUser, dispose };
}

export interface MarkConversationReadEvaluationInput {
  isActive: boolean;
  currentUserId: string | null | undefined;
  buyerId: string | null | undefined;
  sellerId: string | null | undefined;
  conversationId: string | null | undefined;
  documentVisibilityState: string | null | undefined;
  isLastMessageVisible: boolean;
  lastVisibleMessageId: string | null | undefined;
  hasServerConversation: boolean;
  unreadCount: number;
}

export interface ConversationReadControllerOptions {
  debounceMs?: number;
  markReadFn: (params: { conversationId: string; lastVisibleMessageId: string }) => Promise<unknown>;
  onError?: (error: unknown, params: { conversationId: string; lastVisibleMessageId: string }) => void;
}

/**
 * Pure debounced/deduplicated controller for triggering `markMarketConversationRead`.
 * - Enforces all 5 visibility + participant + active chat + server-unread preconditions.
 * - Never sends duplicate requests for the same `(uid, conversationId, lastVisibleMessageId)` across re-renders.
 * - Allows safe retries if a callable invocation fails or a new unread message arrives later.
 */
export function createConversationReadController(options: ConversationReadControllerOptions) {
  const debounceMs = typeof options.debounceMs === 'number' && options.debounceMs >= 0 ? options.debounceMs : 150;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingKey: string | null = null;
  let trackedUid: string | null = null;
  const inFlightKeys = new Set<string>();
  const completedKeys = new Set<string>();

  const cancelPending = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pendingKey = null;
  };

  const resetForUser = (uid: string | null | undefined) => {
    cancelPending();
    inFlightKeys.clear();
    completedKeys.clear();
    trackedUid = cleanChatId(uid) || null;
  };

  const evaluate = (input: MarkConversationReadEvaluationInput): { scheduled: boolean; reason: string } => {
    const uid = cleanChatId(input.currentUserId);
    if (uid !== (trackedUid || '')) {
      resetForUser(uid);
    }

    if (!input.isActive) {
      cancelPending();
      return { scheduled: false, reason: 'inactive_chat' };
    }

    const convId = cleanChatId(input.conversationId);
    const buyerId = cleanChatId(input.buyerId);
    const sellerId = cleanChatId(input.sellerId);
    const msgId = cleanChatId(input.lastVisibleMessageId);

    if (!uid || !convId || !buyerId || !sellerId || buyerId === sellerId) {
      cancelPending();
      return { scheduled: false, reason: 'invalid_participants' };
    }

    if (uid !== buyerId && uid !== sellerId) {
      cancelPending();
      return { scheduled: false, reason: 'not_participant' };
    }

    if (input.documentVisibilityState !== 'visible') {
      cancelPending();
      return { scheduled: false, reason: 'document_hidden' };
    }

    if (!msgId || !input.isLastMessageVisible) {
      cancelPending();
      return { scheduled: false, reason: 'last_message_not_visible' };
    }

    if (!input.hasServerConversation) {
      cancelPending();
      return { scheduled: false, reason: 'no_server_conversation' };
    }

    if (!Number.isFinite(input.unreadCount) || input.unreadCount <= 0) {
      cancelPending();
      return { scheduled: false, reason: 'nothing_unread' };
    }

    const key = `${uid}:${convId}:${msgId}`;
    if (completedKeys.has(key) || inFlightKeys.has(key) || pendingKey === key) {
      return { scheduled: false, reason: 'already_processed_or_pending' };
    }

    cancelPending();
    pendingKey = key;

    const execute = async () => {
      timer = null;
      pendingKey = null;
      if (uid !== trackedUid) return;
      inFlightKeys.add(key);
      try {
        await options.markReadFn({
          conversationId: convId,
          lastVisibleMessageId: msgId,
        });
        if (uid === trackedUid) {
          completedKeys.add(key);
        }
      } catch (err) {
        options.onError?.(err, { conversationId: convId, lastVisibleMessageId: msgId });
      } finally {
        inFlightKeys.delete(key);
      }
    };

    if (debounceMs === 0) {
      void execute();
    } else {
      timer = setTimeout(() => {
        void execute();
      }, debounceMs);
    }

    return { scheduled: true, reason: 'scheduled' };
  };

  return {
    evaluate,
    cancelPending,
    resetForUser,
    dispose: () => resetForUser(null),
  };
}
