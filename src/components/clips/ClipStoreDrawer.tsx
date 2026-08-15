import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Tag, 
  X, 
  Check, 
  ShoppingBag, 
  Sparkles, 
  CheckCircle2, 
  Zap, 
  CreditCard, 
  Coins,
  Minus,
  Plus
} from 'lucide-react';
import { Clip, MarketplaceItem, Order } from '../../types';
import { cn } from '../../lib/utils';

export interface ClipStoreDrawerProps {
  // Tagging State
  taggingClip: Clip | null;
  taggingProductId: string;
  isSavingTag: boolean;
  sellerListings: MarketplaceItem[];
  allListings: MarketplaceItem[];
  listings: MarketplaceItem[];
  isLoadingListings?: boolean;
  getClipVideoUrl: (clip: Clip) => string;
  onCloseTagging: () => void;
  onSelectTagProductId: (id: string) => void;
  onSaveTagProduct: () => void;

  // Checkout State
  checkoutClip: Clip | null;
  checkoutQuantity: number;
  checkoutDeliveryNotes: string;
  checkoutPaymentMethod: 'proton_pay' | 'card' | 'crypto';
  isCheckingOut: boolean;
  checkoutSuccessOrder: Order | null;
  language: 'en' | 'ka';
  onCloseCheckout: () => void;
  onChangeQuantity: (updater: (prev: number) => number) => void;
  onChangeDeliveryNotes: (notes: string) => void;
  onChangePaymentMethod: (method: 'proton_pay' | 'card' | 'crypto') => void;
  onSubmitCheckout: () => void;
  onContinueWatchingAfterCheckout: () => void;
}

export function ClipStoreDrawer({
  taggingClip,
  taggingProductId,
  isSavingTag,
  sellerListings,
  allListings,
  listings,
  isLoadingListings = false,
  getClipVideoUrl,
  onCloseTagging,
  onSelectTagProductId,
  onSaveTagProduct,
  checkoutClip,
  checkoutQuantity,
  checkoutDeliveryNotes,
  checkoutPaymentMethod,
  isCheckingOut,
  checkoutSuccessOrder,
  language,
  onCloseCheckout,
  onChangeQuantity,
  onChangeDeliveryNotes,
  onChangePaymentMethod,
  onSubmitCheckout,
  onContinueWatchingAfterCheckout,
}: ClipStoreDrawerProps) {
  return (
    <>
      {/* MERCHANT PRODUCT TAGGING MODAL */}
      <AnimatePresence>
        {taggingClip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-zinc-900 border border-purple-500/30 rounded-2xl shadow-2xl p-5 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Tag className="text-pink-400" size={18} />
                  <h3 className="font-extrabold text-white text-sm">
                    {language === 'ka' ? 'პროდუქტის მიბმა კლიპზე' : 'Tag Product to Video Clip'}
                  </h3>
                </div>
                <button
                  onClick={onCloseTagging}
                  className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Clip preview banner */}
              <div className="my-3 p-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
                <div className="w-12 h-16 rounded-lg bg-black border border-white/10 overflow-hidden flex-shrink-0 relative">
                  {taggingClip.thumbnailUrl ? (
                    <img referrerPolicy="no-referrer" src={taggingClip.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <video src={getClipVideoUrl(taggingClip)} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white line-clamp-1">
                    {taggingClip.caption || 'Clip'}
                  </p>
                  <p className="text-[10px] text-proton-muted">
                    @{taggingClip.creatorName}
                  </p>
                </div>
              </div>

              {/* Products list selection */}
              <div className="flex-1 overflow-y-auto space-y-3 my-2 pr-1 custom-scrollbar">
                <label className="block text-[11px] font-extrabold uppercase tracking-widest text-proton-muted">
                  {language === 'ka' ? 'აირჩიეთ პროდუქტი (თქვენი მარკეტიდან)' : 'Select Active Product'}
                </label>

                <button
                  type="button"
                  onClick={() => onSelectTagProductId('')}
                  className={cn(
                    "w-full p-3 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between",
                    taggingProductId === ''
                      ? "bg-purple-600/20 border-purple-500 text-purple-300"
                      : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                  )}
                >
                  <span>{language === 'ka' ? '🚫 პროდუქტის ტეგის მოხსნა (არაფერი)' : '🚫 No Product Tag (Remove Tag)'}</span>
                  {taggingProductId === '' && <Check size={14} className="text-purple-400" />}
                </button>

                {/* Seller listings section */}
                {sellerListings.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block">
                      {language === 'ka' ? 'თქვენი პროდუქტები' : 'Your Merchant Listings'}
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {sellerListings.map((item) => {
                        const isSelected = taggingProductId === item.id;
                        return (
                          <div
                            key={item.id}
                            onClick={() => onSelectTagProductId(item.id)}
                            className={cn(
                              "p-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer",
                              isSelected
                                ? "bg-pink-600/20 border-pink-500 ring-1 ring-pink-500/50"
                                : "bg-proton-bg/60 border-proton-border/20 hover:border-pink-500/40"
                            )}
                          >
                            <div className="w-10 h-10 rounded-lg bg-black border border-white/10 overflow-hidden flex-shrink-0">
                              {item.images?.[0] || item.image ? (
                                <img referrerPolicy="no-referrer" src={item.images?.[0] || item.image} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <ShoppingBag className="m-auto text-pink-400 mt-2.5" size={16} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                              <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-mono font-bold">
                                <span>${item.price}</span>
                                <span className="text-proton-muted font-sans">• {item.category || 'Product'}</span>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="p-1 rounded-full bg-pink-500 text-white">
                                <Check size={12} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* All Marketplace Listings fallback */}
                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-bold text-proton-muted uppercase tracking-widest block">
                    {language === 'ka' ? 'მარკეტფლეისის ყველა პროდუქტი' : 'All Marketplace Products'}
                  </span>
                  
                  {isLoadingListings ? (
                    <div className="space-y-2 py-1">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 flex items-center gap-3 animate-pulse">
                          <div className="w-8 h-8 rounded-lg bg-white/10 shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 bg-white/10 rounded-md w-3/4" />
                            <div className="h-2.5 bg-white/10 rounded-md w-1/4" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (allListings.length > 0 ? allListings : listings).length === 0 ? (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center text-proton-muted text-xs font-medium">
                      {language === 'ka' ? 'პროდუქტები ვერ მოიძებნა' : 'No marketplace products available'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto custom-scrollbar">
                      {(allListings.length > 0 ? allListings : listings).map((item) => {
                        const isSelected = taggingProductId === item.id;
                        return (
                          <div
                            key={item.id}
                            onClick={() => onSelectTagProductId(item.id)}
                            className={cn(
                              "p-2.5 rounded-xl border transition-all flex items-center gap-3 cursor-pointer",
                              isSelected
                                ? "bg-purple-600/20 border-purple-500"
                                : "bg-white/5 border-white/10 hover:bg-white/10"
                            )}
                          >
                            <div className="w-8 h-8 rounded-lg bg-black overflow-hidden flex-shrink-0">
                              {item.images?.[0] || item.image ? (
                                <img referrerPolicy="no-referrer" src={item.images?.[0] || item.image} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <ShoppingBag className="m-auto text-purple-400 mt-2" size={14} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                              <span className="text-[10px] text-emerald-400 font-mono font-bold">${item.price}</span>
                            </div>
                            {isSelected && <Check size={12} className="text-purple-400" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal actions */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onCloseTagging}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white"
                >
                  {language === 'ka' ? 'გაუქმება' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={isSavingTag}
                  onClick={onSaveTagProduct}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-xs font-black text-white hover:opacity-90 transition-all flex items-center gap-1.5 shadow-lg shadow-pink-500/20"
                >
                  {isSavingTag ? (
                    <span>{language === 'ka' ? 'ინახება...' : 'Saving...'}</span>
                  ) : (
                    <>
                      <Tag size={13} />
                      <span>{language === 'ka' ? 'ტეგის შენახვა' : 'Save Product Tag'}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SHOPPABLE INSTANT CHECKOUT MODAL OVER VIDEO */}
      <AnimatePresence>
        {checkoutClip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-zinc-900 border border-pink-500/40 rounded-3xl shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Background ambient glow */}
              <div className="absolute -top-20 -right-20 w-48 h-48 bg-pink-600/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

              {/* Modal Close Button */}
              <button
                onClick={onCloseCheckout}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all z-10"
              >
                <X size={18} />
              </button>

              {checkoutSuccessOrder ? (
                /* SUCCESS STATE VIEW */
                <div className="py-8 text-center space-y-4 my-auto">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
                    <CheckCircle2 size={36} className="animate-bounce" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-white">
                      {language === 'ka' ? 'შეკვეთა მიღებულია!' : 'Order Placed Successfully!'}
                    </h3>
                    <p className="text-xs text-proton-muted max-w-xs mx-auto">
                      {language === 'ka' 
                        ? 'გმადლობთ კლიპიდან შეძენისთვის. გამყიდველი მიიღებს შეტყობინებას.' 
                        : 'Thank you for buying directly from this clip loop! Merchant has been notified.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-2 font-mono text-xs text-gray-300">
                    <div className="flex justify-between">
                      <span className="text-proton-muted">Order ID:</span>
                      <span className="text-purple-400 font-bold">{checkoutSuccessOrder.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-proton-muted">Item:</span>
                      <span className="text-white truncate max-w-[180px]">{checkoutSuccessOrder.itemTitle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-proton-muted">Total Paid:</span>
                      <span className="text-emerald-400 font-bold">${checkoutSuccessOrder.amount} USD</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-proton-muted">Source:</span>
                      <span className="text-pink-400 font-bold">Shoppable Clip #{checkoutClip.id.slice(0, 6)}</span>
                    </div>
                  </div>

                  <button
                    onClick={onContinueWatchingAfterCheckout}
                    className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    {language === 'ka' ? 'ვიდეოების ყურების გაგრძელება' : 'Continue Watching Clips'}
                  </button>
                </div>
              ) : (
                /* CHECKOUT FORM VIEW */
                <div className="space-y-4 overflow-y-auto custom-scrollbar pr-1 my-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-pink-500/20 border border-pink-500/40 text-[10px] font-black text-pink-300 uppercase tracking-widest flex items-center gap-1">
                      <Sparkles size={11} className="text-pink-400 animate-pulse" />
                      {language === 'ka' ? 'სწრაფი შეძენა' : 'Shoppable Clip Checkout'}
                    </span>
                  </div>

                  {/* Tagged Product Header Card */}
                  {checkoutClip.productInfo && (
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl bg-black border border-white/10 overflow-hidden flex-shrink-0">
                        {checkoutClip.productInfo.image ? (
                          <img referrerPolicy="no-referrer" src={checkoutClip.productInfo.image} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <ShoppingBag size={24} className="m-auto text-pink-400 mt-3" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <h4 className="text-xs font-black text-white truncate">
                          {checkoutClip.productInfo.title}
                        </h4>
                        <p className="text-[10px] text-proton-muted">
                          {language === 'ka' ? 'გამყიდველი:' : 'Seller:'} @{checkoutClip.creatorName}
                        </p>
                        <p className="text-sm font-mono font-bold text-emerald-400">
                          ${checkoutClip.productInfo.price} USD
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Quantity Selector */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-gray-200 block">
                        {language === 'ka' ? 'რაოდენობა:' : 'Quantity:'}
                      </span>
                      <span className="text-[10px] text-proton-muted font-mono block">
                        {language === 'ka' ? 'მაქსიმუმ 10 ერთეული' : 'Max 10 per order'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 bg-black/70 p-1 rounded-xl border border-white/10 shadow-inner">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                        onClick={() => onChangeQuantity(q => Math.max(1, q - 1))}
                        disabled={checkoutQuantity <= 1 || isCheckingOut}
                        aria-label="Decrease quantity"
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/15 active:bg-white/20 text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      >
                        <Minus size={14} />
                      </motion.button>
                      <span className="text-xs font-mono font-black text-white w-7 text-center select-none">
                        {checkoutQuantity}
                      </span>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                        onClick={() => onChangeQuantity(q => Math.min(10, q + 1))}
                        disabled={checkoutQuantity >= 10 || isCheckingOut}
                        aria-label="Increase quantity"
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/15 active:bg-white/20 text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      >
                        <Plus size={14} />
                      </motion.button>
                    </div>
                  </div>

                  {/* Delivery / Order notes */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-proton-muted">
                      {language === 'ka' ? 'მიწოდების მისამართი ან შენიშვნა:' : 'Delivery Address / Special Notes:'}
                    </label>
                    <textarea
                      rows={2}
                      value={checkoutDeliveryNotes}
                      onChange={(e) => onChangeDeliveryNotes(e.target.value)}
                      placeholder={language === 'ka' ? 'მაგ: თბილისი, რუსთაველის #12, ბინა 4' : 'e.g. Tbilisi, Rustaveli Ave #12, Apt 4'}
                      className="w-full bg-white/5 border border-white/10 focus:border-pink-500/50 outline-none rounded-xl p-3 text-xs text-white placeholder:text-gray-500 transition-all resize-none font-sans"
                    />
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-proton-muted">
                      {language === 'ka' ? 'გადახდის მეთოდი:' : 'Payment Method:'}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => onChangePaymentMethod('proton_pay')}
                        className={cn(
                          "p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all",
                          checkoutPaymentMethod === 'proton_pay'
                            ? "bg-purple-600/30 border-purple-500 text-purple-300 ring-1 ring-purple-500/40"
                            : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                        )}
                      >
                        <Zap size={14} className="text-purple-400" />
                        <span className="text-[10px] font-extrabold">Proton Pay</span>
                        <span className="text-[8px] text-emerald-400 font-mono">-5% Fee</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onChangePaymentMethod('card')}
                        className={cn(
                          "p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all",
                          checkoutPaymentMethod === 'card'
                            ? "bg-purple-600/30 border-purple-500 text-purple-300 ring-1 ring-purple-500/40"
                            : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                        )}
                      >
                        <CreditCard size={14} className="text-pink-400" />
                        <span className="text-[10px] font-extrabold">Card / Apple</span>
                        <span className="text-[8px] text-proton-muted font-mono">Instant</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onChangePaymentMethod('crypto')}
                        className={cn(
                          "p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all",
                          checkoutPaymentMethod === 'crypto'
                            ? "bg-purple-600/30 border-purple-500 text-purple-300 ring-1 ring-purple-500/40"
                            : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                        )}
                      >
                        <Coins size={14} className="text-amber-400" />
                        <span className="text-[10px] font-extrabold">USDT / TON</span>
                        <span className="text-[8px] text-amber-400/80 font-mono">Web3</span>
                      </button>
                    </div>
                  </div>

                  {/* Pricing Summary */}
                  {checkoutClip.productInfo && (
                    <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between text-proton-muted">
                        <span>Subtotal ({checkoutQuantity}x):</span>
                        <span>${(checkoutClip.productInfo.price * checkoutQuantity).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-proton-muted">
                        <span>Proton Escrow Fee:</span>
                        <span className="text-emerald-400">$0.00 (Free)</span>
                      </div>
                      <div className="h-[1px] bg-white/10 my-1" />
                      <div className="flex justify-between text-white font-bold text-sm">
                        <span>Total:</span>
                        <span className="text-emerald-400">
                          ${(checkoutClip.productInfo.price * checkoutQuantity).toFixed(2)} USD
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Checkout Submit Button */}
                  <button
                    type="button"
                    disabled={isCheckingOut}
                    onClick={onSubmitCheckout}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:opacity-95 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-pink-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isCheckingOut ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>{language === 'ka' ? 'მუშავდება...' : 'Processing Secure Escrow...'}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        <span>{language === 'ka' ? 'მყისიერი შეკვეთა' : 'Complete Instant Purchase'}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
