import { isApiMode } from '@/config/apiConfig'

/**
 * When false (VITE_USE_API=true), accounting UIs must not surface seed/demo rows.
 * Dual-mode bridges already use live HTTP; seed-only services use this gate.
 */
export function isAccountingDemoDataEnabled(): boolean {
  return !isApiMode()
}

/** Seed factory when demo mode; empty fallback for live API mode. */
export function accountingDemoOrEmpty<T>(seed: () => T[], empty: T[] = []): T[] {
  return isAccountingDemoDataEnabled() ? seed() : empty
}

/** Seed object factory when demo mode; emptyObject factory for live mode. */
export function accountingDemoOrFactory<T>(seed: () => T, empty: () => T): T {
  return isAccountingDemoDataEnabled() ? seed() : empty()
}
