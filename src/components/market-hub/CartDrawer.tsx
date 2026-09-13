import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, X, Trash2, ShoppingBag, Loader2, ShieldCheck, Truck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Listing, ShippingDetails } from '../../types';
import { MarketTheme, isPhysicalListing, isServiceListing, isProjectListing } from './MarketConstants';

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
    <div className="w-full h-full relative overflow-hidden bg-black/40">
      {!isLoaded && !hasError && src && (
        <div className="absolute inset-0 z-0 animate-pulse bg-zinc-800/60" />
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
        <div className="w-full h-full flex items-center justify-center text-white/20">
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
              "relative w-full max-w-md h-full sm:h-[calc(100vh-32px)] sm:rounded-[40px] border border-white/5 flex flex-col overflow-hidden shadow-2xl z-10",
              currentTheme.card
            )}
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500">
                  <ShoppingCart size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-white">
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
                className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors disabled:opacity-50 text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
                  <div className="p-5 bg-white/5 rounded-[30px] border border-white/5 text-white/20">
                    <ShoppingCart size={32} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-wider text-white">
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
                        className="p-4 rounded-3xl bg-white/5 border border-white/5 space-y-3"
                      >
                        <div className="flex items-center gap-4 relative">
                          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-black/40 shrink-0 border border-white/5 relative">
                            {item.image ? (
                              <CartItemThumbnail src={item.image} alt={item.title} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/20">
                                <ShoppingBag size={20} />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0 pr-8">
                            <span className={cn(
                              "inline-block px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest mb-1",
                              isService 
                                ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                                : "bg-emerald-500/10 border border-emerald-500/20 text-[#10b981]"
                            )}>
                              {isService
                                ? (language === 'ka' ? '⚡ სერვისი' : '⚡ Service')
                                : (language === 'ka' ? 'ნივთი' : 'Product')}
                            </span>
                            <h4 className="text-xs font-black text-white uppercase truncate tracking-tight">
                              {language === 'ka' ? (item.titleGe || item.title) : item.title}
                            </h4>
                            <p className="text-[11px] font-black text-[#10b981] font-mono mt-0.5">
                              {(priceMap.get(item.id) ?? convertPrice(item.price, item.currency || 'USD', displayCurrency)).toLocaleString(undefined, { maximumFractionDigits: 0 })} {displayCurrency}
                            </p>
                          </div>

                          <button 
                            type="button"
                            onClick={() => onRemoveFromCart(item.id)}
                            className="absolute right-0 top-1/2 -translate-y-1/2 p-2.5 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                            title={language === 'ka' ? 'წაშლა' : 'Remove'}
                            aria-label={language === 'ka' ? 'კალათიდან წაშლა' : 'Remove from cart'}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        {/* Service Task Instructions Field */}
                        {isService && (
                          <div className="pt-2 border-t border-white/5 space-y-1.5">
                            <div className="flex items-center justify-between text-[9px] font-bold">
                              <label htmlFor={`cart-instructions-${item.id}`} className="text-amber-400/90 flex items-center gap-1 uppercase tracking-wider">
                                <span>⚡</span>
                                <span>{language === 'ka' ? 'მოთხოვნები შემსრულებლისთვის' : 'Service Instructions'}</span>
                              </label>
                              <span className={cn(
                                "font-mono text-[9px]",
                                (cartServiceInstructions[item.id] || '').length >= 480 ? "text-amber-400 font-bold" : "text-white/40"
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
                                "w-full h-18 p-2.5 rounded-xl border text-xs font-normal text-white focus:outline-none transition-all placeholder:text-white/25 bg-black/40 resize-none",
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
                    <div className="p-4 rounded-3xl bg-white/5 border border-white/5 space-y-3 mt-4 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                          <Truck size={13} className="text-[#2e5bff]" />
                          <span>{language === 'ka' ? 'მიწოდების მისამართი' : 'Shipping Destination'}</span>
                        </span>
                        <span className="text-[8px] font-bold text-amber-400/80 uppercase tracking-widest">
                          {language === 'ka' ? '* აუცილებელია' : '* Required for delivery'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <input
                          type="text"
                          value={shippingDetails.recipientName}
                          onChange={e => onChangeShippingDetails({ ...shippingDetails, recipientName: e.target.value })}
                          placeholder={language === 'ka' ? 'მიმღების სახელი, გვარი' : 'Recipient Name'}
                          className={cn("w-full px-3 py-2 rounded-xl border text-xs text-white focus:outline-none placeholder:text-white/20 bg-black/40", currentTheme.input)}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="tel"
                            value={shippingDetails.phone}
                            onChange={e => onChangeShippingDetails({ ...shippingDetails, phone: e.target.value })}
                            placeholder={language === 'ka' ? 'ტელეფონი *' : 'Phone *'}
                            className={cn("w-full px-3 py-2 rounded-xl border text-xs text-white focus:outline-none placeholder:text-white/20 bg-black/40 font-mono", currentTheme.input)}
                          />
                          <input
                            type="text"
                            value={shippingDetails.city}
                            onChange={e => onChangeShippingDetails({ ...shippingDetails, city: e.target.value })}
                            placeholder={language === 'ka' ? 'ქალაქი *' : 'City *'}
                            className={cn("w-full px-3 py-2 rounded-xl border text-xs text-white focus:outline-none placeholder:text-white/20 bg-black/40", currentTheme.input)}
                          />
                        </div>
                        <input
                          type="text"
                          value={shippingDetails.address}
                          onChange={e => onChangeShippingDetails({ ...shippingDetails, address: e.target.value })}
                          placeholder={language === 'ka' ? 'ზუსტი მისამართი (ქუჩა, ბინა) *' : 'Full Address (Street, Apt / Suite) *'}
                          className={cn("w-full px-3 py-2 rounded-xl border text-xs text-white focus:outline-none placeholder:text-white/20 bg-black/40", currentTheme.input)}
                        />
                        <textarea
                          value={shippingDetails.notes || ''}
                          maxLength={200}
                          onChange={e => onChangeShippingDetails({ ...shippingDetails, notes: e.target.value })}
                          placeholder={language === 'ka' ? 'კურიერის შენიშვნა (სურვილისამებრ)' : 'Delivery notes (optional)'}
                          className={cn("w-full h-14 px-3 py-1.5 rounded-xl border text-xs text-white focus:outline-none placeholder:text-white/20 bg-black/40 resize-none", currentTheme.input)}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Action buttons at bottom */}
            {cart.length > 0 && (
              <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-6 border-t border-white/10 space-y-4 shrink-0 bg-zinc-950/95 backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.6)]">
                <div className="flex items-center justify-between">
                  <span className={cn("text-[9px] font-black uppercase tracking-widest", currentTheme.muted)}>
                    {language === 'ka' ? 'ჯამური ღირებულება' : 'Total Price'}
                  </span>
                  <span className="text-xl font-black text-[#10b981] font-mono drop-shadow-[0_0_8px_rgba(16,185,129,0.3)] whitespace-nowrap">
                    {cartTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    <span className="text-[10px] font-black opacity-50 ml-1">{displayCurrency}</span>
                  </span>
                </div>

                {hasPhysicalItems && !isCartShippingValid && (
                  <p className="text-[10px] font-bold text-amber-400 text-center bg-amber-500/10 py-1.5 px-3 rounded-xl border border-amber-500/20">
                    {language === 'ka' 
                      ? '⚠️ შეავსეთ მიწოდების ტელეფონი, ქალაქი და მისამართი' 
                      : '⚠️ Provide phone number, city, and delivery address'}
                  </p>
                )}

                <button 
                  onClick={onCheckout}
                  disabled={!canCheckout}
                  className={cn(
                    "w-full min-h-[48px] py-3.5 px-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg drop-shadow-[0_0_12px_rgba(16,185,129,0.2)] text-black bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  )}
                >
                  {isPlacingCartOrders ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>{language === 'ka' ? 'მუშავდება...' : 'Processing...'}</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      <span>{language === 'ka' ? 'შეკვეთის გაფორმება' : 'Proceed to Checkout'}</span>
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
