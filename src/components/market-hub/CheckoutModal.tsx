import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, ShoppingBag, ShieldCheck, MapPin, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Listing } from '../../types';
import { MarketTheme } from './MarketConstants';
import { CartItemThumbnail } from './CartDrawer';

export interface CheckoutModalProps {
  checkoutItem: Listing | null;
  onClose: () => void;
  modalRef?: React.Ref<HTMLDivElement>;
  language: string;
  t: any;
  currentTheme: MarketTheme;
  cart: Listing[];
  onViewCart: () => void;
  displayCurrency: string;
  priceMap: Map<string, number>;
  convertPrice: (price: number, from: string, to: string) => number;
  buyerInstructions: string;
  onChangeBuyerInstructions: (instructions: string) => void;
  isCheckingOut: boolean;
  onConfirmPurchase: () => void;
}

export const CheckoutModal = React.memo(function CheckoutModal({
  checkoutItem,
  onClose,
  modalRef,
  language,
  t,
  currentTheme,
  cart,
  onViewCart,
  displayCurrency,
  priceMap,
  convertPrice,
  buyerInstructions,
  onChangeBuyerInstructions,
  isCheckingOut,
  onConfirmPurchase
}: CheckoutModalProps) {
  return (
    <AnimatePresence>
      {checkoutItem && (
        <div 
          className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={language === 'ka' ? 'შეკვეთის გაფორმება' : 'Complete Purchase'}
        >
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isCheckingOut && onClose()}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          
          <motion.div 
            ref={modalRef}
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className={cn(
              "relative w-full max-w-lg rounded-t-[32px] sm:rounded-[36px] border border-white/10 flex flex-col overflow-hidden z-10 max-h-[92dvh] sm:max-h-[88vh] shadow-2xl",
              currentTheme.card
            )}
          >
            {/* Fixed Header */}
            <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-zinc-950/60 backdrop-blur-md">
              <div>
                <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
                  {language === 'ka' ? 'შეკვეთის გაფორმება' : 'Complete Purchase'}
                </h3>
                <p className={cn("text-[9px] font-bold uppercase tracking-widest leading-none mt-1", currentTheme.muted)}>
                  {checkoutItem.listingType === 'service' || checkoutItem.category === 'service'
                    ? (language === 'ka' ? 'პირდაპირი ჯავშანი' : 'Direct Service Booking')
                    : (language === 'ka' ? 'პირდაპირი შესყიდვა' : 'Direct Item Purchase')}
                </p>
              </div>
              <button 
                onClick={onClose}
                disabled={isCheckingOut}
                className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors disabled:opacity-50 text-white"
                aria-label={language === 'ka' ? 'დახურვა' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar-minimal overscroll-contain">
              {/* Cart Sync Warning Banner */}
              {cart.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                    <ShoppingCart size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-amber-200/90 leading-snug">
                      {language === 'ka'
                        ? `თქვენს კალათაში უკვე გაქვთ ${cart.length} ნივთი. ეს მოქმედება გააფორმებს მხოლოდ ამ კონკრეტულ ნივთს.`
                        : `You currently have ${cart.length} item(s) in your cart. This action purchases only this listing directly.`}
                    </p>
                    <button
                      type="button"
                      onClick={onViewCart}
                      className="mt-2 text-[10px] font-black uppercase tracking-wider text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors flex items-center gap-1"
                    >
                      {language === 'ka' ? 'კალათის ნახვა & ერთობლივი შეძენა' : 'View Cart & Checkout All Items'}
                    </button>
                  </div>
                </div>
              )}

              {/* Item Details Card */}
              <div className="bg-white/5 rounded-3xl p-5 border border-white/5 flex items-center gap-4 sm:gap-5">
                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-black/40 border border-white/10 shrink-0 relative">
                  {checkoutItem.image ? (
                    <CartItemThumbnail 
                      src={checkoutItem.image} 
                      alt={language === 'ka' ? (checkoutItem.titleGe || checkoutItem.title) : checkoutItem.title} 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag size={24} className={currentTheme.accent} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    "inline-block px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest mb-1.5",
                    (checkoutItem.listingType === 'service' || checkoutItem.category === 'service')
                      ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                      : "bg-emerald-500/10 border border-emerald-500/20 text-[#10b981]"
                  )}>
                    {t.market.categories[checkoutItem.category as keyof typeof t.market.categories] || checkoutItem.category}
                  </span>
                  <h4 className="text-sm sm:text-base font-bold text-white uppercase tracking-tight line-clamp-1">
                    {language === 'ka' ? (checkoutItem.titleGe || checkoutItem.title) : checkoutItem.title}
                  </h4>
                  <p className="text-lg sm:text-xl font-black text-[#10b981] font-mono mt-1">
                    {(priceMap.get(checkoutItem.id) ?? convertPrice(checkoutItem.price, checkoutItem.currency || 'USD', displayCurrency)).toLocaleString(undefined, { maximumFractionDigits: 0 })} {displayCurrency}
                  </p>
                </div>
              </div>

              {/* Seller & Location Metas */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-2xl p-3.5 border border-white/5">
                  <p className={cn("text-[8px] font-black uppercase tracking-widest opacity-50 mb-1.5", currentTheme.muted)}>Seller</p>
                  <div className="flex items-center gap-2 min-w-0">
                     <ShieldCheck size={13} className={currentTheme.accent} />
                     <span className="text-[11px] font-black text-white uppercase truncate">{checkoutItem.sellerName}</span>
                  </div>
                </div>
                <div className="bg-white/5 rounded-2xl p-3.5 border border-white/5">
                  <p className={cn("text-[8px] font-black uppercase tracking-widest opacity-50 mb-1.5", currentTheme.muted)}>Location</p>
                  <div className="flex items-center gap-2 min-w-0">
                     <MapPin size={12} className={currentTheme.accent} />
                     <span className="text-[11px] font-black text-white uppercase truncate">{checkoutItem.city || 'Tbilisi'}</span>
                  </div>
                </div>
              </div>

              {/* Conditional Service Booking Panel */}
              {(checkoutItem.listingType === 'service' || checkoutItem.category === 'service') && (
                <div className="space-y-4 bg-white/5 rounded-3xl p-5 border border-white/5 text-left">
                  <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                    <span className="text-amber-400">⚡</span>
                    <span>{language === 'ka' ? 'სერვისის დეტალები' : 'Service Booking Details'}</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs font-medium">
                    <div className="bg-white/5 rounded-xl p-3">
                      <span className="block text-[8px] uppercase tracking-wider opacity-40 mb-1">{language === 'ka' ? 'შესრულების ვადა' : 'Duration'}</span>
                      <span className="text-white font-bold">{checkoutItem.serviceDuration || (language === 'ka' ? 'შეთანხმებით' : 'Flexible')}</span>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                      <span className="block text-[8px] uppercase tracking-wider opacity-40 mb-1">{language === 'ka' ? 'პირობა' : 'Requirements'}</span>
                      <span className="text-white font-bold truncate block">{checkoutItem.serviceTerms || (language === 'ka' ? 'სტანდარტული' : 'Standard')}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-0.5">
                      <label htmlFor="direct-buyer-instructions" className="text-[9px] font-black uppercase tracking-wider text-white/60 block">
                        {language === 'ka' ? 'მოთხოვნები შემსრულებლისთვის' : 'Instructions for the Seller'}
                      </label>
                      <span className={cn("text-[9px] font-mono", buyerInstructions.length >= 480 ? "text-amber-400 font-bold" : "text-white/40")}>
                        {buyerInstructions.length}/500
                      </span>
                    </div>
                    <textarea
                      id="direct-buyer-instructions"
                      value={buyerInstructions}
                      maxLength={500}
                      onChange={e => onChangeBuyerInstructions(e.target.value)}
                      placeholder={language === 'ka' ? "ჩაწერეთ სამუშაოს სპეციფიკაცია, ბმულები ან ინსტრუქცია..." : "Enter your specific task instructions, links, or requirements..."}
                      className={cn("w-full h-24 p-3 rounded-2xl border text-xs font-normal text-white focus:outline-none transition-all placeholder:text-white/20 bg-black/40 resize-none", currentTheme.input)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Bottom Action Footer with safe-area spacing */}
            <div className="p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 border-t border-white/10 shrink-0 bg-zinc-950/95 backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between">
                <span className={cn("text-[9px] font-black uppercase tracking-widest", currentTheme.muted)}>
                  {language === 'ka' ? 'საბოლოო თანხა' : 'Total Amount'}
                </span>
                <span className="text-xl font-black text-[#10b981] font-mono drop-shadow-[0_0_8px_rgba(16,185,129,0.3)] whitespace-nowrap">
                  {(priceMap.get(checkoutItem.id) ?? convertPrice(checkoutItem.price, checkoutItem.currency || 'USD', displayCurrency)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  <span className="text-[10px] font-black opacity-50 ml-1">{displayCurrency}</span>
                </span>
              </div>

              <p className={cn("text-[9px] font-bold text-center leading-relaxed opacity-60", currentTheme.muted)}>
                {language === 'ka' 
                  ? 'ღილაკზე დაჭერით თქვენ ეთანხმებით მომსახურების პირობებს და კონფიდენციალურობის პოლიტიკას.'
                  : 'By confirming, you agree to the marketplace terms and conditions.'}
              </p>
              
              <button 
                onClick={onConfirmPurchase}
                disabled={isCheckingOut}
                className={cn(
                  "w-full min-h-[48px] py-4 sm:py-4.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-2.5 relative overflow-hidden group cursor-pointer",
                  currentTheme.accentBg, "text-white hover:brightness-110 active:scale-98 disabled:opacity-60 disabled:active:scale-100"
                )}
              >
                {isCheckingOut ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {language === 'ka' ? 'მუშავდება...' : 'Processing...'}
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    {language === 'ka' ? 'შესყიდვის დადასტურება' : 'Confirm & Purchase'}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});
