import React from 'react';
import { ArrowLeft, ExternalLink, Package, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { getListingTitle, MarketTheme } from '../MarketConstants';
import { Listing } from '../../../types';

export interface ChatHeaderOrderContext {
  orderId: string;
  itemTitle?: string;
  amount?: number;
  currency?: string;
  status?: string;
}

export interface ChatThreadHeaderProps {
  listing: Listing;
  order?: ChatHeaderOrderContext | null;
  currentUserId?: string | null;
  buyerName?: string;
  sellerName?: string;
  language: string;
  currentTheme: MarketTheme;
  onClose?: () => void;
  onBack?: () => void;
  onViewOrder?: (orderId: string) => void;
  showInquiryTerms?: boolean;
}

function getInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return 'U';
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export const ChatThreadHeader = React.memo(function ChatThreadHeader({
  listing,
  order,
  currentUserId,
  buyerName,
  sellerName,
  language,
  currentTheme,
  onClose,
  onBack,
  onViewOrder,
  showInquiryTerms = true,
}: ChatThreadHeaderProps) {
  const isKa = language === 'ka';
  const isSellerViewing = Boolean(currentUserId && listing.sellerId && currentUserId === listing.sellerId);

  const counterpartName = isSellerViewing
    ? buyerName?.trim() || (isKa ? 'მყიდველი' : 'Buyer')
    : sellerName?.trim() || listing.sellerName?.trim() || (isKa ? 'გამყიდველი' : 'Seller');

  const counterpartRole = isSellerViewing
    ? isKa
      ? 'მყიდველი'
      : 'Buyer'
    : isKa
    ? 'გამყიდველი'
    : 'Seller';

  const resolvedListingTitle = getListingTitle(listing, language) || listing.title;

  const conditionLabel =
    listing.condition === 'new'
      ? isKa
        ? 'ახალი'
        : 'New'
      : listing.condition === 'used'
      ? isKa
        ? 'მეორადი'
        : 'Used'
      : listing.condition === 'refurbished'
      ? isKa
        ? 'განახლებული'
        : 'Refurbished'
      : null;

  return (
    <div className="shrink-0 space-y-2.5">
      {/* Primary Partner & Listing Row */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="min-w-[44px] min-h-[44px] px-2.5 rounded-xl bg-proton-bg border border-proton-border hover:bg-proton-accent/10 hover:border-proton-accent/40 text-proton-text flex items-center justify-center gap-1 transition-colors shrink-0 cursor-pointer active:scale-95"
              aria-label={isKa ? 'უკან' : 'Back'}
            >
              <ArrowLeft size={18} />
            </button>
          )}

          <div
            className="w-10 h-10 rounded-xl bg-proton-accent/15 border border-proton-accent/30 flex items-center justify-center font-bold text-xs text-proton-accent shrink-0"
            aria-hidden="true"
          >
            {getInitials(counterpartName)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="text-sm font-bold text-proton-text truncate">
                {counterpartName}
              </h3>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-md text-[11px] font-semibold border shrink-0',
                  currentTheme.badgeBg
                )}
              >
                {counterpartRole}
              </span>
            </div>
            <p
              className="text-xs text-proton-muted truncate mt-0.5"
              title={resolvedListingTitle}
            >
              {resolvedListingTitle}
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-proton-bg border border-proton-border hover:bg-proton-accent/10 hover:border-proton-accent/40 transition-colors text-proton-text flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
            aria-label={isKa ? 'დახურვა' : 'Close'}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Order Context Banner */}
      {order && (
        <div
          id="chat-order-context-banner"
          className="bg-proton-accent/10 border border-proton-accent/25 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-2.5 min-w-0"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-proton-accent/20 border border-proton-accent/30 flex items-center justify-center text-proton-accent shrink-0">
              <Package size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <span className="text-xs font-bold text-proton-accent truncate">
                  {isKa ? 'შეკვეთა' : 'Order'} #{order.orderId.slice(-6).toUpperCase()}
                </span>
                {order.status && (
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-proton-card text-proton-text border border-proton-border font-mono shrink-0">
                    {order.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-proton-muted truncate mt-0.5">
                {order.itemTitle || resolvedListingTitle}
                {order.amount !== undefined && order.amount > 0
                  ? ` • ${order.amount} ${order.currency || ''}`
                  : ''}
              </p>
            </div>
          </div>

          {onViewOrder && (
            <button
              type="button"
              id="chat-view-order-btn"
              onClick={() => onViewOrder(order.orderId)}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-proton-card hover:bg-proton-accent/10 text-proton-text text-xs font-bold transition-all border border-proton-border hover:border-proton-accent/40 shrink-0 flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <ExternalLink size={13} className="text-proton-accent shrink-0" />
              <span className="sm:hidden">{isKa ? 'შეკვეთა' : 'Order'}</span>
              <span className="hidden sm:inline">{isKa ? 'შეკვეთის ნახვა' : 'View Order'}</span>
            </button>
          )}
        </div>
      )}

      {/* Optional Listing Terms Strip (non-order chats) */}
      {!order && showInquiryTerms && conditionLabel && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl px-3 py-2 flex items-center gap-2 min-w-0">
          <span className="text-sm shrink-0" aria-hidden="true">
            💬
          </span>
          <p className="text-xs font-medium text-amber-500 leading-snug min-w-0">
            {isKa
              ? `მდგომარეობა: ${conditionLabel} • ${listing.isNegotiable ? 'ფასზე შეგიძლიათ შეთანხმება' : 'ფასი ფიქსირებულია'}`
              : `Condition: ${conditionLabel} • ${listing.isNegotiable ? 'Open to offers' : 'Fixed price'}`}
          </p>
        </div>
      )}
    </div>
  );
});
