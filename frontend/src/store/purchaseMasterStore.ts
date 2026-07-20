import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PurchaseMasterEntry, PurchaseMasterKind, PurchaseMasterSettings } from '../types/purchaseMasters'
import { PURCHASE_MASTERS_SEED, PURCHASE_MASTER_SETTINGS_SEED } from '../data/purchase/purchaseMastersSeed'
import { erpStorage, ERP_STORAGE_KEYS } from './persistConfig'
import { canDeletePurchaseMasterEntry, resolveItemCategoryId, sortPurchaseMasterEntries } from '../utils/purchaseMasterUtils'
import { memoizedOnSource } from './selectors/memoizedGetters'
import { getSessionUser } from '../utils/permissions'

function purchaseMasterActorName() {
  return getSessionUser().name
}

function genId(kind: PurchaseMasterKind) {
  return `${kind}-${crypto.randomUUID().slice(0, 8)}`
}

function nowIso() {
  return new Date().toISOString()
}

export interface PurchaseMasterInput {
  kind: PurchaseMasterKind
  code: string
  name: string
  status?: 'active' | 'inactive'
  sortOrder?: number
  description?: string
  notes?: string
  attributes?: Record<string, string | number | boolean | null>
  systemControlled?: boolean
}

interface PurchaseMasterState {
  entries: PurchaseMasterEntry[]
  settings: PurchaseMasterSettings
  getByKind: (kind: PurchaseMasterKind, activeOnly?: boolean) => PurchaseMasterEntry[]
  getEntry: (id: string) => PurchaseMasterEntry | undefined
  getByCode: (kind: PurchaseMasterKind, code: string) => PurchaseMasterEntry | undefined
  getLabel: (kind: PurchaseMasterKind, code: string) => string
  addEntry: (input: PurchaseMasterInput) => { ok: boolean; error?: string; id?: string }
  updateEntry: (id: string, patch: Partial<PurchaseMasterInput>) => { ok: boolean; error?: string }
  duplicateEntry: (id: string) => { ok: boolean; error?: string; id?: string }
  activateEntry: (id: string) => { ok: boolean; error?: string }
  deactivateEntry: (id: string) => { ok: boolean; error?: string }
  deleteEntry: (id: string) => { ok: boolean; error?: string }
  importEntries: (kind: PurchaseMasterKind, rows: Array<{ code: string; name: string; status?: string; description?: string }>) => { ok: boolean; imported: number; skipped: number }
  resetMasters: () => void
  itemRequiresIncomingQc: (itemId: string) => boolean
  getGrnTolerancePct: (itemId: string) => number
  updateSettings: (patch: Partial<PurchaseMasterSettings>) => void
}

export const usePurchaseMasterStore = create<PurchaseMasterState>()(
  persist(
    (set, get) => ({
      entries: PURCHASE_MASTERS_SEED.map((e) => ({ ...e })),
      settings: { ...PURCHASE_MASTER_SETTINGS_SEED },

      getByKind: (kind, activeOnly = false) => {
        const entries = get().entries
        return memoizedOnSource(entries, `purchase-master:${kind}:${activeOnly}`, () => {
          const list = entries.filter((e) => e.kind === kind)
          return activeOnly ? sortPurchaseMasterEntries(list.filter((e) => e.status === 'active')) : sortPurchaseMasterEntries(list)
        })
      },

      getEntry: (id) => get().entries.find((e) => e.id === id),

      getByCode: (kind, code) => get().entries.find((e) => e.kind === kind && e.code === code),

      getLabel: (kind, code) => get().getByCode(kind, code)?.name ?? code,

      addEntry: (input) => {
        const code = input.code.trim()
        const name = input.name.trim()
        if (!code || !name) return { ok: false, error: 'Code and name are required.' }
        if (get().entries.some((e) => e.kind === input.kind && e.code === code)) {
          return { ok: false, error: 'A master with this code already exists.' }
        }
        const ts = nowIso()
        const entry: PurchaseMasterEntry = {
          id: genId(input.kind),
          kind: input.kind,
          code,
          name,
          status: input.status ?? 'active',
          sortOrder: input.sortOrder ?? get().entries.filter((e) => e.kind === input.kind).length + 1,
          description: input.description,
          notes: input.notes,
          attributes: input.attributes ?? {},
          systemControlled: input.systemControlled,
          createdAt: ts,
          updatedAt: ts,
          createdBy: purchaseMasterActorName(),
          modifiedBy: purchaseMasterActorName(),
        }
        set((s) => ({ entries: [...s.entries, entry] }))
        return { ok: true, id: entry.id }
      },

      updateEntry: (id, patch) => {
        const existing = get().getEntry(id)
        if (!existing) return { ok: false, error: 'Master not found.' }
        if (existing.systemControlled && patch.code && patch.code !== existing.code) {
          return { ok: false, error: 'System-controlled codes cannot be changed.' }
        }
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === id
              ? {
                  ...e,
                  ...patch,
                  code: patch.code?.trim() ?? e.code,
                  name: patch.name?.trim() ?? e.name,
                  notes: patch.notes ?? e.notes,
                  attributes: patch.attributes ? { ...e.attributes, ...patch.attributes } : e.attributes,
                  updatedAt: nowIso(),
                  modifiedBy: purchaseMasterActorName(),
                }
              : e,
          ),
        }))
        return { ok: true }
      },

      duplicateEntry: (id) => {
        const source = get().getEntry(id)
        if (!source) return { ok: false, error: 'Master not found.' }
        const entries = get().entries
        const code = `${source.code}_copy`
        const name = `${source.name} (Copy)`
        const ts = nowIso()
        const dup: PurchaseMasterEntry = {
          ...source,
          id: genId(source.kind),
          code,
          name,
          status: 'active',
          sortOrder: entries.filter((e) => e.kind === source.kind).length + 1,
          systemControlled: false,
          createdAt: ts,
          updatedAt: ts,
          createdBy: purchaseMasterActorName(),
          modifiedBy: purchaseMasterActorName(),
        }
        set((s) => ({ entries: [...s.entries, dup] }))
        return { ok: true, id: dup.id }
      },

      activateEntry: (id) => {
        if (!get().getEntry(id)) return { ok: false, error: 'Master not found.' }
        const actor = purchaseMasterActorName()
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === id
              ? { ...e, status: 'active' as const, updatedAt: nowIso(), modifiedBy: actor }
              : e,
          ),
        }))
        return { ok: true }
      },

      deactivateEntry: (id) => {
        const existing = get().getEntry(id)
        if (!existing) return { ok: false, error: 'Master not found.' }
        if (existing.systemControlled) return { ok: false, error: 'System-controlled values cannot be deactivated.' }
        const actor = purchaseMasterActorName()
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === id
              ? { ...e, status: 'inactive' as const, updatedAt: nowIso(), modifiedBy: actor }
              : e,
          ),
        }))
        return { ok: true }
      },

      deleteEntry: (id) => {
        const existing = get().getEntry(id)
        if (!existing) return { ok: false, error: 'Master not found.' }
        const gate = canDeletePurchaseMasterEntry(existing)
        if (!gate.ok) return { ok: false, error: gate.reason }
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }))
        return { ok: true }
      },

      importEntries: (kind, rows) => {
        let imported = 0
        let skipped = 0
        for (const row of rows) {
          const r = get().addEntry({
            kind,
            code: row.code.trim(),
            name: row.name.trim(),
            status: row.status === 'inactive' ? 'inactive' : 'active',
            description: row.description,
          })
          if (r.ok) imported += 1
          else skipped += 1
        }
        return { ok: true, imported, skipped }
      },

      resetMasters: () => set({
        entries: PURCHASE_MASTERS_SEED.map((e) => ({ ...e })),
        settings: { ...PURCHASE_MASTER_SETTINGS_SEED },
      }),

      itemRequiresIncomingQc: (itemId) => {
        const rules = get().getByKind('qc-rules', true)
        const categoryId = resolveItemCategoryId(itemId)
        for (const rule of rules) {
          const scope = String(rule.attributes.scopeType ?? 'item')
          const requires = rule.attributes.requiresIncomingQc !== false
          if (!requires) continue
          if (scope === 'all') return true
          if (scope === 'item' && String(rule.attributes.itemId) === itemId) return true
          if (scope === 'category' && categoryId && String(rule.attributes.categoryId) === categoryId) return true
        }
        return false
      },

      getGrnTolerancePct: (itemId) => {
        const rules = get().getByKind('grn-tolerance', true)
        const categoryId = resolveItemCategoryId(itemId)
        let itemRule: number | undefined
        let categoryRule: number | undefined
        let defaultRule: number | undefined
        for (const rule of rules) {
          const pct = Number(rule.attributes.tolerancePct)
          if (!Number.isFinite(pct)) continue
          const scope = String(rule.attributes.scopeType ?? 'default')
          if (scope === 'item' && String(rule.attributes.itemId) === itemId) itemRule = pct
          else if (scope === 'category' && categoryId && String(rule.attributes.categoryId) === categoryId) categoryRule = pct
          else if (scope === 'default' || rule.code === 'default') defaultRule = pct
        }
        if (itemRule !== undefined) return itemRule
        if (categoryRule !== undefined) return categoryRule
        if (defaultRule !== undefined) return defaultRule
        return get().settings.defaultGrnTolerancePct
      },

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: ERP_STORAGE_KEYS.purchaseMasters,
      storage: erpStorage,
      partialize: (s) => ({ entries: s.entries, settings: s.settings }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const existingIds = new Set(state.entries.map((e) => e.id))
        const missing = PURCHASE_MASTERS_SEED.filter((e) => !existingIds.has(e.id))
        if (missing.length === 0) return
        state.entries = [...state.entries, ...missing.map((e) => ({ ...e }))]
      },
    },
  ),
)
