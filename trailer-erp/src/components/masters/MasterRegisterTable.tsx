import { useMemo } from 'react'
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
}

export function MasterRegisterTable<T extends object>({
  data,
  columns,
  includeAuditColumns = true,
  auditColumnMode = 'updated',
  emptyMessage,
}: MasterRegisterTableProps<T>) {
  const mergedColumns = useMemo(
    () =>
      includeAuditColumns
        ? mergeMasterListColumns(columns as ColumnDef<AuditableListRow, unknown>[], {
            include: true,
            mode: auditColumnMode,
          }) as ColumnDef<T, unknown>[]
        : columns,
    [columns, includeAuditColumns, auditColumnMode],
  )

  return <DataTable data={data} columns={mergedColumns} emptyMessage={emptyMessage} />
}
