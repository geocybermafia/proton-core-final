import { useMemo } from 'react';
import { useSeller } from '../contexts/SellerContext';
import { Listing, Order } from '../types';

export interface SellerStats {
  activeListings: Listing[];
  inactiveListings: Listing[];
  draftListings: Listing[];
  pendingOrders: Order[];
  completedOrders: Order[];
  grossRevenue: number;
  monthlyRevenue: number;
  todayRevenue: number;
  walletBalance: number;
  lowStockItemsCount: number;
  averageOrderValue: number;
  recentOrders: Order[];
  loading: boolean;
  error: string | null;
}

export function useSellerStats(): SellerStats {
  const { sellerListings, sellerOrders, ledgerItems, loading, error } = useSeller();

  return useMemo(() => {
    // 1. Listings segmentation
    const activeListings = sellerListings.filter(
      l => l.status === 'active' && !l.isSold
    );
    const inactiveListings = sellerListings.filter(
      l => l.status === 'sold' || l.isSold === true
    );
    const draftListings = sellerListings.filter(
      l => (l as any).status === 'draft'
    );

    // 2. Low stock items (items where stock is defined and <= 2, or default active items)
    const lowStockItemsCount = activeListings.filter(
      l => l.stock !== undefined ? l.stock <= 2 : false
    ).length;

    // 3. Orders segmentation
    const pendingOrders = sellerOrders.filter(
      o => o.status === 'pending' || o.status === 'booked'
    );
    const completedOrders = sellerOrders.filter(
      o => o.status === 'completed'
    );

    // Sort seller orders by creation date descending
    const sortedOrders = [...sellerOrders].sort((a, b) => {
      const timeA = typeof a.createdAt === 'number' ? a.createdAt : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
      const timeB = typeof b.createdAt === 'number' ? b.createdAt : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
      return timeB - timeA;
    });

    const recentOrders = sortedOrders.slice(0, 10);

    // 4. Financial Calculations
    const ordersRevenue = completedOrders.reduce((acc, o) => acc + (Number(o.amount) || 0), 0);
    const inboundLedgerTotal = ledgerItems
      .filter(i => i.type === 'inbound' && i.status === 'completed')
      .reduce((acc, i) => acc + (Number(i.total) || 0), 0);
    const outboundLedgerTotal = ledgerItems
      .filter(i => i.type === 'outbound' && i.status === 'completed')
      .reduce((acc, i) => acc + (Number(i.total) || 0), 0);

    const grossRevenue = ordersRevenue + inboundLedgerTotal;
    const walletBalance = Math.max(0, grossRevenue - outboundLedgerTotal);

    // Date boundaries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const monthlyOrdersRevenue = completedOrders.filter(o => {
      const time = typeof o.createdAt === 'number' ? o.createdAt : (o.createdAt?.seconds ? o.createdAt.seconds * 1000 : 0);
      return time >= startOfMonth;
    }).reduce((acc, o) => acc + (Number(o.amount) || 0), 0);

    const monthlyRevenue = monthlyOrdersRevenue;

    const todayOrdersRevenue = completedOrders.filter(o => {
      const time = typeof o.createdAt === 'number' ? o.createdAt : (o.createdAt?.seconds ? o.createdAt.seconds * 1000 : 0);
      return time >= startOfToday;
    }).reduce((acc, o) => acc + (Number(o.amount) || 0), 0);

    const todayRevenue = todayOrdersRevenue;

    const totalCompletedCount = completedOrders.length;
    const averageOrderValue = totalCompletedCount > 0 ? ordersRevenue / totalCompletedCount : 0;

    return {
      activeListings,
      inactiveListings,
      draftListings,
      pendingOrders,
      completedOrders,
      grossRevenue,
      monthlyRevenue,
      todayRevenue,
      walletBalance,
      lowStockItemsCount,
      averageOrderValue,
      recentOrders,
      loading,
      error
    };
  }, [sellerListings, sellerOrders, ledgerItems, loading, error]);
}
