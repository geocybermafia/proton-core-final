import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Loader2, Package, Wrench, ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Order } from '../../types';
import { MarketTheme, isPhysicalOrder, isServiceOrder } from './MarketConstants';

export interface CancelOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  isCancelling: boolean;
  onClose: () => void;
  onConfirmCancel: () => void;
  isSeller: boolean;
  language: string;
  currentTheme: MarketTheme;
}

export const CancelOrderModal = React.memo(function CancelOrderModal({
  order,
  isOpen,
  isCancelling,
  onClose,
  onConfirmCancel,
  isSeller,
  language,
  currentTheme
}: CancelOrderModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key if not currently executing cancellation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isCancelling) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isCancelling, onClose]);

  if (!isOpen || !order) return null;

  const isPhysical = isPhysicalOrder(order) || (order.orderType === 'product' && Boolean(order.shippingDetails));
  const isService = isServiceOrder(order) || order.orderType === 'service' || order.orderType === 'project';

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-order-dialog-title"
        aria-describedby="cancel-order-dialog-desc"
      >
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!isCancelling) onClose();
          }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Dialog Card */}
        <motion.div 
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "relative w-full max-w-md rounded-[28px] sm:rounded-[32px] border border-proton-border bg-proton-card flex flex-col overflow-hidden z-10 shadow-2xl",
            currentTheme.card
          )}
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-proton-border flex items-start justify-between shrink-0 bg-proton-bg/60 backdrop-blur-md">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 
                  id="cancel-order-dialog-title" 
                  className={cn("text-lg sm:text-xl font-black uppercase tracking-tight leading-tight", currentTheme.text)}
                >
                  {language === 'ka' ? 'შეკვეთის გაუქმება?' : 'Cancel this order?'}
                </h3>
                <p 
                  id="cancel-order-dialog-desc" 
                  className="text-[11px] font-bold text-rose-500 tracking-wide mt-0.5"
                >
                  {language === 'ka' ? 'ეს მოქმედება შეუქცევადია.' : 'This action cannot be undone.'}
                </p>
              </div>
            </div>

            <button 
              type="button"
              onClick={onClose}
              disabled={isCancelling}
              className="p-2.5 bg-proton-card hover:bg-proton-bg border border-proton-border text-proton-muted hover:text-proton-text rounded-xl transition-colors disabled:opacity-40 cursor-pointer"
              aria-label={language === 'ka' ? 'დახურვა' : 'Close'}
            >
              <X size={16} />
            </button>
          </div>

          {/* Body with Order Details */}
          <div className="p-5 sm:p-6 space-y-4 text-left">
            <div className="p-4 rounded-2xl bg-proton-bg/70 border border-proton-border space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-[9px] font-black uppercase tracking-widest", currentTheme.muted)}>
                  {language === 'ka' ? 'შეკვეთილი ნივთი' : 'Order Item'}
                </span>
                <span className={cn("text-[9px] font-mono font-bold", currentTheme.muted)}>
                  #{order.id.substring(0, 10).toUpperCase()}
                </span>
              </div>

              <h4 className={cn("text-sm sm:text-base font-black uppercase tracking-tight leading-snug", currentTheme.text)}>
                {order.itemTitle}
              </h4>

              <div className="flex items-center justify-between pt-1 border-t border-proton-border text-xs">
                <span className={cn("font-mono font-bold", currentTheme.accent)}>
                  {order.amount} {order.currency}
                </span>

                <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold uppercase", currentTheme.muted)}>
                  {isPhysical ? (
                    <>
                      <Package size={12} className="text-cyan-500" />
                      {language === 'ka' ? 'ფიზიკური მიწოდება' : 'Physical Order'}
                    </>
                  ) : isService ? (
                    <>
                      <Wrench size={12} className="text-amber-500" />
                      {language === 'ka' ? 'სერვისი / ჯავშანი' : 'Service Booking'}
                    </>
                  ) : (
                    language === 'ka' ? 'პროდუქტი' : 'Product'
                  )}
                </span>
              </div>
            </div>

            {/* Explanatory Note */}
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5">
              <ShieldAlert size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <p className={cn("text-[11px] font-medium leading-relaxed", currentTheme.subtext)}>
                {isSeller
                  ? (language === 'ka'
                    ? (isPhysical 
                        ? 'შეკვეთა გადავა "გაუქმებულ" სტატუსში. ნივთი ავტომატურად აღდგება მარკეტში და ხელახლა გახდება ხელმისაწვდომი შესაძენად.'
                        : 'შეკვეთა გადავა "გაუქმებულ" სტატუსში. გაუქმებული შეკვეთები აღარ აისახება შემოსავლის ჯამში.')
                    : (isPhysical
                        ? 'The order status will transition to "Cancelled". The listing will be automatically restored to active and available in the marketplace.'
                        : 'The order status will transition to "Cancelled". Cancelled orders will not contribute to your Seller Revenue.'))
                  : (language === 'ka'
                    ? (isPhysical
                        ? 'შეკვეთა გაუქმდება დაუყოვნებლივ. ნივთი ავტომატურად დაბრუნდება მარკეტში ხელმისაწვდომ სტატუსში.'
                        : 'შეკვეთა გაუქმდება და შეჩერდება დამუშავება. გამყიდველს დაუყოვნებლივ ეცნობება გაუქმების შესახებ.')
                    : (isPhysical
                        ? 'The order will be cancelled immediately and the listing will be automatically restored to active in the marketplace.'
                        : 'The order will be cancelled immediately and processing will not proceed. The seller will see the updated status.'))}
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-5 sm:p-6 border-t border-proton-border bg-proton-bg/60 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isCancelling}
              className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-proton-text bg-proton-card hover:bg-proton-bg border border-proton-border transition-all disabled:opacity-50 cursor-pointer"
            >
              {language === 'ka' ? 'შეკვეთის შენარჩუნება' : 'Keep Order'}
            </button>

            <button
              type="button"
              onClick={onConfirmCancel}
              disabled={isCancelling}
              className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-500 border border-rose-500/40 shadow-lg shadow-rose-900/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              {isCancelling ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{language === 'ka' ? 'უქმდება...' : 'Cancelling...'}</span>
                </>
              ) : (
                <span>{language === 'ka' ? 'შეკვეთის გაუქმება' : 'Cancel Order'}</span>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});
