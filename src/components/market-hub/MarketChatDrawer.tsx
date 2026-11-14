import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Listing } from '../../types';
import { MarketTheme } from './MarketConstants';

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
  const isSellerViewing = user && activeChatListing && user.uid === activeChatListing.sellerId;

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
              "relative w-full max-w-lg sm:rounded-[40px] border border-proton-border overflow-hidden z-10",
              currentTheme.card
            )}
          >
            <div className="p-6 sm:p-10 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-10 space-y-4 flex flex-col h-[85vh] md:h-[620px] max-h-[90vh]">
              {/* Main Chat Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-proton-accent/15 border border-proton-accent/30 flex items-center justify-center font-black text-xs text-proton-accent">
                    {((isSellerViewing ? buyerName : activeChatListing.sellerName) || 'User').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-proton-text">
                      {isSellerViewing
                        ? (language === 'ka' ? 'კავშირი მყიდველთან' : 'Chat with Buyer')
                        : (language === 'ka' ? 'კავშირი გამყიდველთან' : 'Chat with Seller')}
                    </h3>
                    <p className="text-xs text-proton-muted">
                      {isSellerViewing ? (buyerName || 'Buyer') : activeChatListing.sellerName} • {activeChatListing.title}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-3 bg-proton-bg border border-proton-border rounded-2xl hover:bg-proton-accent/10 transition-colors text-proton-text"
                  aria-label={language === 'ka' ? 'დახურვა' : 'Close'}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Order Context Banner (Visually Secondary, Compact) */}
              {activeChatOrder && (
                <div 
                  id="chat-order-context-banner"
                  className="bg-proton-accent/10 border border-proton-accent/25 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-proton-accent/20 border border-proton-accent/30 flex items-center justify-center text-proton-accent shrink-0">
                      <Package size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider text-proton-accent">
                          {language === 'ka' ? 'შეკვეთის შესახებ' : 'Regarding Order'} #{activeChatOrder.orderId.slice(-6).toUpperCase()}
                        </span>
                        {activeChatOrder.status && (
                          <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-proton-card text-proton-text border border-proton-border font-mono">
                            {activeChatOrder.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-proton-muted truncate mt-0.5">
                        {activeChatOrder.itemTitle || activeChatListing.title}
                        {activeChatOrder.amount !== undefined ? ` • ${activeChatOrder.amount} ${activeChatOrder.currency || ''}` : ''}
                      </p>
                    </div>
                  </div>

                  {onViewOrder && (
                    <button
                      type="button"
                      id="chat-view-order-btn"
                      onClick={() => onViewOrder(activeChatOrder.orderId)}
                      className="px-3 py-1.5 rounded-xl bg-proton-card hover:bg-proton-accent/10 text-proton-text text-xs font-black uppercase tracking-wider transition-all border border-proton-border shrink-0 flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <ExternalLink size={11} className="text-proton-accent" />
                      <span>{language === 'ka' ? 'შეკვეთის ნახვა' : 'View Order'}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Subsystem status/Product terms (Only when not in direct order mode to keep UI clean) */}
              {!activeChatOrder && (
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3 flex items-start gap-2.5">
                  <span className="text-sm">💬</span>
                  <div className="text-[11px] font-bold text-amber-500 leading-relaxed uppercase">
                    {language === 'ka' 
                      ? `შეთანხმება: პროდუქტის მდგომარეობა - "${activeChatListing.condition === 'new' ? 'ახალი' : activeChatListing.condition === 'used' ? 'მეორადი' : 'განახლებული'}". ${activeChatListing.isNegotiable ? 'ფასზე შეგიძლიათ ვაჭრობა!' : 'ფასი ფიქსირებულია.'}`
                      : `Inquiry terms: item condition is "${activeChatListing.condition || 'new'}". ${activeChatListing.isNegotiable ? 'Custom offers are welcome!' : 'Fixed pricing matches apply.'}`}
                  </div>
                </div>
              )}

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none bg-proton-bg/60 rounded-2xl p-4 border border-proton-border">
                {messagesList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <span className="text-2xl opacity-50">🤝</span>
                    <p className="text-xs font-bold text-proton-text uppercase tracking-wider">
                      {language === 'ka' ? 'მიწერეთ გამყიდველს' : 'No messages yet'}
                    </p>
                    <p className="text-xs text-proton-muted max-w-xs">
                      {language === 'ka' 
                        ? 'ჰკითხეთ მდგომარეობის ან საბოლოო ფასის შესახებ და დაიწყეთ პირდაპირი მოლაპარაკება.'
                        : 'Inquire about item availability, delivery, or state custom quotes.'}
                    </p>
                  </div>
                ) : (
                  messagesList.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={cn(
                        "flex flex-col max-w-[85%] rounded-xl p-4 text-xs font-medium space-y-1",
                        msg.senderId === user?.uid 
                          ? "bg-proton-accent text-proton-on-accent ml-auto rounded-tr-none shadow-md" 
                          : "bg-proton-card text-proton-text border border-proton-border mr-auto rounded-tl-none shadow-sm"
                      )}
                    >
                      <div className="flex items-center justify-between gap-4 text-[11px] font-black uppercase tracking-wider opacity-75">
                        <span>{msg.senderName}</span>
                        <span>
                          {msg.createdAt?.seconds 
                            ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'Just now'}
                        </span>
                      </div>
                      <p className="break-all whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Send message form */}
              <form onSubmit={onSendMessage} className="flex gap-2">
                <input 
                  type="text"
                  value={chatMessageText}
                  onChange={(e) => onChangeChatMessageText(e.target.value)}
                  placeholder={language === 'ka' ? 'დაწერეთ შეთავაზება...' : 'Propose price or ask a question...'}
                  className={cn("flex-1 px-5 py-4 rounded-xl border text-xs font-bold focus:outline-none", currentTheme.input)}
                />
                <button 
                  type="submit"
                  className={cn("px-5 py-4 font-black text-xs uppercase tracking-wider rounded-xl active:scale-95 transition-all flex items-center gap-2 shadow-md cursor-pointer", currentTheme.accentBg)}
                >
                  <span>{language === 'ka' ? 'გაგზავნა' : 'Send'}</span>
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});
