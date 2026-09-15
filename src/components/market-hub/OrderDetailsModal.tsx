import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Copy, 
  Check, 
  Package, 
  Truck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  MapPin, 
  Phone, 
  User as UserIcon, 
  FileText, 
  Store, 
  Calendar, 
  Wrench, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  Tag,
  MessageSquare
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Order, Listing } from '../../types';
import { 
  MarketTheme, 
  safeParseDate, 
  isPhysicalOrder, 
  isServiceOrder, 
  canCancelOrder 
} from './MarketConstants';
import { useToast } from '../Toast';

export interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  listings?: Listing[];
  language: string;
  currentTheme: MarketTheme;
  isSeller?: boolean;
  onConfirmDelivery?: (order: Order) => Promise<void>;
  onCancelOrder?: (order: Order) => void;
  onUpdateOrderStatus?: (orderId: string, newStatus: string, tracking?: any) => Promise<void>;
  onOpenShipmentModal?: (order: Order) => void;
  onMessageSeller?: (order: Order) => void;
  onMessageBuyer?: (order: Order) => void;
}

interface TimelineStep {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'current' | 'upcoming' | 'cancelled';
  timestamp?: string | null;
  icon: React.ReactNode;
  metadata?: React.ReactNode;
}

export const OrderDetailsModal = React.memo(function OrderDetailsModal({
  order,
  isOpen,
  onClose,
  listings = [],
  language,
  currentTheme,
  isSeller = false,
  onConfirmDelivery,
  onCancelOrder,
  onUpdateOrderStatus,
  onOpenShipmentModal,
  onMessageSeller,
  onMessageBuyer
}: OrderDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isConfirmingDelivery, setIsConfirmingDelivery] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showShippingDetails, setShowShippingDetails] = useState(true);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isConfirmingDelivery && !isUpdatingStatus) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isConfirmingDelivery, isUpdatingStatus, onClose]);

  // Copy helper with feedback
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    showToast(
      language === 'ka' ? `${label} დაკოპირდა!` : `${label} copied to clipboard!`,
      'info'
    );
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen || !order) return null;

  const isPhysical = isPhysicalOrder(order);
  const isService = isServiceOrder(order);
  const isCancelled = order.status === 'cancelled';
  const canCancel = canCancelOrder(order);
  const isDeliveryConfirmable = isPhysical && order.status === 'shipped' && !isSeller;

  // Resolve matching listing and seller information
  const matchingListing = listings.find(l => l.id === order.listingId);
  const sellerDisplayName = matchingListing?.sellerName || (order as any).sellerName || null;

  // Format real timestamp without hallucination
  const formatDateTime = (dateVal: any) => {
    if (!dateVal) return null;
    const ms = safeParseDate(dateVal);
    if (!ms) return null;
    const d = new Date(ms);
    return d.toLocaleDateString(language === 'ka' ? 'ka-GE' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const orderCreatedTimestamp = formatDateTime(order.createdAt);
  const shippedTimestamp = order.trackingInfo?.shippedAt ? formatDateTime(order.trackingInfo.shippedAt) : null;

  // Build Chronological Fulfillment Timeline based ONLY on actual order state/data
  const timelineSteps: TimelineStep[] = [];

  if (isPhysical) {
    // 1. Order Placed (Always completed if order exists)
    timelineSteps.push({
      id: 'placed',
      title: language === 'ka' ? 'შეკვეთა გაფორმდა' : 'Order Placed',
      description: language === 'ka' 
        ? 'შეკვეთა დადასტურდა და გადაეცა გამყიდველს დასამუშავებლად.' 
        : 'Order placed and confirmed with seller.',
      status: 'completed',
      timestamp: orderCreatedTimestamp,
      icon: <Package size={16} />
    });

    if (isCancelled) {
      // Terminal state: Cancellation
      timelineSteps.push({
        id: 'cancelled',
        title: language === 'ka' ? 'შეკვეთა გაუქმდა' : 'Order Cancelled',
        description: language === 'ka'
          ? 'შეკვეთა გაუქმდა საწყის ეტაპზე. გადაზიდვის პროცესი შეწყვეტილია.'
          : 'Order was cancelled at the initial stage. Fulfillment is closed.',
        status: 'cancelled',
        timestamp: null, // Do not fabricate timestamp if not in document
        icon: <XCircle size={16} />
      });
    } else {
      // 2. Processing Stage
      const isProcessingCompleted = ['shipped', 'completed'].includes(order.status);
      const isProcessingCurrent = order.status === 'processing';
      timelineSteps.push({
        id: 'processing',
        title: language === 'ka' ? 'მომზადება / დამუშავება' : 'Processing',
        description: isProcessingCurrent
          ? (language === 'ka' ? 'გამყიდველი ამჟამად ამზადებს ამანათს გასაგზავნად.' : 'Seller is preparing your order for shipment.')
          : isProcessingCompleted
            ? (language === 'ka' ? 'ამანათი მომზადდა და შეიფუთა.' : 'Order prepared and packaged.')
            : (language === 'ka' ? 'გამყიდველის მიერ შეკვეთის მომზადების მოლოდინი.' : 'Awaiting seller to begin packaging.'),
        status: isProcessingCurrent ? 'current' : isProcessingCompleted ? 'completed' : 'upcoming',
        timestamp: null, // Order model doesn't store transition timestamp for processing; do not fabricate
        icon: <Clock size={16} />
      });

      // 3. Shipped Stage
      const isShippedCompleted = order.status === 'completed';
      const isShippedCurrent = order.status === 'shipped';
      const hasTrackingData = Boolean(order.trackingInfo?.trackingNumber || order.trackingInfo?.carrier);

      timelineSteps.push({
        id: 'shipped',
        title: language === 'ka' ? 'გაგზავნილია' : 'Shipped',
        description: isShippedCurrent
          ? (language === 'ka' ? 'ამანათი გადაცემულია გადამზიდ კომპანიას და გზაშია.' : 'Parcel dispatched and in transit with carrier.')
          : isShippedCompleted
            ? (language === 'ka' ? 'ამანათი წარმატებით გაიგზავნა და ჩაბარდა.' : 'Parcel was dispatched and delivered.')
            : (language === 'ka' ? 'გადაეცემა გადამზიდს მომზადების დასრულების შემდეგ.' : 'Will be dispatched once packaging is complete.'),
        status: isShippedCurrent ? 'current' : isShippedCompleted ? 'completed' : 'upcoming',
        timestamp: shippedTimestamp, // Actual timestamp from trackingInfo.shippedAt if present
        icon: <Truck size={16} />,
        metadata: hasTrackingData && (isShippedCurrent || isShippedCompleted) ? (
          <div className="mt-2 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-white/60 font-medium">
                {order.trackingInfo?.carrier || (language === 'ka' ? 'გადამზიდი' : 'Carrier')}:
              </span>
              {order.trackingInfo?.trackingNumber && (
                <div className="flex items-center gap-1.5 font-mono text-white">
                  <span className="font-bold">{order.trackingInfo.trackingNumber}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(order.trackingInfo!.trackingNumber!, language === 'ka' ? 'თრექინგ კოდი' : 'Tracking Number')}
                    className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                    title="Copy tracking code"
                  >
                    {copiedId === (language === 'ka' ? 'თრექინგ კოდი' : 'Tracking Number') ? (
                      <Check size={12} className="text-green-400" />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null
      });

      // 4. Delivery Confirmed Stage
      const isDeliveredCompleted = order.status === 'completed';
      timelineSteps.push({
        id: 'delivered',
        title: language === 'ka' ? 'მიღება დადასტურებულია' : 'Delivery Confirmed',
        description: isDeliveredCompleted
          ? (language === 'ka' ? 'მყიდველმა დაადასტურა ამანათის ჩაბარება. შეკვეთა დასრულებულია.' : 'Buyer confirmed package receipt. Order successfully completed.')
          : (language === 'ka' ? 'მყიდველი ადასტურებს მიღებას ამანათის ჩაბარების შემდეგ.' : 'Pending final receipt confirmation by the buyer.'),
        status: isDeliveredCompleted ? 'completed' : 'upcoming',
        timestamp: null, // No completedAt stored in current schema; do not fabricate
        icon: <CheckCircle2 size={16} />
      });
    }
  } else {
    // Service / Project Timeline
    // 1. Booking Created
    timelineSteps.push({
      id: 'booked',
      title: language === 'ka' ? 'ჯავშანი გაფორმდა' : 'Booking Created',
      description: language === 'ka'
        ? 'სერვისის ჯავშანი რეგისტრირებულია და გადაცემულია შემსრულებელს.'
        : 'Service booking created and scheduled with provider.',
      status: 'completed',
      timestamp: orderCreatedTimestamp,
      icon: <FileText size={16} />
    });

    if (isCancelled) {
      timelineSteps.push({
        id: 'cancelled',
        title: language === 'ka' ? 'ჯავშანი გაუქმდა' : 'Booking Cancelled',
        description: language === 'ka'
          ? 'ჯავშანი გაუქმდა. სამუშაო პროცესი შეჩერებულია.'
          : 'Service booking was cancelled. Engagement is closed.',
        status: 'cancelled',
        timestamp: null,
        icon: <XCircle size={16} />
      });
    } else {
      // 2. In Progress Stage
      const isInProgressCompleted = order.status === 'completed';
      const isInProgressCurrent = order.status === 'in_progress';

      timelineSteps.push({
        id: 'in_progress',
        title: language === 'ka' ? 'სამუშაო პროცესი' : 'In Progress',
        description: isInProgressCurrent
          ? (language === 'ka' ? 'შემსრულებელი აქტიურად მუშაობს თქვენს შეკვეთაზე.' : 'Provider is actively working on your request.')
          : isInProgressCompleted
            ? (language === 'ka' ? 'სამუშაო წარმატებით შესრულდა.' : 'Service work completed by provider.')
            : (language === 'ka' ? 'შემსრულებლის მიერ მუშაობის დაწყების მოლოდინი.' : 'Awaiting provider to initiate work.'),
        status: isInProgressCurrent ? 'current' : isInProgressCompleted ? 'completed' : 'upcoming',
        timestamp: null,
        icon: <Wrench size={16} />
      });

      // 3. Completed Stage
      const isServiceCompleted = order.status === 'completed';
      timelineSteps.push({
        id: 'completed',
        title: language === 'ka' ? 'დასრულებული' : 'Completed',
        description: isServiceCompleted
          ? (language === 'ka' ? 'სერვისი სრულად დასრულებულია.' : 'Service delivery completed successfully.')
          : (language === 'ka' ? 'დასრულების მოლოდინი.' : 'Pending project completion.'),
        status: isServiceCompleted ? 'completed' : 'upcoming',
        timestamp: null,
        icon: <CheckCircle2 size={16} />
      });
    }
  }

  // Action handlers
  const handleConfirmDeliveryClick = async () => {
    if (!onConfirmDelivery) return;
    setIsConfirmingDelivery(true);
    try {
      await onConfirmDelivery(order);
      showToast(
        language === 'ka' ? "ჩაბარება წარმატებით დადასტურდა!" : "Delivery confirmed successfully!",
        'success'
      );
      onClose();
    } catch (err) {
      console.error("Error confirming delivery in modal:", err);
    } finally {
      setIsConfirmingDelivery(false);
    }
  };

  const handleSellerStatusChange = async (newStatus: string) => {
    if (!onUpdateOrderStatus) return;
    setIsUpdatingStatus(true);
    try {
      await onUpdateOrderStatus(order.id, newStatus);
      onClose();
    } catch (err) {
      console.error("Error updating status in modal:", err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Status badge helper
  const getStatusBadge = () => {
    const s = order.status;
    if (s === 'completed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 size={12} />
          {language === 'ka' ? 'დასრულებული' : 'Completed'}
        </span>
      );
    }
    if (s === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30">
          <XCircle size={12} />
          {language === 'ka' ? 'გაუქმებული' : 'Cancelled'}
        </span>
      );
    }
    if (s === 'shipped') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/35 shadow-sm shadow-indigo-900/30">
          <Truck size={12} className="animate-bounce" />
          {language === 'ka' ? 'გაგზავნილია' : 'Shipped'}
        </span>
      );
    }
    if (s === 'processing') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
          <Package size={12} />
          {language === 'ka' ? 'დამუშავებაში' : 'Processing'}
        </span>
      );
    }
    if (s === 'in_progress') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-300 border border-blue-500/30">
          <Wrench size={12} className="animate-pulse" />
          {language === 'ka' ? 'მიმდინარე' : 'In Progress'}
        </span>
      );
    }
    if (s === 'booked') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <Clock size={12} />
          {language === 'ka' ? 'დაჯავშნილია' : 'Booked'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
        <Clock size={12} className="animate-pulse" />
        {language === 'ka' ? 'დამუშავების მოლოდინში' : 'Pending'}
      </span>
    );
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-details-title"
      >
        {/* Dark Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!isConfirmingDelivery && !isUpdatingStatus) onClose();
          }}
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Modal Window Container */}
        <motion.div 
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "relative w-full max-w-3xl my-auto rounded-[24px] sm:rounded-[32px] border border-white/10 flex flex-col max-h-[92vh] overflow-hidden z-10 shadow-2xl bg-zinc-950/95",
            currentTheme.card
          )}
        >
          {/* Header Bar */}
          <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-zinc-950/80 backdrop-blur-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/80 shrink-0">
                {isPhysical ? (
                  <Truck size={20} className="text-cyan-400" />
                ) : isService ? (
                  <Wrench size={20} className="text-amber-400" />
                ) : (
                  <Package size={20} className="text-[#dfb257]" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 
                    id="order-details-title"
                    className="text-base sm:text-lg font-black uppercase tracking-tight text-white truncate"
                  >
                    {language === 'ka' ? 'შეკვეთის დეტალები' : 'Order Details'}
                  </h2>
                  <span className="hidden sm:inline-block font-mono text-[10px] text-white/40">
                    #{order.id.substring(0, 10)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-white/50 flex items-center gap-1">
                    <Calendar size={11} className="text-white/40" />
                    {orderCreatedTimestamp || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={onClose}
                disabled={isConfirmingDelivery || isUpdatingStatus}
                className="p-2 sm:p-2.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                aria-label={language === 'ka' ? 'დახურვა' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-left scrollbar-thin scrollbar-thumb-white/10">
            
            {/* 1. Primary Order Summary Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge()}

                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/5 border border-white/10 text-white/60">
                      {isPhysical 
                        ? (language === 'ka' ? 'ფიზიკური პროდუქტი' : 'Physical Product')
                        : isService 
                          ? (language === 'ka' ? 'სერვისი / მომსახურება' : 'Service')
                          : (language === 'ka' ? 'პროდუქტი' : 'Product')}
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-black text-white leading-snug">
                    {order.itemTitle}
                  </h3>
                </div>

                <div className="text-right sm:self-center">
                  <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-[#dfb257]">
                    {order.amount} {order.currency}
                  </div>
                  {order.quantity && order.quantity > 0 && (
                    <div className="text-[10px] font-mono text-white/50 font-bold">
                      {language === 'ka' ? 'რაოდენობა:' : 'Quantity:'} {order.quantity}
                    </div>
                  )}
                </div>
              </div>

              {/* Order Metadata Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t border-white/5 text-[11px]">
                {/* Order ID with Copy */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
                      {language === 'ka' ? 'შეკვეთის ID' : 'Order ID'}
                    </span>
                    <span className="font-mono text-white/80 font-bold truncate">
                      {order.id}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(order.id, language === 'ka' ? 'შეკვეთის ID' : 'Order ID')}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors shrink-0"
                    title="Copy Order ID"
                  >
                    {copiedId === (language === 'ka' ? 'შეკვეთის ID' : 'Order ID') ? (
                      <Check size={13} className="text-emerald-400" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </div>

                {/* Seller Info */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
                      {language === 'ka' ? 'გამყიდველი' : 'Merchant / Seller'}
                    </span>
                    <span className="text-white/80 font-bold truncate flex items-center gap-1.5">
                      <Store size={12} className="text-white/40 shrink-0" />
                      {sellerDisplayName || (language === 'ka' ? 'ავტორიზებული გამყიდველი' : 'Marketplace Seller')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isSeller && onMessageSeller && (
                      <button
                        type="button"
                        id={`card-seller-message-btn-${order.id}`}
                        onClick={() => onMessageSeller(order)}
                        className="px-2.5 py-1 rounded-lg bg-[#dfb257]/15 hover:bg-[#dfb257]/25 text-[#dfb257] border border-[#dfb257]/30 text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                        title={language === 'ka' ? 'მიწერეთ გამყიდველს' : 'Message Seller'}
                      >
                        <MessageSquare size={11} />
                        <span>{language === 'ka' ? 'მიწერა' : 'Message'}</span>
                      </button>
                    )}
                    <span className="font-mono text-[9px] text-white/30">
                      #{order.sellerId.substring(0, 6)}
                    </span>
                  </div>
                </div>

                {/* Order Date */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5 sm:col-span-2 md:col-span-1">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
                      {language === 'ka' ? 'გაფორმების თარიღი' : 'Order Date'}
                    </span>
                    <span className="font-mono text-white/80 font-medium">
                      {orderCreatedTimestamp || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Visual Chronological Fulfillment Timeline */}
            <div className="p-4 sm:p-6 rounded-2xl bg-zinc-950/60 border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#dfb257]" />
                  <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                    {language === 'ka' ? 'შესრულების ქრონოლოგიური ხაზი' : 'Fulfillment Timeline'}
                  </h4>
                </div>
                <span className="text-[9px] font-mono text-white/40">
                  {isCancelled 
                    ? (language === 'ka' ? 'შეწყვეტილია' : 'Terminated') 
                    : (order.status === 'completed' ? (language === 'ka' ? 'დასრულებული' : 'Completed') : (language === 'ka' ? 'აქტიური' : 'In Progress'))}
                </span>
              </div>

              {/* Stepper Flow */}
              <div className="relative pl-3 sm:pl-4 pt-2 space-y-6">
                {timelineSteps.map((step, idx) => {
                  const isLast = idx === timelineSteps.length - 1;
                  const isCompleted = step.status === 'completed';
                  const isCurrent = step.status === 'current';
                  const isTerminalCancelled = step.status === 'cancelled';
                  const isUpcoming = step.status === 'upcoming';

                  return (
                    <div key={step.id} className="relative flex items-start gap-4">
                      {/* Vertical connector line */}
                      {!isLast && (
                        <div 
                          className={cn(
                            "absolute left-4 top-8 -bottom-6 w-0.5 -translate-x-1/2 transition-colors",
                            isCompleted ? "bg-emerald-500/40" : "bg-white/10"
                          )} 
                        />
                      )}

                      {/* Node Circle Icon */}
                      <div 
                        className={cn(
                          "relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-all",
                          isCompleted && "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-md shadow-emerald-950/30",
                          isCurrent && "bg-cyan-500/20 border-cyan-400 text-cyan-300 ring-4 ring-cyan-500/15 animate-pulse",
                          isTerminalCancelled && "bg-red-500/20 border-red-500/40 text-red-400 ring-4 ring-red-500/15",
                          isUpcoming && "bg-white/5 border-white/10 text-white/30"
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircle2 size={16} />
                        ) : isTerminalCancelled ? (
                          <XCircle size={16} />
                        ) : (
                          step.icon
                        )}
                      </div>

                      {/* Content block */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-baseline justify-between gap-2 flex-wrap">
                          <h5 className={cn(
                            "text-xs sm:text-sm font-bold tracking-tight",
                            isCompleted && "text-white",
                            isCurrent && "text-cyan-300 font-black",
                            isTerminalCancelled && "text-red-400 font-black",
                            isUpcoming && "text-white/40"
                          )}>
                            {step.title}
                          </h5>

                          {/* Render Actual Timestamp ONLY when database contains it */}
                          {step.timestamp && (
                            <span className="font-mono text-[10px] text-white/50 font-medium">
                              {step.timestamp}
                            </span>
                          )}
                        </div>

                        <p className={cn(
                          "text-[11px] leading-relaxed mt-0.5",
                          isCurrent ? "text-zinc-200" : isUpcoming ? "text-white/30" : "text-zinc-400"
                        )}>
                          {step.description}
                        </p>

                        {step.metadata}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Physical Shipping & Tracking Details (for physical products) */}
            {isPhysical && (
              <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck size={14} className="text-cyan-400" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">
                      {language === 'ka' ? 'მიწოდების და გადაზიდვის დეტალები' : 'Shipping & Delivery Details'}
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowShippingDetails(!showShippingDetails)}
                    className="text-[10px] font-bold text-white/50 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>{showShippingDetails ? (language === 'ka' ? 'დამალვა' : 'Hide') : (language === 'ka' ? 'ჩვენება' : 'Show')}</span>
                    {showShippingDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>

                <AnimatePresence>
                  {showShippingDetails && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 pt-2 overflow-hidden text-xs"
                    >
                      {/* Carrier & Tracking Card if shipped */}
                      {order.trackingInfo && (order.trackingInfo.carrier || order.trackingInfo.trackingNumber) && (
                        <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300">
                              {language === 'ka' ? 'საკურიერო გზავნილი' : 'Courier Tracking'}
                            </span>
                            {shippedTimestamp && (
                              <span className="font-mono text-[10px] text-white/60">
                                {language === 'ka' ? 'გაიგზავნა:' : 'Shipped:'} {shippedTimestamp}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {order.trackingInfo.carrier && (
                              <div className="text-zinc-200">
                                <span className="text-white/40 block text-[9px] uppercase font-bold">{language === 'ka' ? 'გადამზიდი კომპანია' : 'Carrier'}</span>
                                <span className="font-bold text-white">{order.trackingInfo.carrier}</span>
                              </div>
                            )}

                            {order.trackingInfo.trackingNumber && (
                              <div>
                                <span className="text-white/40 block text-[9px] uppercase font-bold">{language === 'ka' ? 'თრექინგ ნომერი' : 'Tracking Number'}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-cyan-300 break-all">{order.trackingInfo.trackingNumber}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(order.trackingInfo!.trackingNumber!, language === 'ka' ? 'თრექინგ ნომერი' : 'Tracking Number')}
                                    className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white"
                                    title="Copy tracking number"
                                  >
                                    {copiedId === (language === 'ka' ? 'თრექინგ ნომერი' : 'Tracking Number') ? (
                                      <Check size={12} className="text-green-400" />
                                    ) : (
                                      <Copy size={12} />
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Recipient and Shipping Address */}
                      {order.shippingDetails ? (
                        <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                            {order.shippingDetails.recipientName && (
                              <div className="flex items-center gap-2 text-zinc-300">
                                <UserIcon size={13} className="text-white/40 shrink-0" />
                                <span className="text-white font-medium">{order.shippingDetails.recipientName}</span>
                              </div>
                            )}

                            {order.shippingDetails.phone && (
                              <div className="flex items-center gap-2 text-zinc-300 font-mono">
                                <Phone size={13} className="text-white/40 shrink-0" />
                                <span className="text-white">{order.shippingDetails.phone}</span>
                              </div>
                            )}

                            {order.shippingDetails.city && (
                              <div className="flex items-center gap-2 text-zinc-300">
                                <MapPin size={13} className="text-white/40 shrink-0" />
                                <span>{order.shippingDetails.city}</span>
                              </div>
                            )}

                            {order.shippingDetails.address && (
                              <div className="flex items-start gap-2 text-zinc-300 sm:col-span-2">
                                <MapPin size={13} className="text-white/40 shrink-0 mt-0.5" />
                                <span className="break-words leading-relaxed">{order.shippingDetails.address}</span>
                              </div>
                            )}
                          </div>

                          {order.shippingDetails.notes && (
                            <div className="pt-2 border-t border-white/5 text-[11px] text-zinc-400">
                              <span className="font-bold text-white/50">{language === 'ka' ? 'მითითება კურიერს:' : 'Delivery Instructions:'}</span>{' '}
                              <span className="text-zinc-300">{order.shippingDetails.notes}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-zinc-500 italic p-3">
                          {language === 'ka' ? 'მიწოდების მისამართი არ არის მითითებული.' : 'No shipping address provided.'}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* 4. Buyer Instructions (if present for service or custom project) */}
            {order.buyerInstructions && (
              <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-white/50">
                  <FileText size={13} />
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
                    {language === 'ka' ? 'მყიდველის მოთხოვნები / ინსტრუქცია' : 'Buyer Requirements / Instructions'}
                  </span>
                </div>
                <p className="text-zinc-300 text-[11px] leading-relaxed pl-5 whitespace-pre-wrap">
                  {order.buyerInstructions}
                </p>
              </div>
            )}
          </div>

          {/* Modal Action Footer */}
          <div className="p-4 sm:p-5 border-t border-white/10 bg-zinc-950/90 backdrop-blur-md flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              disabled={isConfirmingDelivery || isUpdatingStatus}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
            >
              {language === 'ka' ? 'დახურვა' : 'Close'}
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Buyer Actions */}
              {!isSeller && (
                <>
                  {/* Message Seller Action */}
                  {onMessageSeller && (
                    <button
                      type="button"
                      id={`modal-message-seller-${order.id}`}
                      onClick={() => {
                        onMessageSeller(order);
                      }}
                      className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-white/10 hover:bg-white/20 border border-white/15 transition-all active:scale-95 flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      <MessageSquare size={14} className="text-[#dfb257]" />
                      <span>{language === 'ka' ? 'მიწერეთ გამყიდველს' : 'Message Seller'}</span>
                    </button>
                  )}

                  {/* Cancel Action (Only when allowed by security rules) */}
                  {canCancel && onCancelOrder && (
                    <button
                      type="button"
                      id={`modal-cancel-order-${order.id}`}
                      onClick={() => {
                        onClose();
                        onCancelOrder(order);
                      }}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-red-300 hover:text-white bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <XCircle size={14} />
                      <span>{language === 'ka' ? 'შეკვეთის გაუქმება' : 'Cancel Order'}</span>
                    </button>
                  )}

                  {/* Delivery Confirmation (Physical orders in 'shipped' state) */}
                  {isDeliveryConfirmable && onConfirmDelivery && (
                    <button
                      type="button"
                      id={`modal-confirm-delivery-${order.id}`}
                      onClick={handleConfirmDeliveryClick}
                      disabled={isConfirmingDelivery}
                      className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-400 hover:bg-emerald-300 text-black shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isConfirmingDelivery ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>{language === 'ka' ? 'დასტურდება...' : 'Confirming...'}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} />
                          <span>{language === 'ka' ? 'ჩაბარების დადასტურება' : 'Confirm Delivery Received'}</span>
                        </>
                      )}
                    </button>
                  )}
                </>
              )}

              {/* Seller Actions (If opened from seller view) */}
              {isSeller && (
                <>
                  {/* Message Buyer Action */}
                  {onMessageBuyer && (
                    <button
                      type="button"
                      id={`modal-message-buyer-${order.id}`}
                      onClick={() => {
                        onMessageBuyer(order);
                      }}
                      className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-white/10 hover:bg-white/20 border border-white/15 transition-all active:scale-95 flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      <MessageSquare size={14} className="text-[#dfb257]" />
                      <span>{language === 'ka' ? 'მიწერეთ მყიდველს' : 'Message Buyer'}</span>
                    </button>
                  )}

                  {canCancel && onCancelOrder && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onCancelOrder(order);
                      }}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <XCircle size={14} />
                      <span>{language === 'ka' ? 'შეკვეთის გაუქმება' : 'Cancel Order'}</span>
                    </button>
                  )}

                  {isPhysical && order.status === 'pending' && onUpdateOrderStatus && (
                    <button
                      type="button"
                      onClick={() => handleSellerStatusChange('processing')}
                      disabled={isUpdatingStatus}
                      className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-black bg-white hover:bg-zinc-200 transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Package size={14} />
                      <span>{language === 'ka' ? 'დამუშავების დაწყება' : 'Start Processing'}</span>
                    </button>
                  )}

                  {isPhysical && order.status === 'processing' && onOpenShipmentModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenShipmentModal(order);
                      }}
                      className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-black bg-cyan-400 hover:bg-cyan-300 transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Truck size={14} />
                      <span>{language === 'ka' ? 'ამანათის გაგზავნა & თრექინგი' : 'Ship Parcel & Add Tracking'}</span>
                    </button>
                  )}

                  {isService && order.status === 'booked' && onUpdateOrderStatus && (
                    <button
                      type="button"
                      onClick={() => handleSellerStatusChange('in_progress')}
                      disabled={isUpdatingStatus}
                      className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-black bg-white hover:bg-zinc-200 transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Wrench size={14} />
                      <span>{language === 'ka' ? 'მუშაობის დაწყება' : 'Begin Work'}</span>
                    </button>
                  )}

                  {isService && order.status === 'in_progress' && onUpdateOrderStatus && (
                    <button
                      type="button"
                      onClick={() => handleSellerStatusChange('completed')}
                      disabled={isUpdatingStatus}
                      className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-black bg-emerald-400 hover:bg-emerald-300 transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 size={14} />
                      <span>{language === 'ka' ? 'დასრულებულად მონიშვნა' : 'Mark Completed'}</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});
