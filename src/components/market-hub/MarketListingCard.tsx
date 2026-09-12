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
import { MarketTheme, CATEGORY_EMOJIS, WORLD_COUNTRIES } from './MarketConstants';

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
    <div className="w-full h-full relative overflow-hidden bg-zinc-950">
      {/* Skeleton placeholder while loading image */}
      {!isLoaded && !hasError && src && (
        <div className="absolute inset-0 z-0 animate-pulse bg-zinc-800/60 flex items-center justify-center">
          <div className="w-7 h-7 rounded-full border-2 border-white/10 border-t-[#dfb257]/40 animate-spin opacity-40" />
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
        <div className="w-full h-full flex items-center justify-center bg-zinc-900/90">
          <ShoppingBag size={24} className={cn("opacity-15", themeAccent)} />
        </div>
      )}

      {/* Sold Item Visual Overlay */}
      {isSold && (
        <div className="absolute inset-0 z-20 flex items-center justify-center backdrop-blur-[2px] bg-black/60 pointer-events-none select-none">
          <div className="px-3.5 py-1.5 rounded-xl bg-zinc-950/95 border border-red-500/30 shadow-[0_8px_30px_rgba(0,0,0,0.8)] flex items-center gap-2 transform -rotate-3">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" />
            <span className="text-[11px] font-black tracking-widest text-zinc-100 uppercase font-mono">
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
  const isAdminUser = !!user && user.email === 'devdarianib@gmail.com';
  const canManageListing = isOwnListing || isAdminUser;
  const isItemSold = listing.status === 'sold' || Boolean((listing as any).isSold);
  const displayTitle = language === 'ka' ? (listing.titleGe || listing.title) : listing.title;
  const imageUrl = (listing.images && listing.images.length > 0) ? listing.images[0] : listing.image;
  const rawPrice = priceMap.get(listing.id) ?? convertPrice(listing.price, listing.currency || 'USD', displayCurrency);
  const formattedPrice = rawPrice.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const isLargePrice = formattedPrice.length >= 6;

  return (
    <motion.article 
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      key={listing.id}
      transition={{ delay: idx * 0.03 }}
      className={cn(
        "group rounded-2xl overflow-hidden transition-all duration-300 flex flex-col relative border bg-zinc-950/40 hover:shadow-[0_8px_30px_rgba(223,178,87,0.05)] hover:-translate-y-1 hover:bg-zinc-950/60",
        isItemSold 
          ? "border-zinc-800/50 opacity-85" 
          : "border-zinc-900/40 hover:border-[#dfb257]/30",
        currentTheme.card
      )}
    >
      <div 
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button, [role="button"], a, input')) return;
          onSelectListing(listing);
        }}
        className="w-full aspect-[4/3] bg-zinc-900/80 overflow-hidden relative cursor-pointer"
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
          <div className="px-2 py-1 bg-black/85 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-1 shadow-sm shrink min-w-0 max-w-[130px]">
            <span className="text-[10px] leading-none shrink-0">{CATEGORY_EMOJIS[listing.category] || '🏷️'}</span>
            <span className="text-[9px] font-black text-proton-accent uppercase tracking-wider truncate block">
              {t.market.categories[listing.category] || listing.category}
            </span>
          </div>
          {(listing.city || listing.country) && (
            <div className="px-2 py-1 bg-black/85 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-1 shadow-sm shrink min-w-0 max-w-[100px]">
              <span className="text-[10px] leading-none shrink-0">{WORLD_COUNTRIES.find(c => c.code === listing.country)?.flag || '🌐'}</span>
              <span className="text-[9px] font-black text-white/90 uppercase tracking-widest truncate block">
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
                ? "bg-red-500/20 border-red-500/30 text-red-500"
                : "bg-black/80 border-white/10 text-zinc-400 hover:text-red-500 hover:border-white/20"
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
                className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center bg-black/80 backdrop-blur-md rounded-xl border border-white/10 text-white transition-all hover:bg-white hover:text-black active:scale-90 shadow-md"
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
                className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center bg-black/80 backdrop-blur-md rounded-xl border border-white/10 text-white transition-all hover:bg-rose-500 hover:border-rose-500/30 active:scale-90 shadow-md"
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
            className="text-sm sm:text-base font-bold tracking-tight text-white hover:text-[#dfb257] cursor-pointer transition-colors line-clamp-2 min-h-[2.5rem] sm:min-h-[2.75rem] leading-snug mb-1"
          >
            {displayTitle}
          </h2>
          <p className="text-xs font-sans text-zinc-400 font-normal leading-relaxed line-clamp-2 min-h-[2.25rem]">
            {language === 'ka' ? (listing.descriptionGe || listing.description) : listing.description}
          </p>
        </div>

        <div className={cn("pt-3 border-t", currentTheme.border)}>
          {/* Price Section: Scannable, prominent, flex-shrink controlled with no line wraps */}
          <div className="flex items-end justify-between gap-2 mb-3 min-w-0">
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold mb-0.5 block font-mono">
                {t.market.price}
              </span>
              <div className="flex items-baseline gap-1 whitespace-nowrap min-w-0 overflow-hidden">
                <span className={cn(
                  "font-black tracking-tight text-[#dfb257] font-mono leading-none truncate",
                  isLargePrice ? "text-base sm:text-lg" : "text-lg sm:text-xl md:text-2xl"
                )}>
                  {formattedPrice}
                </span>
                <span className="text-xs font-bold text-zinc-400 font-mono ml-0.5 shrink-0 whitespace-nowrap">
                  {displayCurrency}
                </span>
              </div>
            </div>

            {listing.isNegotiable ? (
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono shrink-0 whitespace-nowrap">
                {language === 'ka' ? 'შეთანხმებით' : 'Negotiable'}
              </span>
            ) : listing.listingType === 'service' || listing.category === 'service' ? (
              <span className="text-[9px] font-bold text-amber-400/80 uppercase tracking-wider font-mono shrink-0 whitespace-nowrap">
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
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] relative shrink-0 bg-zinc-900 text-white border border-zinc-800 group-hover/vendor:border-[#dfb257]/50 transition-all">
                {(listing.sellerName || 'Seller').substring(0, 2).toUpperCase()}
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border-2 border-zinc-950" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-xs font-bold tracking-wide truncate block text-zinc-200 group-hover/vendor:text-[#dfb257] transition-colors">
                    {listing.sellerName}
                  </span>
                  <ShieldCheck size={12} className="shrink-0 text-[#dfb257]" />
                </div>
                <div className="flex items-center mt-0.5 min-w-0">
                  {sellerRating && sellerRating.count > 0 ? (
                    <div className="flex items-center gap-0.5">
                      <Star size={10} className="fill-[#dfb257] text-[#dfb257]" />
                      <span className="text-[10px] font-black text-[#dfb257]">
                        {sellerRating.avg.toFixed(1)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
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
                className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-[#dfb257] hover:bg-white/10 transition-all flex items-center justify-center shrink-0 active:scale-95"
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
                    "flex-1 min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border border-white/10 hover:bg-white/10 text-white active:scale-[0.98]",
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
                  className="min-w-[44px] min-h-[44px] w-11 h-11 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-xl transition-all flex items-center justify-center shrink-0 active:scale-90"
                  title={language === 'ka' ? 'წაშლა' : 'Delete'}
                  aria-label={language === 'ka' ? 'წაშლა' : 'Delete'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : isItemSold ? (
              <button 
                type="button"
                disabled
                className="w-full min-h-[44px] py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-zinc-900/80 text-zinc-500 border border-zinc-800 flex items-center justify-center gap-2 cursor-not-allowed select-none"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500/60" />
                {language === 'ka' ? 'გაყიდულია' : 'SOLD'}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onBuyNow(listing);
                  }}
                  className={cn(
                    "flex-1 min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-proton-accent/20 active:scale-[0.98]",
                    currentTheme.accentBg, "text-white"
                  )}
                >
                  <ShoppingBag size={15} />
                  <span>{t.market.buy_now}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onAddToCart(listing);
                  }}
                  className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl transition-all shadow-md active:scale-90 hover:scale-105 bg-[#dfb257] text-[#070708] hover:bg-[#ebd083] focus:outline-none flex items-center justify-center border border-[#dfb257]/30 shrink-0"
                  title={language === 'ka' ? 'კალათაში დამატება' : 'Add to Cart'}
                  aria-label={language === 'ka' ? 'კალათაში დამატება' : 'Add to Cart'}
                >
                  <ShoppingCart size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
});
