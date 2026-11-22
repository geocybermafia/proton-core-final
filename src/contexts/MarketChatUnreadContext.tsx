import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import {
  createMarketConversationsSubscriptionCoordinator,
  INITIAL_MARKET_CHAT_UNREAD_STATE,
  MarketChatUnreadState,
  MarketConversationRecord,
} from '../lib/marketChatUnread';

export interface MarketChatUnreadContextValue extends MarketChatUnreadState {
  getConversationUnreadCount: (conversationId: string | null | undefined) => number;
  hasConversationRecord: (conversationId: string | null | undefined) => boolean;
}

const MarketChatUnreadContext = createContext<MarketChatUnreadContextValue | undefined>(undefined);

export const MarketChatUnreadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [state, setState] = useState<MarketChatUnreadState>(INITIAL_MARKET_CHAT_UNREAD_STATE);
  const coordinatorRef = useRef<ReturnType<typeof createMarketConversationsSubscriptionCoordinator> | null>(null);

  if (!coordinatorRef.current) {
    coordinatorRef.current = createMarketConversationsSubscriptionCoordinator(
      (uid, onDocs, onError) => {
        const q = query(
          collection(db, 'market_conversations'),
          where('participants', 'array-contains', uid),
          orderBy('lastMessageAt', 'desc'),
          limit(100)
        );

        return onSnapshot(
          q,
          (snapshot) => {
            const docs = snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as Partial<MarketConversationRecord>),
            }));
            onDocs(docs);
          },
          (err) => {
            console.warn('[MarketChatUnreadContext] Listener error on market_conversations:', err);
            onError(err);
          }
        );
      },
      (nextState) => {
        setState(nextState);
      }
    );
  }

  useEffect(() => {
    coordinatorRef.current?.setUser(user?.uid ?? null);
  }, [user?.uid]);

  useEffect(() => {
    return () => {
      coordinatorRef.current?.dispose();
    };
  }, []);

  const getConversationUnreadCount = useCallback(
    (conversationId: string | null | undefined): number => {
      if (!conversationId) return 0;
      return state.unreadByConversationId[conversationId] ?? 0;
    },
    [state.unreadByConversationId]
  );

  const hasConversationRecord = useCallback(
    (conversationId: string | null | undefined): boolean => {
      if (!conversationId) return false;
      return Boolean(state.conversationsById[conversationId]);
    },
    [state.conversationsById]
  );

  const value = useMemo<MarketChatUnreadContextValue>(
    () => ({
      ...state,
      getConversationUnreadCount,
      hasConversationRecord,
    }),
    [state, getConversationUnreadCount, hasConversationRecord]
  );

  return (
    <MarketChatUnreadContext.Provider value={value}>
      {children}
    </MarketChatUnreadContext.Provider>
  );
};

export function useMarketChatUnread(): MarketChatUnreadContextValue {
  const ctx = useContext(MarketChatUnreadContext);
  if (ctx === undefined) {
    throw new Error('useMarketChatUnread must be used within a MarketChatUnreadProvider');
  }
  return ctx;
}
