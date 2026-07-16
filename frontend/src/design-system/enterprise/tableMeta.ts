import type { ColumnDef } from '@tanstack/react-table'

export type EnterpriseColumnAlign = 'left' | 'center' | 'right'

export interface EnterpriseColumnMeta {
  align?: EnterpriseColumnAlign
  /** Applies numeric typography + right alignment */
  numeric?: boolean
  columnLabel?: string
  cellClass?: string
}

/** Build column meta for numeric fields (amount, qty, probability, margin…) */
export function entNumericMeta(label?: string): EnterpriseColumnMeta {
  return { align: 'right', numeric: true, columnLabel: label }
}

/** Build column meta for ID columns */
export function entIdMeta(label?: string): EnterpriseColumnMeta {
  return { align: 'left', columnLabel: label }
}

/** Build column meta for action/checkbox columns */
export function entCenterMeta(label?: string): EnterpriseColumnMeta {
  return { align: 'center', columnLabel: label }
}

export function entMetaToClasses(meta?: EnterpriseColumnMeta): string {
  const parts: string[] = []
  if (meta?.align === 'right') parts.push('ent-align-right')
  if (meta?.align === 'center') parts.push('ent-align-center')
  if (meta?.numeric) parts.push('ent-td-numeric', 'num')
  if (meta?.cellClass) parts.push(meta.cellClass)
  return parts.join(' ')
}

/** Type-safe column def helper */
export function entColumn<T>(
  def: ColumnDef<T, unknown> & { meta?: EnterpriseColumnMeta },
): ColumnDef<T, unknown> {
  return def
}
