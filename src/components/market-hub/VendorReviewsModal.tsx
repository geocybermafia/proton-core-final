import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X, Star, Trash2, Loader2, Info, Clock, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MarketTheme } from './MarketConstants';

export interface VendorReviewItem {
  id: string;
  sellerId: string;
  buyerId: string;
  buyerName: string;
  rating: number;
  text: string;
  orderId?: string;
  listingId?: string;
  createdAt?: { seconds?: number };
}

export interface SelectedVendorInfo {
  id: string;
  name: string;
}

export interface VendorReviewOrderOption {
  id: string;
  itemTitle: string;
  amount: number;
  currency: string;
  createdAt?: any;
}

export interface VendorReviewsModalProps {
  selectedVendor: SelectedVendorInfo | null;
  onClose: () => void;
  vendorModalRef?: React.Ref<HTMLDivElement>;
  language: string;
  currentTheme: MarketTheme;
  user: { uid: string } | null;
  sellerRatings: Record<string, { avg: number; count: number }>;
  selectedVendorRatingBreakdown: { counts: Record<number, number>; total: number };
  selectedVendorReviews: VendorReviewItem[];
  vendorBuyerOrderKeys: Set<string>;
  eligibleCompletedOrders?: VendorReviewOrderOption[];
  unreviewedCompletedOrders?: VendorReviewOrderOption[];
  hasPendingOrInTransitOrder?: boolean;
  selectedOrderId?: string;
  onSelectOrderId?: (orderId: string) => void;
  isCheckingEligibility?: boolean;
  eligibilityError?: string | null;
  onRetryEligibility?: () => void;
  onDeleteReview: (reviewId: string) => void;
  reviewRating: number;
  onChangeReviewRating: (rating: number) => void;
  reviewText: string;
  onChangeReviewText: (text: string) => void;
  onSubmitReview: (e: React.FormEvent) => void;
  isSubmittingReview: boolean;
}

export const VendorReviewsModal = React.memo(function VendorReviewsModal({
  selectedVendor,
  onClose,
  vendorModalRef,
  language,
  currentTheme,
  user,
  sellerRatings,
  selectedVendorRatingBreakdown,
  selectedVendorReviews,
  vendorBuyerOrderKeys,
  eligibleCompletedOrders = [],
  unreviewedCompletedOrders = [],
  hasPendingOrInTransitOrder = false,
  selectedOrderId,
  onSelectOrderId,
  isCheckingEligibility = false,
  eligibilityError = null,
  onRetryEligibility,
  onDeleteReview,
  reviewRating,
  onChangeReviewRating,
  reviewText,
  onChangeReviewText,
  onSubmitReview,
  isSubmittingReview
}: VendorReviewsModalProps) {
  return (
    <AnimatePresence>
      {selectedVendor && (
        <div 
          className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={language === 'ka' ? 'გამყიდველის შეფასებები' : 'Vendor Reviews'}
        >
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
          />
          
          <motion.div 
            ref={vendorModalRef}
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className={cn(
              "relative w-full max-w-2xl sm:rounded-[32px] border border-proton-border overflow-hidden z-10",
              currentTheme.card
            )}
          >
            <div className="p-6 sm:p-8 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-8 space-y-6 flex flex-col max-h-[90vh] overflow-y-auto scrollbar-none">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-proton-border pb-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-12 h-12 rounded-2xl bg-proton-bg border border-proton-border flex items-center justify-center font-black text-sm", currentTheme.accent)}>
                    {selectedVendor.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase text-proton-text tracking-tight flex items-center gap-2">
                      {selectedVendor.name}
                      <ShieldCheck size={16} className={currentTheme.accent} />
                    </h3>
                    <p className={cn("text-[10px] uppercase font-black tracking-widest opacity-70", currentTheme.muted)}>
                      {language === 'ka' ? 'ავტორიზებული გამყიდველი' : 'Authorized Vendor'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2.5 bg-proton-bg border border-proton-border rounded-xl hover:bg-proton-accent/10 transition-colors text-proton-text"
                  aria-label={language === 'ka' ? 'დახურვა' : 'Close'}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Score Breakdown Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-proton-bg/60 rounded-3xl p-6 border border-proton-border">
                <div className="flex flex-col items-center justify-center text-center p-2 md:border-r border-proton-border">
                  <span className="text-4xl font-black text-proton-text tracking-tighter">
                    {sellerRatings[selectedVendor.id] ? sellerRatings[selectedVendor.id].avg.toFixed(1) : '0.0'}
                  </span>
                  <div className="flex gap-0.5 my-1.5 justify-center">
                    {[1, 2, 3, 4, 5].map((starIdx) => {
                      const score = sellerRatings[selectedVendor.id]?.avg || 0;
                      return (
                        <Star 
                          key={starIdx} 
                          size={14} 
                          className={cn(
                            starIdx <= score 
                              ? "fill-amber-400 text-amber-500" 
                              : starIdx - 0.5 <= score 
                                ? "fill-amber-400/50 text-amber-500" 
                                : "text-proton-muted/40"
                          )} 
                        />
                      );
                    })}
                  </div>
                  <span className={cn("text-[9px] font-black uppercase tracking-wider opacity-75", currentTheme.muted)}>
                    {sellerRatings[selectedVendor.id]?.count || 0} {language === 'ka' ? 'შეფასება' : 'reviews'}
                  </span>
                </div>

                <div className="md:col-span-2 space-y-2 flex flex-col justify-center">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = selectedVendorRatingBreakdown.counts[stars] || 0;
                    const total = selectedVendorRatingBreakdown.total;
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div key={stars} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-wider text-proton-text">
                        <span className="w-16 text-right text-[9px] text-proton-muted">{stars} {language === 'ka' ? 'ვარსკვლ.' : 'stars'}</span>
                        <div className="flex-1 h-1.5 bg-proton-card rounded-full overflow-hidden border border-proton-border">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-8 text-proton-muted text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reviews Content Area */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-proton-accent">
                  {language === 'ka' ? 'მყიდველთა გამოხმაურება' : 'Buyer Feedback'}
                </h4>

                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 scrollbar-none">
                  {selectedVendorReviews.length === 0 ? (
                    <div className="text-center py-8 bg-proton-bg/60 rounded-2xl border border-proton-border text-xs text-proton-muted">
                      {language === 'ka' ? 'ჯერ არ არის შეფასებები ამ გამყიდველისთვის.' : 'No reviews left for this seller yet.'}
                    </div>
                  ) : (
                    selectedVendorReviews.map((rev) => {
                      const isOwnReview = user?.uid === rev.buyerId;
                      const hasOrder = Boolean(rev.orderId) || vendorBuyerOrderKeys.has(rev.buyerId);
                      
                      return (
                        <div key={rev.id} className="bg-proton-bg/60 border border-proton-border rounded-2xl p-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase text-proton-text tracking-wider">
                                  {rev.buyerName}
                                </span>
                                {hasOrder && (
                                  <span className="px-1.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 rounded text-[7px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-0.5">
                                    <ShieldCheck size={8} />
                                    {language === 'ka' ? 'ვერიფიცირებული მყიდველი' : 'Verified Buyer'}
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star 
                                    key={s} 
                                    size={10} 
                                    className={cn(s <= rev.rating ? "fill-amber-400 text-amber-500" : "text-proton-muted/35")} 
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={cn("text-[8px] font-mono opacity-60", currentTheme.muted)}>
                                {rev.createdAt?.seconds 
                                  ? new Date(rev.createdAt.seconds * 1000).toLocaleDateString()
                                  : 'Just now'}
                              </span>
                              {isOwnReview && (
                                <button 
                                  onClick={() => onDeleteReview(rev.id)}
                                  className="p-1.5 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-all"
                                  title={language === 'ka' ? 'შეფასების წაშლა' : 'Delete review'}
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-proton-text/85 leading-relaxed font-medium">
                            {rev.text}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Review Gating & Verification Section */}
              {user?.uid === selectedVendor.id ? (
                <div className="border-t border-proton-border pt-4 text-center text-[10px] text-proton-muted font-bold uppercase tracking-widest">
                  {language === 'ka' ? 'თქვენ არ შეგიძლიათ საკუთარი თავის შეფასება.' : 'You cannot submit a review for yourself.'}
                </div>
              ) : !user ? (
                <div className="border-t border-proton-border pt-4 text-center text-[10px] text-proton-muted font-bold uppercase tracking-widest">
                  {language === 'ka' ? 'შეფასების დასაწერად გთხოვთ გაიაროთ ავტორიზაცია.' : 'Please sign in to write a review.'}
                </div>
              ) : eligibleCompletedOrders.length === 0 ? (
                <div className="border-t border-proton-border pt-5">
                  {hasPendingOrInTransitOrder ? (
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-proton-text">
                      <Clock size={18} className="shrink-0 mt-0.5 text-amber-500" />
                      <div className="space-y-1">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-amber-500">
                          {language === 'ka' ? 'შეკვეთა მიმდინარეობს' : 'Order In Progress'}
                        </h5>
                        <p className="text-[11px] text-proton-muted leading-relaxed font-medium">
                          {language === 'ka' 
                            ? 'თქვენი შეკვეთა დამუშავების ან მიწოდების პროცესშია. გამყიდველის შეფასებას შეძლებთ შეკვეთის დასრულების (ჩაბარების) შემდეგ.' 
                            : 'Your order is currently being processed or shipped. You can review this seller once the order is completed.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-proton-bg/60 border border-proton-border text-proton-text">
                      <ShieldCheck size={18} className="shrink-0 mt-0.5 text-proton-accent" />
                      <div className="space-y-1">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-proton-text">
                          {language === 'ka' ? 'ვერიფიცირებული შეფასებები' : 'Verified Reviews Only'}
                        </h5>
                        <p className="text-[11px] text-proton-muted leading-relaxed font-medium">
                          {language === 'ka' 
                            ? 'შეფასების დაწერა შეუძლიათ მხოლოდ იმ მყიდველებს, რომელთაც აქვთ დასრულებული შეკვეთა ამ გამყიდველთან. ეს იცავს სისტემას ყალბი შეფასებებისგან.' 
                            : 'Only buyers who have completed a verified order with this vendor can leave a review. This protects our marketplace from unverified reviews.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : isCheckingEligibility ? (
                <div className="border-t border-proton-border pt-5 text-center p-6 rounded-2xl bg-proton-bg/60 border border-proton-border">
                  <Loader2 size={18} className="animate-spin text-proton-accent mx-auto mb-2" />
                  <p className="text-[11px] text-proton-muted font-medium">
                    {language === 'ka' ? 'მოწმდება შეფასების სტატუსი...' : 'Verifying review eligibility...'}
                  </p>
                </div>
              ) : eligibilityError ? (
                <div className="border-t border-proton-border pt-5">
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-proton-text space-y-2">
                    <div className="flex items-center gap-2">
                      <Info size={16} className="shrink-0 text-rose-500" />
                      <span className="text-xs font-bold uppercase tracking-wider text-rose-500">
                        {language === 'ka' ? 'შეცდომა სტატუსის შემოწმებისას' : 'Status Check Failed'}
                      </span>
                    </div>
                    <p className="text-[11px] text-proton-muted leading-relaxed font-medium">
                      {language === 'ka' 
                        ? 'შეფასების სტატუსის გადამოწმება ვერ მოხერხდა. გთხოვთ შეამოწმოთ ინტერნეტთან კავშირი და სცადოთ თავიდან.' 
                        : 'Could not verify review eligibility. Please check your network connection and try again.'}
                    </p>
                    {onRetryEligibility && (
                      <button
                        type="button"
                        onClick={onRetryEligibility}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-500 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        {language === 'ka' ? 'თავიდან ცდა' : 'Retry'}
                      </button>
                    )}
                  </div>
                </div>
              ) : unreviewedCompletedOrders.length === 0 ? (
                <div className="border-t border-proton-border pt-5">
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-proton-text">
                    <CheckCircle size={18} className="shrink-0 mt-0.5 text-emerald-500" />
                    <div className="space-y-1">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-500">
                        {language === 'ka' ? 'ყველა შეკვეთა შეფასებულია' : 'All Orders Reviewed'}
                      </h5>
                      <p className="text-[11px] text-proton-muted leading-relaxed font-medium">
                        {language === 'ka' 
                          ? 'თქვენ უკვე შეაფასეთ ყველა დასრულებული შეკვეთა ამ გამყიდველთან. მადლობა გამოხმაურებისთვის!' 
                          : 'You have already reviewed all completed orders for this vendor. Thank you for your feedback!'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={onSubmitReview} className="border-t border-proton-border pt-6 space-y-4">
                  {/* Order Selector (if multiple unreviewed completed orders) */}
                  {unreviewedCompletedOrders.length > 1 ? (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-proton-muted">
                        {language === 'ka' ? 'აირჩიეთ შეკვეთა შესაფასებლად:' : 'Select order to review:'}
                      </label>
                      <select
                        value={selectedOrderId || unreviewedCompletedOrders[0].id}
                        onChange={(e) => onSelectOrderId?.(e.target.value)}
                        className={cn(
                          "w-full px-4 py-2.5 rounded-xl border text-xs font-semibold focus:outline-none",
                          currentTheme.input
                        )}
                      >
                        {unreviewedCompletedOrders.map((ord) => (
                          <option key={ord.id} value={ord.id} className="bg-proton-card text-proton-text">
                            {ord.itemTitle} — {ord.currency} {ord.amount}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="px-3.5 py-2.5 rounded-xl bg-proton-bg/60 border border-proton-border flex items-center justify-between text-xs">
                      <span className="text-[10px] font-bold text-proton-text uppercase tracking-wider truncate mr-2">
                        {language === 'ka' ? 'შეკვეთა:' : 'Order:'} {unreviewedCompletedOrders[0].itemTitle}
                      </span>
                      <span className="text-[9px] font-mono text-emerald-500 font-bold flex items-center gap-1 shrink-0">
                        <ShieldCheck size={12} />
                        {language === 'ka' ? 'ვერიფიცირებული' : 'Verified'}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-widest text-proton-accent">
                      {language === 'ka' ? 'შეაფასეთ გამყიდველი' : 'Write a Review'}
                    </label>
                    <div className="flex items-center gap-1 bg-proton-bg p-1 rounded-xl border border-proton-border">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          type="button"
                          key={star}
                          onClick={() => onChangeReviewRating(star)}
                          className="p-2 rounded-lg transition-transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-1 focus:ring-proton-accent"
                          aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
                        >
                          <Star 
                            size={18} 
                            className={cn(
                              star <= reviewRating 
                                ? "fill-amber-400 text-amber-500" 
                                : "text-proton-muted/40 hover:text-amber-500/70"
                            )} 
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative">
                    <textarea
                      value={reviewText}
                      onChange={(e) => onChangeReviewText(e.target.value)}
                      placeholder={language === 'ka' ? 'გაგვიზიარეთ თქვენი გამოცდილება ამ გამყიდველთან...' : 'Tell others about your experience trading with this vendor...'}
                      rows={3}
                      maxLength={2000}
                      className={cn(
                        "w-full px-5 py-4 rounded-2xl border text-xs font-medium focus:outline-none",
                        currentTheme.input
                      )}
                      required
                    />
                    <div className="text-[9px] font-mono text-proton-muted text-right mt-1">
                      {reviewText.length}/2000
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingReview || !reviewText.trim()}
                    className={cn(
                      "w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer",
                      currentTheme.accentBg, "active:scale-95 disabled:opacity-50"
                    )}
                  >
                    {isSubmittingReview ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        {language === 'ka' ? 'იგზავნება...' : 'Submitting...'}
                      </>
                    ) : (
                      <>
                        <span>{language === 'ka' ? 'შეფასების გამოქვეყნება' : 'Submit Review'}</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});
