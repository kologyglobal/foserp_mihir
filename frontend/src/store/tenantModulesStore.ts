import { create } from 'zustand'
import { isApiMode } from '../config/apiConfig'
import { fetchAdminModulesApi } from '../services/api/adminApi'

interface TenantModulesState {
  hydrated: boolean
  enabledKeys: string[] | null
  setEnabledKeys: (keys: string[]) => void
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
 */
export const useTenantModulesStore = create<TenantModulesState>()((set, get) => ({
  hydrated: !isApiMode(),
  enabledKeys: null,
  setEnabledKeys: (keys) => set({ enabledKeys: keys, hydrated: true }),
  hydrate: async () => {
    if (!isApiMode()) {
      set({ hydrated: true, enabledKeys: null })
      return
    }
    try {
      const res = await fetchAdminModulesApi()
      set({ enabledKeys: res.data.enabledKeys, hydrated: true })
    } catch {
      set({ hydrated: true, enabledKeys: null })
    }
  },
  isModuleEnabled: (moduleKey) => {
    if (ALWAYS_ON_CATEGORY_IDS.has(moduleKey)) return true
    const keys = get().enabledKeys
    if (keys === null) return true
    const resolved = MODULE_KEY_ALIASES[moduleKey] ?? moduleKey
    return keys.includes(resolved)
  },
}))
