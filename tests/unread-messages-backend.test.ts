import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareMessageOrder,
  extractTimestampMs,
  processMarkMarketConversationRead,
  processMarketMessageConversationUpdate,
  processMarketMessageCreated,
} from '../functions/src/index';
import { planMarketConversationsBackfill } from '../scripts/backfill-market-conversations-dry-run';

// ============================================================================
// TRANSACTIONAL IN-MEMORY FIRESTORE TEST DOUBLE (FakeFirestore)
// NOTE: This is an in-memory FakeFirestore double + Rules Simulator.
// It is NOT a substitute for live Firebase Emulator or production Firestore.
// ============================================================================

class FakeDocSnapshot {
  constructor(
    public readonly id: string,
    public readonly ref: FakeDocRef,
    private readonly _data: Record<string, any> | undefined
  ) {}

  get exists(): boolean {
    return this._data !== undefined;
  }

  data(): Record<string, any> | undefined {
    return this._data ? structuredClone(this._data) : undefined;
  }
}

class FakeQuerySnapshot {
  constructor(public readonly docs: FakeDocSnapshot[]) {}
  get empty(): boolean {
    return this.docs.length === 0;
  }
  get size(): number {
    return this.docs.length;
  }
}

class FakeDocRef {
  constructor(
    private readonly db: TransactionalFakeFirestore,
    public readonly path: string,
    public readonly id: string
  ) {}

  async get(): Promise<FakeDocSnapshot> {
    return new FakeDocSnapshot(this.id, this, this.db.store.get(this.path));
  }

  async create(data: Record<string, any>): Promise<void> {
    if (this.db.store.has(this.path)) {
      const err: any = new Error(`6 ALREADY_EXISTS: Document already exists: ${this.path}`);
      err.code = 6;
      throw err;
    }
    this.db.store.set(this.path, structuredClone(data));
  }

  async set(data: Record<string, any>, options?: { merge?: boolean }): Promise<void> {
    if (options?.merge) {
      const prev = this.db.store.get(this.path) || {};
      this.db.store.set(this.path, { ...structuredClone(prev), ...structuredClone(data) });
    } else {
      this.db.store.set(this.path, structuredClone(data));
    }
  }

  collection(subName: string): FakeCollectionRef {
    return new FakeCollectionRef(this.db, `${this.path}/${subName}`);
  }
}

class FakeQuery {
  constructor(
    private readonly db: TransactionalFakeFirestore,
    public readonly basePath: string,
    private readonly orderField: string | null = null,
    private readonly orderDir: 'asc' | 'desc' = 'asc',
    private readonly limitCount: number | null = null
  ) {}

  orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): FakeQuery {
    return new FakeQuery(this.db, this.basePath, field, dir, this.limitCount);
  }

  limit(n: number): FakeQuery {
    return new FakeQuery(this.db, this.basePath, this.orderField, this.orderDir, n);
  }

  async get(): Promise<FakeQuerySnapshot> {
    const prefix = `${this.basePath}/`;
    const matched: FakeDocSnapshot[] = [];
    for (const [docPath, data] of this.db.store.entries()) {
      if (!docPath.startsWith(prefix)) continue;
      const rest = docPath.slice(prefix.length);
      if (!rest || rest.includes('/')) continue;
      matched.push(new FakeDocSnapshot(rest, new FakeDocRef(this.db, docPath, rest), data));
    }

    if (this.orderField) {
      const field = this.orderField;
      const mult = this.orderDir === 'desc' ? -1 : 1;
      matched.sort((a, b) => {
        const aVal = extractTimestampMs(a.data()?.[field]) ?? 0;
        const bVal = extractTimestampMs(b.data()?.[field]) ?? 0;
        if (aVal !== bVal) return (aVal - bVal) * mult;
        // Firestore ties break by __name__
        if (a.id === b.id) return 0;
        return (a.id > b.id ? 1 : -1) * mult;
      });
    }

    const sliced = this.limitCount !== null ? matched.slice(0, this.limitCount) : matched;
    return new FakeQuerySnapshot(sliced);
  }
}

class FakeCollectionRef {
  constructor(
    private readonly db: TransactionalFakeFirestore,
    public readonly basePath: string
  ) {}

  doc(id: string): FakeDocRef {
    return new FakeDocRef(this.db, `${this.basePath}/${id}`, id);
  }

  orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): FakeQuery {
    return new FakeQuery(this.db, this.basePath, field, dir, null);
  }

  limit(n: number): FakeQuery {
    return new FakeQuery(this.db, this.basePath, null, 'asc', n);
  }
}

type BufferedOp =
  | { type: 'set'; path: string; data: Record<string, any>; merge: boolean }
  | { type: 'update'; path: string; patch: Record<string, any> }
  | { type: 'delete'; path: string };

class FakeTransaction {
  private hasWritten = false;
  public readonly ops: BufferedOp[] = [];
  public readonly readPaths = new Set<string>();

  constructor(private readonly db: TransactionalFakeFirestore) {}

  async get(target: FakeDocRef | FakeQuery): Promise<any> {
    if (this.hasWritten) {
      throw new Error('Firestore transactions require all reads to be executed before all writes.');
    }
    if (target instanceof FakeDocRef) {
      this.readPaths.add(target.path);
      return target.get();
    }
    return target.get();
  }

  set(ref: FakeDocRef, data: Record<string, any>, options?: { merge?: boolean }): this {
    this.hasWritten = true;
    this.ops.push({ type: 'set', path: ref.path, data: structuredClone(data), merge: Boolean(options?.merge) });
    return this;
  }

  update(ref: FakeDocRef, patch: Record<string, any>): this {
    this.hasWritten = true;
    this.ops.push({ type: 'update', path: ref.path, patch: structuredClone(patch) });
    return this;
  }

  delete(ref: FakeDocRef): this {
    this.hasWritten = true;
    this.ops.push({ type: 'delete', path: ref.path });
    return this;
  }
}

class TransactionalFakeFirestore {
  public readonly store = new Map<string, Record<string, any>>();
  public readonly transactionWriteCounts: number[] = [];
  private txQueue: Promise<any> = Promise.resolve();

  collection(name: string): FakeCollectionRef {
    return new FakeCollectionRef(this, name);
  }

  doc(path: string): FakeDocRef {
    const parts = path.split('/');
    const id = parts[parts.length - 1] || '';
    return new FakeDocRef(this, path, id);
  }

  seedListing(listingId: string, data: Record<string, any>): void {
    this.store.set(`listings/${listingId}`, structuredClone(data));
  }

  seedMessage(messageId: string, data: Record<string, any>): void {
    this.store.set(`market_messages/${messageId}`, structuredClone(data));
  }

  getConversation(conversationId: string): Record<string, any> | undefined {
    const val = this.store.get(`market_conversations/${conversationId}`);
    return val ? structuredClone(val) : undefined;
  }

  getUnreadMarkers(conversationId: string, recipientId: string): string[] {
    const prefix = `market_conversations/${conversationId}/unread/${recipientId}/messages/`;
    const ids: string[] = [];
    for (const p of this.store.keys()) {
      if (p.startsWith(prefix)) ids.push(p.slice(prefix.length));
    }
    return ids.sort();
  }

  getProcessedMarkers(conversationId: string): string[] {
    const prefix = `market_conversations/${conversationId}/processed_messages/`;
    const ids: string[] = [];
    for (const p of this.store.keys()) {
      if (p.startsWith(prefix)) ids.push(p.slice(prefix.length));
    }
    return ids.sort();
  }

  getUserNotifications(userId: string): Array<{ id: string; data: Record<string, any> }> {
    const prefix = `users/${userId}/notifications/`;
    const results: Array<{ id: string; data: Record<string, any> }> = [];
    for (const [path, data] of this.store.entries()) {
      if (path.startsWith(prefix)) {
        results.push({ id: path.slice(prefix.length), data: structuredClone(data) });
      }
    }
    return results;
  }

  async runTransaction<T>(updateFunction: (transaction: FakeTransaction) => Promise<T>): Promise<T> {
    // Serialize transactions like Firestore server-side pessimistic/optimistic lock on convRef
    const run = async (): Promise<T> => {
      const tx = new FakeTransaction(this);
      const result = await updateFunction(tx);
      for (const op of tx.ops) {
        if (op.type === 'set') {
          if (op.merge) {
            const prev = this.store.get(op.path) || {};
            this.store.set(op.path, { ...prev, ...op.data });
          } else {
            this.store.set(op.path, op.data);
          }
        } else if (op.type === 'update') {
          if (!this.store.has(op.path)) {
            throw new Error(`NOT_FOUND: Cannot update missing doc ${op.path}`);
          }
          const prev = this.store.get(op.path) || {};
          this.store.set(op.path, { ...prev, ...op.patch });
        } else if (op.type === 'delete') {
          this.store.delete(op.path);
        }
      }
      this.transactionWriteCounts.push(tx.ops.length);
      return result;
    };

    const next = this.txQueue.then(run, run);
    this.txQueue = next.catch(() => {});
    return next;
  }
}

// ============================================================================
// FIRESTORE RULES SIMULATOR FOR market_conversations + subcollections
// Mirrors firestore.rules lines 48-50 and 495-518
// ============================================================================

const isValidConversationId = (id: unknown): boolean =>
  typeof id === 'string' && id.length >= 3 && id.length <= 260 && /^[a-zA-Z0-9_\-]+$/.test(id);

function evaluateMarketConversationsRule(args: {
  action: 'get' | 'list' | 'create' | 'update' | 'delete';
  conversationId: string;
  docData: Record<string, any> | null;
  auth: { uid: string } | null;
}): { allowed: boolean; reason?: string } {
  const { action, conversationId, docData, auth } = args;
  if (action === 'create' || action === 'update' || action === 'delete') {
    return { allowed: false, reason: 'CLIENT_WRITE_FORBIDDEN' };
  }
  if (!auth?.uid) {
    return { allowed: false, reason: 'UNAUTHENTICATED' };
  }
  if (action === 'get') {
    if (!isValidConversationId(conversationId)) {
      return { allowed: false, reason: 'INVALID_CONVERSATION_ID' };
    }
    if (!docData) return { allowed: false, reason: 'MISSING_DOC' };
    const inParticipants =
      Array.isArray(docData.participants) && docData.participants.includes(auth.uid);
    const isBuyerOrSeller = docData.buyerId === auth.uid || docData.sellerId === auth.uid;
    return inParticipants || isBuyerOrSeller
      ? { allowed: true }
      : { allowed: false, reason: 'NOT_PARTICIPANT' };
  }
  // list
  if (!docData) return { allowed: false, reason: 'MISSING_DOC' };
  const inParticipants =
    Array.isArray(docData.participants) && docData.participants.includes(auth.uid);
  return inParticipants ? { allowed: true } : { allowed: false, reason: 'NOT_IN_PARTICIPANTS' };
}

function evaluateConversationInternalSubcollectionRule(
  subcollection: 'processed_messages' | 'unread' | 'unread_messages',
  action: 'get' | 'list' | 'create' | 'update' | 'delete'
): { allowed: boolean; reason: string } {
  return { allowed: false, reason: `${subcollection.toUpperCase()}_${action.toUpperCase()}_DENIED` };
}

const silentLogger = {
  log: () => {},
  warn: () => {},
  error: () => {},
};

// ============================================================================
// TEST SUITE: CHAT-AUD-02 STAGE 1 — UNREAD MESSAGES BACKEND FOUNDATION
// ============================================================================

describe('PROTON CHAT-AUD-02 Stage 1: Unread Messages Backend Foundation (FakeFirestore + Rules Simulator)', () => {
  const buyerId = 'buyer_alice_01';
  const sellerId = 'seller_bob_02';
  const strangerId = 'stranger_eve_99';
  const listingId = 'lst_servo_motor_01';
  const conversationId = `${listingId}_${buyerId}`;

  const createSeededDb = () => {
    const db = new TransactionalFakeFirestore();
    db.seedListing(listingId, {
      id: listingId,
      sellerId,
      sellerName: 'Bob CNC Lab',
      title: 'Servo Motor 750W',
    });
    return db;
  };

  const makeMsg = (overrides: Partial<Record<string, any>> = {}) => ({
    conversationId,
    listingId,
    listingTitle: 'Servo Motor 750W',
    buyerId,
    sellerId,
    senderId: buyerId,
    senderName: 'Alice',
    receiverId: sellerId,
    participants: [buyerId, sellerId],
    text: 'Hello there',
    createdAt: 1700000001000,
    ...overrides,
  });

  it('1. Buyer message increments ONLY sellerUnreadCount (buyerUnreadCount stays 0)', async () => {
    const db = createSeededDb();
    const res = await processMarketMessageConversationUpdate({
      messageId: 'm_b2s_1',
      messageData: makeMsg({
        senderId: buyerId,
        receiverId: sellerId,
        text: 'Hi Bob, is it ready?',
        createdAt: 1700000001000,
      }),
      firestore: db,
      now: () => 1700000001500,
      logger: silentLogger,
    });

    assert.equal(res.updated, true);
    assert.equal(res.markedUnread, true);
    assert.equal(res.recipientId, sellerId);

    const conv = db.getConversation(conversationId);
    assert.ok(conv);
    assert.equal(conv.sellerUnreadCount, 1);
    assert.equal(conv.buyerUnreadCount, 0);
    assert.equal(conv.lastMessageId, 'm_b2s_1');
    assert.equal(conv.lastSenderId, buyerId);
    assert.deepEqual(db.getUnreadMarkers(conversationId, sellerId), ['m_b2s_1']);
    assert.deepEqual(db.getUnreadMarkers(conversationId, buyerId), []);
  });

  it('2. Seller message increments ONLY buyerUnreadCount (sellerUnreadCount stays unchanged)', async () => {
    const db = createSeededDb();
    const res = await processMarketMessageConversationUpdate({
      messageId: 'm_s2b_1',
      messageData: makeMsg({
        senderId: sellerId,
        senderName: 'Bob CNC Lab',
        receiverId: buyerId,
        text: 'Yes, packed and ready!',
        createdAt: 1700000002000,
      }),
      firestore: db,
      now: () => 1700000002500,
      logger: silentLogger,
    });

    assert.equal(res.updated, true);
    assert.equal(res.markedUnread, true);
    assert.equal(res.recipientId, buyerId);

    const conv = db.getConversation(conversationId);
    assert.ok(conv);
    assert.equal(conv.buyerUnreadCount, 1);
    assert.equal(conv.sellerUnreadCount, 0);
    assert.equal(conv.lastMessageId, 'm_s2b_1');
    assert.equal(conv.lastSenderId, sellerId);
    assert.deepEqual(db.getUnreadMarkers(conversationId, buyerId), ['m_s2b_1']);
    assert.deepEqual(db.getUnreadMarkers(conversationId, sellerId), []);
  });

  it('3. Own messages never increment sender unreadCount (including multiple messages from same sender)', async () => {
    const db = createSeededDb();

    await processMarketMessageConversationUpdate({
      messageId: 'm_own_1',
      messageData: makeMsg({ senderId: buyerId, receiverId: sellerId, text: 'Msg 1', createdAt: 1700000001000 }),
      firestore: db,
      logger: silentLogger,
    });
    await processMarketMessageConversationUpdate({
      messageId: 'm_own_2',
      messageData: makeMsg({ senderId: buyerId, receiverId: sellerId, text: 'Msg 2', createdAt: 1700000002000 }),
      firestore: db,
      logger: silentLogger,
    });

    const convAfterBuyer = db.getConversation(conversationId)!;
    assert.equal(convAfterBuyer.buyerUnreadCount, 0);
    assert.equal(convAfterBuyer.sellerUnreadCount, 2);

    // Self-chat is strictly rejected
    const selfRes = await processMarketMessageConversationUpdate({
      messageId: 'm_self_bad',
      messageData: makeMsg({
        conversationId: `${listingId}_${sellerId}`,
        buyerId: sellerId,
        sellerId,
        senderId: sellerId,
        receiverId: sellerId,
        participants: [sellerId, sellerId],
      }),
      firestore: db,
      logger: silentLogger,
    });
    assert.equal(selfRes.updated, false);
    assert.equal(selfRes.reason, 'self_messaging_forbidden');
  });

  it('4. Trigger retry / duplicate messageId is strictly idempotent via processed_messages', async () => {
    const db = createSeededDb();
    const payload = makeMsg({ senderId: buyerId, receiverId: sellerId, createdAt: 1700000001000 });

    const [first, second] = await Promise.all([
      processMarketMessageConversationUpdate({
        messageId: 'm_dup_01',
        messageData: payload,
        firestore: db,
        logger: silentLogger,
      }),
      processMarketMessageConversationUpdate({
        messageId: 'm_dup_01',
        messageData: payload,
        firestore: db,
        logger: silentLogger,
      }),
    ]);

    const third = await processMarketMessageConversationUpdate({
      messageId: 'm_dup_01',
      messageData: payload,
      firestore: db,
      logger: silentLogger,
    });

    assert.equal([first, second].filter((r) => r.updated).length, 1);
    assert.equal(third.updated, false);
    assert.equal(third.duplicate, true);
    assert.equal(third.reason, 'already_processed');

    const conv = db.getConversation(conversationId)!;
    assert.equal(conv.sellerUnreadCount, 1);
    assert.deepEqual(db.getProcessedMarkers(conversationId), ['m_dup_01']);
  });

  it('5. Out-of-order late older message does NOT overwrite newer lastMessage* (including equal-timestamp ID tie-breaker)', async () => {
    const db = createSeededDb();

    // Newer message processed first
    await processMarketMessageConversationUpdate({
      messageId: 'msg_200',
      messageData: makeMsg({
        senderId: sellerId,
        receiverId: buyerId,
        text: 'Latest reply',
        createdAt: 1700000005000,
      }),
      firestore: db,
      logger: silentLogger,
    });

    // Older message trigger arrives late
    await processMarketMessageConversationUpdate({
      messageId: 'msg_100',
      messageData: makeMsg({
        senderId: buyerId,
        receiverId: sellerId,
        text: 'Older initial question',
        createdAt: 1700000002000,
      }),
      firestore: db,
      logger: silentLogger,
    });

    let conv = db.getConversation(conversationId)!;
    assert.equal(conv.lastMessageId, 'msg_200');
    assert.equal(conv.lastMessageText, 'Latest reply');
    assert.equal(conv.lastMessageAt, 1700000005000);
    assert.equal(conv.lastSenderId, sellerId);
    // Unread counts for both sides still accurately tracked
    assert.equal(conv.buyerUnreadCount, 1);
    assert.equal(conv.sellerUnreadCount, 1);

    // Equal-timestamp tie-breaker: 'msg_200_z' > 'msg_200', while 'msg_200_a' < 'msg_200_z'
    await processMarketMessageConversationUpdate({
      messageId: 'msg_200_z',
      messageData: makeMsg({
        senderId: buyerId,
        receiverId: sellerId,
        text: 'Same ms higher id',
        createdAt: 1700000005000,
      }),
      firestore: db,
      logger: silentLogger,
    });
    await processMarketMessageConversationUpdate({
      messageId: 'msg_200_a',
      messageData: makeMsg({
        senderId: sellerId,
        receiverId: buyerId,
        text: 'Same ms lower id',
        createdAt: 1700000005000,
      }),
      firestore: db,
      logger: silentLogger,
    });

    conv = db.getConversation(conversationId)!;
    assert.equal(conv.lastMessageId, 'msg_200_z');
    assert.equal(conv.lastMessageText, 'Same ms higher id');
    assert.equal(compareMessageOrder(100, 'b', 100, 'a'), 1);
  });

  it('6. Buyer markMarketConversationRead updates ONLY buyerUnreadCount and buyerLastRead* fields', async () => {
    const db = createSeededDb();

    // Buyer sent m1 (sellerUnread=1), Seller sent m2 & m3 (buyerUnread=2)
    db.seedMessage('m1', makeMsg({ senderId: buyerId, receiverId: sellerId, createdAt: 1700000001000 }));
    db.seedMessage('m2', makeMsg({ senderId: sellerId, receiverId: buyerId, createdAt: 1700000002000 }));
    db.seedMessage('m3', makeMsg({ senderId: sellerId, receiverId: buyerId, createdAt: 1700000003000 }));

    await processMarketMessageConversationUpdate({ messageId: 'm1', messageData: (await db.collection('market_messages').doc('m1').get()).data(), firestore: db, logger: silentLogger });
    await processMarketMessageConversationUpdate({ messageId: 'm2', messageData: (await db.collection('market_messages').doc('m2').get()).data(), firestore: db, logger: silentLogger });
    await processMarketMessageConversationUpdate({ messageId: 'm3', messageData: (await db.collection('market_messages').doc('m3').get()).data(), firestore: db, logger: silentLogger });

    const res = await processMarkMarketConversationRead({
      callerUid: buyerId,
      conversationId,
      lastVisibleMessageId: 'm3',
      firestore: db,
      now: () => 1700000004000,
      logger: silentLogger,
    });

    assert.equal(res.success, true);
    assert.equal(res.role, 'buyer');
    assert.equal(res.unreadCount, 0);
    assert.equal(res.clearedCount, 2);

    const conv = db.getConversation(conversationId)!;
    assert.equal(conv.buyerUnreadCount, 0);
    assert.equal(conv.buyerLastReadAt, 1700000003000);
    assert.equal(conv.buyerLastReadMessageId, 'm3');
    // Seller state untouched!
    assert.equal(conv.sellerUnreadCount, 1);
    assert.equal(conv.sellerLastReadAt, null);
    assert.equal(conv.sellerLastReadMessageId, null);
    assert.deepEqual(db.getUnreadMarkers(conversationId, sellerId), ['m1']);
  });

  it('7. Seller markMarketConversationRead updates ONLY sellerUnreadCount and sellerLastRead* fields', async () => {
    const db = createSeededDb();

    db.seedMessage('m1', makeMsg({ senderId: buyerId, receiverId: sellerId, createdAt: 1700000001000 }));
    db.seedMessage('m2', makeMsg({ senderId: sellerId, receiverId: buyerId, createdAt: 1700000002000 }));

    await processMarketMessageConversationUpdate({ messageId: 'm1', messageData: (await db.collection('market_messages').doc('m1').get()).data(), firestore: db, logger: silentLogger });
    await processMarketMessageConversationUpdate({ messageId: 'm2', messageData: (await db.collection('market_messages').doc('m2').get()).data(), firestore: db, logger: silentLogger });

    const res = await processMarkMarketConversationRead({
      callerUid: sellerId,
      conversationId,
      lastVisibleMessageId: 'm1',
      firestore: db,
      now: () => 1700000005000,
      logger: silentLogger,
    });

    assert.equal(res.success, true);
    assert.equal(res.role, 'seller');
    assert.equal(res.unreadCount, 0);
    assert.equal(res.clearedCount, 1);

    const conv = db.getConversation(conversationId)!;
    assert.equal(conv.sellerUnreadCount, 0);
    assert.equal(conv.sellerLastReadAt, 1700000001000);
    assert.equal(conv.sellerLastReadMessageId, 'm1');
    // Buyer state untouched!
    assert.equal(conv.buyerUnreadCount, 1);
    assert.equal(conv.buyerLastReadAt, null);
    assert.equal(conv.buyerLastReadMessageId, null);
  });

  it('8. markMarketConversationRead rejects messageId belonging to another conversation', async () => {
    const db = createSeededDb();
    const otherConvId = `${listingId}_buyer_other`;

    db.seedMessage('m_conv_a', makeMsg({ senderId: buyerId, receiverId: sellerId, createdAt: 1700000001000 }));
    db.seedMessage('m_conv_b', makeMsg({
      conversationId: otherConvId,
      buyerId: 'buyer_other',
      senderId: 'buyer_other',
      receiverId: sellerId,
      participants: ['buyer_other', sellerId],
      createdAt: 1700000002000,
    }));

    await processMarketMessageConversationUpdate({
      messageId: 'm_conv_a',
      messageData: (await db.collection('market_messages').doc('m_conv_a').get()).data(),
      firestore: db,
      logger: silentLogger,
    });

    await assert.rejects(
      () =>
        processMarkMarketConversationRead({
          callerUid: sellerId,
          conversationId,
          lastVisibleMessageId: 'm_conv_b',
          firestore: db,
          logger: silentLogger,
        }),
      (err: any) => err?.code === 'permission-denied'
    );

    // Unread count unchanged
    assert.equal(db.getConversation(conversationId)!.sellerUnreadCount, 1);
  });

  it('9. markMarketConversationRead rejects non-participant and unauthenticated callers', async () => {
    const db = createSeededDb();
    db.seedMessage('m1', makeMsg({ senderId: buyerId, receiverId: sellerId, createdAt: 1700000001000 }));
    await processMarketMessageConversationUpdate({
      messageId: 'm1',
      messageData: (await db.collection('market_messages').doc('m1').get()).data(),
      firestore: db,
      logger: silentLogger,
    });

    await assert.rejects(
      () =>
        processMarkMarketConversationRead({
          callerUid: null,
          conversationId,
          lastVisibleMessageId: 'm1',
          firestore: db,
          logger: silentLogger,
        }),
      (err: any) => err?.code === 'unauthenticated'
    );

    await assert.rejects(
      () =>
        processMarkMarketConversationRead({
          callerUid: strangerId,
          conversationId,
          lastVisibleMessageId: 'm1',
          firestore: db,
          logger: silentLogger,
        }),
      (err: any) => err?.code === 'permission-denied'
    );

    assert.equal(db.getConversation(conversationId)!.sellerUnreadCount, 1);
  });

  it('10. Parallel / interleaved new message trigger + read callable maintain exact consistency', async () => {
    // Case A: Parallel Promise.all where m1 was unread, m2 is visible/arriving, and read is called alongside m3 arriving after cursor
    const dbA = createSeededDb();
    dbA.seedMessage('m1', makeMsg({ senderId: buyerId, receiverId: sellerId, createdAt: 1700000001000 }));
    dbA.seedMessage('m2', makeMsg({ senderId: buyerId, receiverId: sellerId, createdAt: 1700000002000 }));
    dbA.seedMessage('m3', makeMsg({ senderId: buyerId, receiverId: sellerId, createdAt: 1700000005000 }));

    await processMarketMessageConversationUpdate({
      messageId: 'm1',
      messageData: (await dbA.collection('market_messages').doc('m1').get()).data(),
      firestore: dbA,
      logger: silentLogger,
    });
    await processMarketMessageConversationUpdate({
      messageId: 'm2',
      messageData: (await dbA.collection('market_messages').doc('m2').get()).data(),
      firestore: dbA,
      logger: silentLogger,
    });

    const [readRes, m3Res] = await Promise.all([
      processMarkMarketConversationRead({
        callerUid: sellerId,
        conversationId,
        lastVisibleMessageId: 'm2',
        firestore: dbA,
        logger: silentLogger,
      }),
      processMarketMessageConversationUpdate({
        messageId: 'm3',
        messageData: (await dbA.collection('market_messages').doc('m3').get()).data(),
        firestore: dbA,
        logger: silentLogger,
      }),
    ]);

    assert.equal(readRes.success, true);
    assert.equal(m3Res.updated, true);
    // m1 & m2 cleared; m3 (timestamp > cursor) remains unread!
    const convA = dbA.getConversation(conversationId)!;
    assert.equal(convA.sellerUnreadCount, 1);
    assert.deepEqual(dbA.getUnreadMarkers(conversationId, sellerId), ['m3']);

    // Case B: Delayed older trigger (m1 at 1000ms) runs AFTER seller already read up to m2 (2000ms)
    const dbB = createSeededDb();
    dbB.seedMessage('m1', makeMsg({ senderId: buyerId, receiverId: sellerId, createdAt: 1700000001000 }));
    dbB.seedMessage('m2', makeMsg({ senderId: buyerId, receiverId: sellerId, createdAt: 1700000002000 }));

    await processMarketMessageConversationUpdate({
      messageId: 'm2',
      messageData: (await dbB.collection('market_messages').doc('m2').get()).data(),
      firestore: dbB,
      logger: silentLogger,
    });
    await processMarkMarketConversationRead({
      callerUid: sellerId,
      conversationId,
      lastVisibleMessageId: 'm2',
      firestore: dbB,
      logger: silentLogger,
    });

    const lateM1Res = await processMarketMessageConversationUpdate({
      messageId: 'm1',
      messageData: (await dbB.collection('market_messages').doc('m1').get()).data(),
      firestore: dbB,
      logger: silentLogger,
    });

    assert.equal(lateM1Res.updated, true);
    assert.equal(lateM1Res.markedUnread, false); // suppressed by read cursor!
    const convB = dbB.getConversation(conversationId)!;
    assert.equal(convB.sellerUnreadCount, 0);
    assert.deepEqual(dbB.getUnreadMarkers(conversationId, sellerId), []);
  });

  it('11. Old read messages do not stay in unreadCount: chunked cleanup (> chunkSize) & monotonic cursor protection', async () => {
    const db = createSeededDb();

    // Seed 12 unread messages from buyer -> seller
    for (let i = 1; i <= 12; i += 1) {
      const id = `msg_${String(i).padStart(2, '0')}`;
      const payload = makeMsg({
        senderId: buyerId,
        receiverId: sellerId,
        text: `Message #${i}`,
        createdAt: 1700000000000 + i * 1000,
      });
      db.seedMessage(id, payload);
      await processMarketMessageConversationUpdate({
        messageId: id,
        messageData: payload,
        firestore: db,
        logger: silentLogger,
      });
    }

    assert.equal(db.getConversation(conversationId)!.sellerUnreadCount, 12);
    db.transactionWriteCounts.length = 0;

    // Clear all 12 using small chunkSize=5 -> requires 3 bounded transactions (5 + 5 + 2 deletes + 1 conv update each)
    const readRes = await processMarkMarketConversationRead({
      callerUid: sellerId,
      conversationId,
      lastVisibleMessageId: 'msg_12',
      firestore: db,
      chunkSize: 5,
      logger: silentLogger,
    });

    assert.equal(readRes.clearedCount, 12);
    assert.equal(readRes.unreadCount, 0);
    assert.equal(db.getConversation(conversationId)!.sellerUnreadCount, 0);
    assert.deepEqual(db.getUnreadMarkers(conversationId, sellerId), []);
    assert.equal(db.transactionWriteCounts.length, 3);
    assert.ok(db.transactionWriteCounts.every((w) => w <= 6)); // strictly bounded well below 500

    // Monotonic cursor protection: calling read with older msg_03 must NOT regress cursor
    const staleRes = await processMarkMarketConversationRead({
      callerUid: sellerId,
      conversationId,
      lastVisibleMessageId: 'msg_03',
      firestore: db,
      logger: silentLogger,
    });
    assert.equal(staleRes.lastReadMessageId, 'msg_12');
    assert.equal(staleRes.lastReadAt, 1700000012000);
    assert.equal(db.getConversation(conversationId)!.sellerLastReadMessageId, 'msg_12');
  });

  it('12. Messages strictly after lastVisibleMessageId stay unread (both pre-existing & newly arriving)', async () => {
    const db = createSeededDb();

    for (let i = 1; i <= 5; i += 1) {
      const id = `m_${i}`;
      const payload = makeMsg({
        senderId: sellerId,
        receiverId: buyerId,
        text: `Reply ${i}`,
        createdAt: 1700000000000 + i * 1000,
      });
      db.seedMessage(id, payload);
      await processMarketMessageConversationUpdate({
        messageId: id,
        messageData: payload,
        firestore: db,
        logger: silentLogger,
      });
    }

    // Buyer marks up to m_3 as read (m_4 and m_5 are newer and remain unread)
    const res1 = await processMarkMarketConversationRead({
      callerUid: buyerId,
      conversationId,
      lastVisibleMessageId: 'm_3',
      firestore: db,
      chunkSize: 2, // force multi-chunk boundary check while newer docs exist!
      logger: silentLogger,
    });

    assert.equal(res1.clearedCount, 3);
    assert.equal(res1.unreadCount, 2);
    assert.equal(db.getConversation(conversationId)!.buyerUnreadCount, 2);
    assert.deepEqual(db.getUnreadMarkers(conversationId, buyerId), ['m_4', 'm_5']);

    // New message m_6 arrives strictly after m_3 cursor
    const m6Payload = makeMsg({
      senderId: sellerId,
      receiverId: buyerId,
      text: 'Reply 6',
      createdAt: 1700000006000,
    });
    db.seedMessage('m_6', m6Payload);
    await processMarketMessageConversationUpdate({
      messageId: 'm_6',
      messageData: m6Payload,
      firestore: db,
      logger: silentLogger,
    });

    assert.equal(db.getConversation(conversationId)!.buyerUnreadCount, 3);
    assert.deepEqual(db.getUnreadMarkers(conversationId, buyerId), ['m_4', 'm_5', 'm_6']);
  });

  it('13. Two-way users/{recipientId}/notifications creation works via processMarketMessageCreated', async () => {
    const db = createSeededDb();

    const r1 = await processMarketMessageCreated({
      messageId: 'm_combo_1',
      messageData: makeMsg({
        senderId: buyerId,
        senderName: 'Alice',
        receiverId: sellerId,
        text: 'Buyer inquiry',
        createdAt: 1700000001000,
      }),
      firestore: db,
      now: () => 1700000001100,
      logger: silentLogger,
    });

    const r2 = await processMarketMessageCreated({
      messageId: 'm_combo_2',
      messageData: makeMsg({
        senderId: sellerId,
        senderName: 'Bob CNC Lab',
        receiverId: buyerId,
        text: 'Seller response',
        createdAt: 1700000002000,
      }),
      firestore: db,
      now: () => 1700000002100,
      logger: silentLogger,
    });

    assert.equal(r1.conversation.updated, true);
    assert.equal(r1.notification.created, true);
    assert.equal(r1.notification.recipientId, sellerId);

    assert.equal(r2.conversation.updated, true);
    assert.equal(r2.notification.created, true);
    assert.equal(r2.notification.recipientId, buyerId);

    assert.equal(db.getUserNotifications(sellerId).length, 1);
    assert.equal(db.getUserNotifications(buyerId).length, 1);
    assert.equal(db.getConversation(conversationId)!.sellerUnreadCount, 1);
    assert.equal(db.getConversation(conversationId)!.buyerUnreadCount, 1);
  });

  it('14. Rules simulator & dry-run backfill planner: participant read-only enforcement, subcollection denial, underscore listingId safety', () => {
    const convDoc = {
      conversationId,
      buyerId,
      sellerId,
      participants: [buyerId, sellerId],
      buyerUnreadCount: 0,
      sellerUnreadCount: 2,
    };

    // Participant get & list allowed
    assert.equal(
      evaluateMarketConversationsRule({ action: 'get', conversationId, docData: convDoc, auth: { uid: buyerId } }).allowed,
      true
    );
    assert.equal(
      evaluateMarketConversationsRule({ action: 'list', conversationId, docData: convDoc, auth: { uid: sellerId } }).allowed,
      true
    );

    // Stranger & unauthenticated denied
    assert.equal(
      evaluateMarketConversationsRule({ action: 'get', conversationId, docData: convDoc, auth: { uid: strangerId } }).allowed,
      false
    );
    assert.equal(
      evaluateMarketConversationsRule({ action: 'list', conversationId, docData: convDoc, auth: null }).allowed,
      false
    );

    // Client create/update/delete strictly forbidden (even for participants)
    assert.equal(
      evaluateMarketConversationsRule({ action: 'create', conversationId, docData: convDoc, auth: { uid: buyerId } }).allowed,
      false
    );
    assert.equal(
      evaluateMarketConversationsRule({ action: 'update', conversationId, docData: convDoc, auth: { uid: sellerId } }).allowed,
      false
    );
    assert.equal(
      evaluateMarketConversationsRule({ action: 'delete', conversationId, docData: convDoc, auth: { uid: buyerId } }).allowed,
      false
    );

    // Long conversationId up to 260 chars allowed (>128 because listingId + "_" + buyerId)
    const longConvId = `${'a'.repeat(120)}_${'b'.repeat(120)}`;
    assert.equal(
      evaluateMarketConversationsRule({ action: 'get', conversationId: longConvId, docData: convDoc, auth: { uid: buyerId } }).allowed,
      true
    );

    // Internal subcollections denied on all reads/writes
    assert.equal(evaluateConversationInternalSubcollectionRule('processed_messages', 'get').allowed, false);
    assert.equal(evaluateConversationInternalSubcollectionRule('processed_messages', 'create').allowed, false);
    assert.equal(evaluateConversationInternalSubcollectionRule('unread', 'get').allowed, false);
    assert.equal(evaluateConversationInternalSubcollectionRule('unread_messages', 'list').allowed, false);
    assert.equal(evaluateConversationInternalSubcollectionRule('unread_messages', 'delete').allowed, false);

    // Dry-run backfill planner: handles underscores in listingId/buyerId, skips existing, keeps historical unread=0
    const listings = new Map([
      ['lst_with_under_score', { id: 'lst_with_under_score', sellerId: 'sel_1', sellerName: 'Seller One', title: 'Part A' }],
      ['lst_already_exists', { id: 'lst_already_exists', sellerId: 'sel_1', title: 'Part B' }],
    ]);

    const plan = planMarketConversationsBackfill({
      existingConversationIds: ['lst_already_exists_buy_2'],
      listingsById: listings,
      nowMs: 1700000099000,
      messages: [
        {
          id: 'hm_1',
          listingId: 'lst_with_under_score',
          buyerId: 'buy_with_score',
          sellerId: 'sel_1',
          senderId: 'buy_with_score',
          senderName: 'Buyer One',
          participants: ['buy_with_score', 'sel_1'],
          text: 'Older message',
          createdAt: 1700000001000,
        },
        {
          id: 'hm_2',
          listingId: 'lst_with_under_score',
          buyerId: 'buy_with_score',
          sellerId: 'sel_1',
          senderId: 'sel_1',
          senderName: 'Seller One',
          participants: ['buy_with_score', 'sel_1'],
          text: 'Newer message',
          orderId: 'ord_555',
          createdAt: 1700000003000,
        },
        {
          id: 'hm_existing',
          listingId: 'lst_already_exists',
          buyerId: 'buy_2',
          sellerId: 'sel_1',
          senderId: 'buy_2',
          participants: ['buy_2', 'sel_1'],
          text: 'Should be skipped',
          createdAt: 1700000002000,
        },
        {
          id: 'hm_forged',
          listingId: 'lst_with_under_score',
          buyerId: 'buy_with_score',
          sellerId: 'sel_evil',
          senderId: 'buy_with_score',
          participants: ['buy_with_score', 'sel_evil'],
          text: 'Forged seller',
          createdAt: 1700000004000,
        },
      ],
    });

    assert.equal(plan.dryRunOnly, true);
    assert.deepEqual(plan.skippedExistingConversations, ['lst_already_exists_buy_2']);
    assert.equal(plan.skippedMessages.length, 1);
    assert.equal(plan.skippedMessages[0].reason, 'seller_mismatch');
    assert.equal(plan.plannedConversations.length, 1);

    const plannedConv = plan.plannedConversations[0];
    assert.equal(plannedConv.conversationId, 'lst_with_under_score_buy_with_score');
    assert.equal(plannedConv.listingId, 'lst_with_under_score');
    assert.equal(plannedConv.buyerId, 'buy_with_score');
    assert.equal(plannedConv.lastMessageId, 'hm_2');
    assert.equal(plannedConv.lastMessageText, 'Newer message');
    assert.equal(plannedConv.orderId, 'ord_555');
    assert.equal(plannedConv.buyerUnreadCount, 0);
    assert.equal(plannedConv.sellerUnreadCount, 0);
    assert.equal(plan.plannedProcessedMarkers.length, 2);
  });
});
