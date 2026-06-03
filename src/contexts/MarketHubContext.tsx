import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { doc, getDoc, setDoc, onSnapshot, collection, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

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
}

interface MarketHubContextType {
  ledgerItems: LedgerItem[];
  loading: boolean;
  addLedgerItem: (item: Omit<LedgerItem, 'id' | 'total'>) => Promise<void>;
  updateLedgerItem: (id: string, updates: Partial<LedgerItem>) => Promise<void>;
  deleteLedgerItem: (id: string) => Promise<void>;
  generateSampleLedger: () => void;
}

const MarketHubContext = createContext<MarketHubContextType | undefined>(undefined);

export const MarketHubProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [ledgerItems, setLedgerItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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
      operator: 'Core-Node-Alpha'
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

  useEffect(() => {
    if (!user) {
      // Offline / LocalStorage mode
      try {
        const localData = localStorage.getItem('proton_market_hub_ledger');
        if (localData) {
          setLedgerItems(JSON.parse(localData));
        } else {
          setLedgerItems(defaultLedger);
          localStorage.setItem('proton_market_hub_ledger', JSON.stringify(defaultLedger));
        }
      } catch (e) {
        setLedgerItems(defaultLedger);
      }
      setLoading(false);
      return;
    }

    // Firebase Persistent Sync
    setLoading(true);
    const userRef = doc(db, 'users', user.uid);
    const ledgerCollection = collection(userRef, 'market_ledger');

    const unsubscribe = onSnapshot(ledgerCollection, (snapshot) => {
      if (snapshot.empty) {
        // Hydrate Firestore with default seed ledger so the spreadsheet is NOT blank
        defaultLedger.forEach(async (item) => {
          const itemDoc = doc(userRef, 'market_ledger', item.id);
          await setDoc(itemDoc, item);
        });
        setLedgerItems(defaultLedger);
      } else {
        const items: LedgerItem[] = [];
        snapshot.forEach((doc) => {
          items.push(doc.data() as LedgerItem);
        });
        // Sort by date or ID
        items.sort((a, b) => b.id.localeCompare(a.id));
        setLedgerItems(items);
      }
      setLoading(false);
    }, (error) => {
      console.error("Firestore Market Ledger Sync Error:", error);
      // Fallback to local
      try {
        const localData = localStorage.getItem('proton_market_hub_ledger');
        setLedgerItems(localData ? JSON.parse(localData) : defaultLedger);
      } catch {
        setLedgerItems(defaultLedger);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Persist to local storage helper for local state robustness
  const saveLocalAndCommit = (items: LedgerItem[]) => {
    setLedgerItems(items);
    localStorage.setItem('proton_market_hub_ledger', JSON.stringify(items));
  };

  const addLedgerItem = async (item: Omit<LedgerItem, 'id' | 'total'>) => {
    const id = `TX-${Math.floor(1000 + Math.random() * 9000)}`;
    const total = item.value * item.volume;
    const newItem: LedgerItem = { ...item, id, total };

    if (user) {
      const docRef = doc(db, 'users', user.uid, 'market_ledger', id);
      await setDoc(docRef, newItem);
    } else {
      const updated = [newItem, ...ledgerItems];
      saveLocalAndCommit(updated);
    }
  };

  const updateLedgerItem = async (id: string, updates: Partial<LedgerItem>) => {
    const originalItem = ledgerItems.find(it => it.id === id);
    if (!originalItem) return;

    const merged = { ...originalItem, ...updates };
    merged.total = (merged.value || 0) * (merged.volume || 1);

    if (user) {
      const docRef = doc(db, 'users', user.uid, 'market_ledger', id);
      await setDoc(docRef, merged);
    } else {
      const updated = ledgerItems.map(item => item.id === id ? merged : item);
      saveLocalAndCommit(updated);
    }
  };

  const deleteLedgerItem = async (id: string) => {
    if (user) {
      const docRef = doc(db, 'users', user.uid, 'market_ledger', id);
      await deleteDoc(docRef);
    } else {
      const updated = ledgerItems.filter(item => item.id !== id);
      saveLocalAndCommit(updated);
    }
  };

  const generateSampleLedger = () => {
    if (user) {
      defaultLedger.forEach(async (item) => {
        const id = `TX-${Math.floor(1000 + Math.random() * 9000)}`;
        const newItem = { ...item, id };
        const docRef = doc(db, 'users', user.uid, 'market_ledger', id);
        await setDoc(docRef, newItem);
      });
    } else {
      const freshList = [...defaultLedger.map(item => ({...item, id: `TX-${Math.floor(1000 + Math.random() * 9000)}`})), ...ledgerItems];
      saveLocalAndCommit(freshList);
    }
  };

  return (
    <MarketHubContext.Provider value={{
      ledgerItems,
      loading,
      addLedgerItem,
      updateLedgerItem,
      deleteLedgerItem,
      generateSampleLedger
    }}>
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
