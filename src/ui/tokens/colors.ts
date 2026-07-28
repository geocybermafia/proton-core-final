/**
 * Proton Design System - Color Tokens
 * Centralized color roles and semantic color definitions.
 */

export const protonColors = {
  // Core Surface Tokens
  surface: {
    bg: 'var(--proton-bg, #0b0c10)',
    card: 'var(--proton-card, #13151c)',
    cardHover: 'rgba(255, 255, 255, 0.04)',
    border: 'var(--proton-border, rgba(255, 255, 255, 0.08))',
    borderHover: 'rgba(255, 255, 255, 0.16)',
    modalBackdrop: 'rgba(0, 0, 0, 0.75)',
  },

  // Brand Accent (Cyan Core)
  accent: {
    primary: 'var(--proton-accent, #06b6d4)',
    hover: '#22d3ee',
    glow: 'rgba(6, 182, 212, 0.25)',
    subtleBg: 'rgba(6, 182, 212, 0.1)',
    subtleBorder: 'rgba(6, 182, 212, 0.25)',
  },

  // Typography Colors
  text: {
    primary: 'var(--proton-text, #f3f4f6)',
    muted: 'var(--proton-muted, #9ca3af)',
    subtle: '#6b7280',
    inverse: '#000000',
  },

  // Mode Accent Tints
  modes: {
    creative: {
      accent: '#f59e0b', // Amber
      subtleBg: 'rgba(245, 158, 11, 0.1)',
      subtleBorder: 'rgba(245, 158, 11, 0.25)',
    },
    clips: {
      accent: '#f43f5e', // Rose
      subtleBg: 'rgba(244, 63, 94, 0.1)',
      subtleBorder: 'rgba(244, 63, 94, 0.25)',
    },
    market: {
      accent: '#3b82f6', // Blue
      subtleBg: 'rgba(59, 130, 246, 0.1)',
      subtleBorder: 'rgba(59, 130, 246, 0.25)',
    },
    organizer: {
      accent: '#a855f7', // Purple
      subtleBg: 'rgba(168, 85, 247, 0.1)',
      subtleBorder: 'rgba(168, 85, 247, 0.25)',
    },
    business: {
      accent: '#10b981', // Emerald
      subtleBg: 'rgba(16, 185, 129, 0.1)',
      subtleBorder: 'rgba(16, 185, 129, 0.25)',
    },
  },

  // Functional Status
  status: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#06b6d4',
  },
} as const;

export type ProtonColorMode = keyof typeof protonColors.modes;
