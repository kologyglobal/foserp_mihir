import { ALL_MASTER_DEFINITIONS, MASTER_MODULE_GROUPS } from '../config/masterModuleStructure'
import type { Customer, Item, Vendor } from '../types/master'
import type { CrmMasterEntry } from '../types/crmMasters'
import type { BomHeader } from '../types/bom'
import type { RoutingHeader } from '../types/routing'
import type { WorkCenter } from '../types/workcenter'

export interface MasterRecentRecord {
  id: string
  label: string
  sublabel: string
  href: string
  timestamp: string
  action: 'modified' | 'created'
}

function pickRecent<T extends { id: string; updatedAt?: string; createdAt?: string }>(
  rows: T[],
  label: (row: T) => string,
  sublabel: (row: T) => string,
  href: (row: T) => string,
  limit: number,
): MasterRecentRecord[] {
  return [...rows]
    .sort((a, b) => {
      const av = a.updatedAt ?? a.createdAt ?? ''
      const bv = b.updatedAt ?? b.createdAt ?? ''
      return bv.localeCompare(av)
    })
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      label: label(row),
      sublabel: sublabel(row),
      href: href(row),
      timestamp: row.updatedAt ?? row.createdAt ?? '',
      action: row.updatedAt && row.createdAt && row.updatedAt !== row.createdAt ? 'modified' : 'created',
    }))
}

export function buildMasterRecentModified(input: {
  customers: Customer[]
  vendors: Vendor[]
  items: Item[]
  crmEntries: CrmMasterEntry[]
  bomHeaders: BomHeader[]
  limit?: number
}): MasterRecentRecord[] {
  const limit = input.limit ?? 8
  const merged = [
    ...pickRecent(
      input.customers,
      (c) => c.customerName,
      () => 'Company',
      (c) => `/masters/companies/${c.id}/360`,
      limit,
    ),
    ...pickRecent(
      input.vendors,
      (v) => v.vendorName,
      () => 'Vendor',
      (v) => `/masters/vendors/${v.id}`,
      limit,
    ),
    ...pickRecent(
      input.items,
      (i) => i.itemCode,
      (i) => i.itemName,
      (i) => `/masters/items/${i.id}`,
      limit,
    ),
    ...pickRecent(
      input.crmEntries.filter((e) => e.kind === 'owners'),
      (e) => e.name,
      () => 'Employee',
      (e) => `/masters/users/${e.id}`,
      limit,
    ),
    ...pickRecent(
      input.bomHeaders,
      (b) => b.bomNo,
      (b) => b.description || 'BOM',
      (b) => `/masters/bom/${b.id}/manage`,
      limit,
    ),
  ]
  return merged
    .filter((r) => r.timestamp)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit)
}

export function buildMasterRecentCreated(input: {
  customers: Customer[]
  vendors: Vendor[]
  items: Item[]
  limit?: number
}): MasterRecentRecord[] {
  const limit = input.limit ?? 6
  const merged = [
    ...pickRecent(
      input.customers,
      (c) => c.customerName,
      () => 'Company',
      (c) => `/masters/companies/${c.id}/360`,
      limit,
    ),
    ...pickRecent(
      input.vendors,
      (v) => v.vendorName,
      () => 'Vendor',
      (v) => `/masters/vendors/${v.id}`,
      limit,
    ),
    ...pickRecent(
      input.items,
      (i) => i.itemCode,
      (i) => i.itemName,
      (i) => `/masters/items/${i.id}`,
      limit,
    ),
  ]
  return merged
    .filter((r) => r.timestamp)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit)
}

export function searchMasterCatalog(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return ALL_MASTER_DEFINITIONS.filter(
    (m) =>
      m.label.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.path.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q),
  ).slice(0, 12)
}

export function groupMasterCatalogResults(query: string) {
  const hits = searchMasterCatalog(query)
  const byGroup = new Map<string, typeof hits>()
  for (const hit of hits) {
    const group = MASTER_MODULE_GROUPS.find((g) => g.id === hit.groupId)
    const key = group?.title ?? hit.groupId
    const list = byGroup.get(key) ?? []
    list.push(hit)
    byGroup.set(key, list)
  }
  return [...byGroup.entries()]
}

export function masterSummaryMetrics(input: {
  customers: Customer[]
  vendors: Vendor[]
  items: Item[]
  users: number
  hsn: number
  gstGroups: number
  gstRates: number
  workCenters: WorkCenter[]
  bomHeaders: BomHeader[]
  routingHeaders: RoutingHeader[]
}) {
  return {
    companies: input.customers.length,
    customers: input.customers.length,
    vendors: input.vendors.length,
    items: input.items.length,
    users: input.users,
    taxMasters: input.hsn + input.gstGroups + input.gstRates,
    workCenters: input.workCenters.length,
    boms: input.bomHeaders.length,
    routes: input.routingHeaders.length,
  }
}

const PINNED_STORAGE_KEY = 'fos-master-pinned-v1'

export function readPinnedMasters(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writePinnedMasters(paths: string[]) {
  localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(paths.slice(0, 8)))
}

export function togglePinnedMaster(path: string): string[] {
  const current = readPinnedMasters()
  const next = current.includes(path) ? current.filter((p) => p !== path) : [...current, path]
  writePinnedMasters(next)
  return next
}
