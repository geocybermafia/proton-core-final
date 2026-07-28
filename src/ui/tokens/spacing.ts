/**
 * Proton Design System - Spacing & Padding Tokens
 * Rhythmic spacing constants for layout containers and component padding.
 */

export const protonSpacing = {
  // Container Outer Padding
  pagePadding: 'px-4 sm:px-6 md:px-8 py-6',
  
  // Card Padding Scale
  card: {
    compact: 'p-3 sm:p-4',
    default: 'p-5 sm:p-6',
    spacious: 'p-6 sm:p-8 md:p-10',
  },

  // Modal Padding Scale
  modal: {
    header: 'p-5 sm:p-6 pb-4',
    body: 'p-5 sm:p-6',
    footer: 'p-5 sm:p-6 pt-4',
  },

  // Control Padding Scale (Buttons & Inputs)
  control: {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3.5 text-base',
  },

  // Grid & Stack Gaps
  gap: {
    tight: 'gap-2 sm:gap-3',
    default: 'gap-4 sm:gap-6',
    loose: 'gap-6 sm:gap-8',
  },
} as const;
