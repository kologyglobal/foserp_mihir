import type { ModuleStatus } from '@/types/api'
import { useSessionStore } from '@/store/sessionStore'

/**
 * Module loader — fail-open when the modules API was empty/failed
 * (matches backend: missing TenantModuleFlag row = enabled).
 *
 * Hard-gated server modules today: purchase, manufacturing, maintenance.
 * Mobile only hides known disabled rows.
 */

export type KnownModuleKey =
  | 'crm'
  | 'manufacturing'
  | 'inventory'
  | 'accounting'
  | 'hrms'
  | 'dispatch'
  | 'maintenance'
  | 'purchase'
  | 'quality'
  | 'gate'
  | 'masters'
  | 'logistics'

export const MODULE_LABELS: Record<string, string> = {
  crm: 'CRM',
  manufacturing: 'Manufacturing',
  inventory: 'Inventory',
  accounting: 'Accounting',
  hrms: 'HRMS',
  dispatch: 'Dispatch',
  maintenance: 'Maintenance',
  purchase: 'Purchase',
  quality: 'Quality',
  gate: 'Gate',
  masters: 'Master Data',
  logistics: 'Logistics',
}

/** Modules we surface on Home for M1 (features not built yet). */
export const HOME_MODULE_KEYS: string[] = [
  'crm',
  'manufacturing',
  'inventory',
  'accounting',
  'dispatch',
  'maintenance',
  'purchase',
  'quality',
  'gate',
]

export function isModuleEnabled(key: string, modules?: ModuleStatus[]): boolean {
  const list = modules ?? useSessionStore.getState().profile?.modules ?? []
  if (list.length === 0) {
    // Fail-open for catalog (API failure) — do not invent hrms until backend adds it
    if (key === 'hrms') return false
    return true
  }
  const row = list.find((m) => m.key === key)
  if (!row) {
    if (key === 'hrms') return false
    return true
  }
  return row.enabled !== false
}

export function getEnabledModules(modules?: ModuleStatus[]): ModuleStatus[] {
  const list = modules ?? useSessionStore.getState().profile?.modules ?? []
  if (list.length === 0) {
    return HOME_MODULE_KEYS.filter((k) => k !== 'hrms').map((key) => ({
      key,
      name: MODULE_LABELS[key] ?? key,
      enabled: true,
    }))
  }
  return list.filter((m) => m.enabled !== false)
}

export function useModules() {
  const modules = useSessionStore((s) => s.profile?.modules ?? [])
  return {
    modules,
    enabled: getEnabledModules(modules),
    isEnabled: (key: string) => isModuleEnabled(key, modules),
  }
}
