import {
  ALL_MASTER_SETUP_LINKS,
  MASTERS_SETUP_GROUPS,
  type MasterSetupGroup,
  type MasterSetupLink,
} from '../config/mastersSetupCatalog'
import { ALL_MASTER_DEFINITIONS } from '../config/masterModuleStructure'

export interface MasterIndexRow {
  id: string
  label: string
  path: string
  description: string
  groupId: string
  groupTitle: string
  groupAccent: MasterSetupGroup['accent']
  count?: number
  status?: MasterSetupLink['status']
  subsection?: string
  slug?: string
  searchText: string
}

export function buildMasterIndexRows(counts: Record<string, number>): MasterIndexRow[] {
  const groupTitle = new Map(MASTERS_SETUP_GROUPS.map((g) => [g.id, g.title]))
  const groupAccent = new Map(MASTERS_SETUP_GROUPS.map((g) => [g.id, g.accent]))

  return ALL_MASTER_SETUP_LINKS.map((link) => ({
    id: link.path,
    label: link.label,
    path: link.path,
    description: link.description ?? '',
    groupId: link.groupId,
    groupTitle: groupTitle.get(link.groupId) ?? link.groupId,
    groupAccent: groupAccent.get(link.groupId) ?? 'slate',
    count: link.countKey ? counts[link.countKey] : undefined,
    status: link.status,
    subsection: link.subsection,
    slug: link.slug,
    searchText: [
      link.label,
      link.description,
      link.subsection,
      link.slug,
      link.path,
      groupTitle.get(link.groupId),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  })).sort((a, b) => a.label.localeCompare(b.label))
}

export function filterMasterIndexRows(
  rows: MasterIndexRow[],
  query: string,
  categoryId: string | 'all' | 'pinned',
  pinnedPaths: string[],
): MasterIndexRow[] {
  let result = rows

  if (categoryId === 'pinned') {
    result = result.filter((r) => pinnedPaths.includes(r.path))
  } else if (categoryId !== 'all') {
    result = result.filter((r) => r.groupId === categoryId)
  }

  const q = query.trim().toLowerCase()
  if (!q) return result

  return result.filter((r) => r.searchText.includes(q))
}

export function groupMasterIndexRows(rows: MasterIndexRow[]): { groupTitle: string; groupId: string; rows: MasterIndexRow[] }[] {
  const order = MASTERS_SETUP_GROUPS.map((g) => g.id)
  const map = new Map<string, MasterIndexRow[]>()

  for (const row of rows) {
    const list = map.get(row.groupId) ?? []
    list.push(row)
    map.set(row.groupId, list)
  }

  return order
    .filter((id) => map.has(id))
    .map((id) => ({
      groupId: id,
      groupTitle: map.get(id)![0].groupTitle,
      rows: map.get(id)!,
    }))
}

/** Extended catalog search — all matching definitions */
export function searchMasterCatalogAll(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return ALL_MASTER_DEFINITIONS.filter(
    (m) =>
      m.label.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.path.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q),
  )
}

export function highlightMatch(text: string, query: string): { before: string; match: string; after: string } | null {
  const q = query.trim()
  if (!q) return null
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx < 0) return null
  return {
    before: text.slice(0, idx),
    match: text.slice(idx, idx + q.length),
    after: text.slice(idx + q.length),
  }
}

export const MASTER_INDEX_CATEGORY_ALL = 'all' as const
export const MASTER_INDEX_CATEGORY_PINNED = 'pinned' as const

export type MasterIndexCategoryFilter = typeof MASTER_INDEX_CATEGORY_ALL | typeof MASTER_INDEX_CATEGORY_PINNED | string

export function masterIndexCategoryCounts(rows: MasterIndexRow[], pinnedPaths: string[]) {
  const counts = new Map<string, number>()
  counts.set(MASTER_INDEX_CATEGORY_ALL, rows.length)
  counts.set(MASTER_INDEX_CATEGORY_PINNED, rows.filter((r) => pinnedPaths.includes(r.path)).length)
  for (const row of rows) {
    counts.set(row.groupId, (counts.get(row.groupId) ?? 0) + 1)
  }
  return counts
}
