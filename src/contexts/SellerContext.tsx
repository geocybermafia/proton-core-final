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
  limit 
} from 'firebase/firestore';
import { Listing, Order } from '../types';
import { LedgerItem } from './MarketHubContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface CreateListingPayload {
  title: string;
  description: string;
  images?: string[];
  status?: 'draft' | 'active' | 'sold' | string;
  price?: number;
  category?: string;
  listingType?: 'product' | 'service' | 'project';
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
}

const defaultLedger: LedgerItem[] = [
  {
    id: 'TX-4902',
    date: '2026-06-01',
    description: 'Zürich Tech Hub - UI Suprematist Design License',
    category: 'Design Systems',
    type: 'inbound',
    value: 1250,
    volume: 4,
    total: 5000,
    status: 'completed',
    operator: 'System-Node-Alpha'
  },
  {
    id: 'TX-4903',
    date: '2026-06-01',
    description: 'Geneva Node - AWS Server Outpost Hosting',
    category: 'Infrastructure',
    type: 'outbound',
    value: 850,
    volume: 1,
    total: 850,
    status: 'completed',
    operator: 'Infra-Monitor'
  },
  {
    id: 'TX-4904',
    date: '2026-06-02',
    description: 'Saperavi Wine Export - Smart Contract Retainer',
    category: 'Wine Trade',
    type: 'inbound',
    value: 7500,
    volume: 1,
    total: 7500,
    status: 'completed',
    operator: 'Smart-Contract-VM'
  }
];

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
  const [sellerOrders, setSellerOrders] = useState<Order[]>([]);
  const [buyerOrders, setBuyerOrders] = useState<Order[]>([]);
  const [ledgerItems, setLedgerItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Real-time Marketplace Listings Listener
  useEffect(() => {
    let active = true;

    try {
      const qListings = query(collection(db, 'listings'), limit(100));
      const unsubListings = onSnapshot(qListings, (snapshot) => {
        if (!active) return;
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Listing[];
        setAllListings(data);
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
  }, []);

  // 2. Real-time Orders Listener (Seller & Buyer)
  useEffect(() => {
    if (!user) {
      setSellerOrders([]);
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
        if (active && sData) setSellerOrders(sData as Order[]);

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
        setSellerOrders(data);
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
        if (localData && active) setLedgerItems(JSON.parse(localData));
        else if (active) setLedgerItems(defaultLedger);
      } catch {
        if (active) setLedgerItems(defaultLedger);
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
        Promise.all(defaultLedger.map((item) => {
          const itemDoc = doc(userRef, 'market_ledger', item.id);
          return setDoc(itemDoc, item);
        })).catch((e) => console.warn("[SellerContext] Ledger seed warning:", e));
        if (active) setLedgerItems(defaultLedger);
      } else {
        const items: LedgerItem[] = [];
        snapshot.forEach((d) => items.push(d.data() as LedgerItem));
        items.sort((a, b) => b.id.localeCompare(a.id));
        if (active) setLedgerItems(items);
      }
      if (active) setLoading(false);
    }, (err) => {
      if (!active) return;
      console.warn("[SellerContext] Ledger sync warning:", err);
      try {
        const localData = localStorage.getItem('proton_market_hub_ledger');
        setLedgerItems(localData ? JSON.parse(localData) : defaultLedger);
      } catch {
        setLedgerItems(defaultLedger);
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
        const docRef = doc(db, 'users', user.uid, 'market_ledger', id);
        await setDoc(docRef, newItem);
      } catch (err) {
        console.error("Failed to persist ledger item:", err);
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

    const newListing: Listing = {
      id: newId,
      title: payload.title || 'Untitled Listing Draft',
      description: payload.description || '',
      price: typeof payload.price === 'number' ? payload.price : 0,
      currency: 'USD',
      sellerId: user?.uid || 'guest-seller',
      sellerName: user?.displayName || user?.email || 'Proton Merchant',
      images: payload.images || [],
      image: payload.images?.[0] || '',
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
    publishListing
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
    publishListing
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
