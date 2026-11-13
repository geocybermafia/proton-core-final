import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ShoppingBag,
  ShieldCheck,
  Star,
  Trash2,
  Edit3,
  Heart,
  MapPin,
  MoreVertical,
  Eye
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
          whileHover={{ scale: isSold ? 1.0 : 1.04 }}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-proton-bg/80">
          <ShoppingBag size={24} className={cn("opacity-25", themeAccent)} />
        </div>
      )}

      {isSold && (
        <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[2px] bg-black/55 pointer-events-none select-none">
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
  onStartEdit: (listing: Listing) => void;
  onDeleteListing: (id: string) => void;
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
  onStartEdit,
  onDeleteListing
}: MarketListingCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const isOwnListing = !!user && listing.sellerId === user.uid;
  const canManageListing = isOwnListing;
  const showManagementMenu = canManageListing || Boolean(isAdmin);
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

  const countryEntry = WORLD_COUNTRIES.find(c => c.code === listing.country);
  const countryDisplay = countryEntry
    ? (countryEntry.code === 'GLOBAL'
      ? (language === 'ka' ? 'გლობალური' : 'Worldwide')
      : countryEntry.name)
    : (listing.country || '');
  const cityDisplay = (listing.city || '').trim();
  const locationParts = Array.from(
    new Set([cityDisplay, countryDisplay].filter(Boolean))
  );
  const locationLabel = locationParts.length > 0
    ? locationParts.join(', ')
    : (language === 'ka' ? 'მდებარეობა მითითებული არ არის' : 'Location not specified');

  const categoryLabel = t.market.categories[listing.category] || listing.category;
  const sellerName = listing.sellerName || (language === 'ka' ? 'გამყიდველი' : 'Seller');

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      key={listing.id}
      transition={{ delay: idx * 0.03 }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, [role="menu"], [role="menuitem"], a, input')) return;
        onSelectListing(listing);
      }}
      className={cn(
        "group rounded-xl overflow-hidden transition-all duration-300 flex flex-col relative border hover:shadow-xl hover:-translate-y-1 cursor-pointer min-w-0",
        currentTheme.card,
        isItemSold ? "opacity-85" : "hover:border-proton-accent/45"
      )}
    >
      {/* 1. Product Photo */}
      <div className="w-full aspect-[4/3] bg-proton-bg relative">
        <ListingCardImage
          src={imageUrl}
          alt={displayTitle}
          isSold={isItemSold}
          language={language}
          themeAccent={currentTheme.accent}
        />

        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 via-transparent to-transparent pointer-events-none" />

        {/* Non-overlapping Top Overlay Bar: max 1 category badge on left + compact Favorite & options menu on right */}
        <div className="absolute top-2.5 inset-x-2.5 z-20 flex items-start justify-between gap-2 pointer-events-none">
          <div className="min-w-0 flex-1 flex items-center">
            <div className="px-2 py-1 bg-proton-card/90 backdrop-blur-md rounded-lg border border-proton-border inline-flex items-center gap-1 shadow-sm max-w-full min-w-0">
              <span className="text-[10px] leading-none shrink-0" aria-hidden="true">
                {CATEGORY_EMOJIS[listing.category] || '🏷️'}
              </span>
              <span className="text-[9px] font-black text-proton-accent uppercase tracking-wider truncate block">
                {categoryLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 pointer-events-auto" ref={menuContainerRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleFavorite(listing.id, e);
              }}
              aria-pressed={isFavorite}
              aria-label={
                isFavorite
                  ? (language === 'ka' ? 'რჩეულებიდან წაშლა' : 'Remove from favorites')
                  : (language === 'ka' ? 'რჩეულებში დამატება' : 'Add to favorites')
              }
              title={
                isFavorite
                  ? (language === 'ka' ? 'რჩეულებიდან წაშლა' : 'Remove from favorites')
                  : (language === 'ka' ? 'რჩეულებში დამატება' : 'Add to favorites')
              }
              className={cn(
                "min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center backdrop-blur-md rounded-xl border transition-all active:scale-90 shadow-md cursor-pointer",
                isFavorite
                  ? "bg-rose-500/90 border-rose-500 text-white"
                  : "bg-proton-card/90 border-proton-border text-proton-muted hover:text-rose-500 hover:border-rose-500/40"
              )}
            >
              <Heart size={16} fill={isFavorite ? "currentColor" : "none"} className="stroke-[2.5]" />
            </button>

            {showManagementMenu && (
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setIsMenuOpen((prev) => !prev);
                  }}
                  aria-haspopup="menu"
                  aria-expanded={isMenuOpen}
                  aria-label={language === 'ka' ? 'განცხადების მართვა' : 'Listing options'}
                  title={language === 'ka' ? 'განცხადების მართვა' : 'Listing options'}
                  className={cn(
                    "min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center backdrop-blur-md rounded-xl border transition-all active:scale-90 shadow-md cursor-pointer",
                    isMenuOpen
                      ? "bg-proton-accent border-proton-accent text-proton-on-accent"
                      : "bg-proton-card/90 border-proton-border text-proton-text hover:border-proton-accent/50 hover:text-proton-accent"
                  )}
                >
                  <MoreVertical size={16} />
                </button>

                {isMenuOpen && (
                  <div
                    role="menu"
                    aria-label={language === 'ka' ? 'განცხადების მოქმედებები' : 'Listing actions'}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-12 z-30 min-w-[156px] rounded-xl bg-proton-card border border-proton-border shadow-2xl p-1.5 space-y-1"
                  >
                    {canManageListing && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMenuOpen(false);
                          onStartEdit(listing);
                        }}
                        aria-label={t.market.edit_listing || (language === 'ka' ? 'განცხადების რედაქტირება' : 'Edit listing')}
                        className="w-full min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold text-proton-text hover:bg-proton-bg hover:text-proton-accent flex items-center gap-2 transition-colors cursor-pointer text-left"
                      >
                        <Edit3 size={14} className="shrink-0" />
                        <span className="truncate">{t.market.edit_listing || (language === 'ka' ? 'რედაქტირება' : 'Edit')}</span>
                      </button>
                    )}

                    {(canManageListing || isAdmin) && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMenuOpen(false);
                          onDeleteListing(listing.id);
                        }}
                        aria-label={
                          !canManageListing && isAdmin
                            ? (language === 'ka' ? 'მოდერაცია: განცხადების წაშლა' : 'Moderate: delete listing')
                            : (language === 'ka' ? 'განცხადების წაშლა' : 'Delete listing')
                        }
                        className="w-full min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold text-rose-500 hover:bg-rose-500/15 flex items-center gap-2 transition-colors cursor-pointer text-left"
                      >
                        <Trash2 size={14} className="shrink-0" />
                        <span className="truncate">
                          {!canManageListing && isAdmin
                            ? (language === 'ka' ? 'მოდერაცია: წაშლა' : 'Delete (Mod)')
                            : (language === 'ka' ? 'წაშლა' : 'Delete')}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3.5 min-w-0">
        <div className="space-y-3 min-w-0">
          {/* 2. Product Title */}
          <h2 className="text-sm sm:text-base font-bold tracking-tight text-proton-text group-hover:text-proton-accent transition-colors line-clamp-2 min-h-[2.6rem] leading-snug break-words">
            {displayTitle}
          </h2>

          {/* 3. Price (with original currency & approx equivalent when needed) */}
          <div className={cn("pt-2.5 border-t min-w-0", currentTheme.border)}>
            <div className="flex items-end justify-between gap-2 min-w-0 flex-wrap">
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
          </div>

          {/* 4. Location */}
          <div className="flex items-center gap-1.5 text-xs text-proton-muted min-w-0">
            <MapPin size={13} className="shrink-0 text-proton-muted" aria-hidden="true" />
            {countryEntry?.flag && (
              <span className="text-xs leading-none shrink-0" aria-hidden="true">
                {countryEntry.flag}
              </span>
            )}
            <span className="truncate font-medium">{locationLabel}</span>
          </div>
        </div>

        {/* 5. Seller Info + 6. Primary View Details Action */}
        <div className={cn("pt-3 border-t space-y-3 min-w-0", currentTheme.border)}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onSelectVendor({ id: listing.sellerId, name: sellerName });
            }}
            aria-label={
              language === 'ka'
                ? `გამყიდველის პროფილი და შეფასებები: ${sellerName}`
                : `View seller profile and reviews for ${sellerName}`
            }
            title={language === 'ka' ? 'გამყიდველის პროფილი და შეფასებები' : 'Vendor Profile & Reviews'}
            className="w-full flex items-center justify-between gap-2 min-w-0 group/vendor cursor-pointer text-left rounded-lg py-0.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-proton-accent"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] relative shrink-0 bg-proton-bg text-proton-text border border-proton-border group-hover/vendor:border-proton-accent/50 transition-all">
                {sellerName.substring(0, 2).toUpperCase()}
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-proton-card" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-xs font-bold tracking-wide truncate block text-proton-text group-hover/vendor:text-proton-accent transition-colors">
                    {sellerName}
                  </span>
                  <ShieldCheck size={12} className="shrink-0 text-proton-accent" aria-hidden="true" />
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-1 text-[10px] font-bold">
              {sellerRating && sellerRating.count > 0 ? (
                <>
                  <Star size={11} className="fill-amber-400 text-amber-500 shrink-0" aria-hidden="true" />
                  <span className="font-black text-proton-accent tabular-nums">
                    {sellerRating.avg.toFixed(1)}
                  </span>
                </>
              ) : (
                <span className="text-proton-muted uppercase tracking-wider font-mono">
                  {language === 'ka' ? 'ახალი' : 'New'}
                </span>
              )}
            </div>
          </button>

          {/* 6. Single Clear Primary Action */}
          {isItemSold ? (
            <button
              type="button"
              disabled
              aria-label={`${language === 'ka' ? 'გაყიდულია' : 'Sold out'}: ${displayTitle}`}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest bg-proton-bg text-proton-muted border border-proton-border flex items-center justify-center gap-2 cursor-not-allowed select-none"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500/70 shrink-0" />
              <span className="truncate">{language === 'ka' ? 'გაყიდულია' : 'SOLD'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectListing(listing);
              }}
              aria-label={`${language === 'ka' ? 'პროდუქტის დეტალების ნახვა' : 'View details'}: ${displayTitle}`}
              className={cn(
                "w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] cursor-pointer",
                currentTheme.accentBg
              )}
            >
              <Eye size={15} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{language === 'ka' ? 'დეტალების ნახვა' : 'View Details'}</span>
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
});
