import type { ColumnDef } from '@tanstack/react-table'
import {
  type AuditableListRow,
  resolveRecordCreatedByForList,
  resolveRecordCreatedOnForList,
  resolveRecordUpdatedBy,
  resolveRecordUpdatedOn,
} from '../../utils/masterAudit'

export type MasterAuditColumnMode = 'updated' | 'full'

function updatedOnColumn<T extends AuditableListRow>(): ColumnDef<T, unknown> {
  return {
    id: 'updatedOn',
    header: 'Updated On',
    enableSorting: true,
    accessorFn: (row) => row.modifiedAt ?? row.updatedAt ?? row.createdAt ?? '',
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-xs text-erp-muted">{resolveRecordUpdatedOn(row.original)}</span>
    ),
  }
}

function updatedByColumn<T extends AuditableListRow>(): ColumnDef<T, unknown> {
  return {
    id: 'updatedBy',
    header: 'Updated By',
    enableSorting: true,
    accessorFn: (row) => resolveRecordUpdatedBy(row),
    cell: ({ row }) => (
      <span className="text-xs text-erp-text whitespace-nowrap">{resolveRecordUpdatedBy(row.original)}</span>
    ),
  }
}

function createdOnColumn<T extends AuditableListRow>(): ColumnDef<T, unknown> {
  return {
    id: 'createdOn',
    header: 'Created On',
    enableSorting: true,
    accessorFn: (row) => row.createdAt ?? '',
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-xs text-erp-muted">{resolveRecordCreatedOnForList(row.original)}</span>
    ),
  }
}

function createdByColumn<T extends AuditableListRow>(): ColumnDef<T, unknown> {
  return {
    id: 'createdBy',
    header: 'Created By',
    enableSorting: true,
    accessorFn: (row) => resolveRecordCreatedByForList(row),
    cell: ({ row }) => <span className="text-xs text-erp-text">{resolveRecordCreatedByForList(row.original)}</span>,
  }
}

export function buildMasterAuditListColumns<T extends AuditableListRow>(
  mode: MasterAuditColumnMode = 'updated',
): ColumnDef<T, unknown>[] {
  if (mode === 'full') {
    return [createdOnColumn<T>(), createdByColumn<T>(), updatedOnColumn<T>(), updatedByColumn<T>()]
  }
  return [updatedOnColumn<T>(), updatedByColumn<T>()]
}

const AUDIT_COLUMN_IDS = new Set(['updatedOn', 'updatedBy', 'createdOn', 'createdBy'])

/** Insert audit columns before the actions column when present. */
export function mergeMasterListColumns<T extends AuditableListRow>(
  columns: ColumnDef<T, unknown>[],
  options?: { mode?: MasterAuditColumnMode; include?: boolean },
): ColumnDef<T, unknown>[] {
  if (options?.include === false) return columns

  const mode = options?.mode ?? 'updated'
  const audit = buildMasterAuditListColumns<T>(mode)
  const filtered = columns.filter((c) => !AUDIT_COLUMN_IDS.has(String(c.id ?? '')))
  const actionIdx = filtered.findIndex((c) => c.id === 'actions')
  if (actionIdx >= 0) {
    return [...filtered.slice(0, actionIdx), ...audit, ...filtered.slice(actionIdx)]
  }
  return [...filtered, ...audit]
}
