import type { ColumnOrderState, VisibilityState } from '@tanstack/react-table'

export type DataGridColumnLayout = {
  visibility: VisibilityState
  order: ColumnOrderState
}

const STORAGE_KEY = 'vasant-erp-grid-column-layouts'

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
