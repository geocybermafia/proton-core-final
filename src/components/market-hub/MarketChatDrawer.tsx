import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Listing } from '../../types';
import { MarketTheme } from './MarketConstants';

export interface MarketChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt?: { seconds?: number };
}

export interface MarketChatDrawerProps {
  activeChatListing: Listing | null;
  onClose: () => void;
  chatModalRef?: React.Ref<HTMLDivElement>;
  language: string;
  currentTheme: MarketTheme;
  user: { uid: string } | null;
  messagesList: MarketChatMessage[];
  chatMessageText: string;
  onChangeChatMessageText: (text: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
}

export const MarketChatDrawer = React.memo(function MarketChatDrawer({
  activeChatListing,
  onClose,
  chatModalRef,
  language,
  currentTheme,
  user,
  messagesList,
  chatMessageText,
  onChangeChatMessageText,
  onSendMessage
}: MarketChatDrawerProps) {
  return (
    <AnimatePresence>
      {activeChatListing && (
        <div 
          className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={language === 'ka' ? 'კავშირი გამყიდველთან' : 'Chat with Seller'}
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
              "relative w-full max-w-lg sm:rounded-[40px] border border-white/10 overflow-hidden z-10",
              currentTheme.card
            )}
          >
            <div className="p-6 sm:p-10 pb-24 sm:pb-10 space-y-6 flex flex-col h-[85vh] md:h-[600px] max-h-[90vh]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#2e5bff]/10 border border-[#2e5bff]/20 flex items-center justify-center font-black text-xs text-[#2e5bff]">
                    {(activeChatListing.sellerName || 'Seller').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                      {language === 'ka' ? 'კავშირი გამყიდველთან' : 'Chat with Seller'}
                    </h3>
                    <p className="text-[10px] text-white/50">{activeChatListing.sellerName} • {activeChatListing.title}</p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors text-white"
                  aria-label={language === 'ka' ? 'დახურვა' : 'Close'}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Subsystem status/Product terms */}
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-3 flex items-start gap-2.5">
                <span className="text-sm">💬</span>
                <div className="text-[9px] font-bold text-yellow-500/80 leading-relaxed uppercase">
                  {language === 'ka' 
                    ? `შეთანხმება: პროდუქტის მდგომარეობა - "${activeChatListing.condition === 'new' ? 'ახალი' : activeChatListing.condition === 'used' ? 'მეორადი' : 'განახლებული'}". ${activeChatListing.isNegotiable ? 'ფასზე შეგიძლიათ ვაჭრობა!' : 'ფასი ფიქსირებულია.'}`
                    : `Inquiry terms: item condition is "${activeChatListing.condition || 'new'}". ${activeChatListing.isNegotiable ? 'Custom offers are welcome!' : 'Fixed pricing matches apply.'}`}
                </div>
              </div>

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none bg-black/20 rounded-2xl p-4 border border-white/5">
                {messagesList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <span className="text-2xl opacity-40">🤝</span>
                    <p className="text-xs font-bold text-white uppercase tracking-wider">
                      {language === 'ka' ? 'მიწერეთ გამყიდველს' : 'No messages yet'}
                    </p>
                    <p className="text-[9px] text-white/40 max-w-xs">
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
                          ? "bg-[#2e5bff] text-white ml-auto rounded-tr-none shadow-[0_4px_10px_rgba(46,91,255,0.2)]" 
                          : "bg-white/10 text-white mr-auto rounded-tl-none"
                      )}
                    >
                      <div className="flex items-center justify-between gap-4 text-[9px] font-black uppercase tracking-wider opacity-65">
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
                  className="flex-1 px-5 py-4 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-[#2e5bff] text-xs font-bold text-white placeholder-white/30"
                />
                <button 
                  type="submit"
                  className="px-5 py-4 bg-[#2e5bff] text-white font-black text-xs uppercase tracking-wider rounded-xl hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 shadow-[0_4px_12px_rgba(46,91,255,0.3)]"
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
