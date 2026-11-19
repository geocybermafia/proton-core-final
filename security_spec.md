# Firestore Security Specification

## Data Invariants

### Listings
- `title`, `category`, `country`, `city` are required and must be strings with size limits.
- `price` must be a positive number.
- `sellerId` must match the authenticated user's UID on creation and remain immutable.
- `status` must be 'active' or 'sold'.
- `createdAt` must be set to `request.time` (server timestamp).

### Orders
- `listingId`, `buyerId`, `sellerId`, `amount`, `currency`, `itemTitle`, `status`, `createdAt` are required.
- `buyerId` must match the authenticated user's UID on creation.
- `amount` must match the listing's price (Relational Sync).
- `createdAt` must be `request.time`.

## The "Dirty Dozen" Payloads (Attacks)

1. **Identity Spoofing (Listing)**: Creating a listing with someone else's `sellerId`.
2. **Resource Poisoning (Listing)**: Injecting a 2MB string into the `title` or `description`.
3. **State Shortcutting (Listing)**: Updating a 'sold' listing back to 'active' (if terminal states were enforced).
4. **ID Poisoning (Listing)**: Creating a listing with a document ID containing malicious characters or being extremely long.
5. **Unauthorized Update (Listing)**: Modifying someone else's listing.
6. **Shadow Update (Listing)**: Adding a `isVerified: true` ghost field to a listing.
7. **Identity Spoofing (Order)**: Creating an order with someone else's `buyerId`.
8. **Resource Poisoning (Order)**: Injecting junk into `itemTitle`.
9. **Relational Deletion (Order)**: Deleting an order record (Orders should be immutable/audit-only).
10. **Unauthorized Read (Order)**: Another user trying to list orders they didn't buy or sell.
11. **Price Manipulation (Order)**: Creating an order for an item but setting the `amount` to `0.01` regardless of listing price.
12. **Timestamp Fraud**: Providing a back-dated `createdAt` timestamp.

### Phase 2B Seller Analytics Foundation
- `seller_analytics/{sellerId}`: Private aggregated seller analytics & funnel metrics. Client `get` allowed strictly when `request.auth.uid == sellerId`, `isValidId(sellerId)`, and (`resource == null || resource.data.sellerId == request.auth.uid`). `list` and all client writes (`create`, `update`, `delete`) are forbidden (`if false`). Admin SDK only writes. Daily buckets capped at 62 days; hourly buckets capped at 52 hours.
- `seller_analytics/{sellerId}/viewers/{sellerViewerHash}`: Server-only HMAC-SHA256 viewer markers. Client `read` and `write` strictly forbidden (`if false`). Zero raw IP, raw `visitorToken`, `User-Agent`, email, or UID stored.
- `analytics_guest_sessions/{guestHash}`: Server-only HMAC-SHA256 guest session index with max 50 `listingIds`, max 30 `sellerIds`, and 30-day TTL (`expiresAt`). Client `read` and `write` strictly forbidden (`if false`). Single-claim transactional binding prevents overwriting `linkedUid` (`409 visitor_already_claimed`).
- `analytics_verified_markers/{markerId}`: Server-only idempotency markers (`order_{orderId}`, `contact_{sourceId}`). Client `read` and `write` strictly forbidden (`if false`).

## Test Runner (Draft)

- `tests/seller-reviews-security.test.ts`
- `tests/market-phase1-competition.test.ts`
- `tests/market-analytics-competition.test.ts`
- `tests/market-phase2a-session-hygiene.test.ts`
- `tests/market-phase2b-seller-foundation.test.ts`
