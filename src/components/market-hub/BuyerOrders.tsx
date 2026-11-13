import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, 
  Truck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  ExternalLink,
  MapPin, 
  Phone, 
  User as UserIcon, 
  FileText, 
  Sparkles,
  ShoppingBag,
  Wrench,
  Zap,
  Loader2,
  Store,
  MessageSquare
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Order, Listing, BuyerOrderFilter } from '../../types';
import { 
  MarketTheme, 
  safeParseDate, 
  isPhysicalOrder, 
  isServiceOrder, 
  canCancelOrder 
} from './MarketConstants';
import { OrderDetailsModal } from './OrderDetailsModal';

export interface BuyerOrdersProps {
  buyerOrders: Order[];
  listings: Listing[];
  language: string;
  currentTheme: MarketTheme;
  onUpdateOrderStatus: (orderId: string, newStatus: string, tracking?: any) => Promise<void>;
  onCancelOrder: (order: Order) => void;
  onExploreMarket: () => void;
  onMessageSeller?: (order: Order) => void;
  selectedOrder?: Order | null;
  onSelectOrder?: (order: Order | null) => void;
}

export const BuyerOrders = React.memo(function BuyerOrders({
  buyerOrders,
  listings,
  language,
  currentTheme,
  onUpdateOrderStatus,
  onCancelOrder,
  onExploreMarket,
  onMessageSeller,
  selectedOrder: controlledSelectedOrder,
  onSelectOrder: setControlledSelectedOrder
}: BuyerOrdersProps) {
  const [activeFilter, setActiveFilter] = useState<BuyerOrderFilter>('all');
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [internalSelectedOrder, setInternalSelectedOrder] = useState<Order | null>(null);

  const selectedOrder = controlledSelectedOrder !== undefined ? controlledSelectedOrder : internalSelectedOrder;
  const setSelectedOrder = setControlledSelectedOrder || setInternalSelectedOrder;

  // Keep selected order synced with real-time updates in buyerOrders
  const activeSelectedOrder = useMemo(() => {
    if (!selectedOrder) return null;
    return buyerOrders.find(o => o.id === selectedOrder.id) || selectedOrder;
  }, [selectedOrder, buyerOrders]);

  // Toggle card expanded state
  const toggleExpand = (orderId: string) => {
    setExpandedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Compute counts for all buyer filters client-side
  const filterCounts = useMemo(() => {
    let actionRequired = 0;
    let processing = 0;
    let shipped = 0;
    let completed = 0;
    let cancelled = 0;

    for (const o of buyerOrders) {
      const isPhys = isPhysicalOrder(o);
      if (isPhys && o.status === 'shipped') {
        actionRequired++;
      }
      if (o.status === 'shipped') {
        shipped++;
      }
      if (
        o.status === 'pending' || 
        o.status === 'processing' || 
        o.status === 'booked' || 
        o.status === 'in_progress'
      ) {
        processing++;
      }
      if (o.status === 'completed') {
        completed++;
      }
      if (o.status === 'cancelled') {
        cancelled++;
      }
    }

    return {
      all: buyerOrders.length,
      actionRequired,
      processing,
      shipped,
      completed,
      cancelled
    };
  }, [buyerOrders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return buyerOrders.filter((order) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'action-required') {
        return isPhysicalOrder(order) && order.status === 'shipped';
      }
      if (activeFilter === 'processing') {
        return (
          order.status === 'pending' ||
          order.status === 'processing' ||
          order.status === 'booked' ||
          order.status === 'in_progress'
        );
      }
      if (activeFilter === 'shipped') {
        return order.status === 'shipped';
      }
      if (activeFilter === 'completed') {
        return order.status === 'completed';
      }
      if (activeFilter === 'cancelled') {
        return order.status === 'cancelled';
      }
      return true;
    });
  }, [buyerOrders, activeFilter]);

  // Format order date
  const formatOrderDate = (dateVal: any) => {
    const ms = safeParseDate(dateVal);
    const d = new Date(ms);
    return d.toLocaleDateString(language === 'ka' ? 'ka-GE' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatShortDate = (dateVal: any) => {
    const ms = safeParseDate(dateVal);
    const d = new Date(ms);
    return d.toLocaleDateString(language === 'ka' ? 'ka-GE' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Helper to resolve seller info
  const getSellerInfo = (order: Order) => {
    const matchingListing = listings.find(l => l.id === order.listingId);
    const sellerName = matchingListing?.sellerName || (order as any).sellerName || null;
    return {
      name: sellerName,
      id: order.sellerId
    };
  };

  // Delivery confirmation action
  const handleConfirmDelivery = async (order: Order) => {
    setConfirmingOrderId(order.id);
    try {
      await onUpdateOrderStatus(order.id, 'completed');
    } finally {
      setConfirmingOrderId(null);
    }
  };

  // Status mapping badge renderer
  const renderStatusBadge = (order: Order) => {
    const isPhysical = isPhysicalOrder(order);
    const isService = isServiceOrder(order);
    const status = order.status;

    if (isPhysical) {
      switch (status) {
        case 'pending':
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/25">
              <Clock size={11} className="animate-pulse" />
              {language === 'ka' ? 'დამუშავების მოლოდინში' : 'Awaiting seller processing'}
            </span>
          );
        case 'processing':
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-500 border border-cyan-500/25">
              <Package size={11} />
              {language === 'ka' ? 'მზადდება / მუშავდება' : 'Being prepared'}
            </span>
          );
        case 'shipped':
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-500/15 text-indigo-500 border border-indigo-500/30">
              <Truck size={11} className="animate-bounce" />
              {language === 'ka' ? 'გაგზავნილია' : 'Shipped'}
            </span>
          );
        case 'completed':
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-500 border border-emerald-500/25">
              <CheckCircle2 size={11} />
              {language === 'ka' ? 'მიღება დადასტურებულია' : 'Delivery confirmed'}
            </span>
          );
        case 'cancelled':
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-500 border border-rose-500/25">
              <XCircle size={11} />
              {language === 'ka' ? 'გაუქმებული' : 'Cancelled'}
            </span>
          );
        default:
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-proton-bg text-proton-muted border border-proton-border">
              {status}
            </span>
          );
      }
    }

    if (isService) {
      switch (status) {
        case 'booked':
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/25">
              <Clock size={11} />
              {language === 'ka' ? 'დაჯავშნილია' : 'Booked'}
            </span>
          );
        case 'in_progress':
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-500 border border-blue-500/25">
              <Wrench size={11} className="animate-pulse" />
              {language === 'ka' ? 'მიმდინარე' : 'In progress'}
            </span>
          );
        case 'completed':
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-500 border border-emerald-500/25">
              <CheckCircle2 size={11} />
              {language === 'ka' ? 'დასრულებული' : 'Completed'}
            </span>
          );
        case 'cancelled':
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-500 border border-rose-500/25">
              <XCircle size={11} />
              {language === 'ka' ? 'გაუქმებული' : 'Cancelled'}
            </span>
          );
        default:
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-proton-bg text-proton-muted border border-proton-border">
              {status}
            </span>
          );
      }
    }

    // Default fallback for generic digital items
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-500 border border-emerald-500/25">
            <CheckCircle2 size={11} />
            {language === 'ka' ? 'დასრულებული' : 'Completed'}
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-500 border border-rose-500/25">
            <XCircle size={11} />
            {language === 'ka' ? 'გაუქმებული' : 'Cancelled'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/25">
            <Clock size={11} />
            {language === 'ka' ? 'მუშავდება' : 'Processing'}
          </span>
        );
    }
  };

  const filterTabs: { id: BuyerOrderFilter; labelEn: string; labelKa: string; count: number; icon: any }[] = [
    { id: 'all', labelEn: 'All Orders', labelKa: 'ყველა შეკვეთა', count: filterCounts.all, icon: Package },
    { id: 'action-required', labelEn: 'Action Required', labelKa: 'მოქმედებაა საჭირო', count: filterCounts.actionRequired, icon: AlertCircle },
    { id: 'processing', labelEn: 'Processing', labelKa: 'მუშავდება', count: filterCounts.processing, icon: Clock },
    { id: 'shipped', labelEn: 'Shipped', labelKa: 'გაგზავნილია', count: filterCounts.shipped, icon: Truck },
    { id: 'completed', labelEn: 'Completed', labelKa: 'დასრულებული', count: filterCounts.completed, icon: CheckCircle2 },
    { id: 'cancelled', labelEn: 'Cancelled', labelKa: 'გაუქმებული', count: filterCounts.cancelled, icon: XCircle },
  ];

  return (
    <div id="buyer-orders-container" className="space-y-6 w-full animate-in fade-in duration-300">
      {/* Header & Sub-Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-proton-border">
        <div>
          <h2 className={cn("text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-2.5", currentTheme.text)}>
            <ShoppingBag className={currentTheme.accent} size={22} />
            <span>{language === 'ka' ? 'ჩემი შეკვეთები' : 'My Purchases & Orders'}</span>
          </h2>
          <p className={cn("text-xs font-medium mt-1", currentTheme.muted)}>
            {language === 'ka' 
              ? 'თვალყური ადევნეთ თქვენი შეკვეთების მიწოდების პროცესს და სტატუსებს'
              : 'Track fulfillment progress, shipments, and confirm deliveries'}
          </p>
        </div>

        {filterCounts.actionRequired > 0 && (
          <div className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center gap-2 text-amber-500 text-xs font-bold animate-pulse">
            <AlertCircle size={14} />
            <span>
              {language === 'ka'
                ? `${filterCounts.actionRequired} შეკვეთა ელოდება ჩაბარების დადასტურებას`
                : `${filterCounts.actionRequired} shipment(s) ready for delivery confirmation`}
            </span>
          </div>
        )}
      </div>

      {/* Buyer Filter Tabs */}
      <div 
        id="buyer-order-filters-nav"
        className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none"
      >
        {filterTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeFilter === tab.id;
          const isActionTab = tab.id === 'action-required';
          return (
            <button
              key={tab.id}
              type="button"
              id={`buyer-filter-${tab.id}-btn`}
              onClick={() => setActiveFilter(tab.id)}
              className={cn(
                "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 whitespace-nowrap transition-all shrink-0 cursor-pointer border",
                isActive 
                  ? "bg-proton-accent text-proton-on-accent border-proton-accent shadow-md" 
                  : "bg-proton-card text-proton-muted hover:text-proton-text hover:bg-proton-bg border-proton-border"
              )}
            >
              <Icon size={12} className={cn(
                isActive ? "text-proton-on-accent" : "text-proton-muted",
                isActionTab && tab.count > 0 && !isActive && "text-amber-500 animate-pulse"
              )} />
              <span>{language === 'ka' ? tab.labelKa : tab.labelEn}</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-md text-[8px] font-mono font-black ml-0.5",
                isActive 
                  ? "bg-black/20 text-proton-on-accent" 
                  : isActionTab && tab.count > 0 
                    ? "bg-amber-500 text-black font-black animate-pulse" 
                    : "bg-proton-bg text-proton-muted"
              )}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Buyer Orders List or Empty States */}
      {buyerOrders.length === 0 ? (
        /* Global Empty State: Buyer has no orders at all */
        <div 
          id="buyer-orders-empty-state"
          className={cn("p-10 sm:p-14 rounded-3xl border text-center flex flex-col items-center justify-center max-w-xl mx-auto space-y-4 shadow-xl", currentTheme.card)}
        >
          <div className="w-16 h-16 rounded-2xl bg-proton-bg border border-proton-border flex items-center justify-center text-proton-muted">
            <ShoppingBag size={28} />
          </div>
          <div>
            <h3 className={cn("text-base sm:text-lg font-black uppercase tracking-tight", currentTheme.text)}>
              {language === 'ka' ? 'თქვენი შეკვეთები გამოჩნდება აქ.' : 'Your orders will appear here.'}
            </h3>
            <p className={cn("text-xs max-w-sm mt-1 leading-relaxed", currentTheme.muted)}>
              {language === 'ka' 
                ? 'პროდუქტის შეძენის ან სერვისის დაჯავშნის შემდეგ, შეკვეთის დეტალები და სტატუსი გამოჩნდება ამ განყოფილებაში.'
                : 'When you purchase products or book services from the marketplace, your order records and tracking will be displayed here.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onExploreMarket}
            className={cn("mt-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer", currentTheme.accentBg)}
          >
            <Sparkles size={14} />
            <span>{language === 'ka' ? 'მარკეტის დათვალიერება' : 'Explore Marketplace'}</span>
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        /* Filter Empty State: No orders match this filter */
        <div 
          id="buyer-orders-filtered-empty"
          className={cn("p-8 sm:p-12 rounded-3xl border text-center flex flex-col items-center justify-center max-w-md mx-auto space-y-4 shadow-xl", currentTheme.card)}
        >
          <div className="w-14 h-14 rounded-2xl bg-proton-bg border border-proton-border flex items-center justify-center text-proton-muted">
            <Package size={24} />
          </div>
          <div>
            <h3 className={cn("text-sm sm:text-base font-black uppercase tracking-tight", currentTheme.text)}>
              {language === 'ka' ? 'ამ ფილტრით შეკვეთები არ მოიძებნა.' : 'No orders match this filter.'}
            </h3>
            <p className={cn("text-xs mt-1", currentTheme.muted)}>
              {language === 'ka' 
                ? 'არცერთი შეკვეთა არ შეესაბამება არჩეულ კატეგორიას.'
                : 'There are no orders in your history currently matching this filter.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-proton-bg hover:bg-proton-accent/10 text-proton-text transition-all border border-proton-border cursor-pointer"
          >
            {language === 'ka' ? 'ყველა შეკვეთის ნახვა' : 'View All Orders'}
          </button>
        </div>
      ) : (
        /* Orders Grid */
        <div id="buyer-orders-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrders.map((order) => {
            const isPhysical = isPhysicalOrder(order);
            const isService = isServiceOrder(order);
            const isExpanded = expandedOrderIds.has(order.id);
            const sellerInfo = getSellerInfo(order);
            const hasShipping = Boolean(order.shippingDetails);
            const hasTracking = Boolean(order.trackingInfo?.trackingNumber || order.trackingInfo?.carrier);
            const orderDateStr = formatOrderDate(order.createdAt);
            const canCancel = canCancelOrder(order);
            const isDeliveryConfirmable = isPhysical && order.status === 'shipped';

            return (
              <motion.div
                key={order.id}
                id={`buyer-order-card-${order.id}`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "relative rounded-2xl border p-4 sm:p-5 flex flex-col justify-between transition-all backdrop-blur-md shadow-xl",
                  currentTheme.card,
                  isDeliveryConfirmable && "border-indigo-500/45 ring-1 ring-indigo-500/20"
                )}
              >
                {/* Card Top: Order Date & Status */}
                <div>
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-proton-border">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-proton-bg border border-proton-border flex items-center justify-center text-proton-muted shrink-0">
                        {isPhysical ? (
                          <Truck size={14} className="text-cyan-500" />
                        ) : isService ? (
                          <Wrench size={14} className="text-amber-500" />
                        ) : (
                          <ShoppingBag size={14} className={currentTheme.accent} />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className={cn("text-[10px] font-mono tracking-wider", currentTheme.muted)}>
                          {orderDateStr}
                        </span>
                        <span className={cn("text-[8px] font-black uppercase tracking-widest", currentTheme.tagMuted)}>
                          {isPhysical 
                            ? (language === 'ka' ? 'ფიზიკური მიწოდება' : 'Physical Order')
                            : isService 
                              ? (language === 'ka' ? 'სერვისი / ჯავშანი' : 'Service Booking')
                              : (language === 'ka' ? 'პროდუქტი' : 'Product')}
                        </span>
                      </div>
                    </div>

                    {renderStatusBadge(order)}
                  </div>

                  {/* Title & Price & Quantity */}
                  <div className="py-3.5 space-y-2">
                    <h3 
                      onClick={() => setSelectedOrder(order)}
                      className={cn("text-sm sm:text-base font-black leading-snug tracking-tight hover:text-proton-accent cursor-pointer transition-colors", currentTheme.text)}
                      title={language === 'ka' ? 'დეტალებისა და თაიმლაინის ნახვა' : 'Click to view details & timeline'}
                    >
                      {order.itemTitle}
                    </h3>

                    <div className="flex items-baseline justify-between flex-wrap gap-2 pt-0.5">
                      <div className="flex items-baseline gap-2">
                        <span className={cn("text-lg sm:text-xl font-black font-mono tracking-tight", currentTheme.accent)}>
                          {order.amount} {order.currency}
                        </span>

                        {order.quantity && order.quantity > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-proton-bg border border-proton-border text-[9px] font-mono font-bold text-proton-text">
                            {language === 'ka' ? 'რაოდენობა:' : 'Qty:'} {order.quantity}
                          </span>
                        )}
                      </div>

                      {/* Seller Information */}
                      <div className={cn("flex items-center gap-1.5 text-[10px]", currentTheme.muted)}>
                        <Store size={11} className="text-proton-muted" />
                        <span className={cn("font-bold", currentTheme.text)}>
                          {sellerInfo.name || (language === 'ka' ? 'გამყიდველი' : 'Seller')}
                        </span>
                        <span className={cn("font-mono text-[9px]", currentTheme.tagMuted)}>
                          #{sellerInfo.id.substring(0, 6)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Tracking Banner if shipped */}
                  {order.status === 'shipped' && order.trackingInfo && (
                    <div className="mb-3 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-between gap-2 text-indigo-500">
                      <div className="flex items-center gap-2 text-[10px] font-bold">
                        <Truck size={13} className="text-indigo-500 shrink-0" />
                        <span>
                          {order.trackingInfo.carrier ? `${order.trackingInfo.carrier}: ` : ''}
                          <span className={cn("font-mono", currentTheme.text)}>{order.trackingInfo.trackingNumber || 'Tracked'}</span>
                        </span>
                      </div>
                      {order.trackingInfo.trackingNumber && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(order.trackingInfo!.trackingNumber!, `track-${order.id}`);
                          }}
                          className="p-1 rounded bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-500 transition-colors cursor-pointer"
                          title="Copy tracking code"
                        >
                          {copiedId === `track-${order.id}` ? <Check size={11} /> : <Copy size={11} />}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Expandable Details Section */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3 pt-3 border-t border-proton-border overflow-hidden text-left"
                      >
                        {/* Physical Shipping Details Block */}
                        {hasShipping && order.shippingDetails && (
                          <div className="p-3 rounded-xl bg-proton-bg/60 border border-proton-border space-y-2 text-xs">
                            <span className={cn("text-[8px] font-black uppercase tracking-widest block", currentTheme.accent)}>
                              {language === 'ka' ? 'მიწოდების მონაცემები' : 'Shipping Information'}
                            </span>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              {order.shippingDetails.recipientName && (
                                <div className={cn("flex items-center gap-1.5", currentTheme.subtext)}>
                                  <UserIcon size={12} className="text-proton-muted shrink-0" />
                                  <span className="truncate">{order.shippingDetails.recipientName}</span>
                                </div>
                              )}

                              {order.shippingDetails.phone && (
                                <div className={cn("flex items-center gap-1.5 font-mono", currentTheme.subtext)}>
                                  <Phone size={12} className="text-proton-muted shrink-0" />
                                  <span>{order.shippingDetails.phone}</span>
                                </div>
                              )}

                              {order.shippingDetails.city && (
                                <div className={cn("flex items-center gap-1.5", currentTheme.subtext)}>
                                  <MapPin size={12} className="text-proton-muted shrink-0" />
                                  <span>{order.shippingDetails.city}</span>
                                </div>
                              )}

                              {order.shippingDetails.address && (
                                <div className={cn("flex items-start gap-1.5 sm:col-span-2", currentTheme.subtext)}>
                                  <MapPin size={12} className="text-proton-muted shrink-0 mt-0.5" />
                                  <span className="break-words">{order.shippingDetails.address}</span>
                                </div>
                              )}
                            </div>

                            {order.shippingDetails.notes && (
                              <div className="mt-1 pt-1.5 border-t border-proton-border text-[10px] text-proton-muted">
                                <span className="font-bold text-proton-text">{language === 'ka' ? 'მითითება:' : 'Note:'}</span>{' '}
                                {order.shippingDetails.notes}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Shipment Tracking Details Block (When Shipped) */}
                        {hasTracking && order.trackingInfo && (
                          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-1.5 text-xs">
                            <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500 block">
                              {language === 'ka' ? 'გზავნილის თრექინგი' : 'Shipment Tracking'}
                            </span>

                            <div className="space-y-1 text-[11px]">
                              {order.trackingInfo.carrier && (
                                <div className="flex items-center justify-between text-proton-muted">
                                  <span>{language === 'ka' ? 'გადამზიდი:' : 'Carrier:'}</span>
                                  <span className={cn("font-bold", currentTheme.text)}>{order.trackingInfo.carrier}</span>
                                </div>
                              )}

                              {order.trackingInfo.trackingNumber && (
                                <div className="flex items-center justify-between text-proton-muted">
                                  <span>{language === 'ka' ? 'თრექინგ კოდი:' : 'Tracking Number:'}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-cyan-500">{order.trackingInfo.trackingNumber}</span>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(order.trackingInfo!.trackingNumber!, `track-full-${order.id}`)}
                                      className="p-1 rounded bg-proton-card hover:bg-proton-bg border border-proton-border text-proton-muted hover:text-proton-text transition-colors cursor-pointer"
                                      title="Copy tracking number"
                                    >
                                      {copiedId === `track-full-${order.id}` ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {order.trackingInfo.shippedAt && (
                                <div className="flex items-center justify-between text-proton-muted text-[10px]">
                                  <span>{language === 'ka' ? 'გაგზავნის თარიღი:' : 'Shipped At:'}</span>
                                  <span className="font-mono">{formatShortDate(order.trackingInfo.shippedAt)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Buyer Instructions / Project notes */}
                        {order.buyerInstructions && (
                          <div className="p-3 rounded-xl bg-proton-bg/60 border border-proton-border text-[11px] space-y-1">
                            <span className={cn("text-[8px] font-black uppercase tracking-widest block", currentTheme.muted)}>
                              {language === 'ka' ? 'თქვენი მოთხოვნები / ინსტრუქცია' : 'Your Requirements / Instructions'}
                            </span>
                            <p className={cn("leading-relaxed", currentTheme.subtext)}>{order.buyerInstructions}</p>
                          </div>
                        )}

                        {/* Technical Metadata & Order ID */}
                        <div className="pt-2 flex items-center justify-between text-[9px] font-mono text-proton-muted border-t border-proton-border">
                          <div className="flex items-center gap-1">
                            <span>ID:</span>
                            <span className={cn("font-bold", currentTheme.text)}>{order.id}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(order.id, `order-id-${order.id}`)}
                              className="p-1 rounded hover:bg-proton-bg text-proton-muted hover:text-proton-text transition-colors cursor-pointer"
                              title="Copy Order ID"
                            >
                              {copiedId === `order-id-${order.id}` ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                            </button>
                          </div>

                          <span>Seller ID: #{sellerInfo.id.substring(0, 8)}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Card Footer: Toggle Details Button & Action Handlers */}
                <div className="pt-3 mt-3 border-t border-proton-border flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      id={`view-timeline-btn-${order.id}`}
                      onClick={() => setSelectedOrder(order)}
                      className="px-2.5 py-1.5 rounded-xl bg-proton-bg hover:bg-proton-accent/10 border border-proton-border hover:border-proton-accent/40 text-[10px] font-bold text-proton-text flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                      <Clock size={12} className={currentTheme.accent} />
                      <span>{language === 'ka' ? 'თაიმლაინი & დეტალები' : 'Timeline & Details'}</span>
                    </button>

                    {onMessageSeller && (
                      <button
                        type="button"
                        id={`card-message-seller-btn-${order.id}`}
                        onClick={() => onMessageSeller(order)}
                        className="px-2.5 py-1.5 rounded-xl bg-proton-bg hover:bg-proton-accent/10 border border-proton-border hover:border-proton-accent/40 text-[10px] font-bold text-proton-text flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        title={language === 'ka' ? 'მიწერეთ გამყიდველს' : 'Message Seller'}
                      >
                        <MessageSquare size={12} className={currentTheme.accent} />
                        <span>{language === 'ka' ? 'მიწერეთ' : 'Message Seller'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleExpand(order.id)}
                      className="text-[10px] font-bold text-proton-muted hover:text-proton-text flex items-center gap-1 transition-colors py-1 cursor-pointer"
                    >
                      <span>{isExpanded ? (language === 'ka' ? 'დახურვა' : 'Hide Details') : (language === 'ka' ? 'სწრაფი ხედი' : 'Quick Details')}</span>
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Delivery Confirmation Button (Physical orders in 'shipped' status) */}
                    {isDeliveryConfirmable && (
                      <button
                        type="button"
                        id={`confirm-delivery-btn-${order.id}`}
                        onClick={() => handleConfirmDelivery(order)}
                        disabled={confirmingOrderId === order.id}
                        className="px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        {confirmingOrderId === order.id ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>{language === 'ka' ? 'დასტურდება...' : 'Confirming...'}</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={12} />
                            <span>{language === 'ka' ? 'ჩაბარების დადასტურება' : 'Confirm Delivery Received'}</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Safe Cancellation Button (Only allowed when in pending or booked) */}
                    {canCancel && (
                      <button
                        type="button"
                        id={`cancel-order-btn-${order.id}`}
                        onClick={() => onCancelOrder(order)}
                        className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      >
                        <XCircle size={12} />
                        <span>{language === 'ka' ? 'შეკვეთის გაუქმება' : 'Cancel Order'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Order Details & Fulfillment Timeline Modal */}
      <OrderDetailsModal
        order={activeSelectedOrder}
        isOpen={Boolean(activeSelectedOrder)}
        onClose={() => setSelectedOrder(null)}
        listings={listings}
        language={language}
        currentTheme={currentTheme}
        isSeller={false}
        onConfirmDelivery={handleConfirmDelivery}
        onCancelOrder={onCancelOrder}
        onMessageSeller={onMessageSeller}
      />
    </div>
  );
});
