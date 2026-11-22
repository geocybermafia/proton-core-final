import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { processMarketMessageNotification } from '../functions/src/index';

// ============================================================================
// IN-MEMORY FIRESTORE TEST DOUBLE (for exercising real processMarketMessageNotification)
// Supports .collection(...).doc(...).get() and atomic .create() semantics
// ============================================================================

class FakeDocSnapshot {
  constructor(
    public readonly id: string,
    private readonly _data: Record<string, any> | undefined
  ) {}

  get exists(): boolean {
    return this._data !== undefined;
  }

  data(): Record<string, any> | undefined {
    return this._data ? { ...this._data } : undefined;
  }
}

class FakeDocRef {
  constructor(
    private readonly store: Map<string, Record<string, any>>,
    public readonly path: string,
    public readonly id: string
  ) {}

  async get(): Promise<FakeDocSnapshot> {
    return new FakeDocSnapshot(this.id, this.store.get(this.path));
  }

  async create(data: Record<string, any>): Promise<void> {
    if (this.store.has(this.path)) {
      const err: any = new Error(`6 ALREADY_EXISTS: Document already exists: ${this.path}`);
      err.code = 6;
      throw err;
    }
    this.store.set(this.path, structuredClone(data));
  }

  async set(data: Record<string, any>): Promise<void> {
    this.store.set(this.path, structuredClone(data));
  }

  collection(subName: string): FakeCollectionRef {
    return new FakeCollectionRef(this.store, `${this.path}/${subName}`);
  }
}

class FakeCollectionRef {
  constructor(
    private readonly store: Map<string, Record<string, any>>,
    private readonly basePath: string
  ) {}

  doc(id: string): FakeDocRef {
    return new FakeDocRef(this.store, `${this.basePath}/${id}`, id);
  }
}

class FakeFirestore {
  public readonly store = new Map<string, Record<string, any>>();

  seedListing(listingId: string, data: Record<string, any>): void {
    this.store.set(`listings/${listingId}`, structuredClone(data));
  }

  collection(name: string): FakeCollectionRef {
    return new FakeCollectionRef(this.store, name);
  }

  getUserNotifications(userId: string): Array<{ id: string; data: Record<string, any> }> {
    const prefix = `users/${userId}/notifications/`;
    const results: Array<{ id: string; data: Record<string, any> }> = [];
    for (const [path, data] of this.store.entries()) {
      if (path.startsWith(prefix)) {
        results.push({ id: path.slice(prefix.length), data });
      }
    }
    return results;
  }

  countAllNotifications(): number {
    let count = 0;
    for (const path of this.store.keys()) {
      if (/^users\/[^/]+\/notifications\/[^/]+$/.test(path)) {
        count += 1;
      }
    }
    return count;
  }
}

const silentLogger = {
  log: () => {},
  warn: () => {},
  error: () => {}
};

// ============================================================================
// FIRESTORE SECURITY RULES SIMULATOR FOR match /market_messages/{messageId}
// Mirrors firestore.rules lines 462-486 verbatim
// ============================================================================

interface RuleListing {
  id: string;
  sellerId: string;
}

const isValidId = (id: unknown): boolean => {
  return typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
};

function evaluateMarketMessageCreateRule(
  messageId: string,
  incoming: Record<string, any>,
  auth: { uid: string } | null,
  listingsDb: Map<string, RuleListing>
): { allowed: boolean; reason?: string } {
  if (!auth) return { allowed: false, reason: 'UNAUTHENTICATED' };
  if (!isValidId(messageId)) return { allowed: false, reason: 'INVALID_MESSAGE_ID' };
  if (!incoming || typeof incoming !== 'object') return { allowed: false, reason: 'INVALID_PAYLOAD' };

  if (incoming.senderId !== auth.uid) return { allowed: false, reason: 'SENDER_ID_MISMATCH' };
  if (!Array.isArray(incoming.participants) || incoming.participants.length !== 2) {
    return { allowed: false, reason: 'INVALID_PARTICIPANTS_ARRAY' };
  }
  if (!incoming.participants.includes(auth.uid)) {
    return { allowed: false, reason: 'AUTH_NOT_IN_PARTICIPANTS' };
  }
  if (typeof incoming.buyerId !== 'string' || !isValidId(incoming.buyerId)) {
    return { allowed: false, reason: 'INVALID_BUYER_ID' };
  }
  if (typeof incoming.sellerId !== 'string' || !isValidId(incoming.sellerId)) {
    return { allowed: false, reason: 'INVALID_SELLER_ID' };
  }
  if (incoming.buyerId === incoming.sellerId) {
    return { allowed: false, reason: 'SELF_CHAT_FORBIDDEN' };
  }
  if (typeof incoming.listingId !== 'string' || !isValidId(incoming.listingId)) {
    return { allowed: false, reason: 'INVALID_LISTING_ID' };
  }

  const listing = listingsDb.get(incoming.listingId);
  if (!listing) return { allowed: false, reason: 'LISTING_NOT_FOUND' };
  if (listing.sellerId !== incoming.sellerId) return { allowed: false, reason: 'FORGED_SELLER_ID' };

  if (!incoming.participants.includes(incoming.buyerId) || !incoming.participants.includes(incoming.sellerId)) {
    return { allowed: false, reason: 'PARTICIPANTS_MISMATCH' };
  }

  if (typeof incoming.conversationId !== 'string' || incoming.conversationId !== `${incoming.listingId}_${incoming.buyerId}`) {
    return { allowed: false, reason: 'CONVERSATION_ID_MISMATCH' };
  }

  const expectedReceiver = auth.uid === incoming.sellerId ? incoming.buyerId : incoming.sellerId;
  if (incoming.receiverId !== expectedReceiver) {
    return { allowed: false, reason: 'RECEIVER_ID_MISMATCH' };
  }

  if (typeof incoming.text !== 'string' || incoming.text.length === 0 || incoming.text.length > 2000) {
    return { allowed: false, reason: 'INVALID_TEXT' };
  }
  if (typeof incoming.listingTitle !== 'string' || incoming.listingTitle.length > 300) {
    return { allowed: false, reason: 'INVALID_LISTING_TITLE' };
  }
  if ('orderId' in incoming && (typeof incoming.orderId !== 'string' || !isValidId(incoming.orderId))) {
    return { allowed: false, reason: 'INVALID_ORDER_ID' };
  }
  if ('senderAvatar' in incoming && (typeof incoming.senderAvatar !== 'string' || incoming.senderAvatar.length > 2000)) {
    return { allowed: false, reason: 'INVALID_SENDER_AVATAR' };
  }
  if ('senderName' in incoming && (typeof incoming.senderName !== 'string' || incoming.senderName.length > 200)) {
    return { allowed: false, reason: 'INVALID_SENDER_NAME' };
  }

  return { allowed: true };
}

// ============================================================================
// TEST SUITE: CHAT-AUD-01 TWO-WAY MARKET CHAT NOTIFICATIONS
// ============================================================================

describe('PROTON CHAT-AUD-01: Two-Way Market Chat Notifications (Unit & Logic)', () => {
  const buyerId = 'buyer_alice_001';
  const sellerId = 'seller_bob_002';
  const otherBuyerId = 'buyer_carol_003';
  const attackerId = 'attacker_mallory_999';
  const listingId = 'listing_cnc_100';

  const makeValidListingDb = () => {
    const db = new FakeFirestore();
    db.seedListing(listingId, {
      id: listingId,
      sellerId,
      sellerName: 'Bob Studio',
      title: 'CNC Spindle Kit',
      status: 'active'
    });
    return db;
  };

  it('1. Buyer -> Seller: creates exactly one notification for the real seller', async () => {
    const db = makeValidListingDb();
    const res = await processMarketMessageNotification({
      messageId: 'msg_b2s_001',
      messageData: {
        conversationId: `${listingId}_${buyerId}`,
        listingId,
        listingTitle: 'CNC Spindle Kit',
        senderId: buyerId,
        senderName: 'Alice',
        text: 'Hello, is this still available?',
        sellerId,
        buyerId,
        receiverId: sellerId,
        participants: [buyerId, sellerId]
      },
      firestore: db,
      now: () => 1700000001000,
      logger: silentLogger
    });

    assert.equal(res.created, true);
    assert.equal(res.recipientId, sellerId);
    assert.equal(res.notificationId, 'market_msg_msg_b2s_001');

    const sellerNotifs = db.getUserNotifications(sellerId);
    const buyerNotifs = db.getUserNotifications(buyerId);
    assert.equal(sellerNotifs.length, 1);
    assert.equal(buyerNotifs.length, 0);
    assert.equal(sellerNotifs[0].id, 'market_msg_msg_b2s_001');
    assert.equal(sellerNotifs[0].data.type, 'market_message');
    assert.equal(sellerNotifs[0].data.category, 'market');
    assert.equal(sellerNotifs[0].data.read, false);
    assert.equal(sellerNotifs[0].data.conversationId, `${listingId}_${buyerId}`);
    assert.equal(sellerNotifs[0].data.sellerId, sellerId);
    assert.equal(sellerNotifs[0].data.buyerId, buyerId);
    assert.equal(sellerNotifs[0].data.listingId, listingId);
  });

  it('2. Seller -> Buyer: creates exactly one notification for the buyer when seller replies', async () => {
    const db = makeValidListingDb();
    const res = await processMarketMessageNotification({
      messageId: 'msg_s2b_002',
      messageData: {
        conversationId: `${listingId}_${buyerId}`,
        listingId,
        listingTitle: 'CNC Spindle Kit',
        senderId: sellerId,
        senderName: 'Bob Studio',
        text: 'Yes, ready to ship today!',
        sellerId,
        buyerId,
        receiverId: buyerId,
        participants: [buyerId, sellerId]
      },
      firestore: db,
      now: () => 1700000002000,
      logger: silentLogger
    });

    assert.equal(res.created, true);
    assert.equal(res.recipientId, buyerId);
    assert.equal(res.notificationId, 'market_msg_msg_s2b_002');

    const buyerNotifs = db.getUserNotifications(buyerId);
    const sellerNotifs = db.getUserNotifications(sellerId);
    assert.equal(buyerNotifs.length, 1);
    assert.equal(sellerNotifs.length, 0);
    assert.equal(buyerNotifs[0].id, 'market_msg_msg_s2b_002');
    assert.equal(buyerNotifs[0].data.conversationId, `${listingId}_${buyerId}`);
    assert.equal(buyerNotifs[0].data.metadata.senderId, sellerId);
    assert.equal(buyerNotifs[0].data.metadata.recipientId, buyerId);
  });

  it('3. Order-linked chat: preserves orderId and notifies both buyer -> seller and seller -> buyer', async () => {
    const db = makeValidListingDb();
    const orderId = 'ord_cnc_777';

    const buyerSend = await processMarketMessageNotification({
      messageId: 'msg_ord_1',
      messageData: {
        conversationId: `${listingId}_${buyerId}`,
        listingId,
        listingTitle: 'CNC Spindle Kit',
        senderId: buyerId,
        senderName: 'Alice',
        text: 'Can you share tracking number?',
        sellerId,
        buyerId,
        receiverId: sellerId,
        participants: [buyerId, sellerId],
        orderId
      },
      firestore: db,
      now: () => 1700000003000,
      logger: silentLogger
    });

    const sellerReply = await processMarketMessageNotification({
      messageId: 'msg_ord_2',
      messageData: {
        conversationId: `${listingId}_${buyerId}`,
        listingId,
        listingTitle: 'CNC Spindle Kit',
        senderId: sellerId,
        senderName: 'Bob Studio',
        text: 'Tracking: TRK-9912',
        sellerId,
        buyerId,
        receiverId: buyerId,
        participants: [buyerId, sellerId],
        orderId
      },
      firestore: db,
      now: () => 1700000004000,
      logger: silentLogger
    });

    assert.equal(buyerSend.created, true);
    assert.equal(buyerSend.recipientId, sellerId);
    assert.equal(sellerReply.created, true);
    assert.equal(sellerReply.recipientId, buyerId);

    const sellerNotifs = db.getUserNotifications(sellerId);
    const buyerNotifs = db.getUserNotifications(buyerId);
    assert.equal(sellerNotifs[0].data.orderId, orderId);
    assert.equal(sellerNotifs[0].data.metadata.orderId, orderId);
    assert.equal(buyerNotifs[0].data.orderId, orderId);
    assert.equal(buyerNotifs[0].data.metadata.orderId, orderId);
  });

  it('4. Self-messaging: buyerId === sellerId never creates any notification', async () => {
    const db = makeValidListingDb();
    const res = await processMarketMessageNotification({
      messageId: 'msg_self_001',
      messageData: {
        conversationId: `${listingId}_${sellerId}`,
        listingId,
        listingTitle: 'CNC Spindle Kit',
        senderId: sellerId,
        text: 'Talking to myself',
        sellerId,
        buyerId: sellerId,
        receiverId: sellerId,
        participants: [sellerId, sellerId]
      },
      firestore: db,
      logger: silentLogger
    });

    assert.equal(res.created, false);
    assert.equal(res.reason, 'self_messaging_forbidden');
    assert.equal(db.countAllNotifications(), 0);
  });

  it('5. Forged sellerId / non-existent listing: never creates any notification', async () => {
    const db = makeValidListingDb();

    // Forged sellerId mismatching listing.sellerId
    const forgedRes = await processMarketMessageNotification({
      messageId: 'msg_forged_seller',
      messageData: {
        conversationId: `${listingId}_${buyerId}`,
        listingId,
        listingTitle: 'CNC Spindle Kit',
        senderId: buyerId,
        text: 'Spoofing sellerId',
        sellerId: attackerId,
        buyerId,
        receiverId: attackerId,
        participants: [buyerId, attackerId]
      },
      firestore: db,
      logger: silentLogger
    });
    assert.equal(forgedRes.created, false);
    assert.equal(forgedRes.reason, 'seller_mismatch');

    // Non-existent listing
    const missingListingRes = await processMarketMessageNotification({
      messageId: 'msg_no_listing',
      messageData: {
        conversationId: `ghost_listing_${buyerId}`,
        listingId: 'ghost_listing',
        listingTitle: 'Ghost Item',
        senderId: buyerId,
        text: 'No listing exists',
        sellerId,
        buyerId,
        receiverId: sellerId,
        participants: [buyerId, sellerId]
      },
      firestore: db,
      logger: silentLogger
    });
    assert.equal(missingListingRes.created, false);
    assert.equal(missingListingRes.reason, 'listing_not_found');
    assert.equal(db.countAllNotifications(), 0);
  });

  it('6. Missing, incomplete, or tampered participant/routing fields: creates zero notifications', async () => {
    const db = makeValidListingDb();

    const baseValid = {
      conversationId: `${listingId}_${buyerId}`,
      listingId,
      listingTitle: 'CNC Spindle Kit',
      senderId: buyerId,
      text: 'Test message',
      sellerId,
      buyerId,
      receiverId: sellerId,
      participants: [buyerId, sellerId]
    };

    const invalidCases: Array<{ label: string; data: any }> = [
      { label: 'null data', data: null },
      { label: 'missing sellerId', data: { ...baseValid, sellerId: '' } },
      { label: 'missing buyerId', data: { ...baseValid, buyerId: undefined } },
      { label: 'missing listingId', data: { ...baseValid, listingId: '' } },
      { label: 'missing senderId', data: { ...baseValid, senderId: '' } },
      { label: 'missing conversationId', data: { ...baseValid, conversationId: '' } },
      { label: 'forged conversationId', data: { ...baseValid, conversationId: `${listingId}_${otherBuyerId}` } },
      { label: 'sender not participant', data: { ...baseValid, senderId: attackerId } },
      { label: 'participants missing array', data: { ...baseValid, participants: undefined } },
      { label: 'participants includes stranger', data: { ...baseValid, participants: [buyerId, attackerId] } },
      { label: 'receiverId mismatch', data: { ...baseValid, receiverId: attackerId } }
    ];

    for (let i = 0; i < invalidCases.length; i += 1) {
      const c = invalidCases[i];
      const res = await processMarketMessageNotification({
        messageId: `msg_invalid_${i}`,
        messageData: c.data,
        firestore: db,
        logger: silentLogger
      });
      assert.equal(res.created, false, `Expected rejected for case: ${c.label}`);
    }

    assert.equal(db.countAllNotifications(), 0);
  });

  it('7. Idempotency: duplicate sequential or concurrent invocations produce only one notification', async () => {
    const db = makeValidListingDb();
    const payload = {
      conversationId: `${listingId}_${buyerId}`,
      listingId,
      listingTitle: 'CNC Spindle Kit',
      senderId: sellerId,
      text: 'Idempotent reply',
      sellerId,
      buyerId,
      receiverId: buyerId,
      participants: [buyerId, sellerId]
    };

    // Concurrent race simulation
    const [r1, r2] = await Promise.all([
      processMarketMessageNotification({
        messageId: 'msg_race_001',
        messageData: payload,
        firestore: db,
        now: () => 1700000005000,
        logger: silentLogger
      }),
      processMarketMessageNotification({
        messageId: 'msg_race_001',
        messageData: payload,
        firestore: db,
        now: () => 1700000005000,
        logger: silentLogger
      })
    ]);

    const createdCount = [r1, r2].filter((r) => r.created).length;
    assert.equal(createdCount, 1);

    // Sequential retry
    const r3 = await processMarketMessageNotification({
      messageId: 'msg_race_001',
      messageData: payload,
      firestore: db,
      now: () => 1700000006000,
      logger: silentLogger
    });
    assert.equal(r3.created, false);
    assert.equal(r3.reason, 'already_exists');

    assert.equal(db.getUserNotifications(buyerId).length, 1);
    assert.equal(db.countAllNotifications(), 1);
  });

  it('8. Conversation isolation: separate buyers on the same listing stay strictly isolated', async () => {
    const db = makeValidListingDb();

    // Seller replies to Buyer A
    await processMarketMessageNotification({
      messageId: 'msg_iso_a',
      messageData: {
        conversationId: `${listingId}_${buyerId}`,
        listingId,
        listingTitle: 'CNC Spindle Kit',
        senderId: sellerId,
        text: 'Reply for Alice',
        sellerId,
        buyerId,
        receiverId: buyerId,
        participants: [buyerId, sellerId]
      },
      firestore: db,
      logger: silentLogger
    });

    // Buyer B messages Seller
    await processMarketMessageNotification({
      messageId: 'msg_iso_b',
      messageData: {
        conversationId: `${listingId}_${otherBuyerId}`,
        listingId,
        listingTitle: 'CNC Spindle Kit',
        senderId: otherBuyerId,
        text: 'Question from Carol',
        sellerId,
        buyerId: otherBuyerId,
        receiverId: sellerId,
        participants: [otherBuyerId, sellerId]
      },
      firestore: db,
      logger: silentLogger
    });

    assert.equal(db.getUserNotifications(buyerId).length, 1);
    assert.equal(db.getUserNotifications(buyerId)[0].data.conversationId, `${listingId}_${buyerId}`);
    assert.equal(db.getUserNotifications(otherBuyerId).length, 0);
    assert.equal(db.getUserNotifications(sellerId).length, 1);
    assert.equal(db.getUserNotifications(sellerId)[0].data.conversationId, `${listingId}_${otherBuyerId}`);
  });

  it('9. Firestore Rules simulator: enforces auth, distinct participants, listing ownership, and denies forgery/self-chat', () => {
    const listingsDb = new Map<string, RuleListing>([
      [listingId, { id: listingId, sellerId }]
    ]);

    const validBuyerMsg = {
      conversationId: `${listingId}_${buyerId}`,
      listingId,
      listingTitle: 'CNC Spindle Kit',
      senderId: buyerId,
      senderName: 'Alice',
      senderAvatar: '',
      text: 'Hi Bob!',
      sellerId,
      buyerId,
      receiverId: sellerId,
      participants: [buyerId, sellerId]
    };

    const validSellerReply = {
      conversationId: `${listingId}_${buyerId}`,
      listingId,
      listingTitle: 'CNC Spindle Kit',
      senderId: sellerId,
      senderName: 'Bob Studio',
      senderAvatar: '',
      text: 'Hi Alice!',
      sellerId,
      buyerId,
      receiverId: buyerId,
      participants: [buyerId, sellerId],
      orderId: 'ord_123'
    };

    // Allowed legitimate buyer & seller writes
    assert.equal(evaluateMarketMessageCreateRule('msg_ok_1', validBuyerMsg, { uid: buyerId }, listingsDb).allowed, true);
    assert.equal(evaluateMarketMessageCreateRule('msg_ok_2', validSellerReply, { uid: sellerId }, listingsDb).allowed, true);

    // Denied: unauthenticated
    assert.equal(evaluateMarketMessageCreateRule('msg_noauth', validBuyerMsg, null, listingsDb).reason, 'UNAUTHENTICATED');

    // Denied: self-chat
    const selfChatMsg = {
      ...validBuyerMsg,
      senderId: sellerId,
      buyerId: sellerId,
      receiverId: sellerId,
      conversationId: `${listingId}_${sellerId}`,
      participants: [sellerId, sellerId]
    };
    assert.equal(evaluateMarketMessageCreateRule('msg_self', selfChatMsg, { uid: sellerId }, listingsDb).reason, 'SELF_CHAT_FORBIDDEN');

    // Denied: forged sellerId on existing listing
    const forgedSellerMsg = {
      ...validBuyerMsg,
      sellerId: attackerId,
      receiverId: attackerId,
      participants: [buyerId, attackerId]
    };
    assert.equal(evaluateMarketMessageCreateRule('msg_forge_seller', forgedSellerMsg, { uid: buyerId }, listingsDb).reason, 'FORGED_SELLER_ID');

    // Denied: outsider impersonation / injection
    const outsiderMsg = {
      ...validBuyerMsg,
      senderId: attackerId
    };
    assert.equal(evaluateMarketMessageCreateRule('msg_outsider', outsiderMsg, { uid: attackerId }, listingsDb).reason, 'AUTH_NOT_IN_PARTICIPANTS');

    // Denied: senderId spoofing another user
    assert.equal(evaluateMarketMessageCreateRule('msg_spoof', validBuyerMsg, { uid: sellerId }, listingsDb).reason, 'SENDER_ID_MISMATCH');

    // Denied: missing listing
    const noListingMsg = {
      ...validBuyerMsg,
      listingId: 'missing_999',
      conversationId: `missing_999_${buyerId}`
    };
    assert.equal(evaluateMarketMessageCreateRule('msg_nolist', noListingMsg, { uid: buyerId }, listingsDb).reason, 'LISTING_NOT_FOUND');
  });
});
