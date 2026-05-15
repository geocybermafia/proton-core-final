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

## Test Runner (Draft)

(Full `firestore.rules.test.ts` to be implemented after rules draft)
