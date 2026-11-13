import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, X, Trash2, ShoppingBag, Loader2, ShieldCheck, Truck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Listing, ShippingDetails } from '../../types';
import {
  MarketTheme,
  isPhysicalListing,
  isServiceListing,
  isProjectListing,
  getListingTitle,
  formatOriginalCurrencyPrice,
  formatApproxCurrencyEquivalent
} from './MarketConstants';

export interface CartItemThumbnailProps {
  src?: string;
  alt: string;
}

export const CartItemThumbnail = React.memo(function CartItemThumbnail({ src, alt }: CartItemThumbnailProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-proton-bg">
      {!isLoaded && !hasError && src && (
        <div className="absolute inset-0 z-0 animate-pulse bg-proton-border/40" />
      )}
      {src && !hasError ? (
        <img 
          src={src} 
          alt={alt} 
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            setHasError(true);
            setIsLoaded(true);
          }}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-proton-muted/50">
          <ShoppingBag size={20} />
        </div>
      )}
    </div>
  );
});

export interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  drawerRef?: React.Ref<HTMLDivElement>;
  language: string;
  currentTheme: MarketTheme;
  cart: Listing[];
  cartTotal: number;
  displayCurrency: string;
  priceMap: Map<string, number>;
  convertPrice: (price: number, from: string, to: string) => number;
  isPlacingCartOrders: boolean;
  cartServiceInstructions: Record<string, string>;
  onUpdateServiceInstruction: (itemId: string, instruction: string) => void;
  shippingDetails?: ShippingDetails;
  onChangeShippingDetails?: (details: ShippingDetails) => void;
  onRemoveFromCart: (itemId: string) => void;
  onCheckout: () => void;
}

export const CartDrawer = React.memo(function CartDrawer({
  isOpen,
  onClose,
  drawerRef,
  language,
  currentTheme,
  cart,
  cartTotal,
  displayCurrency,
  priceMap,
  convertPrice,
  isPlacingCartOrders,
  cartServiceInstructions,
  onUpdateServiceInstruction,
  shippingDetails,
  onChangeShippingDetails,
  onRemoveFromCart,
  onCheckout
}: CartDrawerProps) {
  const hasPhysicalItems = cart.some(item => isPhysicalListing(item));
  const isCartShippingValid = !hasPhysicalItems || Boolean(
    shippingDetails &&
    shippingDetails.phone.trim().length >= 4 &&
    shippingDetails.city.trim().length >= 2 &&
    shippingDetails.address.trim().length >= 3
  );
  const canCheckout = !isPlacingCartOrders && isCartShippingValid;
  const targetCurrency = (displayCurrency || 'USD').trim().toUpperCase();

  const currencyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of cart) {
      const code = (item.currency || 'USD').trim().toUpperCase();
      const amount = typeof item.price === 'number' && Number.isFinite(item.price) ? item.price : 0;
      totals.set(code, (totals.get(code) || 0) + amount);
    }
    return Array.from(totals.entries());
  }, [cart]);

  const hasCurrencyMismatch = useMemo(
    () => cart.some(item => (item.currency || 'USD').trim().toUpperCase() !== targetCurrency),
    [cart, targetCurrency]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[140] flex items-stretch sm:items-center justify-end p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={language === 'ka' ? 'კალათა' : 'Shopping Cart'}
        >
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isPlacingCartOrders && onClose()}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          
          <motion.div 
            ref={drawerRef}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              "relative w-full max-w-md h-full sm:h-[calc(100vh-32px)] sm:rounded-[40px] border border-proton-border flex flex-col overflow-hidden shadow-2xl z-10",
              currentTheme.card
            )}
          >
            <div className="p-6 border-b border-proton-border flex items-center justify-between shrink-0 bg-proton-card/95 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-proton-accent/15 rounded-xl text-proton-accent">
                  <ShoppingCart size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-proton-text">
                    {language === 'ka' ? 'კალათა' : 'Shopping Cart'}
                  </h3>
                  <p className={cn("text-[9px] font-bold uppercase tracking-widest leading-none mt-1", currentTheme.muted)}>
                    {cart.length === 1 
                      ? (language === 'ka' ? '1 ნივთი' : '1 item') 
                      : (language === 'ka' ? `${cart.length} ნივთი` : `${cart.length} items`)}
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                disabled={isPlacingCartOrders}
                className="p-3 bg-proton-bg border border-proton-border rounded-2xl hover:bg-proton-accent/10 transition-colors disabled:opacity-50 text-proton-text"
              >
                <X size={16} />
              </button>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
                  <div className="p-5 bg-proton-bg rounded-[30px] border border-proton-border text-proton-muted">
                    <ShoppingCart size={32} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-wider text-proton-text">
                      {language === 'ka' ? 'კალათა ცარიელია' : 'Cart is Empty'}
                    </h4>
                    <p className={cn("text-[10px] font-medium leading-relaxed max-w-xs mt-1.5", currentTheme.muted)}>
                      {language === 'ka' 
                        ? 'დაამატეთ საინტერესო პროდუქტები ან სერვისები მარკეტიდან.' 
                        : 'Explore the marketplace to add professional products or services.'}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {cart.map((item) => {
                    const isService = isServiceListing(item) || isProjectListing(item);
                    return (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        key={item.id}
                        className="p-4 rounded-3xl bg-proton-bg/60 border border-proton-border space-y-3"
                      >
                        <div className="flex items-center gap-4 relative">
                          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-proton-bg shrink-0 border border-proton-border relative">
                            {item.image ? (
                              <CartItemThumbnail src={item.image} alt={getListingTitle(item, language)} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-proton-muted/50">
                                <ShoppingBag size={20} />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0 pr-8">
                            <span className={cn(
                              "inline-block px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest mb-1",
                              isService 
                                ? "bg-amber-500/15 border border-amber-500/30 text-amber-500"
                                : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-500"
                            )}>
                              {isService
                                ? (language === 'ka' ? '⚡ სერვისი' : '⚡ Service')
                                : (language === 'ka' ? 'ნივთი' : 'Product')}
                            </span>
                            <h4 className="text-xs font-black text-proton-text uppercase truncate tracking-tight">
                              {getListingTitle(item, language)}
                            </h4>
                            {(() => {
                              const origCur = (item.currency || 'USD').trim().toUpperCase();
                              const isSameCur = origCur === targetCurrency;
                              const convertedAmt = priceMap.get(item.id) ?? convertPrice(item.price, origCur, targetCurrency);
                              return (
                                <div className="mt-0.5 space-y-0.5">
                                  <p className="text-xs font-black text-proton-accent font-mono tabular-nums">
                                    {formatOriginalCurrencyPrice(item.price, origCur)}
                                  </p>
                                  {!isSameCur && (
                                    <p className="text-[11px] font-medium text-proton-muted font-mono tabular-nums">
                                      {language === 'ka' ? 'სავარაუდო:' : 'Est.:'} {formatApproxCurrencyEquivalent(convertedAmt, targetCurrency)}
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          <button 
                            type="button"
                            onClick={() => onRemoveFromCart(item.id)}
                            className="absolute right-0 top-1/2 -translate-y-1/2 p-2.5 rounded-xl text-rose-500 hover:bg-rose-500/15 transition-colors"
                            title={language === 'ka' ? 'წაშლა' : 'Remove'}
                            aria-label={language === 'ka' ? 'კალათიდან წაშლა' : 'Remove from cart'}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        {/* Service Task Instructions Field */}
                        {isService && (
                          <div className="pt-2 border-t border-proton-border space-y-1.5">
                            <div className="flex items-center justify-between text-[9px] font-bold">
                              <label htmlFor={`cart-instructions-${item.id}`} className="text-amber-500 flex items-center gap-1 uppercase tracking-wider">
                                <span>⚡</span>
                                <span>{language === 'ka' ? 'მოთხოვნები შემსრულებლისთვის' : 'Service Instructions'}</span>
                              </label>
                              <span className={cn(
                                "font-mono text-[9px]",
                                (cartServiceInstructions[item.id] || '').length >= 480 ? "text-amber-500 font-bold" : "text-proton-muted"
                              )}>
                                {(cartServiceInstructions[item.id] || '').length}/500
                              </span>
                            </div>
                            <textarea
                              id={`cart-instructions-${item.id}`}
                              value={cartServiceInstructions[item.id] || ''}
                              onChange={(e) => onUpdateServiceInstruction(item.id, e.target.value)}
                              maxLength={500}
                              placeholder={language === 'ka' 
                                ? "ჩაწერეთ სამუშაოს სპეციფიკაცია, ბმულები ან ინსტრუქცია..." 
                                : "Enter requirements, project brief, links or specifics..."}
                              className={cn(
                                "w-full h-18 p-2.5 rounded-xl border text-base md:text-xs font-normal focus:outline-none transition-all resize-none",
                                currentTheme.input
                              )}
                            />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}

                  {/* Physical Items Shipping Form in Cart */}
                  {hasPhysicalItems && shippingDetails && onChangeShippingDetails && (
                    <div className="p-4 rounded-3xl bg-proton-bg/60 border border-proton-border space-y-3 mt-4 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-proton-text flex items-center gap-1.5">
                          <Truck size={13} className="text-proton-accent" />
                          <span>{language === 'ka' ? 'მიწოდების მისამართი' : 'Shipping Destination'}</span>
                        </span>
                        <span className="text-[8px] font-bold text-amber-500 uppercase tracking-widest">
                          {language === 'ka' ? '* აუცილებელია' : '* Required for delivery'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <input
                          type="text"
                          value={shippingDetails.recipientName}
                          onChange={e => onChangeShippingDetails({ ...shippingDetails, recipientName: e.target.value })}
                          placeholder={language === 'ka' ? 'მიმღების სახელი, გვარი' : 'Recipient Name'}
                          className={cn("w-full px-3 py-2 rounded-xl border text-base md:text-xs focus:outline-none", currentTheme.input)}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="tel"
                            value={shippingDetails.phone}
                            onChange={e => onChangeShippingDetails({ ...shippingDetails, phone: e.target.value })}
                            placeholder={language === 'ka' ? 'ტელეფონი *' : 'Phone *'}
                            className={cn("w-full px-3 py-2 rounded-xl border text-base md:text-xs focus:outline-none font-mono", currentTheme.input)}
                          />
                          <input
                            type="text"
                            value={shippingDetails.city}
                            onChange={e => onChangeShippingDetails({ ...shippingDetails, city: e.target.value })}
                            placeholder={language === 'ka' ? 'ქალაქი *' : 'City *'}
                            className={cn("w-full px-3 py-2 rounded-xl border text-base md:text-xs focus:outline-none", currentTheme.input)}
                          />
                        </div>
                        <input
                          type="text"
                          value={shippingDetails.address}
                          onChange={e => onChangeShippingDetails({ ...shippingDetails, address: e.target.value })}
                          placeholder={language === 'ka' ? 'ზუსტი მისამართი (ქუჩა, ბინა) *' : 'Full Address (Street, Apt / Suite) *'}
                          className={cn("w-full px-3 py-2 rounded-xl border text-base md:text-xs focus:outline-none", currentTheme.input)}
                        />
                        <textarea
                          value={shippingDetails.notes || ''}
                          maxLength={200}
                          onChange={e => onChangeShippingDetails({ ...shippingDetails, notes: e.target.value })}
                          placeholder={language === 'ka' ? 'კურიერის შენიშვნა (სურვილისამებრ)' : 'Delivery notes (optional)'}
                          className={cn("w-full h-14 px-3 py-1.5 rounded-xl border text-base md:text-xs focus:outline-none resize-none", currentTheme.input)}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Action buttons at bottom */}
            {cart.length > 0 && (
              <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-6 border-t border-proton-border space-y-4 shrink-0 bg-proton-card/95 backdrop-blur-xl shadow-2xl">
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <span className={cn("text-[10px] font-black uppercase tracking-wider shrink-0 pt-1", currentTheme.muted)}>
                      {currencyTotals.length > 1
                        ? (language === 'ka' ? 'ჯამი ვალუტების მიხედვით' : 'Totals by Currency')
                        : (language === 'ka' ? 'ჯამური ღირებულება' : 'Total Price')}
                    </span>
                    <div className="flex flex-col items-end gap-0.5">
                      {currencyTotals.map(([curCode, curAmount]) => (
                        <span
                          key={curCode}
                          className="text-base sm:text-lg font-black text-proton-accent font-mono tabular-nums whitespace-nowrap"
                        >
                          {formatOriginalCurrencyPrice(curAmount, curCode)}
                        </span>
                      ))}
                    </div>
                  </div>
                  {hasCurrencyMismatch && (
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-proton-border text-xs">
                      <span className="text-proton-muted">
                        {language === 'ka' ? 'სავარაუდო ეკვივალენტი (საორიენტაციო)' : 'Indicative est. equivalent'}
                      </span>
                      <span className="font-bold text-proton-text font-mono tabular-nums whitespace-nowrap">
                        {formatApproxCurrencyEquivalent(cartTotal, targetCurrency)}
                      </span>
                    </div>
                  )}
                </div>

                {hasPhysicalItems && !isCartShippingValid && (
                  <p className="text-[10px] font-bold text-amber-500 text-center bg-amber-500/10 py-1.5 px-3 rounded-xl border border-amber-500/25">
                    {language === 'ka' 
                      ? '⚠️ შეავსეთ მიწოდების ტელეფონი, ქალაქი და მისამართი' 
                      : '⚠️ Provide phone number, city, and delivery address'}
                  </p>
                )}

                <div className="p-3 rounded-xl bg-proton-accent/10 border border-proton-accent/25 text-left">
                  <p className="text-[10px] text-proton-text/85 leading-relaxed font-normal">
                    {language === 'ka' 
                      ? 'ℹ️ Proton არ ამუშავებს ონლაინ გადახდებს. თითოეულ გამყიდველთან ანგარიშსწორება და მიწოდება ხდება პირდაპირ.' 
                      : 'ℹ️ Proton does not process payments. Settlement and delivery are arranged directly with each seller.'}
                  </p>
                </div>

                <button 
                  onClick={onCheckout}
                  disabled={!canCheckout}
                  className={cn(
                    "w-full min-h-[48px] py-3.5 px-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
                    currentTheme.accentBg
                  )}
                >
                  {isPlacingCartOrders ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>{language === 'ka' ? 'იგზავნება მოთხოვნები...' : 'Sending Requests...'}</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      <span>{language === 'ka' ? 'შეკვეთის მოთხოვნის გაგზავნა' : 'Send Order Requests'}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});
