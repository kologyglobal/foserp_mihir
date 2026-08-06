/** Shared document-number sort keys for register list pages. */

export type DocumentNumberSortDirection = 'asc' | 'desc'

/** Legacy `documentNumber` is treated as A→Z for saved views. */
export type DocumentNumberSortKey = 'documentNumber' | 'documentNumberAsc' | 'documentNumberDesc'

export function documentNumberSortOptions(numberLabel: string): {
  value: DocumentNumberSortKey
  label: string
}[] {
  return [
    { value: 'documentNumberAsc', label: `Sort: ${numberLabel} (A→Z)` },
    { value: 'documentNumberDesc', label: `Sort: ${numberLabel} (Z→A)` },
  ]
}

export function isDocumentNumberSortKey(key: string): key is DocumentNumberSortKey {
  return key === 'documentNumber' || key === 'documentNumberAsc' || key === 'documentNumberDesc'
}

export function documentNumberSortDirection(key: string): DocumentNumberSortDirection | null {
  if (key === 'documentNumberDesc') return 'desc'
  if (key === 'documentNumber' || key === 'documentNumberAsc') return 'asc'
  return null
}

export function compareDocumentNumbers(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: DocumentNumberSortDirection = 'asc',
): number {
  const as = a ?? ''
  const bs = b ?? ''
  const cmp = as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' })
  return direction === 'asc' ? cmp : -cmp
}
