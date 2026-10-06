import { useMemo, useState, useEffect } from 'react';
import { useSeller, isRealListing } from '../contexts/SellerContext';
import { safeParseDate } from '../components/market-hub/MarketConstants';
import { safeStorage } from '../lib/safeStorage';
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
  const [creativeAdTick, setCreativeAdTick] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setCreativeAdTick(t => t + 1);
    window.addEventListener('proton-creative-ad-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('proton-creative-ad-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  return useMemo(() => {
    const safeListings: Listing[] = Array.isArray(sellerListings) ? sellerListings : [];
    const safeOrders: Order[] = Array.isArray(sellerOrders) ? sellerOrders : [];

    const now = Date.now();
    const windowMs = 72 * 60 * 60 * 1000; // 72 hours
    const cutoff = now - windowMs;

    const commerceOpps: (Opportunity & { _latestOrderTime?: number })[] = [];

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

      commerceOpps.push({
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
      });
    }

    // Sort Opportunity #1 items by latest order timestamp descending
    commerceOpps.sort((a, b) => (b._latestOrderTime || 0) - (a._latestOrderTime || 0));

    // -------------------------------------------------------------------------
    // Filter Opportunity #2: Creative Studio -> Market Hub Unused Ad Copy
    // -------------------------------------------------------------------------
    let creativeOpp: Opportunity | null = null;
    try {
      const creativeRecord = safeStorage.getJSON<any>('proton_creative_ad_draft', null);
      if (
        creativeRecord &&
        creativeRecord.id &&
        !creativeRecord.exportedAt &&
        creativeRecord.dismissed !== true
      ) {
        const recordAge = now - (Number(creativeRecord.createdAt) || 0);
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days window
        if (recordAge >= 0 && recordAge <= maxAge) {
          const isKa = language === 'ka';
          creativeOpp = {
            id: `creative-ad-copy-${creativeRecord.id}`,
            category: 'creative',
            priority: 'strategic',
            headline: isKa 
              ? 'ახალი სარეკლამო ტექსტი მზად არის გამოსაყენებლად'
              : 'Your new product copy is ready to use',
            reasoning: isKa
              ? 'Creative Studio-ში შექმნილი ახალი სარეკლამო ტექსტი ჯერ Market-ში არ გამოგიყენებია.'
              : 'You created new product copy in Creative Studio, but it has not been used in Market yet.',
            ctaLabel: isKa
              ? 'დრაფტის გამოქვეყნება'
              : 'Publish Draft',
            listingTitle: creativeRecord.title || creativeRecord.hook || (isKa ? 'სარეკლამო კოპი' : 'Ad Copy')
          };
        }
      }
    } catch (err) {
      console.warn("[useOpportunities] Failed to evaluate creative ad draft opportunity:", err);
    }

    // Coexistence: Return up to 2 opportunities total
    // If both Commerce and Creative exist, display 1 Commerce and 1 Creative
    const resultOpps: (Opportunity & { _latestOrderTime?: number })[] = [];
    if (creativeOpp) {
      if (commerceOpps.length > 0) {
        resultOpps.push(commerceOpps[0]);
        resultOpps.push(creativeOpp);
      } else {
        resultOpps.push(creativeOpp);
      }
    } else {
      resultOpps.push(...commerceOpps.slice(0, 2));
    }

    return resultOpps.map(({ _latestOrderTime, ...opp }) => opp);
  }, [sellerListings, sellerOrders, language, creativeAdTick]);
}
