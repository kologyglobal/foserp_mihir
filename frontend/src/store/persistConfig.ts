import { createJSONStorage, type StateStorage } from 'zustand/middleware'

/** In-memory storage for Node migration/validation scripts. */
export function createMemoryStorage(initial: Record<string, string> = {}): StateStorage {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (name) => map.get(name) ?? null,
    setItem: (name, value) => {
      map.set(name, value)
    },
    removeItem: (name) => {
      map.delete(name)
    },
  }
}

const browserOrMemoryStorage: StateStorage =
  typeof localStorage !== 'undefined'
    ? {
        getItem: (name) => localStorage.getItem(name),
        setItem: (name, value) => localStorage.setItem(name, value),
        removeItem: (name) => localStorage.removeItem(name),
      }
    : createMemoryStorage()

/** Raw localStorage adapter (migration scripts + direct read/write). Falls back to memory in Node. */
export const erpRawStorage: StateStorage = browserOrMemoryStorage

/** Shared browser storage for ERP session data (survives page refresh). */
export const erpStorage = createJSONStorage(() => erpRawStorage)

/** Persist key registry — bump suffix on breaking schema changes. */
export const ERP_STORAGE_KEYS = {
  masters: 'vasant-erp-masters-v1',
  inventory: 'vasant-erp-inventory-v1',
  mrp: 'vasant-erp-mrp-v1',
  purchase: 'vasant-erp-purchase-v1',
  workOrders: 'vasant-erp-workorders-v1',
  bom: 'vasant-erp-bom-v1',
  routing: 'vasant-erp-routing-v1',
  workCenters: 'vasant-erp-workcenters-v1',
  quality: 'vasant-erp-quality-v1',
  costing: 'vasant-erp-costing-v1',
  dispatch: 'vasant-erp-dispatch-v1',
  invoice: 'vasant-erp-invoice-v1',
  sales: 'vasant-erp-sales-v1',
  dms: 'vasant-erp-dms-v1',
  approval: 'vasant-erp-approval-v1',
  barcode: 'vasant-erp-barcode-v1',
  qr: 'vasant-erp-qr-v1',
  eco: 'vasant-erp-eco-v1',
  serial: 'vasant-erp-serial-v1',
  freeze: 'vasant-erp-freeze-v1',
  mobileDrafts: 'vasant-erp-mobile-drafts-v1',
  mobileGate: 'vasant-erp-mobile-gate-v1',
  mobileStockCount: 'vasant-erp-mobile-stockcount-v1',
  crm: 'vasant-erp-crm-v1',
  purchaseMasters: 'vasant-erp-purchase-masters-v1',
  proformaInvoice: 'vasant-erp-proforma-v1',
  codeSeries: 'vasant-erp-code-series-v1',
  accounting: 'vasant-erp-accounting-v1',
} as const

export const ERP_PERSIST_VERSION = 1

export function readPersistedJson<T>(key: string, storage: StateStorage = erpRawStorage): T | null {
  const raw = storage.getItem(key)
  if (!raw || typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw) as { state?: T; version?: number }
    return (parsed.state ?? parsed) as T
  } catch {
    return null
  }
}

export function writePersistedJson<T>(key: string, state: T, storage: StateStorage = erpRawStorage): void {
  storage.setItem(
    key,
    JSON.stringify({
      state,
      version: ERP_PERSIST_VERSION,
    }),
  )
}