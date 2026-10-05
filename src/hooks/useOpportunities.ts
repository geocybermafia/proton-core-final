import { useMemo } from 'react';
import { useSeller, isRealListing } from '../contexts/SellerContext';
import { safeParseDate } from '../components/market-hub/MarketConstants';
import { Listing, Order } from '../types';

export type OpportunityCategory = 'commerce' | 'creative' | 'content' | 'focus';
export type OpportunityPriority = 'immediate' | 'strategic' | 'nurture';

export interface Opportunity {
  id: string;
  category: OpportunityCategory;
  priority: OpportunityPriority;
  headline: string;
  reasoning: string;
  ctaLabel: string;
  listingId?: string;
  listingTitle?: string;
  stock?: number;
}

export function useOpportunities(language: 'en' | 'ka' = 'en'): Opportunity[] {
  const { sellerListings, sellerOrders } = useSeller();

  return useMemo(() => {
    const safeListings: Listing[] = Array.isArray(sellerListings) ? sellerListings : [];
    const safeOrders: Order[] = Array.isArray(sellerOrders) ? sellerOrders : [];

    const now = Date.now();
    const windowMs = 72 * 60 * 60 * 1000; // 72 hours
    const cutoff = now - windowMs;

    const opportunities: Opportunity[] = [];

    // Filter qualifying listings for Opportunity #1: Low Stock + Recent Orders
    for (const listing of safeListings) {
      // 1. Must be a real listing (not demo/mock/sample)
      if (!listing || !listing.id || !isRealListing(listing)) {
        continue;
      }

      // 2. Must not be already sold or inactive
      if (listing.status === 'sold' || listing.isSold === true) {
        continue;
      }

      // 3. Concrete numeric stock/quantity must be <= 2
      const stockVal = typeof listing.stock === 'number'
        ? listing.stock
        : (typeof listing.quantity === 'number' ? listing.quantity : undefined);

      if (stockVal === undefined || stockVal > 2) {
        continue;
      }

      // 4. Must have at least one non-cancelled order with order.listingId === listing.id within the last 72 hours
      const recentOrdersForListing = safeOrders.filter(order => {
        if (!order || order.listingId !== listing.id) return false;
        if (order.status === 'cancelled') return false;

        const orderTime = safeParseDate(order.createdAt);
        return orderTime >= cutoff && orderTime <= now + 60000; // within window (with minor clock skew guard)
      });

      if (recentOrdersForListing.length === 0) {
        continue;
      }

      // Sort recent orders to find the most recent
      recentOrdersForListing.sort((a, b) => safeParseDate(b.createdAt) - safeParseDate(a.createdAt));
      const latestOrderTime = safeParseDate(recentOrdersForListing[0].createdAt);

      const isKa = language === 'ka';
      const headline = isKa
        ? 'ამ ნივთზე მოთხოვნა ჯერ კიდევ აქტიურია'
        : 'This item still has active demand';

      const reasoning = isKa
        ? `მარაგში მხოლოდ ${stockVal} ცალია დარჩენილი და ბოლო 72 საათში ამ ნივთზე შეკვეთა დაფიქსირდა.`
        : `Only ${stockVal} left in stock, and this item received an order within the last 72 hours.`;

      const ctaLabel = isKa
        ? 'მარაგის განახლება'
        : 'Update stock';

      opportunities.push({
        id: `low-stock-recent-orders-${listing.id}`,
        category: 'commerce',
        priority: 'immediate',
        headline,
        reasoning,
        ctaLabel,
        listingId: listing.id,
        listingTitle: isKa ? (listing.titleGe || listing.title) : listing.title,
        stock: stockVal,
        _latestOrderTime: latestOrderTime
      } as Opportunity & { _latestOrderTime: number });
    }

    // Sort opportunities by latest order timestamp descending (most active first)
    opportunities.sort((a: any, b: any) => (b._latestOrderTime || 0) - (a._latestOrderTime || 0));

    // Return maximum 2 opportunities
    return opportunities.slice(0, 2).map(({ _latestOrderTime, ...opp }: any) => opp);
  }, [sellerListings, sellerOrders, language]);
}
