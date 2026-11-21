import React, { useEffect, useMemo, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { safeParseDate } from '../MarketConstants';

export interface ChatMessageItem {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  orderId?: string;
  createdAt?: unknown;
}

export interface ChatMessageListProps {
  messages: ChatMessageItem[];
  currentUserId?: string | null;
  isSellerViewing?: boolean;
  language: string;
  emptyStateAction?: (suggestedText: string) => void;
  conversationKey?: string;
  className?: string;
}

function getDayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDateDivider(ms: number, language: string): string {
  const isKa = language === 'ka';
  const target = new Date(ms);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const diffDays = Math.round((todayStart - targetStart) / 86400000);

  if (diffDays === 0) return isKa ? 'დღეს' : 'Today';
  if (diffDays === 1) return isKa ? 'გუშინ' : 'Yesterday';

  const sameYear = target.getFullYear() === now.getFullYear();
  return target.toLocaleDateString(isKa ? 'ka-GE' : 'en-US', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

function formatMessageTime(createdAt: unknown, language: string): string {
  if (!createdAt) {
    return language === 'ka' ? 'ახლახანს' : 'Just now';
  }
  const ms = safeParseDate(createdAt);
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const ChatMessageList = React.memo(function ChatMessageList({
  messages,
  currentUserId,
  isSellerViewing = false,
  language,
  emptyStateAction,
  conversationKey,
  className,
}: ChatMessageListProps) {
  const isKa = language === 'ka';
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef<number>(0);
  const prevConvKeyRef = useRef<string | undefined>(conversationKey);
  const isNearBottomRef = useRef<boolean>(true);
  const lastClientHeightRef = useRef<number>(0);
  const lastClientWidthRef = useRef<number>(0);
  const lastScrollHeightRef = useRef<number>(0);
  const lastScrollTopRef = useRef<number>(0);
  const isAutoScrollingRef = useRef<boolean>(false);
  const autoScrollTimeoutRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const lastMessageSenderId = messages.length > 0 ? messages[messages.length - 1]?.senderId : undefined;

  const clearAutoScrolling = () => {
    isAutoScrollingRef.current = false;
    if (autoScrollTimeoutRef.current !== null) {
      window.clearTimeout(autoScrollTimeoutRef.current);
      autoScrollTimeoutRef.current = null;
    }
  };

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container || container.clientHeight === 0) return;

    const { scrollHeight, clientHeight, clientWidth, scrollTop } = container;
    const distanceFromBottom = scrollHeight - clientHeight - scrollTop;

    if (isAutoScrollingRef.current) {
      const containerDimensionsUnchanged =
        clientHeight === lastClientHeightRef.current &&
        clientWidth === lastClientWidthRef.current;
      const scrolledUpManually =
        containerDimensionsUnchanged &&
        scrollHeight >= lastScrollHeightRef.current &&
        scrollTop < lastScrollTopRef.current - 1;

      if (scrolledUpManually) {
        clearAutoScrolling();
        isNearBottomRef.current = distanceFromBottom <= 24;
      } else if (distanceFromBottom <= 24) {
        clearAutoScrolling();
        isNearBottomRef.current = true;
      }

      lastScrollTopRef.current = scrollTop;
      return;
    }

    const containerResized =
      lastClientHeightRef.current > 0 &&
      (clientHeight < lastClientHeightRef.current || clientWidth !== lastClientWidthRef.current);

    if (
      isNearBottomRef.current &&
      distanceFromBottom > 24 &&
      containerResized &&
      scrollTop >= lastScrollTopRef.current - 1
    ) {
      return;
    }

    isNearBottomRef.current = distanceFromBottom <= 24;
    lastClientHeightRef.current = clientHeight;
    lastClientWidthRef.current = clientWidth;
    lastScrollHeightRef.current = scrollHeight;
    lastScrollTopRef.current = scrollTop;
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const conversationChanged = prevConvKeyRef.current !== conversationKey;
    const isInitialLoadWithMessages = prevCountRef.current === 0 && messages.length > 0;
    const hasNewMessages = messages.length > prevCountRef.current;

    const syncMetrics = (el: HTMLDivElement) => {
      if (el.clientHeight === 0) return;
      lastClientHeightRef.current = el.clientHeight;
      lastClientWidthRef.current = el.clientWidth;
      lastScrollHeightRef.current = el.scrollHeight;
      lastScrollTopRef.current = el.scrollTop;
    };

    if (conversationChanged || isInitialLoadWithMessages) {
      clearAutoScrolling();
      isNearBottomRef.current = true;
      const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
      container.scrollTop = maxScrollTop;
      syncMetrics(container);

      const rafId = requestAnimationFrame(() => {
        const el = scrollContainerRef.current;
        if (!el || el.clientHeight === 0) return;
        const target = Math.max(0, el.scrollHeight - el.clientHeight);
        el.scrollTop = target;
        isNearBottomRef.current = true;
        syncMetrics(el);
      });

      prevConvKeyRef.current = conversationKey;
      prevCountRef.current = messages.length;
      return () => cancelAnimationFrame(rafId);
    }

    if (hasNewMessages) {
      const isOwnNewMessage = Boolean(currentUserId && lastMessageSenderId === currentUserId);
      if (isOwnNewMessage || isNearBottomRef.current || isAutoScrollingRef.current) {
        isNearBottomRef.current = true;
        const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
        if (maxScrollTop - container.scrollTop <= 2) {
          clearAutoScrolling();
          container.scrollTop = maxScrollTop;
          syncMetrics(container);
        } else {
          if (autoScrollTimeoutRef.current !== null) {
            window.clearTimeout(autoScrollTimeoutRef.current);
          }
          isAutoScrollingRef.current = true;
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth',
          });
          autoScrollTimeoutRef.current = window.setTimeout(() => {
            autoScrollTimeoutRef.current = null;
            const el = scrollContainerRef.current;
            if (!el || el.clientHeight === 0) {
              isAutoScrollingRef.current = false;
              return;
            }
            if (isAutoScrollingRef.current) {
              isAutoScrollingRef.current = false;
              const dist = el.scrollHeight - el.clientHeight - el.scrollTop;
              isNearBottomRef.current = dist <= 24;
              syncMetrics(el);
            }
          }, 700);
          if (container.clientHeight > 0) {
            lastClientHeightRef.current = container.clientHeight;
            lastClientWidthRef.current = container.clientWidth;
            lastScrollHeightRef.current = container.scrollHeight;
          }
        }
      } else if (container.clientHeight > 0) {
        lastClientHeightRef.current = container.clientHeight;
        lastClientWidthRef.current = container.clientWidth;
        lastScrollHeightRef.current = container.scrollHeight;
      }
    } else if (messages.length < prevCountRef.current) {
      syncMetrics(container);
    }

    prevConvKeyRef.current = conversationKey;
    prevCountRef.current = messages.length;
  }, [messages.length, lastMessageSenderId, conversationKey, currentUserId]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScrollEnd = () => {
      const el = scrollContainerRef.current;
      if (!el || el.clientHeight === 0) return;
      if (isAutoScrollingRef.current) {
        clearAutoScrolling();
        const dist = el.scrollHeight - el.clientHeight - el.scrollTop;
        isNearBottomRef.current = dist <= 24;
      }
      lastClientHeightRef.current = el.clientHeight;
      lastClientWidthRef.current = el.clientWidth;
      lastScrollHeightRef.current = el.scrollHeight;
      lastScrollTopRef.current = el.scrollTop;
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0 && isAutoScrollingRef.current) {
        clearAutoScrolling();
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartYRef.current = e.touches[0].clientY;
      } else {
        touchStartYRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (
        isAutoScrollingRef.current &&
        touchStartYRef.current !== null &&
        e.touches.length === 1 &&
        e.touches[0].clientY - touchStartYRef.current > 4
      ) {
        clearAutoScrolling();
      }
    };

    const handleTouchEnd = () => {
      touchStartYRef.current = null;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        isAutoScrollingRef.current &&
        (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Home')
      ) {
        clearAutoScrolling();
      }
    };

    container.addEventListener('scrollend', handleScrollEnd);
    container.addEventListener('wheel', handleWheel, { passive: true });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    container.addEventListener('keydown', handleKeyDown);

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            const el = scrollContainerRef.current;
            if (!el || el.clientHeight === 0) return;

            if (isNearBottomRef.current) {
              clearAutoScrolling();
              const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
              if (Math.abs(el.scrollTop - maxScrollTop) > 1) {
                el.scrollTop = maxScrollTop;
              }
            }

            lastClientHeightRef.current = el.clientHeight;
            lastClientWidthRef.current = el.clientWidth;
            lastScrollHeightRef.current = el.scrollHeight;
            lastScrollTopRef.current = el.scrollTop;
          })
        : null;

    observer?.observe(container);

    return () => {
      clearAutoScrolling();
      observer?.disconnect();
      container.removeEventListener('scrollend', handleScrollEnd);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const messagesWithMeta = useMemo(() => {
    return messages.map((msg, index) => {
      const ms = safeParseDate(msg.createdAt);
      const dayKey = getDayKey(ms);
      const prevMs = index > 0 ? safeParseDate(messages[index - 1].createdAt) : null;
      const showDateDivider = index === 0 || (prevMs !== null && getDayKey(prevMs) !== dayKey);

      return {
        msg,
        ms,
        showDateDivider,
        dateLabel: showDateDivider ? formatDateDivider(ms, language) : '',
        timeLabel: formatMessageTime(msg.createdAt, language),
      };
    });
  }, [messages, language]);

  const starterPrompts = isKa
    ? isSellerViewing
      ? ['გამარჯობა! რით შემიძლია დაგეხმაროთ?', 'დიახ, ხელმისაწვდომია.']
      : ['გამარჯობა, პროდუქტი ისევ ხელმისაწვდომია?', 'შეგვიძლია ფასზე შეთანხმება?']
    : isSellerViewing
    ? ['Hello! How can I help you with this item?', 'Yes, it is still available.']
    : ['Hi, is this item still available?', 'Is the price negotiable?'];

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      role="log"
      aria-live="polite"
      aria-label={isKa ? 'შეტყობინებების ისტორია' : 'Chat messages'}
      className={cn(
        'flex-1 min-h-0 overflow-y-auto overflow-x-hidden rounded-2xl p-3 sm:p-4 border border-proton-border bg-proton-bg/65 space-y-3 flex flex-col custom-scrollbar',
        className
      )}
    >
      {messagesWithMeta.length === 0 ? (
        <div className="my-auto flex flex-col items-center justify-center text-center px-3 py-6 space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-proton-card border border-proton-border flex items-center justify-center text-proton-accent shadow-sm">
            <MessageSquare size={20} />
          </div>
          <div className="space-y-1 max-w-xs">
            <p className="text-sm font-bold text-proton-text">
              {isKa
                ? isSellerViewing
                  ? 'დაიწყეთ საუბარი მყიდველთან'
                  : 'დაიწყეთ საუბარი გამყიდველთან'
                : isSellerViewing
                ? 'Start chatting with the buyer'
                : 'Start chatting with the seller'}
            </p>
            <p className="text-xs text-proton-muted leading-relaxed">
              {isKa
                ? isSellerViewing
                  ? 'უპასუხეთ შეკითხვებს ან დააზუსტეთ მიწოდებისა და შეკვეთის დეტალები.'
                  : 'იკითხეთ მდგომარეობის, მიწოდების ან ფასის შესახებ უსაფრთხოდ.'
                : isSellerViewing
                ? 'Reply to questions or coordinate delivery and order details.'
                : 'Ask about availability, condition, delivery, or propose an offer.'}
            </p>
          </div>
          {emptyStateAction && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 max-w-sm">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => emptyStateAction(prompt)}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-proton-card hover:bg-proton-accent/10 border border-proton-border hover:border-proton-accent/40 text-xs font-medium text-proton-text transition-colors cursor-pointer text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        messagesWithMeta.map(({ msg, showDateDivider, dateLabel, timeLabel }) => {
          const isMe = Boolean(currentUserId && msg.senderId === currentUserId);
          return (
            <React.Fragment key={msg.id}>
              {showDateDivider && (
                <div className="flex items-center justify-center my-1.5" role="separator" aria-label={dateLabel}>
                  <span className="px-3 py-1 rounded-full bg-proton-card border border-proton-border text-[11px] font-semibold text-proton-muted">
                    {dateLabel}
                  </span>
                </div>
              )}

              <div
                className={cn(
                  'flex flex-col max-w-[85%] sm:max-w-[min(78%,520px)] min-w-0 rounded-2xl px-3.5 py-2.5 shadow-sm',
                  isMe
                    ? 'bg-proton-accent text-proton-on-accent self-end ml-auto rounded-br-sm'
                    : 'bg-proton-card text-proton-text border border-proton-border self-start mr-auto rounded-bl-sm'
                )}
              >
                <div className="flex items-baseline justify-between gap-3 mb-1 min-w-0">
                  <span
                    className={cn(
                      'text-xs font-bold truncate',
                      isMe ? 'text-proton-on-accent/85' : 'text-proton-muted'
                    )}
                  >
                    {isMe ? (isKa ? 'თქვენ' : 'You') : msg.senderName}
                  </span>
                  <time
                    className={cn(
                      'text-[11px] font-medium tabular-nums shrink-0',
                      isMe ? 'text-proton-on-accent/80' : 'text-proton-muted/90'
                    )}
                  >
                    {timeLabel}
                  </time>
                </div>

                <p className="text-[13px] sm:text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] break-words min-w-0">
                  {msg.text}
                </p>
              </div>
            </React.Fragment>
          );
        })
      )}
    </div>
  );
});
