import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, ShoppingBag, ShieldCheck, MapPin, Loader2, Truck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Listing, ShippingDetails } from '../../types';
import { MarketTheme, isPhysicalListing, isServiceListing, isProjectListing } from './MarketConstants';
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
  shippingDetails: ShippingDetails;
  onChangeShippingDetails: (details: ShippingDetails) => void;
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
  shippingDetails,
  onChangeShippingDetails,
  isCheckingOut,
  onConfirmPurchase
}: CheckoutModalProps) {
  const isPhysical = checkoutItem ? isPhysicalListing(checkoutItem) : false;
  const isServiceOrProject = checkoutItem ? (isServiceListing(checkoutItem) || isProjectListing(checkoutItem)) : false;
  const isShippingComplete = !isPhysical || Boolean(
    shippingDetails && 
    shippingDetails.phone.trim().length >= 4 && 
    shippingDetails.city.trim().length >= 2 && 
    shippingDetails.address.trim().length >= 3
  );
  const canConfirm = !isCheckingOut && isShippingComplete;

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
                  {isServiceOrProject
                    ? (language === 'ka' ? 'პირდაპირი ჯავშანი' : 'Direct Service Booking')
                    : (language === 'ka' ? 'პირდაპირი შესყიდვა & მიწოდება' : 'Direct Item Purchase & Shipping')}
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
                    isServiceOrProject
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

              {/* Physical Product Shipping Form */}
              {isPhysical && (
                <div className="space-y-4 bg-white/5 rounded-3xl p-5 border border-white/5 text-left">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                      <Truck size={14} className="text-[#2e5bff]" />
                      <span>{language === 'ka' ? 'მიწოდების მონაცემები' : 'Delivery & Shipping Details'}</span>
                    </h4>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400/80">
                      {language === 'ka' ? '* აუცილებელი ველები' : '* Required fields'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label htmlFor="shipping-recipient" className="text-[9px] font-black uppercase tracking-wider text-white/60 block mb-1.5 ml-0.5">
                        {language === 'ka' ? 'მიმღების სახელი, გვარი' : 'Recipient Name'}
                      </label>
                      <input
                        id="shipping-recipient"
                        type="text"
                        value={shippingDetails.recipientName}
                        onChange={e => onChangeShippingDetails({ ...shippingDetails, recipientName: e.target.value })}
                        placeholder={language === 'ka' ? 'მიმღების სახელი და გვარი' : 'Full name / Contact Person'}
                        className={cn("w-full px-3.5 py-2.5 rounded-xl border text-xs text-white focus:outline-none placeholder:text-white/20 bg-black/40", currentTheme.input)}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="shipping-phone" className="text-[9px] font-black uppercase tracking-wider text-white/60 block mb-1.5 ml-0.5">
                          {language === 'ka' ? 'საკონტაქტო ტელეფონი *' : 'Contact Phone *'}
                        </label>
                        <input
                          id="shipping-phone"
                          type="tel"
                          value={shippingDetails.phone}
                          onChange={e => onChangeShippingDetails({ ...shippingDetails, phone: e.target.value })}
                          placeholder={language === 'ka' ? 'მაგ: 599 123 456' : 'e.g. +995 599 123 456'}
                          className={cn("w-full px-3.5 py-2.5 rounded-xl border text-xs text-white focus:outline-none placeholder:text-white/20 bg-black/40 font-mono", currentTheme.input)}
                        />
                      </div>

                      <div>
                        <label htmlFor="shipping-city" className="text-[9px] font-black uppercase tracking-wider text-white/60 block mb-1.5 ml-0.5">
                          {language === 'ka' ? 'ქალაქი / რეგიონი *' : 'City / Region *'}
                        </label>
                        <input
                          id="shipping-city"
                          type="text"
                          value={shippingDetails.city}
                          onChange={e => onChangeShippingDetails({ ...shippingDetails, city: e.target.value })}
                          placeholder={language === 'ka' ? 'მაგ: თბილისი' : 'e.g. Tbilisi, Batumi...'}
                          className={cn("w-full px-3.5 py-2.5 rounded-xl border text-xs text-white focus:outline-none placeholder:text-white/20 bg-black/40", currentTheme.input)}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="shipping-address" className="text-[9px] font-black uppercase tracking-wider text-white/60 block mb-1.5 ml-0.5">
                        {language === 'ka' ? 'ზუსტი მისამართი (ქუჩა, ბინა) *' : 'Street Address & Apartment / Suite *'}
                      </label>
                      <input
                        id="shipping-address"
                        type="text"
                        value={shippingDetails.address}
                        onChange={e => onChangeShippingDetails({ ...shippingDetails, address: e.target.value })}
                        placeholder={language === 'ka' ? 'მაგ: ჭავჭავაძის გამზ. 25, სადარბაზო 1, ბინა 14' : 'e.g. 25 Chavchavadze Ave, Entrance 1, Apt 14'}
                        className={cn("w-full px-3.5 py-2.5 rounded-xl border text-xs text-white focus:outline-none placeholder:text-white/20 bg-black/40", currentTheme.input)}
                      />
                    </div>

                    <div>
                      <label htmlFor="shipping-notes" className="text-[9px] font-black uppercase tracking-wider text-white/60 block mb-1.5 ml-0.5">
                        {language === 'ka' ? 'კურიერის შენიშვნა (სურვილისამებრ)' : 'Courier Notes (Optional)'}
                      </label>
                      <textarea
                        id="shipping-notes"
                        maxLength={300}
                        value={shippingDetails.notes || ''}
                        onChange={e => onChangeShippingDetails({ ...shippingDetails, notes: e.target.value })}
                        placeholder={language === 'ka' ? 'მაგ: სადარბაზოს კოდი, სასურველი საათი...' : 'e.g. Entry code, preferred drop-off time...'}
                        className={cn("w-full h-16 p-3 rounded-xl border text-xs font-normal text-white focus:outline-none placeholder:text-white/20 bg-black/40 resize-none", currentTheme.input)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Conditional Service Booking Panel */}
              {isServiceOrProject && (
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

              {isPhysical && !isShippingComplete && (
                <p className="text-[10px] font-bold text-amber-400/90 text-center bg-amber-500/10 py-1.5 px-3 rounded-xl border border-amber-500/20">
                  {language === 'ka' 
                    ? '⚠️ გთხოვთ შეავსოთ ტელეფონი, ქალაქი და მისამართი' 
                    : '⚠️ Please provide contact phone, city, and delivery address'}
                </p>
              )}

              <p className={cn("text-[9px] font-bold text-center leading-relaxed opacity-60", currentTheme.muted)}>
                {language === 'ka' 
                  ? 'ღილაკზე დაჭერით თქვენ ეთანხმებით მომსახურების პირობებს და კონფიდენციალურობის პოლიტიკას.'
                  : 'By confirming, you agree to the marketplace terms and conditions.'}
              </p>
              
              <button 
                onClick={onConfirmPurchase}
                disabled={!canConfirm}
                className={cn(
                  "w-full min-h-[48px] py-4 sm:py-4.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-2.5 relative overflow-hidden group cursor-pointer",
                  currentTheme.accentBg, "text-white hover:brightness-110 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
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
