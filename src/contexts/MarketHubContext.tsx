import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { doc, setDoc, onSnapshot, collection, deleteDoc } from 'firebase/firestore';
import { executeSecureTransaction } from '../services/cloudFunctionsService';

export interface LedgerItem {
  id: string;
  date: string;
  description: string;
  category: string;
  type: 'inbound' | 'outbound';
  value: number;
  volume: number;
  total: number;
  status: 'active' | 'completed' | 'pending';
  operator: string;
  grossAmount?: number;
  platformFee?: number;
  netAmount?: number;
  orderId?: string;
}

interface MarketHubContextType {
  ledgerItems: LedgerItem[];
  loading: boolean;
  addLedgerItem: (item: Omit<LedgerItem, 'id' | 'total'>) => Promise<void>;
  updateLedgerItem: (id: string, updates: Partial<LedgerItem>) => Promise<void>;
  deleteLedgerItem: (id: string) => Promise<void>;
  generateSampleLedger: () => void;
}

const generateTxId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `TX-${crypto.randomUUID()}`;
  }
  return `TX-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
};

// Helper to validate and reject any legacy fake/demo/seed entries
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

// Pre-configured default seed data for Swiss Minimalist style
const defaultLedger: LedgerItem[] = [];

const MarketHubContext = createContext<MarketHubContextType | undefined>(undefined);

export const MarketHubProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [ledgerItems, setLedgerItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isSubscribed = true;

    if (!user) {
      // Offline / LocalStorage mode
      try {
        const localData = localStorage.getItem('proton_market_hub_ledger');
        if (localData) {
          const parsed = JSON.parse(localData) as LedgerItem[];
          const clean = Array.isArray(parsed) ? parsed.filter(isRealLedgerItem) : [];
          if (isSubscribed) setLedgerItems(clean);
          if (clean.length === 0) {
            localStorage.removeItem('proton_market_hub_ledger');
          } else {
            localStorage.setItem('proton_market_hub_ledger', JSON.stringify(clean));
          }
        } else {
          if (isSubscribed) {
            setLedgerItems([]);
            localStorage.removeItem('proton_market_hub_ledger');
          }
        }
      } catch (e) {
        if (isSubscribed) setLedgerItems([]);
      }
      if (isSubscribed) setLoading(false);
      return () => {
        isSubscribed = false;
      };
    }

    // Reset ledger state during authorization transition to prevent transient state pollution
    setLoading(true);
    setLedgerItems([]);

    const userRef = doc(db, 'users', user.uid);
    const ledgerCollection = collection(userRef, 'market_ledger');

    const unsubscribe = onSnapshot(ledgerCollection, (snapshot) => {
      if (!isSubscribed) return;

      if (snapshot.empty) {
        if (isSubscribed) setLedgerItems([]);
      } else {
        const items: LedgerItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as LedgerItem;
          if (isRealLedgerItem(data)) {
            items.push(data);
          } else {
            // Delete legacy seed entry permanently from user's Firestore
            try {
              const deadDoc = doc(db, 'users', user.uid, 'market_ledger', docSnap.id);
              deleteDoc(deadDoc).catch(() => {});
            } catch {}
          }
        });
        // Sort by date or ID
        items.sort((a, b) => b.id.localeCompare(a.id));
        if (isSubscribed) setLedgerItems(items);
      }
      if (isSubscribed) setLoading(false);
    }, (error) => {
      if (!isSubscribed) return;
      console.error("Firestore Market Ledger Sync Error:", error);
      // Fallback to local
      try {
        const localData = localStorage.getItem('proton_market_hub_ledger');
        if (localData) {
          const parsed = JSON.parse(localData) as LedgerItem[];
          const clean = Array.isArray(parsed) ? parsed.filter(isRealLedgerItem) : [];
          if (isSubscribed) setLedgerItems(clean);
        } else {
          if (isSubscribed) setLedgerItems([]);
        }
      } catch {
        if (isSubscribed) setLedgerItems([]);
      }
      if (isSubscribed) setLoading(false);
    });

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [user]);

  // Persist to local storage helper for local state robustness
  const saveLocalAndCommit = useCallback((items: LedgerItem[]) => {
    setLedgerItems(items);
    localStorage.setItem('proton_market_hub_ledger', JSON.stringify(items));
  }, []);

  const addLedgerItem = useCallback(async (item: Omit<LedgerItem, 'id' | 'total'>) => {
    const id = generateTxId();
    const total = item.value * item.volume;
    const newItem: LedgerItem = { ...item, id, total };

    let previousLedger: LedgerItem[] = [];
    setLedgerItems((prev) => {
      previousLedger = prev;
      const updated = [newItem, ...prev];
      localStorage.setItem('proton_market_hub_ledger', JSON.stringify(updated));
      return updated;
    });

    if (user) {
      try {
        await executeSecureTransaction({
          buyerId: user.uid,
          sellerId: user.uid,
          amount: Math.max(0.01, total || item.value || 1),
          itemTitle: item.description || 'Market Hub Ledger Entry',
          type: item.type === 'outbound' ? 'PAYOUT' : 'DEPOSIT'
        });
      } catch (error) {
        console.error("Failed to add ledger item via Cloud Function, rolling back:", error);
        setLedgerItems(previousLedger);
        localStorage.setItem('proton_market_hub_ledger', JSON.stringify(previousLedger));
        throw error;
      }
    }
  }, [user]);

  const updateLedgerItem = useCallback(async (id: string, updates: Partial<LedgerItem>) => {
    let previousLedger: LedgerItem[] = [];
    let mergedItem: LedgerItem | undefined;

    setLedgerItems((prev) => {
      previousLedger = prev;
      const originalItem = prev.find(it => it.id === id);
      if (!originalItem) return prev;

      mergedItem = { ...originalItem, ...updates };
      mergedItem.total = (mergedItem.value || 0) * (mergedItem.volume || 1);

      const updated = prev.map(item => item.id === id ? mergedItem! : item);
      localStorage.setItem('proton_market_hub_ledger', JSON.stringify(updated));
      return updated;
    });

    if (!mergedItem) return;

    if (user) {
      try {
        const docRef = doc(db, 'users', user.uid, 'market_ledger', id);
        await setDoc(docRef, mergedItem);
      } catch (error) {
        console.error("Failed to update ledger item in Firestore, rolling back:", error);
        setLedgerItems(previousLedger);
        localStorage.setItem('proton_market_hub_ledger', JSON.stringify(previousLedger));
        throw error;
      }
    }
  }, [user]);

  const deleteLedgerItem = useCallback(async (id: string) => {
    let previousLedger: LedgerItem[] = [];

    setLedgerItems((prev) => {
      previousLedger = prev;
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem('proton_market_hub_ledger', JSON.stringify(updated));
      return updated;
    });

    if (user) {
      try {
        const docRef = doc(db, 'users', user.uid, 'market_ledger', id);
        await deleteDoc(docRef);
      } catch (error) {
        console.error("Failed to delete ledger item from Firestore, rolling back:", error);
        setLedgerItems(previousLedger);
        localStorage.setItem('proton_market_hub_ledger', JSON.stringify(previousLedger));
        throw error;
      }
    }
  }, [user]);

  const generateSampleLedger = useCallback(() => {
    if (user) {
      defaultLedger.forEach(async (item) => {
        const id = generateTxId();
        const newItem = { ...item, id };
        const docRef = doc(db, 'users', user.uid, 'market_ledger', id);
        await setDoc(docRef, newItem).catch(e => console.warn("Sample item set failed:", e));
      });
    } else {
      setLedgerItems(prev => {
        const freshList = [...defaultLedger.map(item => ({ ...item, id: generateTxId() })), ...prev];
        localStorage.setItem('proton_market_hub_ledger', JSON.stringify(freshList));
        return freshList;
      });
    }
  }, [user, ledgerItems, saveLocalAndCommit]);

  const value = useMemo(() => ({
    ledgerItems,
    loading,
    addLedgerItem,
    updateLedgerItem,
    deleteLedgerItem,
    generateSampleLedger
  }), [ledgerItems, loading, addLedgerItem, updateLedgerItem, deleteLedgerItem, generateSampleLedger]);

  return (
    <MarketHubContext.Provider value={value}>
      {children}
    </MarketHubContext.Provider>
  );
};

export const useMarketHub = () => {
  const context = useContext(MarketHubContext);
  if (context === undefined) {
    throw new Error('useMarketHub must be used within a MarketHubProvider');
  }
  return context;
};
