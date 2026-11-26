import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Sparkles, X, Loader2, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { MarketTheme } from './MarketConstants';

export interface ConfirmActionModalProps {
  isOpen: boolean;
  isPending: boolean;
  variant?: 'danger' | 'accent';
  title: string;
  description: string;
  itemPreview?: string;
  warningNote?: string;
  errorMessage?: string | null;
  confirmLabel: string;
  pendingLabel?: string;
  cancelLabel: string;
  closeAriaLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  currentTheme: MarketTheme;
}

const MODAL_FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export const ConfirmActionModal = React.memo(function ConfirmActionModal({
  isOpen,
  isPending,
  variant = 'danger',
  title,
  description,
  itemPreview,
  warningNote,
  errorMessage,
  confirmLabel,
  pendingLabel,
  cancelLabel,
  closeAriaLabel = 'Close',
  onConfirm,
  onCancel,
  currentTheme,
}: ConfirmActionModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const isDanger = variant === 'danger';

  // Manage focus capture on open and focus restoration on close
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const timer = window.setTimeout(() => {
      if (cancelButtonRef.current && !cancelButtonRef.current.disabled) {
        cancelButtonRef.current.focus();
      } else {
        dialogRef.current?.focus();
      }
    }, 30);

    return () => {
      window.clearTimeout(timer);
      const prev = previousFocusRef.current;
      previousFocusRef.current = null;
      if (prev && prev.isConnected && typeof prev.focus === 'function') {
        window.setTimeout(() => {
          prev.focus();
        }, 0);
      }
    };
  }, [isOpen]);

  // Capture-phase keyboard handler:
  // - Escape closes ONLY when not pending, and stops propagation so parent modals stay open
  // - Tab / Shift+Tab stays trapped inside the confirmation dialog
  // - Enter is NEVER globally intercepted; native browser behavior triggers only the focused button
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation();
        }
        if (!isPending) {
          onCancel();
        }
        return;
      }

      if (event.key === 'Tab') {
        const container = dialogRef.current;
        if (!container) return;

        const focusable = Array.from(
          container.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);

        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === first || !container.contains(document.activeElement)) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last || !container.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, isPending, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[170] flex items-center justify-center p-4 sm:p-6"
          role={isDanger ? 'alertdialog' : 'dialog'}
          aria-modal="true"
          aria-busy={isPending}
          aria-labelledby="proton-confirm-dialog-title"
          aria-describedby="proton-confirm-dialog-desc"
          data-testid="confirm-action-modal"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!isPending) {
                onCancel();
              }
            }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Dialog Card */}
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 14 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'relative w-full max-w-md rounded-[24px] sm:rounded-[28px] border border-proton-border bg-proton-card flex flex-col overflow-hidden z-10 shadow-2xl focus:outline-none',
              currentTheme.card
            )}
          >
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-proton-border flex items-start justify-between gap-3 bg-proton-bg/60 backdrop-blur-md">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={cn(
                    'w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0',
                    isDanger
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-500'
                      : 'bg-proton-accent/15 border-proton-accent/30 text-proton-accent'
                  )}
                >
                  {isDanger ? <AlertTriangle size={20} /> : <Sparkles size={20} />}
                </div>
                <div className="min-w-0">
                  <h3
                    id="proton-confirm-dialog-title"
                    className={cn(
                      'text-base sm:text-lg font-black tracking-tight leading-snug break-words',
                      currentTheme.text
                    )}
                  >
                    {title}
                  </h3>
                  {warningNote && (
                    <p
                      className={cn(
                        'text-[11px] font-bold tracking-wide mt-0.5',
                        isDanger ? 'text-rose-500' : currentTheme.accent
                      )}
                    >
                      {warningNote}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={onCancel}
                disabled={isPending}
                aria-label={closeAriaLabel}
                className="min-w-[40px] min-h-[40px] p-2 bg-proton-card hover:bg-proton-bg border border-proton-border text-proton-muted hover:text-proton-text rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-accent"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 space-y-3.5 text-left">
              <p
                id="proton-confirm-dialog-desc"
                className={cn('text-sm leading-relaxed break-words', currentTheme.subtext)}
              >
                {description}
              </p>

              {itemPreview && (
                <div className="p-3 rounded-2xl bg-proton-bg/70 border border-proton-border">
                  <p className={cn('text-xs sm:text-sm font-bold break-words line-clamp-2', currentTheme.text)}>
                    {itemPreview}
                  </p>
                </div>
              )}

              {errorMessage && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-semibold text-rose-500 break-words"
                >
                  {errorMessage}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-6 border-t border-proton-border bg-proton-bg/60 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 sm:gap-3">
              <button
                ref={cancelButtonRef}
                type="button"
                data-testid="confirm-modal-cancel-btn"
                onClick={onCancel}
                disabled={isPending}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-proton-text bg-proton-card hover:bg-proton-bg border border-proton-border transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-accent"
              >
                {cancelLabel}
              </button>

              <button
                type="button"
                data-testid="confirm-modal-confirm-btn"
                onClick={() => {
                  if (!isPending) {
                    void onConfirm();
                  }
                }}
                disabled={isPending}
                className={cn(
                  'w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center text-center gap-2 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-proton-card',
                  isDanger
                    ? 'text-white bg-rose-600 hover:bg-rose-500 border border-rose-500/40 shadow-lg shadow-rose-900/20 focus-visible:ring-rose-500'
                    : cn(currentTheme.accentBg, 'shadow-md focus-visible:ring-proton-accent')
                )}
              >
                {isPending ? (
                  <>
                    <Loader2 size={15} className="animate-spin shrink-0" />
                    <span>{pendingLabel || confirmLabel}</span>
                  </>
                ) : (
                  <>
                    {isDanger && <Trash2 size={15} className="shrink-0" />}
                    <span>{confirmLabel}</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});
