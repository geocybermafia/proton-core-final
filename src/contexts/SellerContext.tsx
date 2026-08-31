import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { 
  collection, 
  doc, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  orderBy, 
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { Listing, Order } from '../types';
import { LedgerItem } from './MarketHubContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { executeSecureTransaction } from '../services/cloudFunctionsService';
import { uploadProductImage } from '../lib/storageUtils';

export interface CreateListingPayload {
  title: string;
  description: string;
  images?: string[];
  status?: 'draft' | 'active' | 'sold' | string;
  price?: number;
  category?: string;
  listingType?: 'product' | 'service' | 'project';
}

export interface CreateOrderPayload {
  listingId: string;
  sellerId: string;
  buyerId?: string;
  amount: number;
  currency?: string;
  itemTitle: string;
  orderType?: 'service' | 'product' | string;
  buyerInstructions?: string;
  source?: string;
  clipId?: string;
}

export interface SellerContextType {
  allListings: Listing[];
  sellerListings: Listing[];
  sellerOrders: Order[];
  buyerOrders: Order[];
  ledgerItems: LedgerItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addLedgerItem?: (item: Omit<LedgerItem, 'id' | 'total'>) => Promise<void>;
  updateLedgerItem?: (id: string, updates: Partial<LedgerItem>) => Promise<void>;
  deleteLedgerItem?: (id: string) => Promise<void>;
  createDraftListing: (payload: CreateListingPayload) => Promise<Listing>;
  publishListing: (payload: CreateListingPayload) => Promise<Listing>;
  createOrder: (payload: CreateOrderPayload) => Promise<Order>;
  updateOrderStatus?: (orderId: string, status: string) => Promise<void>;
}

export const isRealListing = (listing: any): boolean => {
  if (!listing || !listing.id) return false;
  const id = String(listing.id).toLowerCase();
  const title = (listing.title || '').toLowerCase();
  const desc = (listing.description || '').toLowerCase();
  
  if (
    id.startsWith('demo') ||
    id.startsWith('seed') ||
    id.startsWith('mock') ||
    id.startsWith('sample') ||
    id.startsWith('test') ||
    listing.isDemo === true ||
    listing.isSeed === true ||
    listing.isMock === true
  ) {
    return false;
  }
  
  if (
    title.includes('hydroponic smart garden') ||
    title.includes('ჰიდროპონიკური') ||
    title.includes('kutaisi logistics hangar') ||
    title.includes('ქუთაისის ლოჯისტიკური ანგარი') ||
    title.includes('web3 დეცენტრალიზებული') ||
    title.includes('sample listing') ||
    title.includes('demo listing') ||
    desc.includes('seed data')
  ) {
    return false;
  }
  
  return true;
};

export const isRealLedgerItem = (item: LedgerItem | null | undefined): boolean => {
  if (!item || !item.id) return false;
  const id = String(item.id).toLowerCase();
  if (
    id.startsWith('demo') ||
    id.startsWith('seed') ||
    id.startsWith('mock') ||
    id.startsWith('sample') ||
    id.startsWith('test') ||
    /^(tx_)?0*([1-9]|[1-9][0-9])$/i.test(id) ||
    id === 'tx-1' || id === 'tx-2' || id === 'tx-3' || id === 'tx-4' || id === 'tx-5' ||
    id === 'tx_001' || id === 'tx_002' || id === 'tx_003' || id === 'tx_004' ||
    (item as any).isDemo === true ||
    (item as any).isSeed === true ||
    (item as any).isMock === true
  ) {
    return false;
  }
  const desc = (item.description || '').toLowerCase();
  const cat = (item.category || '').toLowerCase();
  if (
    desc.includes('sample') || desc.includes('demo') || desc.includes('seed data') ||
    cat.includes('sample') || cat.includes('demo')
  ) {
    return false;
  }
  return true;
};

const defaultSampleOrders: Order[] = [];

const defaultLedger: LedgerItem[] = [];

const generateTxId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `TX-${crypto.randomUUID()}`;
  }
  return `TX-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
};

const SellerContext = createContext<SellerContextType | undefined>(undefined);

export const SellerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [sellerOrders, setSellerOrders] = useState<Order[]>(defaultSampleOrders);
  const [buyerOrders, setBuyerOrders] = useState<Order[]>([]);
  const [ledgerItems, setLedgerItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Real-time Scoped Seller Listings Listener
  useEffect(() => {
    if (!user) {
      setAllListings([]);
      return;
    }

    let active = true;

    try {
      const qSellerListings = query(
        collection(db, 'listings'),
        where('sellerId', '==', user.uid),
        limit(50)
      );
      const unsubListings = onSnapshot(qSellerListings, (snapshot) => {
        if (!active) return;
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Listing[];
        setAllListings(data.filter(isRealListing));
      }, (err) => {
        console.warn("[SellerContext] Listings subscription warning:", err);
      });

      return () => {
        active = false;
        unsubListings();
      };
    } catch (e: any) {
      console.warn("[SellerContext] Listings query error:", e);
    }
  }, [user?.uid]);

  // 2. Real-time Orders Listener (Seller & Buyer)
  useEffect(() => {
    if (!user) {
      setSellerOrders(defaultSampleOrders);
      setBuyerOrders([]);
      return;
    }

    let active = true;

    if (isSupabaseConfigured()) {
      const fetchSupabaseOrders = async () => {
        const { data: sData } = await supabase
          .from('orders')
          .select('*')
          .eq('sellerId', user.uid);
        if (active && sData) {
          setSellerOrders(sData.length > 0 ? (sData as Order[]) : defaultSampleOrders);
        }

        const { data: bData } = await supabase
          .from('orders')
          .select('*')
          .eq('buyerId', user.uid);
        if (active && bData) setBuyerOrders(bData as Order[]);
      };

      fetchSupabaseOrders();

      const channel = supabase
        .channel('seller-orders-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          if (active) fetchSupabaseOrders();
        })
        .subscribe();

      return () => {
        active = false;
        supabase.removeChannel(channel);
      };
    } else {
      const qSellerOrders = query(
        collection(db, 'orders'),
        where('sellerId', '==', user.uid)
      );
      const unsubSellerOrders = onSnapshot(qSellerOrders, (snapshot) => {
        if (!active) return;
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Order[];
        setSellerOrders(data.length > 0 ? data : defaultSampleOrders);
      }, (err) => {
        console.warn("[SellerContext] Seller orders warning:", err);
      });

      const qBuyerOrders = query(
        collection(db, 'orders'),
        where('buyerId', '==', user.uid)
      );
      const unsubBuyerOrders = onSnapshot(qBuyerOrders, (snapshot) => {
        if (!active) return;
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Order[];
        setBuyerOrders(data);
      }, (err) => {
        console.warn("[SellerContext] Buyer orders warning:", err);
      });

      return () => {
        active = false;
        unsubSellerOrders();
        unsubBuyerOrders();
      };
    }
  }, [user]);

  // 3. Real-time Ledger Listener
  useEffect(() => {
    let active = true;

    if (!user) {
      try {
        const localData = localStorage.getItem('proton_market_hub_ledger');
        if (localData && active) {
          const parsed = JSON.parse(localData) as LedgerItem[];
          const clean = Array.isArray(parsed) ? parsed.filter(isRealLedgerItem) : [];
          setLedgerItems(clean);
          if (clean.length === 0) {
            localStorage.removeItem('proton_market_hub_ledger');
          } else {
            localStorage.setItem('proton_market_hub_ledger', JSON.stringify(clean));
          }
        } else if (active) {
          setLedgerItems([]);
        }
      } catch {
        if (active) setLedgerItems([]);
      }
      if (active) setLoading(false);
      return;
    }

    setLoading(true);
    const userRef = doc(db, 'users', user.uid);
    const ledgerCollection = collection(userRef, 'market_ledger');

    const unsubLedger = onSnapshot(ledgerCollection, (snapshot) => {
      if (!active) return;

      if (snapshot.empty) {
        if (active) setLedgerItems([]);
      } else {
        const items: LedgerItem[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as LedgerItem;
          if (isRealLedgerItem(data)) {
            items.push(data);
          } else {
            // Clean up legacy fake/demo record from user's Firestore permanently
            try {
              const deadDoc = doc(db, 'users', user.uid, 'market_ledger', d.id);
              deleteDoc(deadDoc).catch(() => {});
            } catch {}
          }
        });
        items.sort((a, b) => b.id.localeCompare(a.id));
        if (active) setLedgerItems(items);
      }
      if (active) setLoading(false);
    }, (err) => {
      if (!active) return;
      console.warn("[SellerContext] Ledger sync warning:", err);
      try {
        const localData = localStorage.getItem('proton_market_hub_ledger');
        if (localData) {
          const parsed = JSON.parse(localData) as LedgerItem[];
          const clean = Array.isArray(parsed) ? parsed.filter(isRealLedgerItem) : [];
          setLedgerItems(clean);
        } else {
          setLedgerItems([]);
        }
      } catch {
        setLedgerItems([]);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      unsubLedger();
    };
  }, [user]);

  // 4. Derive seller listings
  const sellerListings = useMemo(() => {
    if (!user) return [];
    return allListings.filter(l => l.sellerId === user.uid);
  }, [allListings, user]);

  const addLedgerItem = useCallback(async (item: Omit<LedgerItem, 'id' | 'total'>) => {
    const id = generateTxId();
    const total = item.value * item.volume;
    const newItem: LedgerItem = { ...item, id, total };

    let previous = ledgerItems;
    setLedgerItems(prev => [newItem, ...prev]);

    if (user) {
      try {
        await executeSecureTransaction({
          buyerId: user.uid,
          sellerId: user.uid,
          amount: Math.max(0.01, total || item.value || 1),
          itemTitle: item.description || 'Merchant Ledger Entry',
          type: item.type === 'outbound' ? 'PAYOUT' : 'DEPOSIT'
        });
      } catch (err) {
        console.error("Failed to persist ledger item securely via Cloud Functions:", err);
        setLedgerItems(previous);
        throw err;
      }
    }
  }, [user, ledgerItems]);

  const updateLedgerItem = useCallback(async (id: string, updates: Partial<LedgerItem>) => {
    let merged: LedgerItem | undefined;

    setLedgerItems(prev => prev.map(item => {
      if (item.id === id) {
        merged = { ...item, ...updates };
        merged.total = (merged.value || 0) * (merged.volume || 1);
        return merged;
      }
      return item;
    }));

    if (user && merged) {
      try {
        const docRef = doc(db, 'users', user.uid, 'market_ledger', id);
        await setDoc(docRef, merged);
      } catch (err) {
        console.error("Failed to update ledger item:", err);
      }
    }
  }, [user]);

  const deleteLedgerItem = useCallback(async (id: string) => {
    setLedgerItems(prev => prev.filter(item => item.id !== id));

    if (user) {
      try {
        const docRef = doc(db, 'users', user.uid, 'market_ledger', id);
        await deleteDoc(docRef);
      } catch (err) {
        console.error("Failed to delete ledger item:", err);
      }
    }
  }, [user]);

  const createDraftListing = useCallback(async (payload: CreateListingPayload): Promise<Listing> => {
    const newId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `lst-${crypto.randomUUID()}`
      : `lst-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    let processedImages: string[] = [];
    if (payload.images && payload.images.length > 0) {
      processedImages = await Promise.all(
        payload.images.map(async (img) => {
          if (typeof img === 'string' && img.startsWith('data:')) {
            try {
              return await uploadProductImage(user?.uid || 'guest-seller', img, newId);
            } catch (err) {
              console.warn("[SellerContext] Product image upload to Storage failed, falling back:", err);
              return img;
            }
          }
          return img;
        })
      );
    }

    const newListing: Listing = {
      id: newId,
      title: payload.title || 'Untitled Listing Draft',
      description: payload.description || '',
      price: typeof payload.price === 'number' ? payload.price : 0,
      currency: 'USD',
      sellerId: user?.uid || 'guest-seller',
      sellerName: user?.displayName || user?.email || 'Proton Merchant',
      images: processedImages,
      image: processedImages[0] || '',
      category: payload.category || 'Digital Assets',
      location: 'Zürich / Global',
      country: 'Switzerland',
      city: 'Zürich',
      createdAt: Date.now(),
      status: (payload.status as any) || 'draft',
      isSold: false,
      listingType: payload.listingType || 'product'
    };

    try {
      const docRef = doc(db, 'listings', newId);
      await setDoc(docRef, newListing);
    } catch (err) {
      console.warn("[SellerContext] Firestore listing save warning (using local state fallback):", err);
    }

    setAllListings(prev => [newListing, ...prev.filter(l => l.id !== newListing.id)]);
    return newListing;
  }, [user]);

  const publishListing = useCallback(async (payload: CreateListingPayload): Promise<Listing> => {
    return createDraftListing({ ...payload, status: payload.status || 'active' });
  }, [createDraftListing]);

  const createOrder = useCallback(async (payload: CreateOrderPayload): Promise<Order> => {
    const newId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `ord-${crypto.randomUUID()}`
      : `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newOrder: Order = {
      id: newId,
      listingId: payload.listingId,
      buyerId: user?.uid || payload.buyerId || 'guest-buyer',
      sellerId: payload.sellerId,
      amount: payload.amount,
      currency: payload.currency || 'USD',
      itemTitle: payload.itemTitle,
      status: 'pending',
      orderType: payload.orderType || 'product',
      buyerInstructions: payload.buyerInstructions || '',
      createdAt: Date.now(),
      source: payload.source,
      clipId: payload.clipId
    };

    try {
      const docRef = doc(db, 'orders', newId);
      const firestoreOrderData = {
        listingId: payload.listingId,
        buyerId: user?.uid || payload.buyerId || 'guest-buyer',
        sellerId: payload.sellerId,
        amount: payload.amount,
        currency: payload.currency || 'USD',
        itemTitle: payload.itemTitle,
        status: 'pending',
        orderType: payload.orderType || 'product',
        buyerInstructions: payload.buyerInstructions || '',
        createdAt: serverTimestamp()
      };
      await setDoc(docRef, firestoreOrderData);
    } catch (err) {
      console.warn("[SellerContext] Firestore create order warning:", err);
    }

    setSellerOrders(prev => [newOrder, ...prev]);
    setBuyerOrders(prev => [newOrder, ...prev]);

    // Also record inbound transaction in ledger if merchant is receiving
    if (user && user.uid === payload.sellerId) {
      const ledgerEntry: LedgerItem = {
        id: `TX-CLIP-${Date.now().toString(36).toUpperCase()}`,
        date: new Date().toISOString().split('T')[0],
        description: `Shoppable Clip Sale: ${payload.itemTitle}`,
        category: 'Clip Video Sales',
        type: 'inbound',
        value: payload.amount,
        volume: 1,
        total: payload.amount,
        status: 'completed',
        operator: `Clip-${payload.clipId || 'tag'}`
      };
      setLedgerItems(prev => [ledgerEntry, ...prev]);
      try {
        const ledgerDocRef = doc(db, 'users', user.uid, 'market_ledger', ledgerEntry.id);
        await setDoc(ledgerDocRef, ledgerEntry);
      } catch (e) {
        console.warn("[SellerContext] Ledger entry save warning:", e);
      }
    }

    return newOrder;
  }, [user]);

  const updateOrderStatus = useCallback(async (orderId: string, status: string) => {
    let updatedOrder: Order | undefined;

    setSellerOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const gross = o.amount || 0;
        const fee = o.platformFee ?? Math.round(gross * 0.05 * 100) / 100;
        const net = o.netAmount ?? (gross - fee);
        updatedOrder = { ...o, status, grossAmount: gross, platformFee: fee, netAmount: net };
        return updatedOrder;
      }
      return o;
    }));
    setBuyerOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));

    if (user) {
      try {
        const docRef = doc(db, 'orders', orderId);
        await setDoc(docRef, { status }, { merge: true });
      } catch (err) {
        console.warn("[SellerContext] DB update order status warning:", err);
      }
    }

    if ((status === 'completed' || status === 'delivered' || status === 'shipped') && updatedOrder) {
      const gross = updatedOrder.amount || 0;
      const fee = updatedOrder.platformFee ?? Math.round(gross * 0.05 * 100) / 100;
      const net = updatedOrder.netAmount ?? (gross - fee);

      const existingTx = ledgerItems.find(item => item.orderId === orderId || item.id === `TX-ORD-${orderId}`);
      if (!existingTx) {
        const ledgerEntry: LedgerItem = {
          id: `TX-ORD-${orderId}`,
          date: new Date().toISOString().split('T')[0],
          description: `Merchant Settlement: ${updatedOrder.itemTitle}`,
          category: 'Merchant Settlement',
          type: 'inbound',
          value: net,
          volume: 1,
          total: net,
          grossAmount: gross,
          platformFee: fee,
          netAmount: net,
          orderId: orderId,
          status: 'completed',
          operator: 'Settlement-Engine'
        };

        setLedgerItems(prev => [ledgerEntry, ...prev.filter(i => i.id !== ledgerEntry.id)]);
        if (user) {
          try {
            const ledgerDocRef = doc(db, 'users', user.uid, 'market_ledger', ledgerEntry.id);
            await setDoc(ledgerDocRef, ledgerEntry);
          } catch (e) {
            console.warn("[SellerContext] Settlement ledger entry save warning:", e);
          }
        }
      }
    }
  }, [user, ledgerItems]);

  const refresh = useCallback(async () => {
    // Manual re-trigger signal if needed
  }, []);

  const value = useMemo(() => ({
    allListings,
    sellerListings,
    sellerOrders,
    buyerOrders,
    ledgerItems,
    loading,
    error,
    refresh,
    addLedgerItem,
    updateLedgerItem,
    deleteLedgerItem,
    createDraftListing,
    publishListing,
    createOrder,
    updateOrderStatus
  }), [
    allListings,
    sellerListings,
    sellerOrders,
    buyerOrders,
    ledgerItems,
    loading,
    error,
    refresh,
    addLedgerItem,
    updateLedgerItem,
    deleteLedgerItem,
    createDraftListing,
    publishListing,
    createOrder,
    updateOrderStatus
  ]);

  return (
    <SellerContext.Provider value={value}>
      {children}
    </SellerContext.Provider>
  );
};

export const useSeller = () => {
  const context = useContext(SellerContext);
  if (context === undefined) {
    throw new Error('useSeller must be used within a SellerProvider');
  }
  return context;
};

export interface SellerStats {
  grossRevenue: number;
  totalPlatformFees: number;
  totalNetRevenue: number;
  taxEstimate: number;
  todayRevenue: number;
  walletBalance: number;
  activeListingCount: number;
  lowStockItems: { id: string; title: string; quantity: number }[];
  pendingOrderCount: number;
  completedOrderCount: number;
  pendingOrders: Order[];
  clipOrdersCount: number;
  clipGrossRevenue: number;
}

export const useSellerStats = (): SellerStats => {
  const { sellerListings, sellerOrders, ledgerItems } = useSeller();

  return useMemo(() => {
    const completedOrders = sellerOrders.filter(o => o.status === 'completed' || o.status === 'shipped' || o.status === 'delivered');
    const pendingOrders = sellerOrders.filter(o => o.status === 'pending' || o.status === 'booked');

    const ordersGross = completedOrders.reduce((sum, o) => sum + (o.grossAmount ?? o.amount ?? 0), 0);
    const ordersFees = completedOrders.reduce((sum, o) => sum + (o.platformFee ?? Math.round((o.amount || 0) * 0.05 * 100) / 100), 0);

    const ledgerInbound = ledgerItems.filter(l => l.type === 'inbound' && l.status === 'completed');
    const ledgerGross = ledgerInbound.reduce((sum, l) => sum + (l.grossAmount ?? l.total ?? ((l.value || 0) * (l.volume || 1))), 0);
    const ledgerFees = ledgerInbound.reduce((sum, l) => sum + (l.platformFee ?? Math.round((l.total || l.value || 0) * 0.05 * 100) / 100), 0);

    const grossRevenue = ordersGross + ledgerGross;
    const totalPlatformFees = ordersFees + ledgerFees;
    const totalNetRevenue = grossRevenue - totalPlatformFees;
    const taxEstimate = Math.round(totalNetRevenue * 0.18 * 100) / 100;

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const todayRevenue = completedOrders
      .filter(o => (o.createdAt || 0) >= oneDayAgo)
      .reduce((sum, o) => sum + (o.grossAmount ?? o.amount ?? 0), 0);

    const outboundLedger = ledgerItems
      .filter(l => l.type === 'outbound' && l.status === 'completed')
      .reduce((sum, l) => sum + (l.total || ((l.value || 0) * (l.volume || 1))), 0);
    const walletBalance = Math.max(0, totalNetRevenue - outboundLedger);

    const activeListings = sellerListings.filter(l => l.status === 'active' || !l.status);
    const activeListingCount = activeListings.length;

    const lowStockItems = sellerListings
      .filter(l => (l.stock !== undefined && l.stock <= 3) || (l.quantity !== undefined && l.quantity <= 3) || l.status === 'low_stock')
      .map(l => ({
        id: l.id,
        title: l.title || l.titleGe || 'Listing Item',
        quantity: l.stock ?? l.quantity ?? 1
      }));

    const clipOrders = sellerOrders.filter(o => o.source === 'clip');
    const clipOrdersCount = clipOrders.length;
    const clipGrossRevenue = clipOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

    return {
      grossRevenue,
      totalPlatformFees,
      totalNetRevenue,
      taxEstimate,
      todayRevenue,
      walletBalance,
      activeListingCount,
      lowStockItems,
      pendingOrderCount: pendingOrders.length,
      completedOrderCount: completedOrders.length,
      pendingOrders,
      clipOrdersCount,
      clipGrossRevenue
    };
  }, [sellerListings, sellerOrders, ledgerItems]);
};
