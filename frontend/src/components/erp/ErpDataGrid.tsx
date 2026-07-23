import type { ColumnDef, OnChangeFn, RowSelectionState } from '@tanstack/react-table'
import { DataGrid } from '../design-system/DataGrid'
import { cn } from '../../utils/cn'

export interface ErpDataGridProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  className?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  emptyMessage?: string
  emptyAction?: React.ReactNode
  exportFileName?: string
  onExport?: () => void
  filterSlot?: React.ReactNode
  activeView?: string
  viewOptions?: string[]
  onViewChange?: (view: string) => void
  footer?: React.ReactNode
  onRowView?: (row: T) => void
  onRowEdit?: (row: T) => void
  onRowHistory?: (row: T) => void
  onRowQuickView?: (row: T) => void
  selectedRowId?: string | null
  onRowSelect?: (row: T) => void
  stickyFirstColumn?: boolean
  initialSortColumnId?: string
  initialSortDesc?: boolean
  selectable?: boolean
  getRowCanSelect?: (row: T) => boolean
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  getRowId?: (row: T) => string
  recordLabel?: string
  bulkActions?: React.ReactNode
  pageSizeOptions?: number[]
  showCompactSearch?: boolean
  showToolbarView?: boolean
  showToolbarExport?: boolean
  /** When false, column headers are not sortable (use page-level sort instead) */
  enableColumnSorting?: boolean
  /** Search / filters / sort / view controls inside table shell */
  registerBar?: React.ReactNode
}

export function ErpDataGrid<T>({
  className,
  initialSortColumnId,
  initialSortDesc = true,
  showCompactSearch = false,
  showToolbarView = false,
  showToolbarExport = false,
  enableColumnSorting = true,
  registerBar,
  ...props
}: ErpDataGridProps<T>) {
  const sortedData = initialSortColumnId
    ? [...props.data].sort((a, b) => {
        const av = (a as Record<string, unknown>)[initialSortColumnId]
        const bv = (b as Record<string, unknown>)[initialSortColumnId]
        const as = String(av ?? '')
        const bs = String(bv ?? '')
        return initialSortDesc ? bs.localeCompare(as) : as.localeCompare(bs)
      })
    : props.data

  return (
    <div className={cn('erp-data-grid', className)}>
      <DataGrid
        {...props}
        data={sortedData}
        toolbar="compact"
        compact
        zebra
        stickyHeader
        showCompactSearch={showCompactSearch}
        showToolbarView={showToolbarView}
        showToolbarExport={showToolbarExport}
        enableColumnSorting={enableColumnSorting}
        registerBar={registerBar}
      />
    </div>
  )
}
