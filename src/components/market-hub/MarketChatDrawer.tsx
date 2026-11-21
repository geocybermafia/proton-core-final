import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Listing } from '../../types';
import { MarketTheme } from './MarketConstants';
import { ChatThreadHeader } from './chat/ChatThreadHeader';
import { ChatMessageList } from './chat/ChatMessageList';
import { ChatComposer } from './chat/ChatComposer';

export interface MarketChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  orderId?: string;
  createdAt?: { seconds?: number };
}

export interface MarketChatOrderContext {
  orderId: string;
  buyerId?: string;
  sellerId?: string;
  listingId?: string;
  itemTitle?: string;
  amount?: number;
  currency?: string;
  status?: string;
}

export interface MarketChatDrawerProps {
  activeChatListing: Listing | null;
  activeChatOrder?: MarketChatOrderContext | null;
  onClose: () => void;
  onViewOrder?: (orderId: string) => void;
  chatModalRef?: React.Ref<HTMLDivElement>;
  language: string;
  currentTheme: MarketTheme;
  user: { uid: string } | null;
  messagesList: MarketChatMessage[];
  chatMessageText: string;
  onChangeChatMessageText: (text: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
  buyerName?: string;
}

export const MarketChatDrawer = React.memo(function MarketChatDrawer({
  activeChatListing,
  activeChatOrder,
  onClose,
  onViewOrder,
  chatModalRef,
  language,
  currentTheme,
  user,
  messagesList,
  chatMessageText,
  onChangeChatMessageText,
  onSendMessage,
  buyerName
}: MarketChatDrawerProps) {
  const isSellerViewing = Boolean(user && activeChatListing && user.uid === activeChatListing.sellerId);

  return (
    <AnimatePresence>
      {activeChatListing && (
        <div
          className="fixed inset-0 z-[170] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={
            activeChatOrder
              ? (language === 'ka' ? `შეკვეთის ჩატი #${activeChatOrder.orderId.slice(-6)}` : `Order Chat #${activeChatOrder.orderId.slice(-6)}`)
              : (language === 'ka' ? 'კავშირი გამყიდველთან' : 'Chat with Seller')
          }
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            ref={chatModalRef}
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className={cn(
              'relative w-full max-w-lg rounded-t-[32px] sm:rounded-[40px] border border-proton-border overflow-hidden z-10',
              currentTheme.card
            )}
          >
            <div className="p-3.5 sm:p-6 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] sm:pb-6 gap-2.5 sm:gap-3.5 flex flex-col h-[100dvh] sm:h-[620px] sm:max-h-[90vh] min-h-0">
              <ChatThreadHeader
                listing={activeChatListing}
                order={activeChatOrder}
                currentUserId={user?.uid}
                buyerName={buyerName}
                language={language}
                currentTheme={currentTheme}
                onClose={onClose}
                onViewOrder={onViewOrder}
                showInquiryTerms={true}
              />

              <ChatMessageList
                messages={messagesList}
                currentUserId={user?.uid}
                isSellerViewing={isSellerViewing}
                language={language}
                emptyStateAction={onChangeChatMessageText}
                conversationKey={`${activeChatListing.id}_${activeChatOrder?.orderId || ''}`}
              />

              <ChatComposer
                value={chatMessageText}
                onChange={onChangeChatMessageText}
                onSubmit={onSendMessage}
                language={language}
                currentTheme={currentTheme}
                placeholder={
                  language === 'ka'
                    ? 'დაწერეთ შეთავაზება ან შეკითხვა...'
                    : 'Propose a price or ask a question...'
                }
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

