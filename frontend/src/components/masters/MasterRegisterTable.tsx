import { useMemo, type ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../tables/DataTable'
import type { AuditableListRow } from '../../utils/masterAudit'
import {
  mergeMasterListColumns,
  type MasterAuditColumnMode,
} from './MasterAuditListColumns'

interface MasterRegisterTableProps<T extends object> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  /** Append Created/Updated audit columns — default true */
  includeAuditColumns?: boolean
  /** `updated` = Updated On + Updated By; `full` = Created + Updated */
  auditColumnMode?: MasterAuditColumnMode
  emptyMessage?: string
  /** Filter / search / status / Columns — injected by MasterListShell */
  registerBar?: ReactNode
}

/** Pin identity + actions as required (cannot hide in Columns menu). */
function pinRequiredColumns<T extends object>(cols: ColumnDef<T, unknown>[]): ColumnDef<T, unknown>[] {
  if (cols.length === 0) return cols
  return cols.map((col, index) => {
    const id = String(col.id ?? ('accessorKey' in col ? col.accessorKey : '') ?? '')
    const isActions = id === 'actions'
    const isFirst = index === 0
    if (!isActions && !isFirst) return col
    if (col.enableHiding === false) return col
    return { ...col, enableHiding: false }
  })
}

export function MasterRegisterTable<T extends object>({
  data,
  columns,
  includeAuditColumns = true,
  auditColumnMode = 'updated',
  emptyMessage,
  registerBar,
}: MasterRegisterTableProps<T>) {
  const mergedColumns = useMemo(() => {
    const withAudit = includeAuditColumns
      ? mergeMasterListColumns(columns as ColumnDef<AuditableListRow, unknown>[], {
          include: true,
          mode: auditColumnMode,
        }) as ColumnDef<T, unknown>[]
      : columns
    return pinRequiredColumns(withAudit)
  }, [columns, includeAuditColumns, auditColumnMode])

  return (
    <DataTable
      data={data}
      columns={mergedColumns}
      emptyMessage={emptyMessage}
      registerBar={registerBar}
      showCompactSearch={false}
    />
  )
}
