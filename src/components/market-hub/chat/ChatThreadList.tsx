import React from 'react';
import { MessageSquare, Package, ChevronRight } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { getListingTitle, MarketTheme, safeParseDate } from '../MarketConstants';

export interface ChatThreadSummary {
  conversationId: string;
  listingId: string;
  listingTitle: string;
  titleGe?: string;
  titleEn?: string;
  primaryLanguage?: string;
  sellerId: string;
  sellerName: string;
  buyerId: string;
  buyerName: string;
  orderId?: string | null;
  lastMessage: string;
  lastTime: unknown;
  lastSenderId?: string;
  unreadCount?: number;
  hasServerConversation?: boolean;
}

export interface ChatThreadListProps {
  threads: ChatThreadSummary[];
  activeConversationId?: string | null;
  currentUserId?: string | null;
  unreadByConversationId?: Record<string, number>;
  language: string;
  currentTheme: MarketTheme;
  onSelectThread: (thread: ChatThreadSummary) => void;
  onBrowseMarket?: () => void;
  className?: string;
}

function formatThreadTime(dateVal: unknown, language: string): string {
  if (!dateVal) return '';
  const ms = safeParseDate(dateVal);
  const date = new Date(ms);
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(language === 'ka' ? 'ka-GE' : 'en-US', {
    day: 'numeric',
    month: 'short',
  });
}

function getInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return 'U';
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export const ChatThreadList = React.memo(function ChatThreadList({
  threads,
  activeConversationId,
  currentUserId,
  unreadByConversationId,
  language,
  currentTheme,
  onSelectThread,
  onBrowseMarket,
  className,
}: ChatThreadListProps) {
  const isKa = language === 'ka';

  if (threads.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center text-center px-5 py-10 rounded-2xl border border-proton-border bg-proton-bg/50',
          className
        )}
      >
        <div className="w-12 h-12 rounded-2xl bg-proton-accent/10 border border-proton-accent/25 flex items-center justify-center text-proton-accent mb-3">
          <MessageSquare size={22} />
        </div>
        <h4 className="text-sm font-bold text-proton-text">
          {isKa ? 'საუბრები ჯერ არ გაქვთ' : 'No conversations yet'}
        </h4>
        <p className="text-xs text-proton-muted mt-1.5 max-w-[260px] leading-relaxed">
          {isKa
            ? 'როდესაც მისწერთ გამყიდველს ან მიიღებთ შეკითხვას, საუბრები აქ გამოჩნდება.'
            : 'When you message a seller or receive an inquiry, your threads will appear here.'}
        </p>
        {onBrowseMarket && (
          <button
            type="button"
            onClick={onBrowseMarket}
            className={cn(
              'mt-4 min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer',
              currentTheme.accentBg
            )}
          >
            {isKa ? 'განცხადებების ნახვა' : 'Browse Marketplace'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {threads.map((thread) => {
        const isActive = activeConversationId === thread.conversationId;
        const isSeller = Boolean(currentUserId && currentUserId === thread.sellerId);
        const counterpartName = isSeller
          ? thread.buyerName || (isKa ? 'მყიდველი' : 'Buyer')
          : thread.sellerName || (isKa ? 'გამყიდველი' : 'Seller');
        const counterpartRole = isSeller
          ? isKa
            ? 'მყიდველი'
            : 'Buyer'
          : isKa
          ? 'გამყიდველი'
          : 'Seller';

        const resolvedTitle = getListingTitle(
          {
            title: thread.listingTitle,
            titleGe: thread.titleGe,
            titleEn: thread.titleEn,
            primaryLanguage: thread.primaryLanguage,
          },
          language
        );

        const timeLabel = formatThreadTime(thread.lastTime, language);
        const isLastFromMe = Boolean(currentUserId && thread.lastSenderId === currentUserId);
        const rawUnread =
          unreadByConversationId && Object.prototype.hasOwnProperty.call(unreadByConversationId, thread.conversationId)
            ? unreadByConversationId[thread.conversationId]
            : thread.unreadCount;
        const threadUnreadCount =
          typeof rawUnread === 'number' && Number.isFinite(rawUnread) && rawUnread > 0
            ? Math.floor(rawUnread)
            : 0;

        return (
          <button
            key={thread.conversationId}
            type="button"
            onClick={() => onSelectThread(thread)}
            className={cn(
              'w-full min-h-[60px] text-left p-3 sm:p-3.5 rounded-2xl flex items-center gap-3 transition-all border cursor-pointer active:scale-[0.99]',
              isActive
                ? 'bg-proton-bg border-proton-accent/55 shadow-sm ring-1 ring-proton-accent/20'
                : 'bg-proton-card/70 hover:bg-proton-bg border-proton-border hover:border-proton-accent/35'
            )}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border',
                isActive
                  ? 'bg-proton-accent/20 border-proton-accent/40 text-proton-accent'
                  : 'bg-proton-bg border-proton-border text-proton-text'
              )}
              aria-hidden="true"
            >
              {getInitials(counterpartName)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={cn(
                      'text-[13px] font-bold truncate',
                      isActive ? 'text-proton-accent' : 'text-proton-text'
                    )}
                  >
                    {counterpartName}
                  </span>
                  <span className="text-[11px] font-medium text-proton-muted shrink-0">
                    • {counterpartRole}
                  </span>
                </div>
                {timeLabel && (
                  <span className="text-[11px] font-medium text-proton-muted tabular-nums shrink-0">
                    {timeLabel}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                <span className="text-xs font-semibold text-proton-text/90 truncate">
                  {resolvedTitle || thread.listingTitle}
                </span>
                {thread.orderId && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-proton-accent/15 text-proton-accent border border-proton-accent/30 text-[11px] font-mono font-semibold shrink-0">
                    <Package size={10} />
                    <span>#{thread.orderId.slice(-6).toUpperCase()}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 mt-1 min-w-0">
                <p
                  className={cn(
                    'text-xs truncate min-w-0',
                    threadUnreadCount > 0 ? 'text-proton-text font-semibold' : 'text-proton-muted'
                  )}
                >
                  {isLastFromMe ? `${isKa ? 'თქვენ' : 'You'}: ` : ''}
                  {thread.lastMessage || (isKa ? 'შეტყობინება' : 'Message')}
                </p>

                {threadUnreadCount > 0 && (
                  <span
                    data-testid={`thread-unread-badge-${thread.conversationId}`}
                    aria-label={
                      isKa
                        ? `${threadUnreadCount} წაუკითხავი შეტყობინება`
                        : `${threadUnreadCount} unread messages`
                    }
                    className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black leading-none tabular-nums shrink-0 shadow-sm"
                  >
                    {threadUnreadCount}
                  </span>
                )}
              </div>
            </div>

            <ChevronRight size={16} className="text-proton-muted shrink-0 md:hidden" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
});
