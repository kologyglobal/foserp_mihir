import { ERP_STORAGE_KEYS, erpRawStorage } from '../store/persistConfig'

export const DEMO_LOADED_KEY = 'vasant-erp-demo-loaded-v1'

const EXTRA_KEYS = [
  'vasant-erp-ui',
  DEMO_LOADED_KEY,
  'vasant-crm-masters',
  'vasant-erp-saved-views',
  'vasant-erp-job-work-v1',
  'erp-lead-attachments',
  'erp-contact-attachments',
  'erp-opportunity-attachments',
  'erp-quotation-attachments',
]

const ALL_KEYS = [...Object.values(ERP_STORAGE_KEYS), ...EXTRA_KEYS]

/** Clears all ERP demo / persisted store data. Does not remove auth session (`fos-erp-auth`). */
export function clearErpLocalStorage(): void {
  for (const key of ALL_KEYS) {
    erpRawStorage.removeItem(key)
  }
  // Catch any leftover vasant-/erp- keys from older builds
  if (typeof localStorage !== 'undefined') {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (key === 'fos-erp-auth' || key === 'fos_erp_login_remember') continue
      if (key.startsWith('vasant-erp-') || key.startsWith('vasant-crm-') || key.startsWith('erp-')) {
        toRemove.push(key)
      }
    }
    for (const key of toRemove) localStorage.removeItem(key)
  }
}

export function isDemoLoaded(): boolean {
  return erpRawStorage.getItem(DEMO_LOADED_KEY) === '1'
}

export function markDemoLoaded(): void {
  erpRawStorage.setItem(DEMO_LOADED_KEY, '1')
}

export function clearDemoLoadedFlag(): void {
  erpRawStorage.removeItem(DEMO_LOADED_KEY)
}
