/**
 * Standardized Swiss Motion Tokens for Baseer (React 19 + Motion).
 * Physics parameters, timing curves, and reusable motion variants.
 */

export const isTestEnv =
  (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test') ||
  (typeof globalThis !== 'undefined' &&
    typeof (globalThis as Record<string, unknown>).process !== 'undefined' &&
    ((globalThis as Record<string, unknown>).process as { env?: Record<string, string> })?.env?.NODE_ENV === 'test')

export const springSnappy = {
  type: 'spring' as const,
  stiffness: 450,
  damping: 35,
}

export const springSheet = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 32,
  mass: 0.9,
}

export const springBounce = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 24,
}

export const springGentle = {
  type: 'spring' as const,
  stiffness: 280,
  damping: 28,
}

export const pageVariants = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 8 },
}

export const pageTransition = {
  duration: 0.18,
  ease: 'easeOut' as const,
}

export const filterCrossFadeVariants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
}

export const filterTransition = {
  duration: 0.15,
  ease: 'easeOut' as const,
}

export const bottomSheetVariants = {
  initial: { y: '100%' },
  animate: { y: 0 },
  exit: { y: '100%', transition: { duration: 0.22, ease: 'easeIn' as const } },
}

export const backdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
}

export const popoverVariants = {
  initial: { opacity: 0, scale: 0.95, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: -4, transition: { duration: 0.12 } },
}
