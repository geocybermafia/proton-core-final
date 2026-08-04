import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { doc, setDoc, onSnapshot, collection, deleteDoc } from 'firebase/firestore';

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

// Pre-configured default seed data for Swiss Minimalist style
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
  },
  {
    id: 'TX-4905',
    date: '2026-06-02',
    description: 'Cybersecurity Penetration Test - Tbilisi Cafes',
    category: 'Security',
    type: 'inbound',
    value: 1200,
    volume: 3,
    total: 3600,
    status: 'pending',
    operator: 'Sec-Net-Watcher'
  },
  {
    id: 'TX-4906',
    date: '2026-06-02',
    description: 'Vite & React 19 Upgrade Engineering Services',
    category: 'Development',
    type: 'outbound',
    value: 3200,
    volume: 1,
    total: 3200,
    status: 'active',
    operator: 'Antigravity-C-Dev'
  }
];

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
          if (isSubscribed) setLedgerItems(JSON.parse(localData));
        } else {
          if (isSubscribed) {
            setLedgerItems(defaultLedger);
            localStorage.setItem('proton_market_hub_ledger', JSON.stringify(defaultLedger));
          }
        }
      } catch (e) {
        if (isSubscribed) setLedgerItems(defaultLedger);
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
        // Hydrate Firestore with default seed ledger so the spreadsheet is NOT blank
        Promise.all(defaultLedger.map((item) => {
          const itemDoc = doc(userRef, 'market_ledger', item.id);
          return setDoc(itemDoc, item);
        })).catch((e) => console.warn("Market ledger initial seed failed:", e));
        if (isSubscribed) setLedgerItems(defaultLedger);
      } else {
        const items: LedgerItem[] = [];
        snapshot.forEach((doc) => {
          items.push(doc.data() as LedgerItem);
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
        if (isSubscribed) setLedgerItems(localData ? JSON.parse(localData) : defaultLedger);
      } catch {
        if (isSubscribed) setLedgerItems(defaultLedger);
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
        const docRef = doc(db, 'users', user.uid, 'market_ledger', id);
        await setDoc(docRef, newItem);
      } catch (error) {
        console.error("Failed to add ledger item to Firestore, rolling back:", error);
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
