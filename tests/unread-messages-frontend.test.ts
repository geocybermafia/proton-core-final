import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildMarketChatUnreadSnapshot,
  createConversationReadController,
  createMarketConversationsSubscriptionCoordinator,
  formatUnreadBadgeCount,
  getConversationUnreadForUser,
  MarketChatUnreadState,
  MarketConversationRecord,
  mergeConversationThreadsWithLegacy,
} from '../src/lib/marketChatUnread.js';
import {
  resolveMarketChatNavigation,
  validateActiveChatContext,
} from '../src/lib/marketChatNavigation.js';
import {
  processMarkMarketConversationRead,
  processMarketMessageConversationUpdate,
} from '../functions/src/index';

// ============================================================================
// NOTE: Uses in-memory FakeFirestore / mock subscription doubles & source checks.
// Firebase Emulator and Live Firestore are NOT tested in this file.
// ============================================================================

function makeConvDoc(
  overrides: Partial<MarketConversationRecord> = {}
): MarketConversationRecord {
  const listingId = overrides.listingId || 'lst_cnc_01';
  const buyerId = overrides.buyerId || 'buyer_alice';
  const sellerId = overrides.sellerId || 'seller_bob';
  return {
    conversationId: overrides.conversationId || `${listingId}_${buyerId}`,
    listingId,
    listingTitle: 'CNC Spindle Kit',
    orderId: null,
    buyerId,
    sellerId,
    buyerName: 'Alice',
    sellerName: 'Bob Studio',
    participants: [buyerId, sellerId],
    lastMessageId: 'msg_1',
    lastMessageText: 'Hello',
    lastMessageAt: 1700000001000,
    lastSenderId: buyerId,
    buyerUnreadCount: 0,
    sellerUnreadCount: 0,
    buyerLastReadAt: null,
    sellerLastReadAt: null,
    buyerLastReadMessageId: null,
    sellerLastReadMessageId: null,
    updatedAt: 1700000001000,
    ...overrides,
  };
}

class InMemoryReactiveStore {
  public docs = new Map<string, Record<string, any>>();
  private listeners: Array<{
    uid: string;
    onDocs: (docs: Array<Record<string, any>>) => void;
  }> = [];

  seedListing(listingId: string, data: Record<string, any>) {
    this.docs.set(`listings/${listingId}`, structuredClone(data));
  }

  seedMessage(messageId: string, data: Record<string, any>) {
    this.docs.set(`market_messages/${messageId}`, structuredClone(data));
  }

  collection(name: string) {
    return this.colRef(name);
  }

  private colRef(basePath: string) {
    return {
      doc: (id: string) => this.docRef(`${basePath}/${id}`, id),
      orderBy: (field: string, dir: 'asc' | 'desc' = 'asc') =>
        this.queryRef(basePath, field, dir, null),
      limit: (n: number) => this.queryRef(basePath, null, 'asc', n),
    };
  }

  private docRef(docPath: string, id: string): any {
    const self = this;
    return {
      path: docPath,
      id,
      async get() {
        const d = self.docs.get(docPath);
        return {
          id,
          ref: this,
          exists: d !== undefined,
          data: () => (d ? structuredClone(d) : undefined),
        };
      },
      async set(data: Record<string, any>, opts?: { merge?: boolean }) {
        const prev = opts?.merge ? self.docs.get(docPath) || {} : {};
        self.docs.set(docPath, { ...structuredClone(prev), ...structuredClone(data) });
        self.notifySubscribers();
      },
      collection: (sub: string) => self.colRef(`${docPath}/${sub}`),
    };
  }

  private queryRef(
    basePath: string,
    orderField: string | null,
    orderDir: 'asc' | 'desc',
    limitCount: number | null
  ) {
    const self = this;
    const prefix = `${basePath}/`;
    const q = {
      orderBy: (f: string, d: 'asc' | 'desc' = 'asc') =>
        self.queryRef(basePath, f, d, limitCount),
      limit: (n: number) => self.queryRef(basePath, orderField, orderDir, n),
      async get() {
        const matched: Array<{ id: string; ref: any; exists: true; data: () => any }> = [];
        for (const [p, val] of self.docs.entries()) {
          if (!p.startsWith(prefix)) continue;
          const rest = p.slice(prefix.length);
          if (!rest || rest.includes('/')) continue;
          matched.push({
            id: rest,
            ref: self.docRef(p, rest),
            exists: true,
            data: () => structuredClone(val),
          });
        }
        if (orderField) {
          const mult = orderDir === 'desc' ? -1 : 1;
          matched.sort((a, b) => {
            const av = Number(a.data()?.[orderField] ?? 0);
            const bv = Number(b.data()?.[orderField] ?? 0);
            if (av !== bv) return (av - bv) * mult;
            return a.id === b.id ? 0 : (a.id > b.id ? 1 : -1) * mult;
          });
        }
        const sliced = limitCount !== null ? matched.slice(0, limitCount) : matched;
        return { docs: sliced, empty: sliced.length === 0, size: sliced.length };
      },
    };
    return q;
  }

  async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const ops: Array<() => void> = [];
    const tx = {
      get: async (target: any) => target.get(),
      set: (ref: any, data: any, opts?: { merge?: boolean }) => {
        ops.push(() => {
          const prev = opts?.merge ? this.docs.get(ref.path) || {} : {};
          this.docs.set(ref.path, { ...structuredClone(prev), ...structuredClone(data) });
        });
        return tx;
      },
      update: (ref: any, patch: any) => {
        ops.push(() => {
          const prev = this.docs.get(ref.path) || {};
          this.docs.set(ref.path, { ...structuredClone(prev), ...structuredClone(patch) });
        });
        return tx;
      },
      delete: (ref: any) => {
        ops.push(() => {
          this.docs.delete(ref.path);
        });
        return tx;
      },
    };
    const res = await fn(tx);
    for (const op of ops) op();
    this.notifySubscribers();
    return res;
  }

  subscribeUserConversations = (
    uid: string,
    onDocs: (docs: Array<Record<string, any>>) => void
  ) => {
    const entry = { uid, onDocs };
    this.listeners.push(entry);
    this.emitToEntry(entry);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== entry);
    };
  };

  private emitToEntry(entry: { uid: string; onDocs: (docs: Array<Record<string, any>>) => void }) {
    const convs: Array<Record<string, any>> = [];
    for (const [p, val] of this.docs.entries()) {
      if (!p.startsWith('market_conversations/')) continue;
      const rest = p.slice('market_conversations/'.length);
      if (rest.includes('/')) continue;
      if (Array.isArray(val.participants) && val.participants.includes(entry.uid)) {
        convs.push({ id: rest, ...structuredClone(val) });
      }
    }
    entry.onDocs(convs);
  }

  notifySubscribers() {
    for (const entry of [...this.listeners]) {
      this.emitToEntry(entry);
    }
  }
}

const silentLogger = { log: () => {}, warn: () => {}, error: () => {} };

describe('PROTON CHAT-AUD-02 Stage 2: Global Unread Frontend Integration (Unit & Double Tests)', () => {
  it('1. Buyer sees ONLY buyerUnreadCount (never sellerUnreadCount)', () => {
    const conv1 = makeConvDoc({
      conversationId: 'lst_1_buyer_a',
      listingId: 'lst_1',
      buyerId: 'buyer_a',
      sellerId: 'seller_x',
      buyerUnreadCount: 3,
      sellerUnreadCount: 9,
    });
    const conv2 = makeConvDoc({
      conversationId: 'lst_2_buyer_a',
      listingId: 'lst_2',
      buyerId: 'buyer_a',
      sellerId: 'seller_y',
      buyerUnreadCount: 2,
      sellerUnreadCount: 4,
    });

    assert.equal(getConversationUnreadForUser(conv1, 'buyer_a'), 3);
    const snap = buildMarketChatUnreadSnapshot([conv1, conv2], 'buyer_a');
    assert.equal(snap.totalUnreadCount, 5);
    assert.deepEqual(snap.unreadByConversationId, {
      lst_1_buyer_a: 3,
      lst_2_buyer_a: 2,
    });
  });

  it('2. Seller sees ONLY sellerUnreadCount (never buyerUnreadCount)', () => {
    const conv1 = makeConvDoc({
      conversationId: 'lst_1_buyer_a',
      listingId: 'lst_1',
      buyerId: 'buyer_a',
      sellerId: 'seller_bob',
      buyerUnreadCount: 7,
      sellerUnreadCount: 4,
    });
    const conv2 = makeConvDoc({
      conversationId: 'lst_1_buyer_b',
      listingId: 'lst_1',
      buyerId: 'buyer_b',
      sellerId: 'seller_bob',
      buyerUnreadCount: 1,
      sellerUnreadCount: 2,
    });

    assert.equal(getConversationUnreadForUser(conv1, 'seller_bob'), 4);
    const snap = buildMarketChatUnreadSnapshot([conv1, conv2], 'seller_bob');
    assert.equal(snap.totalUnreadCount, 6);
    assert.deepEqual(snap.unreadByConversationId, {
      lst_1_buyer_a: 4,
      lst_1_buyer_b: 2,
    });
  });

  it('3. Desktop and Mobile badges use the exact same totalUnreadCount and formatUnreadBadgeCount rules', () => {
    assert.equal(formatUnreadBadgeCount(0), null);
    assert.equal(formatUnreadBadgeCount(-5), null);
    assert.equal(formatUnreadBadgeCount(1), '1');
    assert.equal(formatUnreadBadgeCount(99), '99');
    assert.equal(formatUnreadBadgeCount(120), '99+');

    // Exact count preserved in Context snapshot even when > 99
    const conv = makeConvDoc({
      buyerId: 'buyer_a',
      sellerId: 'seller_b',
      buyerUnreadCount: 120,
      sellerUnreadCount: 0,
    });
    const snap = buildMarketChatUnreadSnapshot([conv], 'buyer_a');
    assert.equal(snap.totalUnreadCount, 120);
    assert.equal(formatUnreadBadgeCount(snap.totalUnreadCount), '99+');

    // Source verification: Desktop and Mobile badges in MarketHub.tsx both use globalUnreadBadgeLabel
    const marketHubSrc = fs.readFileSync(
      path.resolve('src/components/MarketHub.tsx'),
      'utf8'
    );
    assert.ok(marketHubSrc.includes('data-testid="desktop-messages-unread-badge"'));
    assert.ok(marketHubSrc.includes('data-testid="mobile-messages-unread-badge"'));
    assert.equal(
      marketHubSrc.includes('{allUserMessages.length}'),
      false,
      'Desktop badge must no longer display allUserMessages.length'
    );
    assert.equal(
      marketHubSrc.includes('{groupedChats.length}'),
      false,
      'Mobile badge must no longer display groupedChats.length'
    );
  });

  it('4. Own messages are never counted in unread', async () => {
    const store = new InMemoryReactiveStore();
    store.seedListing('lst_1', { id: 'lst_1', sellerId: 'seller_bob', title: 'CNC Drill' });

    // Buyer sends 3 messages; Buyer unread must stay 0!
    for (let i = 1; i <= 3; i += 1) {
      await processMarketMessageConversationUpdate({
        messageId: `own_m_${i}`,
        messageData: {
          conversationId: 'lst_1_buyer_alice',
          listingId: 'lst_1',
          listingTitle: 'CNC Drill',
          buyerId: 'buyer_alice',
          sellerId: 'seller_bob',
          senderId: 'buyer_alice',
          receiverId: 'seller_bob',
          participants: ['buyer_alice', 'seller_bob'],
          text: `My msg ${i}`,
          createdAt: 1700000000000 + i * 1000,
        },
        firestore: store as any,
        logger: silentLogger,
      });
    }

    const buyerStates: MarketChatUnreadState[] = [];
    const coord = createMarketConversationsSubscriptionCoordinator(
      store.subscribeUserConversations,
      (s) => buyerStates.push(s)
    );
    coord.setUser('buyer_alice');

    const latestBuyerState = buyerStates[buyerStates.length - 1];
    assert.equal(latestBuyerState.totalUnreadCount, 0);
    assert.equal(latestBuyerState.unreadByConversationId['lst_1_buyer_alice'], 0);
    coord.dispose();
  });

  it('5 & 6. Badge updates to 0 after markMarketConversationRead, then increments again on a subsequent message', async () => {
    const store = new InMemoryReactiveStore();
    store.seedListing('lst_1', { id: 'lst_1', sellerId: 'seller_bob', title: 'Servo Motor' });

    const m1 = {
      conversationId: 'lst_1_buyer_alice',
      listingId: 'lst_1',
      listingTitle: 'Servo Motor',
      buyerId: 'buyer_alice',
      sellerId: 'seller_bob',
      senderId: 'seller_bob',
      receiverId: 'buyer_alice',
      participants: ['buyer_alice', 'seller_bob'],
      text: 'Reply 1',
      createdAt: 1700000001000,
    };
    store.seedMessage('m1', m1);
    await processMarketMessageConversationUpdate({
      messageId: 'm1',
      messageData: m1,
      firestore: store as any,
      logger: silentLogger,
    });

    const buyerStates: MarketChatUnreadState[] = [];
    const coord = createMarketConversationsSubscriptionCoordinator(
      store.subscribeUserConversations,
      (s) => buyerStates.push(s)
    );
    coord.setUser('buyer_alice');
    assert.equal(buyerStates[buyerStates.length - 1].totalUnreadCount, 1);

    const readController = createConversationReadController({
      debounceMs: 0,
      markReadFn: async (params) => {
        return processMarkMarketConversationRead({
          callerUid: 'buyer_alice',
          conversationId: params.conversationId,
          lastVisibleMessageId: params.lastVisibleMessageId,
          firestore: store as any,
          logger: silentLogger,
        });
      },
    });

    const eval1 = readController.evaluate({
      isActive: true,
      currentUserId: 'buyer_alice',
      buyerId: 'buyer_alice',
      sellerId: 'seller_bob',
      conversationId: 'lst_1_buyer_alice',
      documentVisibilityState: 'visible',
      isLastMessageVisible: true,
      lastVisibleMessageId: 'm1',
      hasServerConversation: true,
      unreadCount: buyerStates[buyerStates.length - 1].totalUnreadCount,
    });
    assert.equal(eval1.scheduled, true);

    await new Promise((r) => setTimeout(r, 15));
    assert.equal(buyerStates[buyerStates.length - 1].totalUnreadCount, 0);
    assert.equal(
      buyerStates[buyerStates.length - 1].unreadByConversationId['lst_1_buyer_alice'],
      0
    );

    // Step 6: New message arrives after read -> unreadCount increases to 1 again!
    const m2 = { ...m1, text: 'Reply 2', createdAt: 1700000005000 };
    store.seedMessage('m2', m2);
    await processMarketMessageConversationUpdate({
      messageId: 'm2',
      messageData: m2,
      firestore: store as any,
      logger: silentLogger,
    });

    assert.equal(buyerStates[buyerStates.length - 1].totalUnreadCount, 1);
    assert.equal(
      buyerStates[buyerStates.length - 1].unreadByConversationId['lst_1_buyer_alice'],
      1
    );

    readController.dispose();
    coord.dispose();
  });

  it('7 & 8. Legacy conversations without market_conversations document stay in list with unreadCount = 0', () => {
    const serverConvs = [
      makeConvDoc({
        conversationId: 'lst_new_buyer_a',
        listingId: 'lst_new',
        buyerId: 'buyer_a',
        sellerId: 'seller_s1',
        buyerUnreadCount: 2,
        lastMessageText: 'Server synced message',
        lastMessageAt: 1700000020000,
      }),
    ];

    const legacyThreads = [
      {
        conversationId: 'lst_legacy_buyer_a',
        listingId: 'lst_legacy',
        listingTitle: 'Legacy Drill Press',
        sellerId: 'seller_s2',
        sellerName: 'Old Seller',
        buyerId: 'buyer_a',
        buyerName: 'Alice',
        orderId: 'ord_legacy_1',
        lastMessage: 'Legacy pre-migration chat message',
        lastTime: 1700000010000,
        lastTimeMillis: 1700000010000,
        messages: [{ senderId: 'seller_s2', orderId: 'ord_legacy_1' }],
      },
      // Duplicate with server conversation should be unified, keeping server unreadCount=2
      {
        conversationId: 'lst_new_buyer_a',
        listingId: 'lst_new',
        listingTitle: 'New Item',
        sellerId: 'seller_s1',
        sellerName: 'New Seller',
        buyerId: 'buyer_a',
        buyerName: 'Alice',
        lastMessage: 'Older local cache',
        lastTime: 1700000015000,
        lastTimeMillis: 1700000015000,
      },
    ];

    const merged = mergeConversationThreadsWithLegacy({
      serverConversations: serverConvs,
      legacyThreads,
      currentUserId: 'buyer_a',
    });

    assert.equal(merged.length, 2);
    const newItem = merged.find((t) => t.conversationId === 'lst_new_buyer_a')!;
    const legacyItem = merged.find((t) => t.conversationId === 'lst_legacy_buyer_a')!;

    assert.equal(newItem.unreadCount, 2);
    assert.equal(newItem.hasServerConversation, true);
    assert.equal(newItem.lastMessage, 'Server synced message');

    assert.ok(legacyItem);
    assert.equal(legacyItem.unreadCount, 0);
    assert.equal(legacyItem.hasServerConversation, false);
    assert.equal(legacyItem.lastMessage, 'Legacy pre-migration chat message');
    assert.equal(legacyItem.orderId, 'ord_legacy_1');
  });

  it('9. Logout clears unread state immediately and unsubscribes Firestore listener', () => {
    let unsubCount = 0;
    let emittedState: MarketChatUnreadState | null = null;
    let pushedToStaleListener: ((docs: any[]) => void) | null = null;

    const coord = createMarketConversationsSubscriptionCoordinator(
      (_uid, onDocs) => {
        pushedToStaleListener = onDocs;
        onDocs([makeConvDoc({ buyerId: 'user_a', sellerId: 'seller_1', buyerUnreadCount: 4 })]);
        return () => {
          unsubCount += 1;
        };
      },
      (s) => {
        emittedState = s;
      }
    );

    coord.setUser('user_a');
    assert.equal(emittedState!.totalUnreadCount, 4);

    // Logout
    coord.setUser(null);
    assert.equal(unsubCount, 1);
    assert.equal(emittedState!.currentUserId, null);
    assert.equal(emittedState!.totalUnreadCount, 0);
    assert.deepEqual(emittedState!.unreadByConversationId, {});
    assert.equal(emittedState!.conversations.length, 0);

    // Late callback from old listener must be ignored
    pushedToStaleListener!([
      makeConvDoc({ buyerId: 'user_a', sellerId: 'seller_1', buyerUnreadCount: 99 }),
    ]);
    assert.equal(emittedState!.totalUnreadCount, 0);
  });

  it('10. Rapid account switching wipes old account unread data synchronously and suppresses stale callbacks', () => {
    const unsubCalls: string[] = [];
    const callbacksByUid = new Map<string, (docs: any[]) => void>();
    const states: MarketChatUnreadState[] = [];

    const coord = createMarketConversationsSubscriptionCoordinator(
      (uid, onDocs) => {
        callbacksByUid.set(uid, onDocs);
        return () => {
          unsubCalls.push(uid);
        };
      },
      (s) => states.push(s)
    );

    coord.setUser('user_a');
    callbacksByUid.get('user_a')!([
      makeConvDoc({ conversationId: 'c_a', buyerId: 'user_a', sellerId: 's1', buyerUnreadCount: 5 }),
    ]);
    assert.equal(states[states.length - 1].totalUnreadCount, 5);

    // Direct switch User A -> User B
    coord.setUser('user_b');
    assert.deepEqual(unsubCalls, ['user_a']);
    // Intermediate reset state immediately after switch must show 0 before User B snapshot arrives
    const resetState = states[states.length - 1];
    assert.equal(resetState.currentUserId, 'user_b');
    assert.equal(resetState.loading, true);
    assert.equal(resetState.totalUnreadCount, 0);
    assert.deepEqual(resetState.unreadByConversationId, {});

    // Stale async snapshot for User A must never pollute User B state!
    callbacksByUid.get('user_a')!([
      makeConvDoc({ conversationId: 'c_a', buyerId: 'user_a', sellerId: 's1', buyerUnreadCount: 88 }),
    ]);
    assert.equal(states[states.length - 1].totalUnreadCount, 0);

    // User B receives their own unread state
    callbacksByUid.get('user_b')!([
      makeConvDoc({ conversationId: 'c_b', buyerId: 'user_b', sellerId: 's2', buyerUnreadCount: 2 }),
    ]);
    assert.equal(states[states.length - 1].currentUserId, 'user_b');
    assert.equal(states[states.length - 1].totalUnreadCount, 2);

    coord.dispose();
  });

  it('11. Listener operates globally regardless of whether Messages tab is open', () => {
    const mainSrc = fs.readFileSync(path.resolve('src/main.tsx'), 'utf8');
    const contextSrc = fs.readFileSync(
      path.resolve('src/contexts/MarketChatUnreadContext.tsx'),
      'utf8'
    );

    assert.ok(mainSrc.includes('MarketChatUnreadProvider'));
    assert.ok(contextSrc.includes("collection(db, 'market_conversations')"));
    assert.ok(contextSrc.includes("where('participants', 'array-contains', uid)"));
    assert.ok(contextSrc.includes("orderBy('lastMessageAt', 'desc')"));
    assert.ok(contextSrc.includes('limit(100)'));
    assert.equal(contextSrc.includes('activeBottomTab'), false);
  });

  it('12. Callable respects all 5 preconditions, avoids duplicate calls per messageId across renders, and handles errors safely', async () => {
    const calls: Array<{ conversationId: string; lastVisibleMessageId: string }> = [];
    let shouldFail = false;
    let errorCount = 0;

    const controller = createConversationReadController({
      debounceMs: 0,
      markReadFn: async (params) => {
        calls.push(params);
        if (shouldFail) {
          throw new Error('network error');
        }
      },
      onError: () => {
        errorCount += 1;
      },
    });

    const validBase = {
      isActive: true,
      currentUserId: 'buyer_a',
      buyerId: 'buyer_a',
      sellerId: 'seller_b',
      conversationId: 'lst_1_buyer_a',
      documentVisibilityState: 'visible',
      isLastMessageVisible: true,
      lastVisibleMessageId: 'msg_10',
      hasServerConversation: true,
      unreadCount: 2,
    };

    // Blocked when inactive
    assert.equal(controller.evaluate({ ...validBase, isActive: false }).reason, 'inactive_chat');
    // Blocked when document is hidden
    assert.equal(
      controller.evaluate({ ...validBase, documentVisibilityState: 'hidden' }).reason,
      'document_hidden'
    );
    // Blocked when scrolled up (last message not visible)
    assert.equal(
      controller.evaluate({ ...validBase, isLastMessageVisible: false }).reason,
      'last_message_not_visible'
    );
    // Blocked when no server conversation (legacy chat)
    assert.equal(
      controller.evaluate({ ...validBase, hasServerConversation: false }).reason,
      'no_server_conversation'
    );
    // Blocked when nothing unread
    assert.equal(controller.evaluate({ ...validBase, unreadCount: 0 }).reason, 'nothing_unread');
    // Blocked when non-participant
    assert.equal(
      controller.evaluate({ ...validBase, currentUserId: 'stranger_z' }).reason,
      'not_participant'
    );
    assert.equal(calls.length, 0);

    // First error failure: handled safely, allows subsequent real retry
    shouldFail = true;
    controller.evaluate(validBase);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(calls.length, 1);
    assert.equal(errorCount, 1);

    // Subsequent retry succeeds and dedupes across repeated re-renders
    shouldFail = false;
    assert.equal(controller.evaluate(validBase).scheduled, true);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(calls.length, 2);

    // Repeated re-renders for the same msg_10 do NOT re-invoke callable
    assert.equal(
      controller.evaluate(validBase).reason,
      'already_processed_or_pending'
    );
    assert.equal(
      controller.evaluate(validBase).reason,
      'already_processed_or_pending'
    );
    assert.equal(calls.length, 2);

    // Next message msg_11 schedules cleanly once
    assert.equal(
      controller.evaluate({ ...validBase, lastVisibleMessageId: 'msg_11' }).scheduled,
      true
    );
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(calls.length, 3);
    assert.equal(calls[2].lastVisibleMessageId, 'msg_11');

    controller.dispose();
  });

  it('13. Other users conversations and duplicate conversationIds are strictly excluded/deduplicated', () => {
    const ownConv = makeConvDoc({
      conversationId: 'lst_1_buyer_a',
      listingId: 'lst_1',
      buyerId: 'buyer_a',
      sellerId: 'seller_b',
      buyerUnreadCount: 2,
    });
    const duplicateOwnNewer = makeConvDoc({
      conversationId: 'lst_1_buyer_a',
      listingId: 'lst_1',
      buyerId: 'buyer_a',
      sellerId: 'seller_b',
      buyerUnreadCount: 3,
      updatedAt: 1700000099000,
    });
    const strangerConv = makeConvDoc({
      conversationId: 'lst_1_buyer_c',
      listingId: 'lst_1',
      buyerId: 'buyer_c',
      sellerId: 'seller_b',
      buyerUnreadCount: 10,
      sellerUnreadCount: 10,
    });
    const selfChatAnomaly = makeConvDoc({
      conversationId: 'lst_1_buyer_a_self',
      listingId: 'lst_1',
      buyerId: 'buyer_a',
      sellerId: 'buyer_a',
      participants: ['buyer_a', 'buyer_a'],
      buyerUnreadCount: 5,
    });

    const snap = buildMarketChatUnreadSnapshot(
      [ownConv, duplicateOwnNewer, strangerConv, selfChatAnomaly],
      'buyer_a'
    );

    assert.equal(snap.conversations.length, 1);
    assert.equal(snap.totalUnreadCount, 3);
    assert.equal(snap.unreadByConversationId['lst_1_buyer_c'], undefined);
  });

  it('14. CHAT-AUD-04 participant/role navigation and validation checks remain intact', () => {
    const navRes = resolveMarketChatNavigation({
      target: {
        type: 'market_message',
        conversationId: 'lst_cnc_01_buyer_alice',
        listingId: 'lst_cnc_01',
        buyerId: 'buyer_alice',
        sellerId: 'seller_bob',
      },
      currentUserId: 'buyer_alice',
      currentUserDisplayName: 'Alice',
      groupedChats: [
        {
          conversationId: 'lst_cnc_01_buyer_alice',
          listingId: 'lst_cnc_01',
          listingTitle: 'CNC Spindle Kit',
          buyerId: 'buyer_alice',
          buyerName: 'Alice',
          sellerId: 'seller_bob',
          sellerName: 'Bob Studio',
        },
      ],
    });

    assert.equal(navRes.ok, true);
    if (navRes.ok) {
      assert.equal(navRes.userRole, 'buyer');
      assert.equal(navRes.sellerId, 'seller_bob');
      assert.equal(navRes.buyerId, 'buyer_alice');
    }

    const activeCheck = validateActiveChatContext({
      context: {
        conversationId: 'lst_cnc_01_buyer_alice',
        listing: {
          id: 'lst_cnc_01',
          sellerId: 'seller_bob',
          title: 'CNC Spindle Kit',
        } as any,
        buyerId: 'buyer_alice',
        sellerId: 'seller_bob',
      },
      listing: { id: 'lst_cnc_01', sellerId: 'seller_bob' } as any,
      currentUserId: 'stranger_99',
    });
    assert.equal(activeCheck.ok, false);
    if (!activeCheck.ok) {
      assert.equal(activeCheck.reason, 'user_not_participant');
    }
  });

  it('15. Shared chat UI components (ChatThreadList, ChatMessageList, MarketChatDrawer, MarketHub) preserve dual UI and Stage 1 boundaries', () => {
    const threadListSrc = fs.readFileSync(
      path.resolve('src/components/market-hub/chat/ChatThreadList.tsx'),
      'utf8'
    );
    const msgListSrc = fs.readFileSync(
      path.resolve('src/components/market-hub/chat/ChatMessageList.tsx'),
      'utf8'
    );
    const drawerSrc = fs.readFileSync(
      path.resolve('src/components/market-hub/MarketChatDrawer.tsx'),
      'utf8'
    );
    const hubSrc = fs.readFileSync(path.resolve('src/components/MarketHub.tsx'), 'utf8');

    assert.ok(threadListSrc.includes('unreadByConversationId'));
    assert.ok(threadListSrc.includes('threadUnreadCount > 0'));
    assert.ok(threadListSrc.includes('thread-unread-badge-'));

    assert.ok(msgListSrc.includes('onLastMessageVisibilityChange'));
    assert.ok(msgListSrc.includes('IntersectionObserver'));
    // Autoscroll stability fix preserved
    assert.ok(msgListSrc.includes('containerResized'));

    assert.ok(drawerSrc.includes('onLastMessageVisibilityChange'));

    // Both Desktop Inbox and Mobile Overlay pass unreadByConversationId + visibility handlers
    assert.ok(hubSrc.includes('handleDesktopLastMsgVisibility'));
    assert.ok(hubSrc.includes('handleMobileLastMsgVisibility'));
    assert.ok(hubSrc.includes('handleDrawerLastMsgVisibility'));
    assert.ok(hubSrc.includes('unreadByConversationId={unreadByConversationId}'));
  });
});
