import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  beginAuthVisitorLinkIntent,
  cancelAuthVisitorLinkIntent,
  consumePendingAuthVisitorLinkIntent,
  evaluateGuestToAuthTransition,
  getOrCreateVisitorToken,
  getPendingAuthVisitorLinkIntent,
  hasSessionImpression,
  markClientView,
  markSessionImpression,
  peekExistingVisitorToken,
  resetMarketAnalyticsSession,
  rotateVisitorToken,
  sendListingAnalyticsEvent,
  shouldThrottleClientView,
} from '../src/utils/marketAnalyticsClient.js';
import {
  cleanupClientSessionOnLogout,
  processAuthStateTransitionForAnalytics,
  SESSION_SWITCH_CLEANUP_LOCAL_STORAGE_KEYS,
} from '../src/contexts/AuthContext.js';
import { computeBalancedScore } from '../src/lib/marketAnalyticsUtils.js';
import type {
  MarketFunnelEventType,
  SellerAnalyticsDoc,
  SellerFunnelMetrics,
} from '../src/types.js';

class MockStorage implements Storage {
  private store = new Map<string, string>();
  public throwOnAccess = false;

  get length(): number {
    if (this.throwOnAccess) throw new DOMException('Blocked', 'SecurityError');
    return this.store.size;
  }

  clear(): void {
    if (this.throwOnAccess) throw new DOMException('Blocked', 'SecurityError');
    this.store.clear();
  }

  getItem(key: string): string | null {
    if (this.throwOnAccess) throw new DOMException('Blocked', 'SecurityError');
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    if (this.throwOnAccess) throw new DOMException('Blocked', 'SecurityError');
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    if (this.throwOnAccess) throw new DOMException('Blocked', 'SecurityError');
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.throwOnAccess) throw new DOMException('Blocked', 'SecurityError');
    this.store.set(key, String(value));
  }
}

describe('PROTON Market Hub — Phase 2A: Session Hygiene & Zero-Breaking Foundation', () => {
  let origWindow: any;
  let origFetch: any;
  let mockLocalStorage: MockStorage;
  let mockSessionStorage: MockStorage;

  beforeEach(() => {
    origWindow = (globalThis as any).window;
    origFetch = globalThis.fetch;
    mockLocalStorage = new MockStorage();
    mockSessionStorage = new MockStorage();
    (globalThis as any).window = {
      localStorage: mockLocalStorage,
      sessionStorage: mockSessionStorage,
    };
    resetMarketAnalyticsSession();
  });

  afterEach(() => {
    resetMarketAnalyticsSession();
    (globalThis as any).window = origWindow;
    globalThis.fetch = origFetch;
  });

  it('1-3. resetMarketAnalyticsSession (used by AuthContext.logout) clears memoryVisitorId, impression/view throttles, and analytics storage keys while preserving other keys', () => {
    // Seed guest token, throttles, and unrelated user data (favorites, theme, etc.)
    const tokenA = getOrCreateVisitorToken();
    assert.match(tokenA, /^vst_[a-zA-Z0-9_-]{8,128}$/);

    markSessionImpression('listing_101');
    markClientView('listing_101');
    mockLocalStorage.setItem('proton_market_favorites', JSON.stringify(['listing_101']));
    mockLocalStorage.setItem('proton_theme', 'proton');
    mockSessionStorage.setItem('unrelated_session_flag', 'keep_me');

    assert.equal(hasSessionImpression('listing_101'), true);
    assert.equal(shouldThrottleClientView('listing_101'), true);
    assert.equal(mockLocalStorage.getItem('proton_market_visitor_id'), tokenA);
    assert.equal(mockSessionStorage.getItem('proton_imp_seen_listing_101'), '1');
    assert.ok(mockSessionStorage.getItem('proton_view_seen_listing_101'));

    // Simulate logout cleanup
    resetMarketAnalyticsSession();

    // 1. memoryVisitorId is cleared (peek returns null; next getOrCreate produces brand new token)
    assert.equal(peekExistingVisitorToken(), null);
    // 2. memory & storage impression/view throttles are cleared
    assert.equal(hasSessionImpression('listing_101'), false);
    assert.equal(shouldThrottleClientView('listing_101'), false);
    // 3. Analytics storage keys are deleted, while unrelated keys remain intact
    assert.equal(mockLocalStorage.getItem('proton_market_visitor_id'), null);
    assert.equal(mockSessionStorage.getItem('proton_imp_seen_listing_101'), null);
    assert.equal(mockSessionStorage.getItem('proton_view_seen_listing_101'), null);
    assert.equal(mockLocalStorage.getItem('proton_market_favorites'), JSON.stringify(['listing_101']));
    assert.equal(mockLocalStorage.getItem('proton_theme'), 'proton');
    assert.equal(mockSessionStorage.getItem('unrelated_session_flag'), 'keep_me');

    const tokenAfterReset = getOrCreateVisitorToken();
    assert.notEqual(tokenAfterReset, tokenA);
    assert.match(tokenAfterReset, /^vst_[a-zA-Z0-9_-]{8,128}$/);

    // Verify AuthContext.tsx wires cleanupClientSessionOnLogout & resetMarketAnalyticsSession into logout()
    const authCtxSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/contexts/AuthContext.tsx'), 'utf8');
    const authCtxCodeOnly = authCtxSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.ok(authCtxCodeOnly.includes('resetMarketAnalyticsSession()'));
    assert.ok(authCtxCodeOnly.includes('cleanupClientSessionOnLogout()'));
    assert.equal(authCtxCodeOnly.includes("includes('market')"), false);
    assert.equal(authCtxCodeOnly.includes('localStorage.key('), false);
  });

  it('1b. AuthContext logout cleanup (cleanupClientSessionOnLogout) preserves proton_market_favorites and non-session data while clearing analytics & session-switch keys', () => {
    const tokenBeforeLogout = getOrCreateVisitorToken();
    markSessionImpression('listing_555');
    markClientView('listing_555');
    beginAuthVisitorLinkIntent('google_popup', null, 1500);

    // Non-session user data that MUST survive logout (previously killed by wildcard loop!)
    mockLocalStorage.setItem('proton_market_favorites', JSON.stringify(['listing_555', 'listing_777']));
    mockLocalStorage.setItem('proton_creative_ad_draft', JSON.stringify({ hook: 'Ad Hook', body: 'Body' }));
    mockLocalStorage.setItem('proton_active_timer_task_id', 'task_99');
    mockLocalStorage.setItem('organizer_daily_anchor_task_id', 'task_99');
    mockLocalStorage.setItem('proton_theme', 'enterprise');
    mockLocalStorage.setItem('proton_ui_mode', 'market');
    mockLocalStorage.setItem('user-profile', JSON.stringify({ language: 'ka' }));
    mockLocalStorage.setItem('proton_focus_minutes', '25');
    mockLocalStorage.setItem('proton_ai_settings', JSON.stringify({ temperature: 0.4 }));
    // Synthetic unrelated keys containing former wildcard substrings
    mockLocalStorage.setItem('custom_market_filter_pref', 'service');
    mockLocalStorage.setItem('saved_listing_view_mode', 'grid');
    mockLocalStorage.setItem('user_custom_form_state', 'step_2');
    mockSessionStorage.setItem('proton_last_route', '/market');

    // Explicit per-account session-switch keys that MUST be cleared on logout
    for (const sessionKey of SESSION_SWITCH_CLEANUP_LOCAL_STORAGE_KEYS) {
      mockLocalStorage.setItem(sessionKey, `user_A_${sessionKey}`);
    }

    // Execute exact AuthContext logout cleanup function
    cleanupClientSessionOnLogout(mockLocalStorage);

    // 1. Analytics memory + storage cleared exclusively by resetMarketAnalyticsSession()
    assert.equal(peekExistingVisitorToken(), null);
    assert.equal(hasSessionImpression('listing_555'), false);
    assert.equal(shouldThrottleClientView('listing_555'), false);
    assert.equal(getPendingAuthVisitorLinkIntent(), null);
    assert.equal(mockLocalStorage.getItem('proton_market_visitor_id'), null);
    assert.equal(mockSessionStorage.getItem('proton_market_pending_auth_link'), null);
    assert.equal(mockSessionStorage.getItem('proton_imp_seen_listing_555'), null);
    assert.equal(mockSessionStorage.getItem('proton_view_seen_listing_555'), null);

    // 2. Explicit session-switch account keys are cleared
    for (const sessionKey of SESSION_SWITCH_CLEANUP_LOCAL_STORAGE_KEYS) {
      assert.equal(mockLocalStorage.getItem(sessionKey), null, `${sessionKey} should be cleared on logout`);
    }

    // 3. Favorites & all non-session user data are preserved intact
    assert.equal(mockLocalStorage.getItem('proton_market_favorites'), JSON.stringify(['listing_555', 'listing_777']));
    assert.equal(mockLocalStorage.getItem('proton_creative_ad_draft'), JSON.stringify({ hook: 'Ad Hook', body: 'Body' }));
    assert.equal(mockLocalStorage.getItem('proton_active_timer_task_id'), 'task_99');
    assert.equal(mockLocalStorage.getItem('organizer_daily_anchor_task_id'), 'task_99');
    assert.equal(mockLocalStorage.getItem('proton_theme'), 'enterprise');
    assert.equal(mockLocalStorage.getItem('proton_ui_mode'), 'market');
    assert.equal(mockLocalStorage.getItem('user-profile'), JSON.stringify({ language: 'ka' }));
    assert.equal(mockLocalStorage.getItem('proton_focus_minutes'), '25');
    assert.equal(mockLocalStorage.getItem('proton_ai_settings'), JSON.stringify({ temperature: 0.4 }));
    assert.equal(mockLocalStorage.getItem('custom_market_filter_pref'), 'service');
    assert.equal(mockLocalStorage.getItem('saved_listing_view_mode'), 'grid');
    assert.equal(mockLocalStorage.getItem('user_custom_form_state'), 'step_2');
    assert.equal(mockSessionStorage.getItem('proton_last_route'), '/market');

    // 4. Subsequent guest/user session gets a brand new visitorToken
    const tokenAfterLogout = getOrCreateVisitorToken();
    assert.notEqual(tokenAfterLogout, tokenBeforeLogout);
  });

  it('4. User A -> logout -> User B never shares User A visitorToken, and raw null -> User / reload never links guest history', () => {
    // User A browses as guest before signing in
    const tokenA = getOrCreateVisitorToken();
    beginAuthVisitorLinkIntent('google_popup', null, 1000);
    assert.ok(getPendingAuthVisitorLinkIntent());

    // Initial mount as null (unauthenticated)
    let tracker = processAuthStateTransitionForAnalytics(
      { hasResolvedInitialAuth: false, previousUid: null, pendingGuestLinkCandidate: null },
      null,
      1000
    );
    assert.equal(tracker.hasResolvedInitialAuth, true);
    assert.equal(tracker.pendingGuestLinkCandidate, null);

    // User A explicit verified sign-in (null -> uid_A with valid PendingGuestLinkContext)
    beginAuthVisitorLinkIntent('google_popup', null, 2000);
    tracker = processAuthStateTransitionForAnalytics(tracker, 'uid_A', 2100);
    assert.equal(tracker.previousUid, 'uid_A');
    assert.equal(tracker.pendingGuestLinkCandidate?.visitorToken, tokenA);
    // Pending intent was consumed once and cannot be reused
    assert.equal(getPendingAuthVisitorLinkIntent(), null);

    // User A logs out (resetMarketAnalyticsSession + auth -> null)
    resetMarketAnalyticsSession();
    tracker = processAuthStateTransitionForAnalytics(tracker, null, 3000);
    assert.equal(tracker.previousUid, null);
    assert.equal(tracker.pendingGuestLinkCandidate, null);
    assert.equal(peekExistingVisitorToken(), null);

    // User B signs in immediately on the same SPA tab without page reload
    beginAuthVisitorLinkIntent('email_password', null, 3500);
    // Because User A's session was wiped, there is NO visitorToken left to inherit or link
    assert.equal(getPendingAuthVisitorLinkIntent(), null);
    tracker = processAuthStateTransitionForAnalytics(tracker, 'uid_B', 3600);
    assert.equal(tracker.previousUid, 'uid_B');
    assert.equal(tracker.pendingGuestLinkCandidate, null);

    // If User B later browses as guest after logging out, User B gets a completely independent token
    resetMarketAnalyticsSession();
    tracker = processAuthStateTransitionForAnalytics(tracker, null, 4000);
    const tokenB = getOrCreateVisitorToken();
    assert.notEqual(tokenB, tokenA);

    // Page reload auto-restore (hasResolvedInitialAuth = false) must NEVER trigger Guest -> Auth linking
    beginAuthVisitorLinkIntent('google_popup', null, 5000);
    const reloadRestore = processAuthStateTransitionForAnalytics(
      { hasResolvedInitialAuth: false, previousUid: null, pendingGuestLinkCandidate: null },
      'uid_B',
      5100
    );
    assert.equal(reloadRestore.pendingGuestLinkCandidate, null);
    assert.equal(getPendingAuthVisitorLinkIntent(), null);

    // Raw null -> User without explicit sign-in context must NEVER trigger Guest -> Auth linking
    const rawTransition = evaluateGuestToAuthTransition({
      isInitialSessionRestore: false,
      previousUid: null,
      nextUid: 'uid_B',
      pendingContext: null,
      nowMs: 6000,
    });
    assert.equal(rawTransition.shouldLink, false);
    assert.equal(rawTransition.reason, 'missing_verified_signin_context');

    // Cancelled sign-in intent clears pending context
    beginAuthVisitorLinkIntent('google_popup', null, 7000);
    assert.ok(getPendingAuthVisitorLinkIntent());
    cancelAuthVisitorLinkIntent();
    assert.equal(consumePendingAuthVisitorLinkIntent(), null);
  });

  it('5. rotateVisitorToken invalidates old memoryVisitorId and throttles and returns an independent Phase 1-valid token', () => {
    const initialToken = getOrCreateVisitorToken();
    markSessionImpression('lst_1');
    markClientView('lst_1');

    const rotatedToken = rotateVisitorToken();
    assert.notEqual(rotatedToken, initialToken);
    assert.match(rotatedToken, /^vst_[a-zA-Z0-9_-]{8,128}$/);
    assert.equal(peekExistingVisitorToken(), rotatedToken);
    assert.equal(getOrCreateVisitorToken(), rotatedToken);
    assert.equal(mockLocalStorage.getItem('proton_market_visitor_id'), rotatedToken);

    // Old impression/view throttles must NOT carry over after rotation
    assert.equal(hasSessionImpression('lst_1'), false);
    assert.equal(shouldThrottleClientView('lst_1'), false);
  });

  it('6. Storage unavailability (SecurityError) never crashes analytics or cleanup functions', () => {
    mockLocalStorage.throwOnAccess = true;
    mockSessionStorage.throwOnAccess = true;

    assert.doesNotThrow(() => {
      const t1 = getOrCreateVisitorToken();
      assert.match(t1, /^vst_[a-zA-Z0-9_-]{8,128}$/);
      markSessionImpression('lst_err');
      markClientView('lst_err');
      assert.equal(hasSessionImpression('lst_err'), true);
      assert.equal(shouldThrottleClientView('lst_err'), true);
      beginAuthVisitorLinkIntent('google_popup', null);
      cancelAuthVisitorLinkIntent();
      const t2 = rotateVisitorToken();
      assert.notEqual(t2, t1);
      resetMarketAnalyticsSession();
      cleanupClientSessionOnLogout(mockLocalStorage);
      assert.equal(hasSessionImpression('lst_err'), false);
      assert.equal(shouldThrottleClientView('lst_err'), false);
      assert.equal(peekExistingVisitorToken(), null);
    });
  });

  it('7. Existing impression/view client telemetry continues working identically and preserves Phase 2A type contracts', async () => {
    const postedPayloads: Array<{ url: string; body: any }> = [];
    globalThis.fetch = (async (url: any, init: any) => {
      postedPayloads.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
      return new Response(JSON.stringify({ recorded: true }), { status: 200 });
    }) as any;

    sendListingAnalyticsEvent({
      listingId: 'lst_phase1_ok',
      sellerId: 'seller_xyz',
      eventType: 'impression',
      currentUserId: null,
    });
    sendListingAnalyticsEvent({
      listingId: 'lst_phase1_ok',
      sellerId: 'seller_xyz',
      eventType: 'view',
      currentUserId: null,
    });

    // Duplicate impression & view within throttle window are deduplicated as before
    sendListingAnalyticsEvent({
      listingId: 'lst_phase1_ok',
      sellerId: 'seller_xyz',
      eventType: 'impression',
      currentUserId: null,
    });
    sendListingAnalyticsEvent({
      listingId: 'lst_phase1_ok',
      sellerId: 'seller_xyz',
      eventType: 'view',
      currentUserId: null,
    });

    await new Promise((r) => setTimeout(r, 20));

    assert.equal(postedPayloads.length, 2);
    assert.equal(postedPayloads[0].url, '/api/market/listing-event');
    assert.equal(postedPayloads[0].body.eventType, 'impression');
    assert.equal(postedPayloads[1].body.eventType, 'view');
    assert.equal(postedPayloads[0].body.visitorToken, postedPayloads[1].body.visitorToken);

    // Type-check Phase 2A interfaces compile cleanly with click/confirmed/unique/guest-auth separation
    const eventSample: MarketFunnelEventType = 'contact_click';
    const funnelSample: SellerFunnelMetrics = {
      profileViews: 10,
      uniqueProfileViewers: 8,
      authProfileViews: 6,
      guestProfileViews: 4,
      authUniqueProfileViewers: 5,
      guestUniqueProfileViewers: 3,
      listingToSellerClicks: 5,
      uniqueListingToSellerUsers: 4,
      authListingToSellerClicks: 3,
      guestListingToSellerClicks: 2,
      contactClicks: 4,
      uniqueContactClickers: 3,
      authContactClicks: 3,
      guestContactClicks: 1,
      authUniqueContactClickers: 2,
      guestUniqueContactClickers: 1,
      orderIntents: 2,
      uniqueOrderIntentUsers: 2,
      authOrderIntents: 2,
      guestOrderIntents: 0,
      authUniqueOrderIntentUsers: 2,
      guestUniqueOrderIntentUsers: 0,
      contactConfirmed: 2,
      uniqueContactedBuyers: 2,
      ordersConfirmed: 1,
      uniqueOrderBuyers: 1,
      guestToAuthLinks: 1,
    };
    const docSample: SellerAnalyticsDoc = {
      sellerId: 'seller_xyz',
      optedOut: false,
      funnelTrackingSince: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...funnelSample,
    };
    assert.equal(eventSample, 'contact_click');
    assert.equal(docSample.ordersConfirmed, 1);
  });

  it('8. Phase 1 Golden Score regression remains completely unchanged', () => {
    const now = Date.UTC(2026, 4, 20, 12, 0, 0);
    const score = computeBalancedScore({
      impressions: 120,
      views: 45,
      uniqueViewers: 30,
      categoryBaseline: 15,
      sellerRatingAvg: 4.8,
      sellerRatingCount: 5,
      listingCreatedAt: now - 2 * 24 * 60 * 60 * 1000,
      nowMs: now,
    });
    const expectedRaw =
      Math.log1p(30) * 28 +
      Math.log1p(45) * 8 +
      (45 / 130) * 35 +
      Math.round(Math.log1p((30 + 45 * 0.35) / 15) * 18 * 100) / 100 +
      (4.8 / 5) * 5 * 1.2 +
      Math.round((1 - 2 / 14) * 12 * 100) / 100;

    assert.equal(score.balancedScore, Math.round(expectedRaw * 100) / 100);
    assert.equal(score.engagementRate, 37.5);
  });
});
