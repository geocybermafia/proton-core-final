/**
 * Proton Design System - Shadow & Elevation Tokens
 * Consistent box-shadow and glow styles across components.
 */

export const protonShadows = {
  // Depth Elevation
  subtle: 'shadow-sm',
  card: 'shadow-md',
  elevated: 'shadow-xl',
  modal: 'shadow-2xl',
  inner: 'shadow-inner',

  // Brand Glow Effects
  glow: {
    accent: 'shadow-[0_0_20px_rgba(6,182,212,0.25)]',
    emerald: 'shadow-[0_0_20px_rgba(16,185,129,0.25)]',
    amber: 'shadow-[0_0_20px_rgba(245,158,11,0.25)]',
    rose: 'shadow-[0_0_20px_rgba(244,63,94,0.25)]',
    purple: 'shadow-[0_0_20px_rgba(168,85,247,0.25)]',
  },
} as const;
