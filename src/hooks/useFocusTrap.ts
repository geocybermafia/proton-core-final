import { useEffect, useRef } from 'react';

interface UseFocusTrapOptions {
  isOpen: boolean;
  onClose?: () => void;
  autoFocus?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  autoFocus = true,
}: UseFocusTrapOptions) {
  const containerRef = useRef<T | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Store the element that triggered the modal/drawer
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    if (!container) return;

    // Focus the first focusable element inside the container or container itself
    if (autoFocus) {
      const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const firstFocusable = focusableElements[0];
      if (firstFocusable) {
        // Use timeout to allow modal animation to mount
        const timer = setTimeout(() => {
          firstFocusable.focus();
        }, 50);
        return () => clearTimeout(timer);
      } else {
        container.setAttribute('tabindex', '-1');
        container.focus();
      }
    }
  }, [isOpen, autoFocus]);

  useEffect(() => {
    if (!isOpen) {
      // Restore focus on close
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (onClose) {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
        return;
      }

      if (event.key === 'Tab') {
        const container = containerRef.current;
        if (!container) return;

        const focusableElements = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null); // only visible elements

        if (focusableElements.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          // Shift + Tab: if on first element, wrap to last
          if (document.activeElement === firstElement || !container.contains(document.activeElement)) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if on last element, wrap to first
          if (document.activeElement === lastElement || !container.contains(document.activeElement)) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return containerRef;
}
