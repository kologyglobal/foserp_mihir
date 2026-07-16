import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CrmMasterEntry, CrmMasterKind, CrmMasterStatus } from '../types/crmMasters'
import { CRM_MASTERS_SEED } from '../data/crm/crmMastersSeed'
import { erpStorage } from './persistConfig'
import { canDeleteMasterEntry, sortMasterEntries } from '../utils/crmMasterUtils'
import { appendAudit, duplicateMasterCode, duplicateMasterName, stampCreated } from '../utils/crmMasterAudit'
import { memoizedOnSource } from './selectors/memoizedGetters'

function genId(kind: CrmMasterKind) {
  return `${kind}-${crypto.randomUUID().slice(0, 8)}`
}

function nowIso() {
  return new Date().toISOString()
}

export interface CrmMasterInput {
  kind: CrmMasterKind
  code: string
  name: string
  status?: CrmMasterStatus
  sortOrder?: number
  description?: string
  notes?: string
  attributes?: Record<string, string | number | boolean | null>
  systemControlled?: boolean
}

interface CrmMasterState {
  entries: CrmMasterEntry[]
  getByKind: (kind: CrmMasterKind, activeOnly?: boolean) => CrmMasterEntry[]
  getEntry: (id: string) => CrmMasterEntry | undefined
  getByCode: (kind: CrmMasterKind, code: string) => CrmMasterEntry | undefined
  getLabel: (kind: CrmMasterKind, code: string) => string
  addEntry: (input: CrmMasterInput) => { ok: boolean; error?: string; id?: string }
  updateEntry: (id: string, patch: Partial<CrmMasterInput>) => { ok: boolean; error?: string }
  duplicateEntry: (id: string) => { ok: boolean; error?: string; id?: string }
  activateEntry: (id: string) => { ok: boolean; error?: string }
  deactivateEntry: (id: string) => { ok: boolean; error?: string }
  deleteEntry: (id: string) => { ok: boolean; error?: string }
  importEntries: (
    kind: CrmMasterKind,
    rows: Array<{
      code: string
      name: string
      status?: string
      description?: string
      attributes?: Record<string, string | number | boolean | null>
    }>,
  ) => { ok: boolean; imported: number; skipped: number; error?: string }
  resetMasters: () => void
  hydrateFromApi: (entries: CrmMasterEntry[]) => void
}

function stripRetiredMasterEntries(entries: CrmMasterEntry[]): CrmMasterEntry[] {
  return entries.filter((e) => (e.kind as string) !== 'competitors')
}

function mergeLegacyFollowUpMasterEntries(entries: CrmMasterEntry[]): CrmMasterEntry[] {
  const withoutLegacy = stripRetiredMasterEntries(entries.filter((e) => (e.kind as string) !== 'follow-up-types'))
  const legacyFollowUps = entries.filter((e) => (e.kind as string) === 'follow-up-types')
  if (legacyFollowUps.length === 0) return withoutLegacy

  const merged = withoutLegacy.map((entry) => ({ ...entry, attributes: { ...entry.attributes } }))
  for (const legacy of legacyFollowUps) {
    const index = merged.findIndex((e) => e.kind === 'activity-types' && e.code === legacy.code)
    if (index >= 0) {
      merged[index] = {
        ...merged[index],
        attributes: {
          ...merged[index].attributes,
          ...legacy.attributes,
          useInFollowUp: true,
          useInActivity: merged[index].attributes.useInActivity ?? true,
        },
      }
      continue
    }
    merged.push({
      ...legacy,
      kind: 'activity-types',
      attributes: {
        ...legacy.attributes,
        useInFollowUp: true,
        useInActivity: false,
        systemGenerated: false,
      },
    })
  }
  return merged
}

function normalizeMasterEntries(entries: CrmMasterEntry[]): CrmMasterEntry[] {
  return mergeLegacyFollowUpMasterEntries(entries)
}

export const useCrmMasterStore = create<CrmMasterState>()(
  persist(
    (set, get) => ({
      entries: normalizeMasterEntries(CRM_MASTERS_SEED.map((e) => ({ ...e }))),

      getByKind: (kind, activeOnly = false) => {
        const entries = Array.isArray(get().entries) ? get().entries : []
        return memoizedOnSource(entries, `crm-master:${kind}:${activeOnly}`, () => {
          const list = entries.filter((e) => e.kind === kind)
          return activeOnly ? sortMasterEntries(list.filter((e) => e.status === 'active')) : sortMasterEntries(list)
        })
      },

      getEntry: (id) => (Array.isArray(get().entries) ? get().entries : []).find((e) => e.id === id),

      getByCode: (kind, code) =>
        (Array.isArray(get().entries) ? get().entries : []).find((e) => e.kind === kind && e.code === code),

      getLabel: (kind, code) => get().getByCode(kind, code)?.name ?? code,

      addEntry: (input) => {
        const code = input.code.trim()
        const name = input.name.trim()
        if (!code || !name) return { ok: false, error: 'Code and name are required.' }
        if (get().entries.some((e) => e.kind === input.kind && e.code === code)) {
          return { ok: false, error: 'A master with this code already exists.' }
        }
        const ts = nowIso()
        const stamps = stampCreated()
        const entry: CrmMasterEntry = {
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
          ...stamps,
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
                  modifiedBy: 'Demo User',
                  auditHistory: appendAudit(e, 'updated', 'Record updated'),
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
        const code = duplicateMasterCode(source.kind, source.code, entries)
        const name = duplicateMasterName(source.name)
        const ts = nowIso()
        const dup: CrmMasterEntry = {
          ...source,
          id: genId(source.kind),
          code,
          name,
          status: 'active',
          sortOrder: entries.filter((e) => e.kind === source.kind).length + 1,
          systemControlled: false,
          createdAt: ts,
          updatedAt: ts,
          createdBy: 'Demo User',
          modifiedBy: 'Demo User',
          auditHistory: [{ action: 'duplicated', at: ts, by: 'Demo User', detail: `Duplicated from ${source.code}` }],
        }
        set((s) => ({ entries: [...s.entries, dup] }))
        return { ok: true, id: dup.id }
      },

      activateEntry: (id) => {
        const existing = get().getEntry(id)
        if (!existing) return { ok: false, error: 'Master not found.' }
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status: 'active',
                  updatedAt: nowIso(),
                  modifiedBy: 'Demo User',
                  auditHistory: appendAudit(e, 'activated'),
                }
              : e,
          ),
        }))
        return { ok: true }
      },

      deactivateEntry: (id) => {
        const existing = get().getEntry(id)
        if (!existing) return { ok: false, error: 'Master not found.' }
        if (existing.systemControlled) return { ok: false, error: 'System-controlled values cannot be deactivated.' }
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status: 'inactive',
                  updatedAt: nowIso(),
                  modifiedBy: 'Demo User',
                  auditHistory: appendAudit(e, 'deactivated'),
                }
              : e,
          ),
        }))
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
            status: (row.status === 'inactive' ? 'inactive' : 'active'),
            description: row.description,
            attributes: row.attributes,
          })
          if (r.ok) imported += 1
          else skipped += 1
        }
        return { ok: true, imported, skipped }
      },

      deleteEntry: (id) => {
        const existing = get().getEntry(id)
        if (!existing) return { ok: false, error: 'Master not found.' }
        const gate = canDeleteMasterEntry(existing)
        if (!gate.ok) return { ok: false, error: gate.reason }
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }))
        return { ok: true }
      },

      resetMasters: () => set({ entries: normalizeMasterEntries(CRM_MASTERS_SEED.map((e) => ({ ...e }))) }),
      hydrateFromApi: (entries) => set({ entries: normalizeMasterEntries(entries) }),
    }),
    {
      name: 'vasant-crm-masters',
      storage: erpStorage,
      partialize: (s) => ({ entries: s.entries }),
      merge: (persisted, current) => {
        const state = persisted as Partial<CrmMasterState> | undefined
        const entries = normalizeMasterEntries(state?.entries ?? current.entries)
        return { ...current, ...state, entries }
      },
    },
  ),
)

/** Non-hook accessors for utils and legacy bridges */
export function getCrmMasterEntries(kind: CrmMasterKind, activeOnly = false) {
  return useCrmMasterStore.getState().getByKind(kind, activeOnly)
}

export function getCrmMasterLabel(kind: CrmMasterKind, code: string) {
  return useCrmMasterStore.getState().getLabel(kind, code)
}
