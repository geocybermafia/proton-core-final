import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { protonRadius } from '../tokens/radius';
import { protonSpacing } from '../tokens/spacing';

export interface ProtonModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  className?: string;
}

export const ProtonModal: React.FC<ProtonModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  showCloseButton = true,
  className,
}) => {
  // Border radius constraint: Modals MUST use rounded-3xl
  const baseRadius = protonRadius.classes.modal; // 'rounded-3xl'

  // Lock scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={cn(
              baseRadius,
              'relative w-full bg-proton-card border border-proton-border shadow-2xl overflow-hidden z-10 my-8 flex flex-col max-h-[90vh]',
              sizeClasses[size],
              className
            )}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className={cn('flex items-start justify-between border-b border-proton-border/60 shrink-0', protonSpacing.modal.header)}>
                <div className="space-y-1">
                  {title && (
                    <h3 className="text-xl font-extrabold text-proton-text tracking-tight uppercase">
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p className="text-xs text-proton-muted font-normal leading-relaxed">
                      {description}
                    </p>
                  )}
                </div>

                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="p-2 rounded-xl text-proton-muted hover:text-proton-text hover:bg-proton-bg border border-transparent hover:border-proton-border transition-all cursor-pointer ml-4 shrink-0"
                    aria-label="Close dialog"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div className={cn('overflow-y-auto flex-1', protonSpacing.modal.body)}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className={cn('border-t border-proton-border/60 bg-proton-bg/40 flex items-center justify-end gap-3 shrink-0', protonSpacing.modal.footer)}>
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
