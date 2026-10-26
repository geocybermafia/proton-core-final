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
              "relative w-full max-w-2xl sm:rounded-[32px] border border-white/10 overflow-hidden z-10",
              currentTheme.card
            )}
          >
            <div className="p-6 sm:p-8 pb-24 sm:pb-8 space-y-6 flex flex-col max-h-[90vh] overflow-y-auto scrollbar-none">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-sm", currentTheme.accent)}>
                    {selectedVendor.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase text-white tracking-tight flex items-center gap-2">
                      {selectedVendor.name}
                      <ShieldCheck size={16} className={currentTheme.accent} />
                    </h3>
                    <p className={cn("text-[10px] uppercase font-black tracking-widest opacity-50", currentTheme.muted)}>
                      {language === 'ka' ? 'ავტორიზებული გამყიდველი' : 'Authorized Vendor'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition-colors text-white"
                  aria-label={language === 'ka' ? 'დახურვა' : 'Close'}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Score Breakdown Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white/5 rounded-3xl p-6 border border-white/5">
                <div className="flex flex-col items-center justify-center text-center p-2 md:border-r border-white/5">
                  <span className="text-4xl font-black text-white tracking-tighter">
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
                              ? "fill-amber-400 text-amber-400" 
                              : starIdx - 0.5 <= score 
                                ? "fill-amber-400/50 text-amber-400"
                                : "text-zinc-600"
                          )} 
                        />
                      );
                    })}
                  </div>
                  <span className={cn("text-[9px] font-black uppercase tracking-wider opacity-50", currentTheme.muted)}>
                    {sellerRatings[selectedVendor.id]?.count || 0} {language === 'ka' ? 'შეფასება' : 'reviews'}
                  </span>
                </div>

                <div className="md:col-span-2 space-y-2 flex flex-col justify-center">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = selectedVendorRatingBreakdown.counts[stars] || 0;
                    const total = selectedVendorRatingBreakdown.total;
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div key={stars} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-wider text-white">
                        <span className="w-16 text-right text-[9px] opacity-70">{stars} {language === 'ka' ? 'ვარსკვლ.' : 'stars'}</span>
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-8 opacity-40 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reviews Content Area */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-[#2e5bff]">
                  {language === 'ka' ? 'მყიდველთა გამოხმაურება' : 'Buyer Feedback'}
                </h4>

                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 scrollbar-none">
                  {selectedVendorReviews.length === 0 ? (
                    <div className="text-center py-8 bg-white/5 rounded-2xl border border-white/5 text-xs text-white/40">
                      {language === 'ka' ? 'ჯერ არ არის შეფასებები ამ გამყიდველისთვის.' : 'No reviews left for this seller yet.'}
                    </div>
                  ) : (
                    selectedVendorReviews.map((rev) => {
                      const isOwnReview = user?.uid === rev.buyerId;
                      const hasOrder = Boolean(rev.orderId) || vendorBuyerOrderKeys.has(rev.buyerId);
                      
                      return (
                        <div key={rev.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase text-white tracking-wider">
                                  {rev.buyerName}
                                </span>
                                {hasOrder && (
                                  <span className="px-1.5 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-[7px] font-black text-green-400 uppercase tracking-widest flex items-center gap-0.5">
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
                                    className={cn(s <= rev.rating ? "fill-amber-400 text-amber-400" : "text-zinc-700")} 
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={cn("text-[8px] font-mono opacity-30", currentTheme.muted)}>
                                {rev.createdAt?.seconds 
                                  ? new Date(rev.createdAt.seconds * 1000).toLocaleDateString()
                                  : 'Just now'}
                              </span>
                              {isOwnReview && (
                                <button 
                                  onClick={() => onDeleteReview(rev.id)}
                                  className="p-1.5 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-all"
                                  title={language === 'ka' ? 'შეფასების წაშლა' : 'Delete review'}
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-white/70 leading-relaxed font-medium">
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
                <div className="border-t border-white/5 pt-4 text-center text-[10px] text-white/35 font-bold uppercase tracking-widest">
                  {language === 'ka' ? 'თქვენ არ შეგიძლიათ საკუთარი თავის შეფასება.' : 'You cannot submit a review for yourself.'}
                </div>
              ) : !user ? (
                <div className="border-t border-white/5 pt-4 text-center text-[10px] text-white/40 font-bold uppercase tracking-widest">
                  {language === 'ka' ? 'შეფასების დასაწერად გთხოვთ გაიაროთ ავტორიზაცია.' : 'Please sign in to write a review.'}
                </div>
              ) : eligibleCompletedOrders.length === 0 ? (
                <div className="border-t border-white/5 pt-5">
                  {hasPendingOrInTransitOrder ? (
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
                      <Clock size={18} className="shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h5 className="text-xs font-bold uppercase tracking-wider">
                          {language === 'ka' ? 'შეკვეთა მიმდინარეობს' : 'Order In Progress'}
                        </h5>
                        <p className="text-[11px] opacity-90 leading-relaxed font-medium">
                          {language === 'ka' 
                            ? 'თქვენი შეკვეთა დამუშავების ან მიწოდების პროცესშია. გამყიდველის შეფასებას შეძლებთ შეკვეთის დასრულების (ჩაბარების) შემდეგ.' 
                            : 'Your order is currently being processed or shipped. You can review this seller once the order is completed.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/10 text-white/80">
                      <ShieldCheck size={18} className="shrink-0 mt-0.5 text-[#2e5bff]" />
                      <div className="space-y-1">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-white">
                          {language === 'ka' ? 'ვერიფიცირებული შეფასებები' : 'Verified Reviews Only'}
                        </h5>
                        <p className="text-[11px] opacity-80 leading-relaxed font-medium">
                          {language === 'ka' 
                            ? 'შეფასების დაწერა შეუძლიათ მხოლოდ იმ მყიდველებს, რომელთაც აქვთ დასრულებული შეკვეთა ამ გამყიდველთან. ეს იცავს სისტემას ყალბი შეფასებებისგან.' 
                            : 'Only buyers who have completed a verified order with this vendor can leave a review. This protects our marketplace from unverified reviews.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : isCheckingEligibility ? (
                <div className="border-t border-white/5 pt-5 text-center p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                  <Loader2 size={18} className="animate-spin text-[#2e5bff] mx-auto mb-2" />
                  <p className="text-[11px] text-white/60 font-medium">
                    {language === 'ka' ? 'მოწმდება შეფასების სტატუსი...' : 'Verifying review eligibility...'}
                  </p>
                </div>
              ) : eligibilityError ? (
                <div className="border-t border-white/5 pt-5">
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 space-y-2">
                    <div className="flex items-center gap-2">
                      <Info size={16} className="shrink-0 text-red-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-red-200">
                        {language === 'ka' ? 'შეცდომა სტატუსის შემოწმებისას' : 'Status Check Failed'}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-90 leading-relaxed font-medium">
                      {language === 'ka' 
                        ? 'შეფასების სტატუსის გადამოწმება ვერ მოხერხდა. გთხოვთ შეამოწმოთ ინტერნეტთან კავშირი და სცადოთ თავიდან.' 
                        : 'Could not verify review eligibility. Please check your network connection and try again.'}
                    </p>
                    {onRetryEligibility && (
                      <button
                        type="button"
                        onClick={onRetryEligibility}
                        className="px-3.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-white text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        {language === 'ka' ? 'თავიდან ცდა' : 'Retry'}
                      </button>
                    )}
                  </div>
                </div>
              ) : unreviewedCompletedOrders.length === 0 ? (
                <div className="border-t border-white/5 pt-5">
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-300">
                    <CheckCircle size={18} className="shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h5 className="text-xs font-bold uppercase tracking-wider">
                        {language === 'ka' ? 'ყველა შეკვეთა შეფასებულია' : 'All Orders Reviewed'}
                      </h5>
                      <p className="text-[11px] opacity-90 leading-relaxed font-medium">
                        {language === 'ka' 
                          ? 'თქვენ უკვე შეაფასეთ ყველა დასრულებული შეკვეთა ამ გამყიდველთან. მადლობა გამოხმაურებისთვის!' 
                          : 'You have already reviewed all completed orders for this vendor. Thank you for your feedback!'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={onSubmitReview} className="border-t border-white/5 pt-6 space-y-4">
                  {/* Order Selector (if multiple unreviewed completed orders) */}
                  {unreviewedCompletedOrders.length > 1 ? (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-white/70">
                        {language === 'ka' ? 'აირჩიეთ შეკვეთა შესაფასებლად:' : 'Select order to review:'}
                      </label>
                      <select
                        value={selectedOrderId || unreviewedCompletedOrders[0].id}
                        onChange={(e) => onSelectOrderId?.(e.target.value)}
                        className={cn(
                          "w-full px-4 py-2.5 rounded-xl border text-xs font-semibold text-white focus:outline-none",
                          currentTheme.input
                        )}
                      >
                        {unreviewedCompletedOrders.map((ord) => (
                          <option key={ord.id} value={ord.id} className="bg-zinc-900 text-white">
                            {ord.itemTitle} — {ord.currency} {ord.amount}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between text-xs">
                      <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider truncate mr-2">
                        {language === 'ka' ? 'შეკვეთა:' : 'Order:'} {unreviewedCompletedOrders[0].itemTitle}
                      </span>
                      <span className="text-[9px] font-mono text-green-400 font-bold flex items-center gap-1 shrink-0">
                        <ShieldCheck size={12} />
                        {language === 'ka' ? 'ვერიფიცირებული' : 'Verified'}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-widest text-[#2e5bff]">
                      {language === 'ka' ? 'შეაფასეთ გამყიდველი' : 'Write a Review'}
                    </label>
                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          type="button"
                          key={star}
                          onClick={() => onChangeReviewRating(star)}
                          className="p-2 rounded-lg transition-transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-1 focus:ring-[#dfb257]"
                          aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
                        >
                          <Star 
                            size={18} 
                            className={cn(
                              star <= reviewRating 
                                ? "fill-amber-400 text-amber-400" 
                                : "text-zinc-600 hover:text-amber-400/65"
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
                        "w-full px-5 py-4 rounded-2xl border text-xs font-medium text-white focus:outline-none placeholder-white/20 bg-white/5 focus:border-[#2e5bff]/40",
                        currentTheme.input
                      )}
                      required
                    />
                    <div className="text-[9px] font-mono text-white/30 text-right mt-1">
                      {reviewText.length}/2000
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingReview || !reviewText.trim()}
                    className={cn(
                      "w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer",
                      currentTheme.accentBg, "text-white hover:brightness-110 active:scale-95 disabled:opacity-50"
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
