import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ShoppingBag,
  ShoppingCart,
  MessageCircle,
  MapPin,
  Star,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Heart,
  Check,
  Edit3,
  Trash2,
  Tag
} from 'lucide-react';
import { Listing } from '../../types';
import { cn } from '../../lib/utils';
import {
  MarketTheme,
  WORLD_COUNTRIES,
  getListingTitle,
  formatCurrencyAmount,
  formatOriginalCurrencyPrice,
  formatApproxCurrencyEquivalent
} from './MarketConstants';

export interface ListingDetailsModalProps {
  listing: Listing | null;
  onClose: () => void;
  modalRef?: React.Ref<HTMLDivElement>;
  user: any;
  language: string;
  t: any;
  currentTheme: MarketTheme;
  displayCurrency: string;
  priceMap: Map<string, number>;
  convertPrice: (price: number, from: string, to: string) => number;
  sellerRating?: { avg: number; count: number };
  isInCart: boolean;
  isFavorite: boolean;
  onToggleFavorite: (id: string, e?: React.MouseEvent) => void;
  onSelectVendor: (vendor: { id: string; name: string }) => void;
  onAddToCart: (listing: Listing) => void;
  onStartChat: (listing: Listing) => void;
  onBuyNow: (listing: Listing) => void;
  onStartEdit?: (listing: Listing) => void;
  onDeleteListing?: (id: string) => void;
}

export const ListingDetailsModal = React.memo(function ListingDetailsModal({
  listing,
  onClose,
  modalRef,
  user,
  language,
  t,
  currentTheme,
  displayCurrency,
  priceMap,
  convertPrice,
  sellerRating,
  isInCart,
  isFavorite,
  onToggleFavorite,
  onSelectVendor,
  onAddToCart,
  onStartChat,
  onBuyNow,
  onStartEdit,
  onDeleteListing
}: ListingDetailsModalProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setActiveImageIndex(0);
    setFailedImages({});
  }, [listing?.id]);

  const galleryImages = useMemo(() => {
    if (!listing) return [];
    const combined = [
      ...(Array.isArray(listing.images) ? listing.images : []),
      ...(listing.image ? [listing.image] : [])
    ]
      .map((url) => (typeof url === 'string' ? url.trim() : ''))
      .filter(Boolean);

    return Array.from(new Set(combined));
  }, [listing]);

  useEffect(() => {
    if (!listing || galleryImages.length <= 1) return;
    const handleArrowNav = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setActiveImageIndex((prev) => (prev + 1) % galleryImages.length);
      } else if (e.key === 'ArrowLeft') {
        setActiveImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
      }
    };
    window.addEventListener('keydown', handleArrowNav);
    return () => window.removeEventListener('keydown', handleArrowNav);
  }, [listing, galleryImages.length]);

  if (!listing) return null;

  const isOwnListing = Boolean(user && listing.sellerId === user.uid);
  const isItemSold = listing.status === 'sold' || Boolean((listing as any).isSold);
  const displayTitle = getListingTitle(listing, language);
  const secondaryTitle =
    listing.titleGe && listing.title && listing.titleGe.trim() !== listing.title.trim()
      ? language === 'ka'
        ? listing.title
        : listing.titleGe
      : null;

  const displayDescription =
    language === 'ka'
      ? listing.descriptionGe || listing.description
      : listing.description || listing.descriptionGe;

  const originalCurrency = (listing.currency || 'USD').trim().toUpperCase();
  const targetCurrency = (displayCurrency || 'USD').trim().toUpperCase();
  const isSameCurrency = originalCurrency === targetCurrency;

  const resolvedPrice =
    priceMap.get(listing.id) ??
    convertPrice(listing.price, originalCurrency, targetCurrency);
  const formattedOriginal = formatOriginalCurrencyPrice(listing.price, originalCurrency);
  const formattedApprox = formatApproxCurrencyEquivalent(resolvedPrice, targetCurrency);

  const categoryLabel =
    (t?.market?.categories && t.market.categories[listing.category]) ||
    listing.category;

  const countryObj = WORLD_COUNTRIES.find((c) => c.code === listing.country);
  const locationParts = [
    countryObj ? `${countryObj.flag} ${countryObj.name}` : listing.country,
    listing.city,
    listing.location
  ]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);
  const uniqueLocationParts = Array.from(new Set(locationParts));

  const getConditionLabel = (condition?: string) => {
    if (!condition) {
      return language === 'ka' ? 'მითითებული არ არის' : 'Not specified';
    }
    const normalized = condition.toLowerCase();
    if (normalized === 'new') return language === 'ka' ? 'ახალი' : 'New';
    if (normalized === 'used') return language === 'ka' ? 'მეორადი' : 'Used';
    if (normalized === 'refurbished') {
      return language === 'ka' ? 'განახლებული' : 'Refurbished';
    }
    return condition;
  };

  const getListingTypeLabel = () => {
    if (listing.listingType === 'service' || listing.category === 'service') {
      return language === 'ka' ? 'სერვისი' : 'Service';
    }
    if (listing.listingType === 'project') {
      return language === 'ka' ? 'პროექტი' : 'Project';
    }
    return language === 'ka' ? 'პროდუქტი' : 'Product';
  };

  const activeImageSrc = galleryImages[activeImageIndex];
  const hasActiveImageError = Boolean(failedImages[activeImageIndex]);

  return (
    <AnimatePresence>
      {listing && (
        <div
          className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="listing-details-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Dialog Surface */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'relative w-full max-w-4xl rounded-t-3xl sm:rounded-3xl border flex flex-col overflow-hidden z-10 max-h-[92dvh] sm:max-h-[88vh] shadow-2xl',
              currentTheme.card
            )}
          >
            {/* Header Bar */}
            <div
              className={cn(
                'px-5 py-4 sm:px-6 border-b flex items-center justify-between gap-4 shrink-0',
                currentTheme.border
              )}
            >
              <div className="flex items-center gap-2 text-xs font-medium min-w-0">
                <Tag size={14} className={cn('shrink-0', currentTheme.accent)} />
                <span className={cn('truncate', currentTheme.text)}>{categoryLabel}</span>
                <span aria-hidden="true" className={currentTheme.muted}>
                  ·
                </span>
                <span className={cn('shrink-0', currentTheme.muted)}>
                  {getListingTypeLabel()}
                </span>
                {isItemSold && (
                  <>
                    <span aria-hidden="true" className={currentTheme.muted}>
                      ·
                    </span>
                    <span className="font-bold text-red-400 shrink-0">
                      {language === 'ka' ? 'გაყიდულია' : 'Sold'}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => onToggleFavorite(listing.id, e)}
                  className={cn(
                    'min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border transition-colors cursor-pointer',
                    currentTheme.border,
                    isFavorite
                      ? 'bg-red-500/15 border-red-500/30 text-red-400'
                      : 'hover:bg-white/5 text-zinc-400 hover:text-red-400'
                  )}
                  aria-label={
                    isFavorite
                      ? language === 'ka'
                        ? 'რჩეულებიდან წაშლა'
                        : 'Remove from favorites'
                      : language === 'ka'
                      ? 'რჩეულებში დამატება'
                      : 'Add to favorites'
                  }
                  title={
                    language === 'ka' ? 'რჩეულები' : 'Favorite'
                  }
                >
                  <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    'min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border transition-colors cursor-pointer hover:bg-white/10',
                    currentTheme.border,
                    currentTheme.text
                  )}
                  aria-label={language === 'ka' ? 'დახურვა' : 'Close'}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* Left Column: Photo Gallery */}
                <div className="md:col-span-6 space-y-3">
                  <div
                    className={cn(
                      'relative w-full aspect-[4/3] rounded-2xl overflow-hidden border bg-zinc-950/70 flex items-center justify-center',
                      currentTheme.border
                    )}
                  >
                    {activeImageSrc && !hasActiveImageError ? (
                      <img
                        src={activeImageSrc}
                        alt={displayTitle}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImages((prev) => ({
                            ...prev,
                            [activeImageIndex]: true
                          }))
                        }
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
                        <ShoppingBag
                          size={36}
                          className={cn('opacity-25', currentTheme.accent)}
                        />
                        <span className={cn('text-xs', currentTheme.muted)}>
                          {language === 'ka'
                            ? 'ფოტო მიუწვდომელია'
                            : 'No photo available'}
                        </span>
                      </div>
                    )}

                    {isItemSold && (
                      <div className="absolute inset-0 bg-black/55 flex items-center justify-center pointer-events-none">
                        <span className="px-4 py-2 rounded-xl bg-zinc-950/90 border border-red-500/40 text-sm font-bold text-red-400">
                          {language === 'ka' ? 'გაყიდულია' : 'Sold Out'}
                        </span>
                      </div>
                    )}

                    {galleryImages.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveImageIndex(
                              (prev) =>
                                (prev - 1 + galleryImages.length) %
                                galleryImages.length
                            )
                          }
                          className="absolute left-3 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] rounded-xl bg-black/70 hover:bg-black/90 text-white border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
                          aria-label={
                            language === 'ka' ? 'წინა ფოტო' : 'Previous photo'
                          }
                        >
                          <ChevronLeft size={20} />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setActiveImageIndex(
                              (prev) => (prev + 1) % galleryImages.length
                            )
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] rounded-xl bg-black/70 hover:bg-black/90 text-white border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
                          aria-label={
                            language === 'ka' ? 'შემდეგი ფოტო' : 'Next photo'
                          }
                        >
                          <ChevronRight size={20} />
                        </button>

                        <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/75 text-white text-xs font-mono tabular-nums border border-white/10">
                          {activeImageIndex + 1} / {galleryImages.length}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Thumbnails Strip */}
                  {galleryImages.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {galleryImages.map((imgUrl, idx) => {
                        const isSelected = idx === activeImageIndex;
                        const thumbFailed = Boolean(failedImages[idx]);
                        return (
                          <button
                            key={`${imgUrl}-${idx}`}
                            type="button"
                            onClick={() => setActiveImageIndex(idx)}
                            className={cn(
                              'w-16 h-12 min-h-[44px] rounded-xl overflow-hidden border shrink-0 transition-all cursor-pointer bg-zinc-950/60 flex items-center justify-center',
                              isSelected
                                ? 'border-[#dfb257] ring-2 ring-[#dfb257]/30 opacity-100'
                                : cn(currentTheme.border, 'opacity-65 hover:opacity-100')
                            )}
                            aria-label={`${
                              language === 'ka' ? 'ფოტო' : 'Photo'
                            } ${idx + 1}`}
                            aria-current={isSelected ? 'true' : undefined}
                          >
                            {!thumbFailed ? (
                              <img
                                src={imgUrl}
                                alt={`${displayTitle} ${idx + 1}`}
                                referrerPolicy="no-referrer"
                                onError={() =>
                                  setFailedImages((prev) => ({
                                    ...prev,
                                    [idx]: true
                                  }))
                                }
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ShoppingBag size={14} className={currentTheme.muted} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right Column: Product Info & Details */}
                <div className="md:col-span-6 space-y-5 min-w-0">
                  {/* Title & Price */}
                  <div className="space-y-2">
                    <h2
                      id="listing-details-title"
                      className={cn(
                        'text-xl sm:text-2xl font-bold leading-snug break-words',
                        currentTheme.text
                      )}
                    >
                      {displayTitle}
                    </h2>
                    {secondaryTitle && (
                      <p className={cn('text-xs break-words', currentTheme.muted)}>
                        {secondaryTitle}
                      </p>
                    )}

                    <div className="pt-2 space-y-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        {isSameCurrency ? (
                          <div className="flex items-baseline gap-1.5">
                            <span
                              className={cn(
                                'text-2xl sm:text-3xl font-black font-mono tabular-nums',
                                currentTheme.accent
                              )}
                            >
                              {formatCurrencyAmount(listing.price, originalCurrency)}
                            </span>
                            <span className={cn('text-sm font-bold font-mono', currentTheme.muted)}>
                              {originalCurrency}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span
                                className={cn(
                                  'text-2xl sm:text-3xl font-black font-mono tabular-nums',
                                  currentTheme.accent
                                )}
                              >
                                {formattedApprox}
                              </span>
                              <span className={cn('text-xs font-medium', currentTheme.muted)}>
                                ({language === 'ka' ? 'სავარაუდო ეკვივალენტი' : 'Est. equivalent'})
                              </span>
                            </div>
                            <div className={cn('text-sm font-bold font-mono tabular-nums', currentTheme.text)}>
                              {language === 'ka' ? 'ორიგინალი ფასი:' : 'Original price:'} {formattedOriginal}
                            </div>
                          </div>
                        )}

                        <span className={cn('text-xs font-medium', currentTheme.muted)}>
                          {listing.isNegotiable
                            ? language === 'ka'
                              ? 'ფასზე მოლაპარაკება შესაძლებელია'
                              : 'Negotiable price'
                            : language === 'ka'
                            ? 'ფიქსირებული ფასი'
                            : 'Fixed price'}
                        </span>
                      </div>
                      {!isSameCurrency && (
                        <p className={cn('text-xs', currentTheme.muted)}>
                          {language === 'ka'
                            ? `კონვერტირებული თანხა მხოლოდ საორიენტაციოა. შეკვეთა ფორმდება ორიგინალ ვალუტაში (${originalCurrency}).`
                            : `Converted amount is an indicative estimate only. Orders are placed in the listing's original currency (${originalCurrency}).`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Key Specifications List */}
                  <div
                    className={cn(
                      'py-4 border-y space-y-3 text-sm',
                      currentTheme.border
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className={cn('text-xs shrink-0', currentTheme.muted)}>
                        {language === 'ka' ? 'მდგომარეობა' : 'Condition'}
                      </span>
                      <span className={cn('font-medium text-right', currentTheme.text)}>
                        {getConditionLabel(listing.condition)}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <span className={cn('text-xs shrink-0', currentTheme.muted)}>
                        {language === 'ka' ? 'მოლაპარაკება' : 'Negotiability'}
                      </span>
                      <span className={cn('font-medium text-right', currentTheme.text)}>
                        {listing.isNegotiable
                          ? language === 'ka'
                            ? 'შესაძლებელია'
                            : 'Negotiable'
                          : language === 'ka'
                          ? 'ფიქსირებული'
                          : 'Fixed'}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <span className={cn('text-xs shrink-0 flex items-center gap-1', currentTheme.muted)}>
                        <MapPin size={13} className="shrink-0" />
                        <span>{language === 'ka' ? 'მისამართი' : 'Address'}</span>
                      </span>
                      <span className={cn('font-medium text-right break-words', currentTheme.text)}>
                        {uniqueLocationParts.length > 0
                          ? uniqueLocationParts.join(', ')
                          : language === 'ka'
                          ? 'მითითებული არ არის'
                          : 'Not specified'}
                      </span>
                    </div>

                    {(listing.listingType === 'service' || listing.listingType === 'project') &&
                      listing.serviceDuration && (
                        <div className="flex items-start justify-between gap-4">
                          <span className={cn('text-xs shrink-0', currentTheme.muted)}>
                            {language === 'ka' ? 'ვადა / ხანგრძლივობა' : 'Duration'}
                          </span>
                          <span className={cn('font-medium text-right', currentTheme.text)}>
                            {listing.serviceDuration}
                          </span>
                        </div>
                      )}
                  </div>

                  {/* Full Description */}
                  <div className="space-y-2">
                    <h3 className={cn('text-xs font-bold uppercase tracking-wider', currentTheme.muted)}>
                      {language === 'ka' ? 'აღწერა' : 'Description'}
                    </h3>
                    <p
                      className={cn(
                        'text-sm leading-relaxed whitespace-pre-line break-words',
                        currentTheme.subtext
                      )}
                    >
                      {displayDescription?.trim()
                        ? displayDescription
                        : language === 'ka'
                        ? 'დამატებითი აღწერა მითითებული არ არის.'
                        : 'No additional description provided.'}
                    </p>
                  </div>

                  {/* Seller Info & Rating */}
                  <div className={cn('pt-3 border-t', currentTheme.border)}>
                    <button
                      type="button"
                      onClick={() =>
                        onSelectVendor({
                          id: listing.sellerId,
                          name: listing.sellerName
                        })
                      }
                      className={cn(
                        'w-full p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition-colors cursor-pointer',
                        currentTheme.cardAlt,
                        currentTheme.bgHover
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border',
                            currentTheme.border,
                            currentTheme.card
                          )}
                        >
                          {(listing.sellerName || 'S').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={cn('text-sm font-bold truncate', currentTheme.text)}>
                              {listing.sellerName || (language === 'ka' ? 'გამყიდველი' : 'Seller')}
                            </span>
                            <ShieldCheck size={14} className={cn('shrink-0', currentTheme.accent)} />
                          </div>
                          <div className="flex items-center gap-1.5 text-xs mt-0.5">
                            {sellerRating && sellerRating.count > 0 ? (
                              <>
                                <Star size={12} className="fill-[#dfb257] text-[#dfb257] shrink-0" />
                                <span className={cn('font-bold tabular-nums', currentTheme.accent)}>
                                  {sellerRating.avg.toFixed(1)}
                                </span>
                                <span className={currentTheme.muted}>
                                  ({sellerRating.count}{' '}
                                  {language === 'ka' ? 'შეფასება' : 'reviews'})
                                </span>
                              </>
                            ) : (
                              <span className={currentTheme.muted}>
                                {language === 'ka' ? 'ახალი გამყიდველი' : 'New seller'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <span className={cn('text-xs font-medium shrink-0', currentTheme.muted)}>
                        {language === 'ka' ? 'პროფილი' : 'Reviews'}
                      </span>
                    </button>
                  </div>

                  {/* Direct Agreement Notice */}
                  <p className={cn('text-xs leading-relaxed', currentTheme.muted)}>
                    {language === 'ka'
                      ? 'გადახდის და მიწოდების პირობებზე მყიდველი და გამყიდველი თანხმდებიან უშუალოდ.'
                      : 'Payment and delivery terms are agreed directly between buyer and seller.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div
              className={cn(
                'p-4 sm:px-6 sm:py-4 border-t shrink-0',
                currentTheme.border
              )}
            >
              {isOwnListing ? (
                <div className="flex flex-wrap items-center gap-2.5 justify-end">
                  {onStartEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onStartEdit(listing);
                      }}
                      className={cn(
                        'flex-1 sm:flex-initial min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer',
                        currentTheme.accentBg
                      )}
                    >
                      <Edit3 size={16} />
                      <span>{t?.market?.edit_listing || (language === 'ka' ? 'რედაქტირება' : 'Edit Listing')}</span>
                    </button>
                  )}
                  {onDeleteListing && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onDeleteListing(listing.id);
                      }}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-bold bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Trash2 size={16} />
                      <span>{language === 'ka' ? 'წაშლა' : 'Delete'}</span>
                    </button>
                  )}
                </div>
              ) : isItemSold ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <span className="text-sm font-bold text-red-400">
                    {language === 'ka'
                      ? 'ეს განცხადება უკვე გაყიდულია.'
                      : 'This listing is already sold.'}
                  </span>
                  <button
                    type="button"
                    onClick={onClose}
                    className={cn(
                      'min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-bold border transition-colors cursor-pointer',
                      currentTheme.border,
                      currentTheme.text
                    )}
                  >
                    {language === 'ka' ? 'კატალოგში დაბრუნება' : 'Back to Catalog'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onStartChat(listing);
                    }}
                    className={cn(
                      'min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2 transition-colors cursor-pointer hover:bg-white/10',
                      currentTheme.border,
                      currentTheme.text
                    )}
                  >
                    <MessageCircle size={17} />
                    <span>
                      {language === 'ka' ? 'მიწერა გამყიდველს' : 'Message Seller'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onAddToCart(listing)}
                    className={cn(
                      'min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2 transition-colors cursor-pointer',
                      isInCart
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : cn(currentTheme.border, currentTheme.text, 'hover:bg-white/10')
                    )}
                  >
                    {isInCart ? <Check size={17} /> : <ShoppingCart size={17} />}
                    <span>
                      {isInCart
                        ? language === 'ka'
                          ? 'კალათაშია'
                          : 'In Cart'
                        : language === 'ka'
                        ? 'კალათაში დამატება'
                        : 'Add to Cart'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onBuyNow(listing);
                    }}
                    className={cn(
                      'min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md',
                      currentTheme.accentBg
                    )}
                  >
                    <ShoppingBag size={17} />
                    <span>
                      {language === 'ka' ? 'ყიდვა / შეკვეთა' : 'Buy / Order'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});
