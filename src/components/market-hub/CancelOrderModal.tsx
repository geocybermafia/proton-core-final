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
            "relative w-full max-w-md rounded-[28px] sm:rounded-[32px] border border-white/10 flex flex-col overflow-hidden z-10 shadow-2xl",
            currentTheme.card
          )}
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-white/10 flex items-start justify-between shrink-0 bg-zinc-950/60 backdrop-blur-md">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 
                  id="cancel-order-dialog-title" 
                  className="text-lg sm:text-xl font-black uppercase tracking-tight text-white leading-tight"
                >
                  {language === 'ka' ? 'შეკვეთის გაუქმება?' : 'Cancel this order?'}
                </h3>
                <p 
                  id="cancel-order-dialog-desc" 
                  className="text-[11px] font-bold text-red-400/90 tracking-wide mt-0.5"
                >
                  {language === 'ka' ? 'ეს მოქმედება შეუქცევადია.' : 'This action cannot be undone.'}
                </p>
              </div>
            </div>

            <button 
              type="button"
              onClick={onClose}
              disabled={isCancelling}
              className="p-2.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl transition-colors disabled:opacity-40"
              aria-label={language === 'ka' ? 'დახურვა' : 'Close'}
            >
              <X size={16} />
            </button>
          </div>

          {/* Body with Order Details */}
          <div className="p-5 sm:p-6 space-y-4 text-left">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
                  {language === 'ka' ? 'შეკვეთილი ნივთი' : 'Order Item'}
                </span>
                <span className="text-[9px] font-mono font-bold text-white/50">
                  #{order.id.substring(0, 10).toUpperCase()}
                </span>
              </div>

              <h4 className="text-sm sm:text-base font-black text-white uppercase tracking-tight leading-snug">
                {order.itemTitle}
              </h4>

              <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
                <span className="font-mono font-bold text-[#dfb257]">
                  {order.amount} {order.currency}
                </span>

                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-white/60 uppercase">
                  {isPhysical ? (
                    <>
                      <Package size={12} className="text-cyan-400" />
                      {language === 'ka' ? 'ფიზიკური მიწოდება' : 'Physical Order'}
                    </>
                  ) : isService ? (
                    <>
                      <Wrench size={12} className="text-amber-400" />
                      {language === 'ka' ? 'სერვისი / ჯავშანი' : 'Service Booking'}
                    </>
                  ) : (
                    language === 'ka' ? 'პროდუქტი' : 'Product'
                  )}
                </span>
              </div>
            </div>

            {/* Explanatory Note */}
            <div className="p-3.5 rounded-xl bg-red-500/[0.06] border border-red-500/15 flex items-start gap-2.5">
              <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-zinc-300 font-medium leading-relaxed">
                {isSeller
                  ? (language === 'ka'
                    ? 'შეკვეთა გადავა "გაუქმებულ" სტატუსში. გაუქმებული შეკვეთები აღარ აისახება შემოსავლის ჯამში.'
                    : 'The order status will transition to "Cancelled". Cancelled orders will not contribute to your Seller Revenue.')
                  : (language === 'ka'
                    ? 'შეკვეთა გაუქმდება და შეჩერდება დამუშავება. გამყიდველს დაუყოვნებლივ ეცნობება გაუქმების შესახებ.'
                    : 'The order will be cancelled immediately and processing will not proceed. The seller will see the updated status.')}
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-5 sm:p-6 border-t border-white/10 bg-zinc-950/40 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isCancelling}
              className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white/80 hover:text-white bg-white/10 hover:bg-white/15 transition-all disabled:opacity-50"
            >
              {language === 'ka' ? 'შეკვეთის შენარჩუნება' : 'Keep Order'}
            </button>

            <button
              type="button"
              onClick={onConfirmCancel}
              disabled={isCancelling}
              className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-red-200 hover:text-white bg-red-600/80 hover:bg-red-600 border border-red-500/40 shadow-lg shadow-red-900/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
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
