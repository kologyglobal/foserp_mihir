import type { ColumnOrderState, VisibilityState } from '@tanstack/react-table'
import {
  canSyncUiPreferences,
  listUiPreferences,
  putUiPreference,
} from '../services/api/uiPreferencesApi'

export type DataGridColumnLayout = {
  visibility: VisibilityState
  order: ColumnOrderState
}

const STORAGE_KEY = 'vasant-erp-grid-column-layouts'

/** Server pref key namespace: `grid-columns:<layoutKey>`. */
const SERVER_PREF_PREFIX = 'grid-columns:'
const SERVER_SAVE_DEBOUNCE_MS = 1500

/** Fired on `window` after server layouts have been merged into localStorage. */
export const DATAGRID_LAYOUTS_HYDRATED_EVENT = 'fos-erp-datagrid-layouts-hydrated'

function readAll(): Record<string, DataGridColumnLayout> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Record<string, DataGridColumnLayout>
  } catch {
    return {}
  }
}

function writeAll(all: Record<string, DataGridColumnLayout>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* quota / private mode — ignore */
  }
}

export function loadDataGridColumnLayout(layoutKey: string): DataGridColumnLayout | null {
  const entry = readAll()[layoutKey]
  if (!entry) return null
  const visibility =
    entry.visibility && typeof entry.visibility === 'object' ? entry.visibility : {}
  const order = Array.isArray(entry.order)
    ? entry.order.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  return { visibility, order }
}

export function saveDataGridColumnLayout(layoutKey: string, layout: DataGridColumnLayout) {
  if (!layoutKey) return
  const all = readAll()
  all[layoutKey] = {
    visibility: { ...layout.visibility },
    order: [...layout.order],
  }
  writeAll(all)
  scheduleServerSave(layoutKey, all[layoutKey])
}

// ─── Server sync (API mode only) ─────────────────────────────────────────────
// localStorage stays the synchronous source grids read from; the server copy
// makes layouts survive browser resets and follow the user across devices.

function sanitizeLayout(value: unknown): DataGridColumnLayout | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<DataGridColumnLayout>
  const visibility =
    raw.visibility && typeof raw.visibility === 'object' && !Array.isArray(raw.visibility)
      ? Object.fromEntries(
          Object.entries(raw.visibility).filter(([, v]) => typeof v === 'boolean'),
        )
      : {}
  const order = Array.isArray(raw.order)
    ? raw.order.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  if (Object.keys(visibility).length === 0 && order.length === 0) return null
  return { visibility, order }
}

let hydrationStarted = false
const lastSyncedJson = new Map<string, string>()
const pendingServerSaves = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * One-shot: pull the user's saved layouts from the server and merge them into
 * localStorage (server wins — it is the durable cross-device copy). Grids that
 * are already mounted re-read their layout on DATAGRID_LAYOUTS_HYDRATED_EVENT.
 */
export function ensureDataGridColumnLayoutsHydrated(): void {
  if (hydrationStarted) return
  hydrationStarted = true
  if (!canSyncUiPreferences()) return
  void listUiPreferences()
    .then((rows) => {
      const all = readAll()
      let changed = false
      for (const row of rows) {
        if (!row.prefKey.startsWith(SERVER_PREF_PREFIX)) continue
        const layoutKey = row.prefKey.slice(SERVER_PREF_PREFIX.length)
        const layout = sanitizeLayout(row.value)
        if (!layoutKey || !layout) continue
        const json = JSON.stringify(layout)
        lastSyncedJson.set(layoutKey, json)
        if (JSON.stringify(all[layoutKey] ?? null) !== json) {
          all[layoutKey] = layout
          changed = true
        }
      }
      if (changed) {
        writeAll(all)
        window.dispatchEvent(new CustomEvent(DATAGRID_LAYOUTS_HYDRATED_EVENT))
      }
    })
    .catch(() => {
      /* offline / expired session — local layouts still work */
    })
}

function scheduleServerSave(layoutKey: string, layout: DataGridColumnLayout) {
  if (!canSyncUiPreferences()) return
  const json = JSON.stringify(layout)
  if (lastSyncedJson.get(layoutKey) === json) return
  const pending = pendingServerSaves.get(layoutKey)
  if (pending) clearTimeout(pending)
  pendingServerSaves.set(
    layoutKey,
    setTimeout(() => {
      pendingServerSaves.delete(layoutKey)
      void putUiPreference(`${SERVER_PREF_PREFIX}${layoutKey}`, layout)
        .then(() => {
          lastSyncedJson.set(layoutKey, json)
        })
        .catch(() => {
          /* transient failure — next change retries */
        })
    }, SERVER_SAVE_DEBOUNCE_MS),
  )
}

/** Document / register number column ids that remain header-sortable when page-level sort is used. */
export function isDocumentNumberColumnId(columnId: string): boolean {
  const id = columnId.trim().toLowerCase()
  if (!id || id === 'select' || id === 'actions') return false
  if (id === 'documentnumber' || id === 'documentno' || id === 'docnumber' || id === 'number') {
    return true
  }
  // Register document / reference numbers (header A→Z / Z→A)
  return (
    id.endsWith('documentnumber') ||
    id === 'invoicenumber' ||
    id === 'invoiceno' ||
    id === 'grnnumber' ||
    id === 'prnumber' ||
    id === 'ponumber' ||
    id === 'rfqnumber' ||
    id === 'returnnumber' ||
    id === 'vqnumber' ||
    id === 'salesordernumber' ||
    id === 'ordernumber' ||
    id === 'sono' ||
    id === 'prono' ||
    id === 'cnno' ||
    id === 'creditnoteno' ||
    id === 'notenumber' ||
    id === 'note number'
  )
}
