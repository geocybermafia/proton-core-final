import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConfirmActionModal } from '../src/components/market-hub/ConfirmActionModal.js';
import type { MarketTheme } from '../src/components/market-hub/MarketConstants.js';

const TEST_THEME: MarketTheme = {
  card: 'bg-slate-900 border-slate-800 text-slate-100',
  input: 'bg-slate-800 border-slate-700 text-slate-100',
  accent: 'text-emerald-400',
  accentBg: 'bg-emerald-600 text-white hover:bg-emerald-500',
  border: 'border-slate-800',
  muted: 'text-slate-400',
  text: 'text-slate-100',
  subtext: 'text-slate-300',
  tagMuted: 'bg-slate-800 text-slate-300',
  cardAlt: 'bg-slate-900/60',
  badgeBg: 'bg-slate-800',
  bgHover: 'hover:bg-slate-800',
  overlay: 'bg-black/80',
};

describe('PROTON Market Hub — TASK-04 ConfirmActionModal & Confirmation Flow', () => {
  it('1. Renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      React.createElement(ConfirmActionModal, {
        isOpen: false,
        isPending: false,
        variant: 'danger',
        title: 'განცხადების წაშლა',
        description: 'ნამდვილად გსურთ წაშლა?',
        confirmLabel: 'წაშლის დადასტურება',
        cancelLabel: 'გაუქმება',
        onConfirm: () => {},
        onCancel: () => {},
        currentTheme: TEST_THEME,
      })
    );
    assert.equal(html, '');
  });

  it('2. Renders danger alertdialog with KA localization, itemPreview, warningNote, and accessible attributes', () => {
    const html = renderToStaticMarkup(
      React.createElement(ConfirmActionModal, {
        isOpen: true,
        isPending: false,
        variant: 'danger',
        title: 'განცხადების წაშლა',
        warningNote: 'ეს მოქმედება შეუქცევადია',
        description: 'ნამდვილად გსურთ განცხადების წაშლა?',
        itemPreview: 'CNC Spindle Kit 2.2kW',
        confirmLabel: 'წაშლის დადასტურება',
        pendingLabel: 'იშლება...',
        cancelLabel: 'გაუქმება',
        closeAriaLabel: 'დახურვა',
        onConfirm: () => {},
        onCancel: () => {},
        currentTheme: TEST_THEME,
      })
    );

    assert.match(html, /role="alertdialog"/);
    assert.match(html, /aria-modal="true"/);
    assert.match(html, /aria-busy="false"/);
    assert.match(html, /aria-labelledby="proton-confirm-dialog-title"/);
    assert.match(html, /aria-describedby="proton-confirm-dialog-desc"/);
    assert.match(html, /განცხადების წაშლა/);
    assert.match(html, /ეს მოქმედება შეუქცევადია/);
    assert.match(html, /CNC Spindle Kit 2\.2kW/);
    assert.match(html, /გაუქმება/);
    assert.match(html, /წაშლის დადასტურება/);
    assert.match(html, /data-testid="confirm-modal-cancel-btn"/);
    assert.match(html, /data-testid="confirm-modal-confirm-btn"/);
  });

  it('3. Disables buttons and shows pendingLabel with aria-busy="true" when isPending is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(ConfirmActionModal, {
        isOpen: true,
        isPending: true,
        variant: 'danger',
        title: 'Delete Listing',
        description: 'Are you sure you want to delete this listing?',
        confirmLabel: 'Confirm Delete',
        pendingLabel: 'Deleting...',
        cancelLabel: 'Cancel',
        closeAriaLabel: 'Close',
        onConfirm: () => {},
        onCancel: () => {},
        currentTheme: TEST_THEME,
      })
    );

    assert.match(html, /aria-busy="true"/);
    assert.match(html, /Deleting\.\.\./);
    // All 3 action buttons (Close, Cancel, Confirm) must be disabled while pending
    const disabledMatches = html.match(/disabled=""/g) || [];
    assert.equal(disabledMatches.length, 3);
  });

  it('4. Renders inline role="alert" error banner on failure and accent dialog variant for non-destructive prompts', () => {
    const errorHtml = renderToStaticMarkup(
      React.createElement(ConfirmActionModal, {
        isOpen: true,
        isPending: false,
        variant: 'danger',
        title: 'Delete Review',
        description: 'Are you sure you want to delete this review?',
        errorMessage: 'Could not delete review.',
        confirmLabel: 'Confirm Delete',
        cancelLabel: 'Cancel',
        onConfirm: () => {},
        onCancel: () => {},
        currentTheme: TEST_THEME,
      })
    );

    assert.match(errorHtml, /role="alert"/);
    assert.match(errorHtml, /Could not delete review\./);

    const accentHtml = renderToStaticMarkup(
      React.createElement(ConfirmActionModal, {
        isOpen: true,
        isPending: false,
        variant: 'accent',
        title: 'Generate Description with AI',
        description: 'Do you want to use AI?',
        confirmLabel: 'Generate',
        cancelLabel: 'Cancel',
        onConfirm: () => {},
        onCancel: () => {},
        currentTheme: TEST_THEME,
      })
    );

    assert.match(accentHtml, /role="dialog"/);
    assert.match(accentHtml, /Generate Description with AI/);
  });

  it('5. Zero native window.confirm() or bare confirm() calls remain in MarketHub.tsx', () => {
    const marketHubSrc = fs.readFileSync(path.resolve('src/components/MarketHub.tsx'), 'utf8');
    assert.equal(/window\.confirm\s*\(/.test(marketHubSrc), false);
    assert.equal(/(?<![\w.])confirm\s*\(/.test(marketHubSrc), false);
  });

  it('6. MarketHub.tsx wires listing delete, review delete, and AI confirmations to ConfirmActionModal with double-submit & parent-modal guards', () => {
    const marketHubSrc = fs.readFileSync(path.resolve('src/components/MarketHub.tsx'), 'utf8');
    const modalSrc = fs.readFileSync(path.resolve('src/components/market-hub/ConfirmActionModal.tsx'), 'utf8');

    // Handler routing through confirmDialog
    assert.equal(marketHubSrc.includes("setConfirmDialog({\n      kind: 'delete-listing',"), true);
    assert.equal(marketHubSrc.includes("setConfirmDialog({ kind: 'delete-review', reviewId });"), true);
    assert.equal(marketHubSrc.includes("kind: 'ai-generate',"), true);
    assert.equal(marketHubSrc.includes("kind: 'ai-template-fallback',"), true);

    // Double-submit lock and pending close protection
    assert.equal(marketHubSrc.includes('if (!confirmDialog || confirmInFlightRef.current || isConfirmPending) return;'), true);
    assert.equal(marketHubSrc.includes('if (confirmInFlightRef.current || isConfirmPending) return;'), true);

    // Preserved underlying Firestore delete & storage cleanup logic
    assert.equal(marketHubSrc.includes("await deleteDoc(listingDocRef);"), true);
    assert.equal(marketHubSrc.includes("await deleteListingImagesFromStorage(safeImagesToDelete, user.uid);"), true);
    assert.equal(marketHubSrc.includes("await deleteDoc(doc(db, 'seller_reviews', reviewId));"), true);

    // Parent VendorReviewsModal guarded from closing when ConfirmActionModal is open
    assert.equal(marketHubSrc.includes('if (!confirmDialog && !isConfirmPending) {\n        setSelectedVendor(null);\n      }'), true);

    // Keyboard & focus-safety behavior in ConfirmActionModal:
    // - Cancel receives initial focus (never Confirm)
    // - Capture-phase Escape closes only when !isPending and stops propagation
    // - Backdrop click closes only when !isPending
    // - No global Enter interception
    assert.equal(modalSrc.includes('cancelButtonRef.current.focus()'), true);
    assert.equal(modalSrc.includes("document.addEventListener('keydown', handleKeyDown, true);"), true);
    assert.equal(modalSrc.includes('if (!isPending) {\n          onCancel();\n        }'), true);
    assert.equal(modalSrc.includes('if (!isPending) {\n                onCancel();\n              }'), true);
    assert.equal(/event\.key\s*===\s*['"]Enter['"]/.test(modalSrc), false);
  });
});
