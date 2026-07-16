import type { ColumnDef } from '@tanstack/react-table'
import { SaaSDataGrid } from '../saas/SaaSDataGrid'

/** Dynamics-style compact enterprise grid wrapper */
export function DynamicsDataGrid<T>({
  data,
  columns,
  compact = true,
  stickyHeader = true,
  emptyMessage,
  onRowView,
  showToolbarExport = false,
}: {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  compact?: boolean
  stickyHeader?: boolean
  emptyMessage?: string
  onRowView?: (row: T) => void
  showToolbarExport?: boolean
}) {
  return (
    <div className="dyn-data-grid">
      <SaaSDataGrid
        data={data}
        columns={columns}
        compact={compact}
        stickyHeader={stickyHeader}
        emptyMessage={emptyMessage}
        onRowView={onRowView}
        showToolbarExport={showToolbarExport}
      />
    </div>
  )
}
