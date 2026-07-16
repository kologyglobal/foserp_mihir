import type { BulkAction } from './BulkActionToolbar'

export interface EnterpriseBulkActionHandlers<T> {
  onAssign?: (rows: T[]) => void
  onChangeOwner?: (rows: T[]) => void
  onEmail?: (rows: T[]) => void
  onExport?: (rows: T[]) => void
  onDelete?: (rows: T[]) => void
  onInactive?: (rows: T[]) => void
  onActive?: (rows: T[]) => void
  canAssign?: boolean
  canDelete?: boolean
  canSetStatus?: boolean
}

/** Standard list bulk actions: Assign · Change Owner · Email · Export · Delete · Inactive · Active */
export function buildEnterpriseBulkActions<T>(
  selectedRows: T[],
  handlers: EnterpriseBulkActionHandlers<T>,
): BulkAction[] {
  const canAssign = handlers.canAssign ?? false
  const canDelete = handlers.canDelete ?? false
  const canSetStatus = handlers.canSetStatus ?? canAssign

  return [
    {
      id: 'assign',
      label: 'Assign',
      onClick: () => handlers.onAssign?.(selectedRows),
      disabled: !canAssign || !handlers.onAssign,
    },
    {
      id: 'change-owner',
      label: 'Change Owner',
      onClick: () => handlers.onChangeOwner?.(selectedRows),
      disabled: !canAssign || !handlers.onChangeOwner,
    },
    {
      id: 'email',
      label: 'Email',
      onClick: () => handlers.onEmail?.(selectedRows),
      disabled: !handlers.onEmail,
    },
    {
      id: 'export',
      label: 'Export',
      onClick: () => handlers.onExport?.(selectedRows),
      disabled: !handlers.onExport,
    },
    {
      id: 'delete',
      label: 'Delete',
      onClick: () => handlers.onDelete?.(selectedRows),
      danger: true,
      disabled: !canDelete || !handlers.onDelete,
    },
    {
      id: 'inactive',
      label: 'Inactive',
      onClick: () => handlers.onInactive?.(selectedRows),
      disabled: !canSetStatus || !handlers.onInactive,
    },
    {
      id: 'active',
      label: 'Active',
      onClick: () => handlers.onActive?.(selectedRows),
      disabled: !canSetStatus || !handlers.onActive,
    },
  ]
}
