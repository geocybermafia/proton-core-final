/**
 * Proton Design System - Typography Tokens
 * Standard font scales, tracking, and leading values.
 */

export const protonTypography = {
  // Headings Scale
  headings: {
    h1: 'text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight uppercase leading-none',
    h2: 'text-2xl sm:text-3xl font-extrabold tracking-tight text-proton-text',
    h3: 'text-lg sm:text-xl font-bold tracking-tight text-proton-text',
    h4: 'text-base font-semibold text-proton-text',
  },

  // Body Scale
  body: {
    lg: 'text-base leading-relaxed text-proton-muted',
    md: 'text-sm leading-relaxed text-proton-muted',
    sm: 'text-xs leading-normal text-proton-muted',
  },

  // Monospace & Badge Labels
  mono: {
    badge: 'font-mono text-[10px] font-bold uppercase tracking-wider',
    code: 'font-mono text-xs text-proton-accent',
  },
} as const;
