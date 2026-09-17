import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { 
  collection, 
  doc, 
  getDoc,
  query, 
  where, 
  onSnapshot, 
  setDoc, 
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

const generateTxId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `TX-${crypto.randomUUID()}`;
  }
  return `TX-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Validates order status transitions strictly against business rules and Firestore rules.
 * Physical transitions: pending -> processing -> shipped -> completed
 * Service transitions:  booked -> in_progress -> completed
 * Permitted cancellations / refunds:
 * Seller: pending/booked -> cancelled/refunded
 * Buyer:  pending/booked -> cancelled, shipped -> completed
 */
const isValidStatusTransition = (
  currentStatus: string,
  newStatus: string,
  isSeller: boolean,
  isBuyer: boolean
): boolean => {
  if (currentStatus === newStatus) return false;

  // Seller transitions
  if (isSeller) {
    // Physical product: pending -> processing
    if (currentStatus === 'pending' && (newStatus === 'processing' || newStatus === 'cancelled' || newStatus === 'refunded')) {
      return true;
    }
    // Physical product: processing -> shipped
    if (currentStatus === 'processing' && newStatus === 'shipped') {
      return true;
    }
    // Service: booked -> in_progress
    if (currentStatus === 'booked' && (newStatus === 'in_progress' || newStatus === 'cancelled' || newStatus === 'refunded')) {
      return true;
    }
    // Service: in_progress -> completed
    if (currentStatus === 'in_progress' && newStatus === 'completed') {
      return true;
    }
  }

  // Buyer transitions
  if (isBuyer) {
    // Delivery receipt: shipped -> completed
    if (currentStatus === 'shipped' && newStatus === 'completed') {
      return true;
    }
    // Cancellation before processing: pending or booked -> cancelled
    if ((currentStatus === 'pending' || currentStatus === 'booked') && newStatus === 'cancelled') {
      return true;
    }
  }

  return false;
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

  // 3. Real-time Ledger Listener (Read-only subscription)
  useEffect(() => {
    let active = true;

    if (!user) {
      setLedgerItems([]);
      setLoading(false);
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
          }
        });
        items.sort((a, b) => b.id.localeCompare(a.id));
        if (active) setLedgerItems(items);
      }
      if (active) setLoading(false);
    }, (err) => {
      if (!active) return;
      console.warn("[SellerContext] Ledger sync warning:", err);
      setLedgerItems([]);
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

  /**
   * Financial ledger entry creation.
   * Only allowed when it genuinely represents a supported financial transaction type (PAYOUT or DEPOSIT)
   * handled via the secure Cloud Function `executeSecureTransaction`.
   * Direct client-side writes to Firestore `users/{uid}/market_ledger` are strictly removed.
   */
  const addLedgerItem = useCallback(async (item: Omit<LedgerItem, 'id' | 'total'>) => {
    const id = generateTxId();
    const total = (item.value || 0) * (item.volume || 1);
    const newItem: LedgerItem = { ...item, id, total };

    const previous = ledgerItems;
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
        console.error("[SellerContext] Failed to execute secure financial transaction via Cloud Functions:", err);
        setLedgerItems(previous);
        setError(err instanceof Error ? err.message : 'Financial transaction failed');
        throw err;
      }
    }
  }, [user, ledgerItems]);

  /**
   * Ledger items are immutable on the client; direct client writes are prohibited by Firestore rules.
   */
  const updateLedgerItem = useCallback(async (id: string, _updates: Partial<LedgerItem>) => {
    console.warn(`[SellerContext] Ledger item '${id}' cannot be modified. Financial ledger records are immutable and read-only on the client.`);
    throw new Error('Ledger records are immutable and cannot be updated directly from the client.');
  }, []);

  /**
   * Ledger items cannot be deleted directly from the client; direct client writes are prohibited by Firestore rules.
   */
  const deleteLedgerItem = useCallback(async (id: string) => {
    console.warn(`[SellerContext] Ledger item '${id}' cannot be deleted. Financial ledger records are immutable and read-only on the client.`);
    throw new Error('Ledger records are immutable and cannot be deleted directly from the client.');
  }, []);

  /**
   * Creates a draft listing.
   * If status === 'draft' OR price <= 0:
   *  - Does NOT call Firestore setDoc()
   *  - Keeps the draft only in local React state
   *  - Does NOT introduce IndexedDB/localStorage
   *  - Returns the local draft object
   */
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

    const price = typeof payload.price === 'number' ? payload.price : 0;
    const status = payload.status || 'draft';

    const localListing: Listing = {
      id: newId,
      title: payload.title || 'Untitled Listing Draft',
      description: payload.description || '',
      price,
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
      status: status as any,
      isSold: false,
      listingType: payload.listingType || 'product'
    };

    // If status is 'draft' or price <= 0: Keep draft purely in local React state without calling Firestore setDoc
    if (status === 'draft' || price <= 0) {
      setAllListings(prev => [localListing, ...prev.filter(l => l.id !== localListing.id)]);
      return localListing;
    }

    // If active and price > 0, delegate to publishListing
    return publishListing(payload);
  }, [user]);

  /**
   * Publishes an active listing to Firestore.
   * Requires:
   *  - authenticated user
   *  - status === 'active'
   *  - price > 0
   * Uses user.uid as sellerId and serverTimestamp() for createdAt on Firestore.
   */
  const publishListing = useCallback(async (payload: CreateListingPayload): Promise<Listing> => {
    if (!user) {
      const err = new Error('Authentication required to publish a listing');
      console.error("[SellerContext] Publish listing error:", err);
      setError(err.message);
      throw err;
    }

    const price = typeof payload.price === 'number' ? payload.price : 0;
    if (price <= 0) {
      const err = new Error('Listing price must be strictly positive to publish');
      console.error("[SellerContext] Publish listing error:", err);
      setError(err.message);
      throw err;
    }

    const newId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `lst-${crypto.randomUUID()}`
      : `lst-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    let processedImages: string[] = [];
    if (payload.images && payload.images.length > 0) {
      processedImages = await Promise.all(
        payload.images.map(async (img) => {
          if (typeof img === 'string' && img.startsWith('data:')) {
            try {
              return await uploadProductImage(user.uid, img, newId);
            } catch (err) {
              console.warn("[SellerContext] Product image upload to Storage failed, falling back:", err);
              return img;
            }
          }
          return img;
        })
      );
    }

    const title = payload.title?.trim() || 'Untitled Listing';
    const category = payload.category?.trim() || 'Digital Assets';
    const description = payload.description || '';
    const image = processedImages[0] || '';
    const listingType = payload.listingType || 'product';

    const firestoreListingData = {
      title,
      price,
      sellerId: user.uid,
      sellerName: user.displayName || user.email || 'Proton Merchant',
      category,
      country: 'Switzerland',
      city: 'Zürich',
      location: 'Zürich / Global',
      description,
      image,
      images: processedImages,
      status: 'active',
      isSold: false,
      currency: 'USD',
      listingType,
      createdAt: serverTimestamp()
    };

    const localListing: Listing = {
      id: newId,
      title,
      description,
      price,
      currency: 'USD',
      sellerId: user.uid,
      sellerName: user.displayName || user.email || 'Proton Merchant',
      images: processedImages,
      image,
      category,
      location: 'Zürich / Global',
      country: 'Switzerland',
      city: 'Zürich',
      createdAt: Date.now(),
      status: 'active',
      isSold: false,
      listingType
    };

    try {
      const docRef = doc(db, 'listings', newId);
      await setDoc(docRef, firestoreListingData);
      setAllListings(prev => [localListing, ...prev.filter(l => l.id !== localListing.id)]);
      return localListing;
    } catch (err: any) {
      console.error("[SellerContext] Firestore publish listing failed:", err);
      setError(err instanceof Error ? err.message : 'Failed to publish listing to Firestore');
      throw err;
    }
  }, [user]);

  /**
   * Creates an order securely.
   * Verifies listing directly from Firestore:
   *  - Derives authoritative amount from listing.price
   *  - Derives authoritative sellerId from listing.sellerId
   *  - Derives authoritative buyerId from authenticated user.uid
   *  - Uses serverTimestamp() for Firestore document
   *  - Removes client-side ledger writes
   */
  const createOrder = useCallback(async (payload: CreateOrderPayload): Promise<Order> => {
    if (!user) {
      const err = new Error('Authentication required to create an order');
      console.error("[SellerContext] Create order error:", err);
      setError(err.message);
      throw err;
    }

    if (!payload.listingId) {
      const err = new Error('Listing ID is required to create an order');
      console.error("[SellerContext] Create order error:", err);
      setError(err.message);
      throw err;
    }

    // Fetch authoritative listing document from Firestore
    const listingRef = doc(db, 'listings', payload.listingId);
    const listingSnap = await getDoc(listingRef);
    if (!listingSnap.exists()) {
      const err = new Error(`Listing '${payload.listingId}' not found`);
      console.error("[SellerContext] Create order error:", err);
      setError(err.message);
      throw err;
    }

    const listingData = listingSnap.data() as Listing;
    const authPrice = typeof listingData.price === 'number' ? listingData.price : 0;
    const authSellerId = listingData.sellerId;
    const authStatus = listingData.status || 'active';

    if (authStatus === 'sold' || (listingData as any).isSold) {
      const err = new Error('Listing is already sold and unavailable for purchase');
      console.error("[SellerContext] Create order error:", err);
      setError(err.message);
      throw err;
    }

    if (authPrice <= 0) {
      const err = new Error('Listing does not have a valid positive price');
      console.error("[SellerContext] Create order error:", err);
      setError(err.message);
      throw err;
    }

    if (!authSellerId) {
      const err = new Error('Listing is missing authoritative seller information');
      console.error("[SellerContext] Create order error:", err);
      setError(err.message);
      throw err;
    }

    if (authSellerId === user.uid) {
      const err = new Error('Cannot purchase your own listing');
      console.error("[SellerContext] Create order error:", err);
      setError(err.message);
      throw err;
    }

    const newId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `ord-${crypto.randomUUID()}`
      : `ord-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const orderType = payload.orderType || (listingData.listingType === 'service' ? 'service' : 'product');
    const initialStatus = orderType === 'service' ? 'booked' : 'pending';
    const currency = (listingData.currency || payload.currency || 'USD').substring(0, 10);
    const itemTitle = (listingData.title || payload.itemTitle || 'Marketplace Item').substring(0, 200);
    const buyerInstructions = (payload.buyerInstructions || '').substring(0, 500);

    const firestoreOrderData: Record<string, any> = {
      listingId: payload.listingId,
      buyerId: user.uid,
      sellerId: authSellerId,
      amount: authPrice,
      currency,
      itemTitle,
      status: initialStatus,
      orderType,
      buyerInstructions,
      createdAt: serverTimestamp()
    };

    if (payload.source) firestoreOrderData.source = payload.source;
    if (payload.clipId) firestoreOrderData.clipId = payload.clipId;

    const newOrder: Order = {
      id: newId,
      listingId: payload.listingId,
      buyerId: user.uid,
      sellerId: authSellerId,
      amount: authPrice,
      currency,
      itemTitle,
      status: initialStatus as any,
      orderType,
      buyerInstructions,
      createdAt: Date.now(),
      source: payload.source,
      clipId: payload.clipId
    };

    try {
      const docRef = doc(db, 'orders', newId);
      await setDoc(docRef, firestoreOrderData);
      setSellerOrders(prev => [newOrder, ...prev.filter(o => o.id !== newId)]);
      setBuyerOrders(prev => [newOrder, ...prev.filter(o => o.id !== newId)]);
      return newOrder;
    } catch (err: any) {
      console.error("[SellerContext] Firestore create order failed:", err);
      setError(err instanceof Error ? err.message : 'Failed to create order in Firestore');
      throw err;
    }
  }, [user]);

  /**
   * Updates order status with strict transition validation and state rollback.
   */
  const updateOrderStatus = useCallback(async (orderId: string, status: string) => {
    const existingOrder = sellerOrders.find(o => o.id === orderId) || buyerOrders.find(o => o.id === orderId);
    if (!existingOrder) {
      const err = new Error(`Order ${orderId} not found`);
      console.error("[SellerContext] Update order status error:", err);
      throw err;
    }

    const currentStatus = existingOrder.status;
    const isSeller = !!user && user.uid === existingOrder.sellerId;
    const isBuyer = !!user && user.uid === existingOrder.buyerId;

    if (!isValidStatusTransition(currentStatus, status, isSeller, isBuyer)) {
      const err = new Error(
        `Invalid status transition from '${currentStatus}' to '${status}' for role ${isSeller ? 'seller' : isBuyer ? 'buyer' : 'unauthorized'}`
      );
      console.error("[SellerContext] Order transition rejected:", err);
      throw err;
    }

    // Save previous state for rollback on error
    const prevSellerOrders = sellerOrders;
    const prevBuyerOrders = buyerOrders;

    // Optimistically update local state without altering financial fields
    setSellerOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: status as any } : o));
    setBuyerOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: status as any } : o));

    if (user) {
      try {
        const docRef = doc(db, 'orders', orderId);
        await setDoc(docRef, { status }, { merge: true });
      } catch (err: any) {
        console.error("[SellerContext] Firestore order status update failed, rolling back:", err);
        setSellerOrders(prevSellerOrders);
        setBuyerOrders(prevBuyerOrders);
        setError(err instanceof Error ? err.message : 'Failed to update order status');
        throw err;
      }
    }
  }, [user, sellerOrders, buyerOrders]);

  const refresh = useCallback(async () => {
    // Re-trigger signals handled via active onSnapshot listeners
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
    const safeOrders = Array.isArray(sellerOrders) ? sellerOrders : [];
    const safeListings = Array.isArray(sellerListings) ? sellerListings : [];
    const safeLedger = Array.isArray(ledgerItems) ? ledgerItems : [];

    const completedOrders = safeOrders.filter(o => o && (o.status === 'completed' || o.status === 'shipped' || o.status === 'delivered'));
    const pendingOrders = safeOrders.filter(o => o && (o.status === 'pending' || o.status === 'booked'));

    const ordersGross = completedOrders.reduce((sum, o) => sum + (o?.grossAmount ?? o?.amount ?? 0), 0);
    const ordersFees = completedOrders.reduce((sum, o) => sum + (o?.platformFee ?? Math.round((o?.amount || 0) * 0.05 * 100) / 100), 0);

    const ledgerInbound = safeLedger.filter(l => l && l.type === 'inbound' && l.status === 'completed');
    const ledgerGross = ledgerInbound.reduce((sum, l) => sum + (l?.grossAmount ?? l?.total ?? ((l?.value || 0) * (l?.volume || 1))), 0);
    const ledgerFees = ledgerInbound.reduce((sum, l) => sum + (l?.platformFee ?? Math.round(((l?.total || l?.value || 0)) * 0.05 * 100) / 100), 0);

    const grossRevenue = ordersGross + ledgerGross;
    const totalPlatformFees = ordersFees + ledgerFees;
    const totalNetRevenue = grossRevenue - totalPlatformFees;
    const taxEstimate = Math.round(totalNetRevenue * 0.18 * 100) / 100;

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const todayRevenue = completedOrders
      .filter(o => {
        const rawTime = o?.createdAt;
        const timeNum = typeof rawTime === 'number' ? rawTime : (rawTime ? new Date(rawTime).getTime() || 0 : 0);
        return timeNum >= oneDayAgo;
      })
      .reduce((sum, o) => sum + (o?.grossAmount ?? o?.amount ?? 0), 0);

    const outboundLedger = safeLedger
      .filter(l => l && l.type === 'outbound' && l.status === 'completed')
      .reduce((sum, l) => sum + (l?.total || ((l?.value || 0) * (l?.volume || 1))), 0);
    const walletBalance = Math.max(0, totalNetRevenue - outboundLedger);

    const activeListings = safeListings.filter(l => l && (l.status === 'active' || !l.status));
    const activeListingCount = activeListings.length;

    const lowStockItems = safeListings
      .filter(l => l && ((l.stock !== undefined && l.stock <= 3) || (l.quantity !== undefined && l.quantity <= 3) || l.status === 'low_stock'))
      .map(l => ({
        id: l.id,
        title: l.title || l.titleGe || 'Listing Item',
        quantity: l.stock ?? l.quantity ?? 1
      }));

    const clipOrders = safeOrders.filter(o => o && o.source === 'clip');
    const clipOrdersCount = clipOrders.length;
    const clipGrossRevenue = clipOrders.reduce((sum, o) => sum + (o?.amount || 0), 0);

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
