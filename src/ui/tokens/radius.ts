/**
 * Proton Design System - Border Radius Tokens
 * Strict unified scale ensuring component category consistency across views.
 */

export const protonRadius = {
  /** Modals, Dialogs, Floating Drawers, Popups */
  modals: 'rounded-3xl', // 24px

  /** Main Cards, Sections, Grid Panels, Dashboard Containers */
  cards: 'rounded-2xl', // 16px

  /** Buttons, Inputs, Textareas, Selects, Icon Chips, Dropdowns */
  controls: 'rounded-xl', // 12px

  /** Badges, Status Pills, Avatars, Floating Action Buttons */
  pills: 'rounded-full', // 9999px

  /** Inner Sub-containers, Toast notifications */
  inner: 'rounded-lg', // 8px

  /** Class lookup dictionary for type-safe components */
  classes: {
    modal: 'rounded-3xl',
    card: 'rounded-2xl',
    button: 'rounded-xl',
    input: 'rounded-xl',
    badge: 'rounded-full',
    avatar: 'rounded-full',
    iconBox: 'rounded-xl',
    dropdown: 'rounded-xl',
    tooltip: 'rounded-lg',
  },
} as const;

export type ProtonRadiusCategory = keyof typeof protonRadius.classes;
