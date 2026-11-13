import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ShoppingBag, 
  ShoppingCart,
  MessageCircle, 
  ShieldCheck,
  Star,
  Trash2,
  Edit3,
  Heart
} from 'lucide-react';
import { Listing } from '../../types';
import { cn } from '../../lib/utils';
import {
  MarketTheme,
  CATEGORY_EMOJIS,
  WORLD_COUNTRIES,
  getListingTitle,
  formatCurrencyAmount,
  formatOriginalCurrencyPrice,
  formatApproxCurrencyEquivalent
} from './MarketConstants';

export interface ListingCardImageProps {
  src?: string;
  alt: string;
  isSold?: boolean;
  language: string;
  themeAccent?: string;
}

export const ListingCardImage = React.memo(function ListingCardImage({
  src,
  alt,
  isSold,
  language,
  themeAccent
}: ListingCardImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-proton-bg">
      {/* Skeleton placeholder while loading image */}
      {!isLoaded && !hasError && src && (
        <div className="absolute inset-0 z-0 animate-pulse bg-proton-border/40 flex items-center justify-center">
          <div className="w-7 h-7 rounded-full border-2 border-proton-border border-t-proton-accent animate-spin opacity-60" />
        </div>
      )}

      {src && !hasError ? (
        <motion.img 
          src={src} 
          alt={alt} 
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            setHasError(true);
            setIsLoaded(true);
          }}
          className={cn(
            "w-full h-full object-cover transition-all duration-500 ease-out",
            isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-[1.02]"
          )}
          whileHover={{ scale: isSold ? 1.0 : 1.05 }}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-proton-bg/80">
          <ShoppingBag size={24} className={cn("opacity-25", themeAccent)} />
        </div>
      )}

      {/* Sold Item Visual Overlay */}
      {isSold && (
        <div className="absolute inset-0 z-20 flex items-center justify-center backdrop-blur-[2px] bg-black/55 pointer-events-none select-none">
          <div className="px-3.5 py-1.5 rounded-xl bg-proton-card/95 border border-rose-500/40 shadow-xl flex items-center gap-2 transform -rotate-3">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" />
            <span className="text-[11px] font-black tracking-widest text-proton-text uppercase font-mono">
              {language === 'ka' ? 'გაყიდულია' : 'SOLD OUT'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

export interface MarketListingCardProps {
  listing: Listing;
  idx: number;
  user: any;
  isAdmin?: boolean;
  language: string;
  t: any;
  currentTheme: MarketTheme;
  priceMap: Map<string, number>;
  convertPrice: (price: number, from: string, to: string) => number;
  displayCurrency: string;
  isFavorite: boolean;
  toggleFavorite: (id: string, e?: React.MouseEvent) => void;
  sellerRating?: { avg: number; count: number };
  onSelectListing: (listing: Listing) => void;
  onSelectVendor: (vendor: { id: string; name: string }) => void;
  onStartChat: (listing: Listing) => void;
  onStartEdit: (listing: Listing) => void;
  onDeleteListing: (id: string) => void;
  onBuyNow: (listing: Listing) => void;
  onAddToCart: (listing: Listing) => void;
}

export const MarketListingCard = React.memo(function MarketListingCard({
  listing,
  idx,
  user,
  isAdmin,
  language,
  t,
  currentTheme,
  priceMap,
  convertPrice,
  displayCurrency,
  isFavorite,
  toggleFavorite,
  sellerRating,
  onSelectListing,
  onSelectVendor,
  onStartChat,
  onStartEdit,
  onDeleteListing,
  onBuyNow,
  onAddToCart
}: MarketListingCardProps) {
  const isOwnListing = !!user && listing.sellerId === user.uid;
  const canManageListing = isOwnListing;
  const isItemSold = listing.status === 'sold' || Boolean((listing as any).isSold);
  const displayTitle = getListingTitle(listing, language);
  const imageUrl = (listing.images && listing.images.length > 0) ? listing.images[0] : listing.image;
  const originalCurrency = (listing.currency || 'USD').trim().toUpperCase();
  const targetCurrency = (displayCurrency || 'USD').trim().toUpperCase();
  const isSameCurrency = originalCurrency === targetCurrency;
  const convertedPrice = priceMap.get(listing.id) ?? convertPrice(listing.price, originalCurrency, targetCurrency);
  const formattedOriginal = formatOriginalCurrencyPrice(listing.price, originalCurrency);
  const formattedApprox = formatApproxCurrencyEquivalent(convertedPrice, targetCurrency);
  const primaryPriceDisplay = isSameCurrency
    ? formatCurrencyAmount(listing.price, originalCurrency)
    : formattedApprox;
  const isLargePrice = primaryPriceDisplay.length >= 8;

  return (
    <motion.article 
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      key={listing.id}
      transition={{ delay: idx * 0.03 }}
      className={cn(
        "group rounded-xl overflow-hidden transition-all duration-300 flex flex-col relative border hover:shadow-xl hover:-translate-y-1",
        currentTheme.card,
        isItemSold 
          ? "opacity-85" 
          : "hover:border-proton-accent/45"
      )}
    >
      <div 
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button, [role="button"], a, input')) return;
          onSelectListing(listing);
        }}
        className="w-full aspect-[4/3] bg-proton-bg overflow-hidden relative cursor-pointer"
      >
        <ListingCardImage
          src={imageUrl}
          alt={displayTitle}
          isSold={isItemSold}
          language={language}
          themeAccent={currentTheme.accent}
        />
        
        {/* Badge Overlay: Max 2 clean badges with explicit max width and text truncation */}
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 max-w-[calc(100%-105px)] overflow-hidden pointer-events-none">
          <div className="px-2 py-1 bg-proton-card/90 backdrop-blur-md rounded-lg border border-proton-border flex items-center gap-1 shadow-sm shrink min-w-0 max-w-[130px]">
            <span className="text-[10px] leading-none shrink-0">{CATEGORY_EMOJIS[listing.category] || '🏷️'}</span>
            <span className="text-[9px] font-black text-proton-accent uppercase tracking-wider truncate block">
              {t.market.categories[listing.category] || listing.category}
            </span>
          </div>
          {(listing.city || listing.country) && (
            <div className="px-2 py-1 bg-proton-card/90 backdrop-blur-md rounded-lg border border-proton-border flex items-center gap-1 shadow-sm shrink min-w-0 max-w-[100px]">
              <span className="text-[10px] leading-none shrink-0">{WORLD_COUNTRIES.find(c => c.code === listing.country)?.flag || '🌐'}</span>
              <span className="text-[9px] font-black text-proton-text uppercase tracking-widest truncate block">
                {listing.city || listing.country}
              </span>
            </div>
          )}
        </div>

        {/* Top-Right Control Buttons: Min 44x44px touch targets with full event propagation guard */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              toggleFavorite(listing.id, e);
            }}
            className={cn(
              "min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center backdrop-blur-md rounded-xl border transition-all active:scale-90 shadow-md",
              isFavorite
                ? "bg-rose-500/90 border-rose-500 text-white"
                : "bg-proton-card/90 border-proton-border text-proton-muted hover:text-rose-500 hover:border-rose-500/40"
            )}
            title={language === 'ka' ? 'რჩეულებში დამატება' : 'Add to Favorites'}
            aria-label={language === 'ka' ? 'რჩეულებში დამატება' : 'Add to Favorites'}
          >
            <Heart size={16} fill={isFavorite ? "currentColor" : "none"} className="stroke-[2.5]" />
          </button>
          {canManageListing && (
            <>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onStartEdit(listing);
                }}
                className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center bg-proton-card/90 backdrop-blur-md rounded-xl border border-proton-border text-proton-text transition-all hover:bg-proton-accent hover:text-proton-on-accent hover:border-proton-accent active:scale-90 shadow-md"
                title={language === 'ka' ? 'რედაქტირება' : 'Edit'}
                aria-label={language === 'ka' ? 'რედაქტირება' : 'Edit'}
              >
                <Edit3 className="size-4" />
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onDeleteListing(listing.id);
                }}
                className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center bg-proton-card/90 backdrop-blur-md rounded-xl border border-proton-border text-rose-500 transition-all hover:bg-rose-500 hover:text-white hover:border-rose-500 active:scale-90 shadow-md"
                title={language === 'ka' ? 'წაშლა' : 'Delete'}
                aria-label={language === 'ka' ? 'წაშლა' : 'Delete'}
              >
                <Trash2 className="size-4" />
              </button>
            </>
          )}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
      </div>

      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <h2 
            onClick={(e) => {
              e.stopPropagation();
              onSelectListing(listing);
            }}
            className="text-sm sm:text-base font-bold tracking-tight text-proton-text hover:text-proton-accent cursor-pointer transition-colors line-clamp-2 min-h-[2.5rem] sm:min-h-[2.75rem] leading-normal pb-0.5 mb-1"
          >
            {displayTitle}
          </h2>
          <p className="text-xs font-sans text-proton-muted font-normal leading-relaxed line-clamp-2 min-h-[2.25rem]">
            {language === 'ka' ? (listing.descriptionGe || listing.description) : listing.description}
          </p>
        </div>

        <div className={cn("pt-3 border-t", currentTheme.border)}>
          {/* Price Section: Scannable, prominent, flex-shrink controlled with no line wraps */}
          <div className="flex items-end justify-between gap-2 mb-3 min-w-0">
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[9px] uppercase tracking-wider text-proton-muted font-bold mb-0.5 block font-mono">
                {isSameCurrency
                  ? t.market.price
                  : (language === 'ka' ? 'სავარაუდო ფასი' : 'Est. Price')}
              </span>
              {isSameCurrency ? (
                <div className="flex items-baseline gap-1 whitespace-nowrap min-w-0 overflow-hidden">
                  <span className={cn(
                    "font-black tracking-tight text-proton-accent font-mono tabular-nums leading-none truncate",
                    isLargePrice ? "text-base sm:text-lg" : "text-lg sm:text-xl md:text-2xl"
                  )}>
                    {formatCurrencyAmount(listing.price, originalCurrency)}
                  </span>
                  <span className="text-xs font-bold text-proton-muted font-mono ml-0.5 shrink-0 whitespace-nowrap">
                    {originalCurrency}
                  </span>
                </div>
              ) : (
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-baseline gap-1 whitespace-nowrap min-w-0 overflow-hidden">
                    <span className={cn(
                      "font-black tracking-tight text-proton-accent font-mono tabular-nums leading-none truncate",
                      isLargePrice ? "text-base sm:text-lg" : "text-lg sm:text-xl"
                    )}>
                      {formattedApprox}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-proton-text/80 font-mono tabular-nums truncate">
                    {language === 'ka' ? 'ორიგინალი ფასი:' : 'Original price:'} {formattedOriginal}
                  </p>
                </div>
              )}
            </div>

            {listing.isNegotiable ? (
              <span className="text-[9px] font-bold text-proton-muted uppercase tracking-wider font-mono shrink-0 whitespace-nowrap">
                {language === 'ka' ? 'შეთანხმებით' : 'Negotiable'}
              </span>
            ) : listing.listingType === 'service' || listing.category === 'service' ? (
              <span className="text-[9px] font-bold text-proton-accent uppercase tracking-wider font-mono shrink-0 whitespace-nowrap">
                {language === 'ka' ? 'სერვისი' : 'Service'}
              </span>
            ) : null}
          </div>

          {/* Vendor Row: Spacious vendor name & rating + Direct Chat with 44px touch target */}
          <div className="flex items-center justify-between gap-2 pt-1 min-w-0">
            <div 
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onSelectVendor({ id: listing.sellerId, name: listing.sellerName });
              }}
              className="flex items-center gap-2 flex-1 min-w-0 group/vendor cursor-pointer"
              title={language === 'ka' ? 'გამყიდველის პროფილი და შეფასებები' : 'Vendor Profile & Reviews'}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] relative shrink-0 bg-proton-bg text-proton-text border border-proton-border group-hover/vendor:border-proton-accent/50 transition-all">
                {(listing.sellerName || 'Seller').substring(0, 2).toUpperCase()}
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-proton-card" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-xs font-bold tracking-wide truncate block text-proton-text group-hover/vendor:text-proton-accent transition-colors">
                    {listing.sellerName}
                  </span>
                  <ShieldCheck size={12} className="shrink-0 text-proton-accent" />
                </div>
                <div className="flex items-center mt-0.5 min-w-0">
                  {sellerRating && sellerRating.count > 0 ? (
                    <div className="flex items-center gap-0.5">
                      <Star size={10} className="fill-amber-400 text-amber-500" />
                      <span className="text-[10px] font-black text-proton-accent">
                        {sellerRating.avg.toFixed(1)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-proton-muted uppercase tracking-widest font-mono">
                      {language === 'ka' ? 'ახალი' : 'New'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Direct Vendor Chat button */}
            {!isOwnListing && (
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onStartChat(listing);
                }}
                className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-proton-bg/70 border border-proton-border text-proton-muted hover:text-proton-accent hover:bg-proton-accent/10 hover:border-proton-accent/40 transition-all flex items-center justify-center shrink-0 active:scale-95"
                title={language === 'ka' ? 'კონტაქტი გამყიდველთან' : 'Contact Vendor'}
                aria-label={language === 'ka' ? 'კონტაქტი გამყიდველთან' : 'Contact Vendor'}
              >
                <MessageCircle size={16} />
              </button>
            )}
          </div>

          {/* Primary Actions with Full 44px Touch Targets */}
          <div className="mt-3">
            {isOwnListing ? (
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onStartEdit(listing);
                  }}
                  className={cn(
                    "flex-1 min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]",
                    currentTheme.accentBg
                  )}
                >
                  <Edit3 size={14} />
                  <span>{t.market.edit_listing}</span>
                </button>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onDeleteListing(listing.id);
                  }}
                  className="min-w-[44px] min-h-[44px] w-11 h-11 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/30 text-rose-500 rounded-xl transition-all flex items-center justify-center shrink-0 active:scale-90"
                  title={language === 'ka' ? 'წაშლა' : 'Delete'}
                  aria-label={language === 'ka' ? 'წაშლა' : 'Delete'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : isItemSold ? (
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  disabled
                  className="flex-1 min-h-[44px] py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-proton-bg text-proton-muted border border-proton-border flex items-center justify-center gap-2 cursor-not-allowed select-none"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500/70" />
                  {language === 'ka' ? 'გაყიდულია' : 'SOLD'}
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onDeleteListing(listing.id);
                    }}
                    className="min-w-[44px] min-h-[44px] w-11 h-11 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/30 text-rose-500 rounded-xl transition-all flex items-center justify-center shrink-0 active:scale-90"
                    title={language === 'ka' ? 'მოდერაცია: წაშლა' : 'Moderate: Delete Listing'}
                    aria-label={language === 'ka' ? 'მოდერაცია: წაშლა' : 'Moderate: Delete Listing'}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onStartChat(listing);
                  }}
                  className={cn(
                    "flex-1 min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md active:scale-[0.98]",
                    currentTheme.accentBg
                  )}
                >
                  <MessageCircle size={15} />
                  <span>{t.market.contact_seller || (language === 'ka' ? 'დაუკავშირდი გამყიდველს' : 'Contact Seller')}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onBuyNow(listing);
                  }}
                  className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl transition-all shadow-sm active:scale-90 hover:scale-105 bg-proton-bg hover:bg-proton-accent/15 text-proton-text hover:text-proton-accent border border-proton-border hover:border-proton-accent/40 focus:outline-none flex items-center justify-center shrink-0 cursor-pointer"
                  title={language === 'ka' ? 'შეკვეთის შეთანხმება' : 'Order Agreement'}
                  aria-label={language === 'ka' ? 'შეკვეთის შეთანხმება' : 'Order Agreement'}
                >
                  <ShoppingBag size={16} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onAddToCart(listing);
                  }}
                  className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl transition-all shadow-sm active:scale-90 hover:scale-105 bg-proton-accent/15 hover:bg-proton-accent text-proton-accent hover:text-proton-on-accent focus:outline-none flex items-center justify-center border border-proton-accent/35 shrink-0 cursor-pointer"
                  title={language === 'ka' ? 'კალათაში დამატება' : 'Add to Cart'}
                  aria-label={language === 'ka' ? 'კალათაში დამატება' : 'Add to Cart'}
                >
                  <ShoppingCart size={16} />
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onDeleteListing(listing.id);
                    }}
                    className="min-w-[44px] min-h-[44px] w-11 h-11 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/30 text-rose-500 rounded-xl transition-all flex items-center justify-center shrink-0 active:scale-90"
                    title={language === 'ka' ? 'მოდერაცია: წაშლა' : 'Moderate: Delete Listing'}
                    aria-label={language === 'ka' ? 'მოდერაცია: წაშლა' : 'Moderate: Delete Listing'}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
});
