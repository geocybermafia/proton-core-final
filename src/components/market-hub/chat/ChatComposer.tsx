import React, { useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { MarketTheme } from '../MarketConstants';

export interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  language: string;
  currentTheme: MarketTheme;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const MIN_TEXTAREA_HEIGHT = 44;
const MAX_TEXTAREA_HEIGHT = 120;

export const ChatComposer = React.memo(function ChatComposer({
  value,
  onChange,
  onSubmit,
  language,
  currentTheme,
  placeholder,
  className,
  disabled = false,
}: ChatComposerProps) {
  const isKa = language === 'ka';
  const formRef = useRef<HTMLFormElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canSend = !disabled && value.trim().length > 0;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    if (!value) {
      el.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
      el.style.overflowY = 'hidden';
      return;
    }

    el.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
    const nextHeight = Math.min(Math.max(el.scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) {
      return;
    }

    const isFinePointer =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: fine)').matches;

    if (!isFinePointer) {
      return;
    }

    e.preventDefault();
    if (canSend) {
      formRef.current?.requestSubmit();
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className={cn('flex items-end gap-2 shrink-0 min-w-0', className)}
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          placeholder ||
          (isKa ? 'დაწერეთ შეტყობინება...' : 'Write a message...')
        }
        aria-label={isKa ? 'შეტყობინების ტექსტი' : 'Message text'}
        className={cn(
          'flex-1 min-w-0 min-h-[44px] max-h-[120px] resize-none rounded-xl border px-3.5 sm:px-4 py-2.5 text-base sm:text-sm font-medium leading-snug focus:outline-none transition-colors',
          disabled && 'opacity-60 cursor-not-allowed',
          currentTheme.input
        )}
      />

      <button
        type="submit"
        disabled={!canSend}
        aria-label={isKa ? 'გაგზავნა' : 'Send'}
        className={cn(
          'shrink-0 min-w-[44px] min-h-[44px] px-3.5 sm:px-4 py-2.5 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-md',
          canSend
            ? 'cursor-pointer active:scale-95'
            : 'opacity-40 cursor-not-allowed',
          currentTheme.accentBg
        )}
      >
        <Send size={16} className="shrink-0" />
        <span className="hidden min-[360px]:inline">
          {isKa ? 'გაგზავნა' : 'Send'}
        </span>
      </button>
    </form>
  );
});
