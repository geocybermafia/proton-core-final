import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ShoppingBag,
  Star,
  Trash2,
  Edit3,
  Heart,
  MapPin,
  Globe,
  MoreVertical,
  Eye
} from 'lucide-react';
import { Listing, ListingAnalyticsStats } from '../../types';
import { cn } from '../../lib/utils';
import {
  MarketTheme,
  CATEGORY_EMOJIS,
  WORLD_COUNTRIES,
  getListingTitle,
  getCategoryLabel,
  isServiceListing,
  isProjectListing,
  formatCurrencyAmount,
  formatOriginalCurrencyPrice,
  formatApproxCurrencyEquivalent,
  isListingReserved,
  isListingSold,
  isListingUnavailableForPurchase
} from './MarketConstants';
import { getCardAttributeHighlights, isEffectiveRemoteListing } from './ListingSchemas';
import { hasSessionImpression, sendListingAnalyticsEvent } from '../../utils/marketAnalyticsClient';
import { getListingPriceDisplayMode } from '../../lib/listingPricing';

export interface ListingCardImageProps {
  src?: string;
  alt: string;
  isSold?: boolean;
  isReserved?: boolean;
  language: string;
  themeAccent?: string;
  category?: string;
}

const CONTAINER_ASPECT_RATIO = 4 / 3;
const MAX_COVER_CROP_FRACTION = 0.1;

function resolveImageFitMode(naturalWidth: number, naturalHeight: number): 'cover' | 'contain' {
  if (!naturalWidth || !naturalHeight) return 'contain';
  const naturalRatio = naturalWidth / naturalHeight;
  const visibleFraction = Math.min(
    naturalRatio / CONTAINER_ASPECT_RATIO,
    CONTAINER_ASPECT_RATIO / naturalRatio
  );
  return 1 - visibleFraction <= MAX_COVER_CROP_FRACTION ? 'cover' : 'contain';
}

export const ListingCardImage = React.memo(function ListingCardImage({
  src,
  alt,
  isSold,
  isReserved,
  language,
  themeAccent,
  category
}: ListingCardImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [fitMode, setFitMode] = useState<'cover' | 'contain' | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const handleImageReady = (img: HTMLImageElement) => {
    setFitMode(resolveImageFitMode(img.naturalWidth, img.naturalHeight));
    setHasError(false);
    setIsLoaded(true);
  };

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    setFitMode(null);

    const img = imgRef.current;
    if (src && img && img.complete && img.naturalWidth > 0) {
      handleImageReady(img);
    }
  }, [src]);

  const isContainMode = isLoaded && fitMode === 'contain';
  const isCoverMode = isLoaded && fitMode === 'cover';

  return (
    <div className="w-full h-full overflow-hidden relative">
      {!isLoaded && !hasError && src && (
        <div className="absolute inset-0 z-0 animate-pulse bg-proton-border/40 flex items-center justify-center">
          <div className="w-7 h-7 rounded-full border-2 border-proton-border border-t-proton-accent animate-spin opacity-60" />
        </div>
      )}

      {src && !hasError ? (
        <>
          {isContainMode && (
            <div
              aria-hidden="true"
              className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none"
            >
              <img
                src={src}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center blur-xl scale-110 opacity-35"
              />
              <div className="absolute inset-0 bg-proton-bg/30" />
            </div>
          )}

          <motion.img
            ref={imgRef}
            src={src}
            alt={alt}
            onLoad={(e) => handleImageReady(e.currentTarget)}
            onError={() => {
              setHasError(true);
              setIsLoaded(true);
              setFitMode(null);
            }}
            className={cn(
              "relative z-[1] w-full h-full object-center block transition-opacity duration-300 ease-out",
              isCoverMode ? "object-cover" : "object-contain",
              isLoaded ? "opacity-100" : "opacity-0"
            )}
            whileHover={{ scale: (isSold || isReserved) ? 1.0 : (isContainMode ? 1.02 : 1.04) }}
            referrerPolicy="no-referrer"
          />
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-800/60">
          <span className="text-3xl select-none" aria-hidden="true">
            {CATEGORY_EMOJIS[category || ''] || '🏷️'}
          </span>
        </div>
      )}

      {isSold ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[2px] bg-black/55 pointer-events-none select-none">
          <div className="px-3.5 py-1.5 rounded-xl bg-proton-card/95 border border-rose-500/40 shadow-xl flex items-center gap-2 transform -rotate-3">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" />
            <span className="text-[11px] font-black tracking-widest text-proton-text uppercase font-mono">
              {language === 'ka' ? 'გაყიდულია' : 'SOLD OUT'}
            </span>
          </div>
        </div>
      ) : isReserved ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[2px] bg-black/45 pointer-events-none select-none">
          <div className="px-3.5 py-1.5 rounded-xl bg-proton-card/95 border border-amber-500/40 shadow-xl flex items-center gap-2 transform -rotate-3">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
            <span className="text-[11px] font-black tracking-widest text-amber-400 uppercase font-mono">
              {language === 'ka' ? 'დაჯავშნილია' : 'RESERVED'}
            </span>
          </div>
        </div>
      ) : null}
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
  ownerStats?: ListingAnalyticsStats;
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
  onDeleteListing,
  ownerStats
}: MarketListingCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement | null>(null);

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
  const isItemSold = isListingSold(listing);
  const isItemReserved = isListingReserved(listing);
  const isItemUnavailable = isListingUnavailableForPurchase(listing);

  // Real Impression Tracking: >= 50% visible continuously for >= 800ms
  useEffect(() => {
    if (isOwnListing || !listing?.id || hasSessionImpression(listing.id)) return;
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    let dwellTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (!dwellTimer) {
            dwellTimer = setTimeout(() => {
              sendListingAnalyticsEvent({
                listingId: listing.id,
                sellerId: listing.sellerId,
                eventType: 'impression',
                currentUserId: user?.uid,
              });
              observer.disconnect();
            }, 800);
          }
        } else if (dwellTimer) {
          clearTimeout(dwellTimer);
          dwellTimer = null;
        }
      },
      { threshold: [0.5] }
    );

    observer.observe(el);
    return () => {
      if (dwellTimer) clearTimeout(dwellTimer);
      observer.disconnect();
    };
  }, [listing.id, listing.sellerId, isOwnListing, user?.uid]);
  const displayTitle = getListingTitle(listing, language);
  const imageUrl = (listing.images && listing.images.length > 0) ? listing.images[0] : listing.image;

  const priceDisplayMode = getListingPriceDisplayMode(listing);
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

  const isRemote = isEffectiveRemoteListing(listing);
  const attributeHighlights = getCardAttributeHighlights(listing, language, 2);

  const countryEntry = WORLD_COUNTRIES.find(c => c.code === listing.country);
  const countryDisplay = countryEntry
    ? (countryEntry.code === 'GLOBAL'
      ? (language === 'ka' ? 'გლობალური' : 'Worldwide')
      : countryEntry.name)
    : (listing.country || '');
  const cityDisplay = (listing.city || '').trim();
  const isDefaultRemotePlaceholder =
    isRemote &&
    ((listing.country || '').trim().toUpperCase() === 'GLOBAL' || !countryDisplay) &&
    (!cityDisplay || cityDisplay.toLowerCase() === 'online');

  const locationParts = Array.from(
    new Set([cityDisplay, countryDisplay].filter(Boolean))
  );
  const baseLocationLabel = locationParts.length > 0
    ? locationParts.join(', ')
    : (language === 'ka' ? 'მდებარეობა მითითებული არ არის' : 'Location not specified');
  const locationLabel = isRemote
    ? (isDefaultRemotePlaceholder
      ? (language === 'ka' ? 'დისტანციური / ონლაინ' : 'Remote / Online')
      : `${language === 'ka' ? 'დისტანციური' : 'Remote'} · ${baseLocationLabel}`)
    : baseLocationLabel;

  const categoryLabel = getCategoryLabel(listing.category, t, language);
  const tags = Array.isArray(listing.tags) ? listing.tags : [];
  const sellerName = listing.sellerName || listing.authorName || 'Proton Vendor';

  return (
    <motion.article
      ref={cardRef}
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
        "group rounded-xl overflow-hidden transition-all duration-300 flex flex-col h-full w-full relative border hover:shadow-xl hover:-translate-y-1 cursor-pointer min-w-0",
        currentTheme.card,
        isItemUnavailable ? "opacity-85" : "hover:border-proton-accent/45"
      )}
    >
      {/* 1. Product Photo */}
      <div className="w-full aspect-[4/3] overflow-hidden relative shrink-0 bg-proton-bg">
        <ListingCardImage
          src={imageUrl}
          alt={displayTitle}
          isSold={isItemSold}
          isReserved={isItemReserved}
          language={language}
          themeAccent={currentTheme.accent}
          category={listing.category}
        />

        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/35 via-black/10 to-transparent pointer-events-none z-[2]" />

        {/* Non-overlapping Top Overlay Bar: max 1 category badge on left + compact Favorite & options menu on right */}
        <div className="absolute top-2.5 inset-x-2.5 z-20 flex items-start justify-between gap-2 pointer-events-none">
          <div className="min-w-0 flex-1 flex items-center">
            <div className="px-2 py-1 bg-proton-card/90 backdrop-blur-md rounded-lg border border-proton-border inline-flex items-center gap-1 shadow-sm max-w-full min-w-0">
              <span className="text-[10px] leading-none shrink-0" aria-hidden="true">
                {CATEGORY_EMOJIS[listing.category] || '🏷️'}
              </span>
              <span className="text-[11px] font-black text-proton-accent uppercase tracking-wider truncate block">
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
      <div className="p-3.5 sm:p-5 flex-1 flex flex-col justify-between gap-3 min-w-0">
        <div className="space-y-3 min-w-0">
          {/* 2. Product Title */}
          <h2 className="text-[13px] sm:text-base font-bold tracking-tight text-proton-text group-hover:text-proton-accent transition-colors line-clamp-2 min-h-[2.5rem] sm:min-h-[2.6rem] leading-snug break-words">
            {displayTitle}
          </h2>

          {attributeHighlights.length > 0 && (
            <div className="flex flex-wrap gap-1.5 min-w-0">
              {attributeHighlights.map((highlight, hIdx) => (
                <span
                  key={`${listing.id}-hl-${hIdx}`}
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-proton-bg border border-proton-border text-proton-muted truncate max-w-full"
                >
                  {highlight}
                </span>
              ))}
            </div>
          )}

          {/* 3. Price (Free / Negotiable / Unspecified or formatted amount) */}
          <div className={cn("pt-2.5 border-t min-w-0", currentTheme.border)}>
            <div className="flex items-end justify-between gap-2 min-w-0 flex-wrap">
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[11px] uppercase tracking-wider text-proton-muted font-bold mb-0.5 block font-mono">
                  {priceDisplayMode !== 'amount' || isSameCurrency
                    ? t.market.price
                    : (language === 'ka' ? 'სავარაუდო ფასი' : 'Est. Price')}
                </span>

                {priceDisplayMode === 'negotiable' ? (
                  <div className="flex items-baseline gap-1 min-w-0 overflow-hidden">
                    <span className="font-black tracking-tight text-proton-accent leading-none truncate text-base sm:text-lg">
                      {language === 'ka' ? 'შეთანხმებით' : 'Negotiable'}
                    </span>
                  </div>
                ) : priceDisplayMode === 'free' ? (
                  <div className="flex items-baseline gap-1 min-w-0 overflow-hidden">
                    <span className="font-black tracking-tight text-emerald-500 leading-none truncate text-base sm:text-lg">
                      {language === 'ka' ? 'უფასო' : 'Free'}
                    </span>
                  </div>
                ) : priceDisplayMode === 'unspecified' ? (
                  <div className="flex items-baseline gap-1 min-w-0 overflow-hidden">
                    <span className="font-bold tracking-tight text-proton-text leading-none truncate text-sm sm:text-base">
                      {language === 'ka' ? 'მითითებული არ არის' : 'Not specified'}
                    </span>
                  </div>
                ) : isSameCurrency ? (
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

              {listing.isNegotiable && priceDisplayMode === 'amount' ? (
                <span className="text-[10px] font-bold text-proton-muted uppercase tracking-wider font-mono shrink-0 whitespace-nowrap">
                  {language === 'ka' ? 'შეთანხმებით' : 'Negotiable'}
                </span>
              ) : isServiceListing(listing) ? (
                <span className="text-[10px] font-bold text-proton-accent uppercase tracking-wider font-mono shrink-0 whitespace-nowrap">
                  {language === 'ka' ? 'სერვისი' : 'Service'}
                </span>
              ) : isProjectListing(listing) ? (
                <span className="text-[10px] font-bold text-proton-accent uppercase tracking-wider font-mono shrink-0 whitespace-nowrap">
                  {language === 'ka' ? 'პროექტი' : 'Project'}
                </span>
              ) : null}
            </div>
          </div>

          {/* 4. Location */}
          <div className="flex items-center gap-1.5 text-xs text-proton-muted min-w-0">
            {isRemote ? (
              <Globe size={13} className="shrink-0 text-proton-accent" aria-hidden="true" />
            ) : (
              <MapPin size={13} className="shrink-0 text-proton-muted" aria-hidden="true" />
            )}
            {!isDefaultRemotePlaceholder && countryEntry?.flag && (
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
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs relative shrink-0 bg-proton-bg text-proton-text border border-proton-border group-hover/vendor:border-proton-accent/50 transition-all">
                {sellerName.substring(0, 2).toUpperCase()}
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-proton-card" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-xs font-bold tracking-wide truncate block text-proton-text group-hover/vendor:text-proton-accent transition-colors">
                    {sellerName}
                  </span>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-1 text-[11px] font-bold">
              {sellerRating && sellerRating.count > 0 ? (
                <>
                  <Star size={12} className="fill-amber-400 text-amber-500 shrink-0" aria-hidden="true" />
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
          ) : isItemReserved ? (
            <button
              type="button"
              disabled
              aria-label={`${language === 'ka' ? 'დაჯავშნილია' : 'Reserved'}: ${displayTitle}`}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center justify-center gap-2 cursor-not-allowed select-none"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
              <span className="truncate">{language === 'ka' ? 'დაჯავშნილია' : 'RESERVED'}</span>
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

          {isOwnListing && ownerStats && (
            <div className="pt-2 border-t border-proton-border grid grid-cols-3 gap-1 text-center min-w-0">
              <div className="px-1 py-1 rounded-lg bg-proton-bg/70 border border-proton-border min-w-0">
                <div className="text-[7px] sm:text-[8px] font-bold uppercase text-proton-muted truncate">
                  {language === 'ka' ? 'გამოჩენა' : 'Impr.'}
                </div>
                <div className="text-[10px] sm:text-[11px] font-black font-mono text-proton-text tabular-nums truncate">
                  {ownerStats.periods.all.impressions}
                </div>
              </div>
              <div className="px-1 py-1 rounded-lg bg-proton-bg/70 border border-proton-border min-w-0">
                <div className="text-[7px] sm:text-[8px] font-bold uppercase text-proton-muted truncate">
                  {language === 'ka' ? 'ნახვა' : 'Views'}
                </div>
                <div className="text-[10px] sm:text-[11px] font-black font-mono text-proton-text tabular-nums truncate">
                  {ownerStats.periods.all.views}
                </div>
              </div>
              <div className="px-1 py-1 rounded-lg bg-proton-bg/70 border border-proton-border min-w-0">
                <div className="text-[7px] sm:text-[8px] font-bold uppercase text-proton-muted truncate">
                  {language === 'ka' ? 'უნიკ.' : 'Uniq.'}
                </div>
                <div className="text-[10px] sm:text-[11px] font-black font-mono text-emerald-500 tabular-nums truncate">
                  {ownerStats.periods.all.uniqueViewers}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
});
