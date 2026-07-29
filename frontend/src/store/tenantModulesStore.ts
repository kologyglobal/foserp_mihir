import { create } from 'zustand'
import { isApiMode } from '../config/apiConfig'
import { fetchAdminModulesApi } from '../services/api/adminApi'

interface TenantModulesState {
  hydrated: boolean
  enabledKeys: string[] | null
  /** Every module key the backend catalog reported (enabled or not). */
  knownKeys: string[] | null
  setEnabledKeys: (keys: string[], knownKeys?: string[]) => void
  hydrate: () => Promise<void>
  isModuleEnabled: (moduleKey: string) => boolean
}

/** Nav category ids that map to catalog module keys */
const MODULE_KEY_ALIASES: Record<string, string> = {
  production: 'manufacturing',
  sales: 'crm',
}

/** Sidebar categories that stay visible regardless of tenant module flags */
const ALWAYS_ON_CATEGORY_IDS = new Set(['executive', 'admin', 'platform'])

/**
 * Fail-open: until hydrated (or on error), all modules appear enabled.
 * Also fail-open for modules the running backend catalog does not know yet,
 * so a newly shipped module is not hidden by a stale API process.
 */
export const useTenantModulesStore = create<TenantModulesState>()((set, get) => ({
  hydrated: !isApiMode(),
  enabledKeys: null,
  knownKeys: null,
  setEnabledKeys: (keys, knownKeys) =>
    set({ enabledKeys: keys, knownKeys: knownKeys ?? null, hydrated: true }),
  hydrate: async () => {
    if (!isApiMode()) {
      set({ hydrated: true, enabledKeys: null, knownKeys: null })
      return
    }
    try {
      const res = await fetchAdminModulesApi()
      set({
        enabledKeys: res.data.enabledKeys,
        knownKeys: res.data.modules.map((m) => m.key),
        hydrated: true,
      })
    } catch {
      set({ hydrated: true, enabledKeys: null, knownKeys: null })
    }
  },
  isModuleEnabled: (moduleKey) => {
    if (ALWAYS_ON_CATEGORY_IDS.has(moduleKey)) return true
    const keys = get().enabledKeys
    if (keys === null) return true
    const resolved = MODULE_KEY_ALIASES[moduleKey] ?? moduleKey
    if (keys.includes(resolved)) return true
    const known = get().knownKeys
    // Backend catalog has no such module (older API build) — do not hide the nav entry.
    return known !== null && !known.includes(resolved)
  },
}))
