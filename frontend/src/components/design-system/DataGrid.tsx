import { useEffect, useMemo, useRef, useState, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnOrderState,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  Download,
  ChevronDown,
  Eye,
  Filter,
  GripVertical,
  History,
  Pencil,
  Printer,
  Search,
  PanelLeft,
  Archive,
} from 'lucide-react'
import { cn } from '../../utils/cn'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonTable } from './SkeletonTable'
import { Checkbox } from '../forms/Inputs'
import { entMetaToClasses, type EnterpriseColumnMeta } from '../../design-system/enterprise/tableMeta'
import { useDensityClass } from '../../design-system/enterprise/DensityProvider'
import { EnterprisePagination } from '../../design-system/list-page/EnterprisePagination'

export interface DataGridProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  globalFilterFn?: (row: T, filter: string) => boolean
  emptyMessage?: string
  pageSize?: number
  stickyHeader?: boolean
  compact?: boolean
  showPagination?: boolean
  /** @deprecated Prefer `toolbar` — when true, shows full toolbar with in-table search */
  showToolbar?: boolean
  /** full = search + filters + columns; compact = columns + view + export (default for list pages); none = hidden */
  toolbar?: 'full' | 'compact' | 'none'
  exportFileName?: string
  onRowView?: (row: T) => void
  onRowEdit?: (row: T) => void
  onRowPrint?: (row: T) => void
  onRowHistory?: (row: T) => void
  footer?: React.ReactNode
  /** @deprecated Prefer `activeView` */
  viewName?: string
  viewOptions?: string[]
  activeView?: string
  onViewChange?: (view: string) => void
  /** Extra filters rendered left of Columns (e.g. stage select) */
  filterSlot?: React.ReactNode
  onExport?: () => void
  /** Show search in compact toolbar (default: true) */
  showCompactSearch?: boolean
  /** Saved-view picker in grid toolbar — off by default when view lives in page filter bar */
  showToolbarView?: boolean
  /** Export in grid toolbar — off by default when export lives in page command bar */
  showToolbarExport?: boolean
  stickyFirstColumn?: boolean
  zebra?: boolean
  loading?: boolean
  onRowQuickView?: (row: T) => void
  selectedRowId?: string | null
  onRowSelect?: (row: T) => void
  emptyAction?: React.ReactNode
  /** Multi-select with green checkboxes (DataTable spec) */
  selectable?: boolean
  /** When selectable, return false to disable the row checkbox (e.g. terminal statuses). */
  getRowCanSelect?: (row: T) => boolean
  getRowId?: (row: T) => string
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  /** Entity label in toolbar, e.g. "Leads" → "Leads (51)" */
  recordLabel?: string
  /** Bulk action toolbar rendered above table when rows are selected */
  bulkActions?: ReactNode
  pageSizeOptions?: number[]
  onPageSizeChange?: (size: number) => void
  /** When false, disables header click sorting (page-level sort handles ordering) */
  enableColumnSorting?: boolean
  /** Search / filters / sort / view row rendered inside the table shell above column headers */
  registerBar?: ReactNode
}

export function DataGrid<T>({
  data,
  columns,
  searchValue: externalSearch = '',
  onSearchChange,
  searchPlaceholder = 'Search records…',
  globalFilterFn,
  emptyMessage = 'No records found.',
  pageSize = 25,
  stickyHeader = true,
  compact = true,
  showPagination = true,
  showToolbar,
  toolbar,
  exportFileName = 'export',
  onRowView,
  onRowEdit,
  onRowPrint,
  onRowHistory,
  footer,
  viewName = 'Default view',
  viewOptions,
  activeView,
  onViewChange,
  filterSlot,
  onExport,
  showCompactSearch = true,
  showToolbarView = false,
  showToolbarExport = false,
  stickyFirstColumn = false,
  zebra = true,
  loading = false,
  onRowQuickView,
  selectedRowId,
  onRowSelect,
  emptyAction,
  selectable = false,
  getRowCanSelect,
  getRowId,
  rowSelection: controlledSelection,
  onRowSelectionChange,
  recordLabel,
  bulkActions,
  pageSizeOptions = [10, 25, 50, 100],
  onPageSizeChange,
  enableColumnSorting = true,
  registerBar,
}: DataGridProps<T>) {
  const densityClass = useDensityClass()
  const [sorting, setSorting] = useState<SortingState>([])
  const [internalSearch, setInternalSearch] = useState('')
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
  const [dragColumnId, setDragColumnId] = useState<string | null>(null)
  const [showColumnChooser, setShowColumnChooser] = useState(false)
  const [showViewMenu, setShowViewMenu] = useState(false)
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({})
  const [currentPageSize, setCurrentPageSize] = useState(pageSize)
  const columnMenuRef = useRef<HTMLDivElement>(null)
  const viewMenuRef = useRef<HTMLDivElement>(null)

  const resolvedViewOptions = viewOptions ?? (viewName ? [viewName] : ['Default view'])
  const resolvedActiveView = activeView ?? viewName ?? resolvedViewOptions[0] ?? 'Default view'

  const toolbarMode = useMemo((): 'full' | 'compact' | 'none' => {
    if (toolbar) return toolbar
    if (showToolbar === true) return 'full'
    if (showToolbar === false) return 'compact'
    return 'compact'
  }, [toolbar, showToolbar])

  useEffect(() => {
    if (!showColumnChooser && !showViewMenu) return
    function onPointerDown(e: MouseEvent) {
      if (showColumnChooser && columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setShowColumnChooser(false)
      }
      if (showViewMenu && viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setShowViewMenu(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [showColumnChooser, showViewMenu])

  const rowSelection = controlledSelection ?? internalRowSelection
  const setRowSelection = onRowSelectionChange ?? setInternalRowSelection

  const searchValue = onSearchChange ? externalSearch : internalSearch
  const setSearchValue = onSearchChange ?? setInternalSearch

  const filteredData = useMemo(() => {
    if (!searchValue || !globalFilterFn) return data
    return data.filter((row) => globalFilterFn(row, searchValue.toLowerCase()))
  }, [data, searchValue, globalFilterFn])

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnOrder,
      ...(selectable ? { rowSelection: rowSelection ?? {} } : {}),
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onRowSelectionChange: selectable ? setRowSelection : undefined,
    enableRowSelection: selectable
      ? getRowCanSelect
        ? (row) => getRowCanSelect(row.original)
        : true
      : false,
    enableSorting: enableColumnSorting,
    getRowId: getRowId ?? ((_, index) => String(index)),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: currentPageSize } },
  })

  function currentColumnOrderIds() {
    return columnOrder.length > 0
      ? [...columnOrder]
      : table.getAllLeafColumns().map((col) => col.id)
  }

  function reorderColumn(dragId: string, dropId: string) {
    if (dragId === dropId) return
    const order = currentColumnOrderIds()
    const movable = order.filter((id) => table.getColumn(id)?.getCanHide())
    const fixedTail = order.filter((id) => !table.getColumn(id)?.getCanHide())
    const from = movable.indexOf(dragId)
    const to = movable.indexOf(dropId)
    if (from < 0 || to < 0) return
    const next = [...movable]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setColumnOrder([...next, ...fixedTail])
  }

  useEffect(() => {
    table.setPageSize(currentPageSize)
  }, [currentPageSize, table])

  const pageCount = table.getPageCount()
  const pageIndex = table.getState().pagination.pageIndex
  const resolvedPageSize = table.getState().pagination.pageSize
  const totalRows = filteredData.length
  const from = totalRows === 0 ? 0 : pageIndex * resolvedPageSize + 1
  const to = Math.min((pageIndex + 1) * resolvedPageSize, totalRows)
  const selectedCount = Object.keys(rowSelection ?? {}).filter((k) => rowSelection[k]).length

  function handlePageSizeChange(size: number) {
    setCurrentPageSize(size)
    onPageSizeChange?.(size)
    table.setPageIndex(0)
  }

  function handleRowClick(row: T, event: React.MouseEvent<HTMLTableRowElement>) {
    const target = event.target as HTMLElement
    if (
      target.closest('.ent-row-actions') ||
      target.closest('[data-row-actions]') ||
      target.closest('.erp-table-actions-cell') ||
      target.closest('a') ||
      target.closest('button') ||
      target.closest("input, select, textarea, label, [role='menuitem']")
    ) {
      return
    }
    // Don't navigate/select when the user was selecting text
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
      return
    }
    if (onRowQuickView) {
      onRowQuickView(row)
      return
    }
    onRowSelect?.(row)
  }

  function exportCsv() {
    if (onExport) {
      onExport()
      return
    }
    const visibleCols = table.getVisibleLeafColumns()
    const headers = visibleCols.map((c) => String(c.columnDef.header ?? c.id))
    const rows = table.getRowModel().rows.map((row) =>
      visibleCols.map((col) => {
        const val = row.getValue(col.id)
        return val == null ? '' : String(val).replace(/,/g, ';')
      }),
    )
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${exportFileName}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasCustomActionsColumn = columns.some((c) => c.id === 'actions')
  const hasRowActions =
    !hasCustomActionsColumn && (onRowView || onRowEdit || onRowPrint || onRowHistory || onRowQuickView)

  function columnChooserLabel(colId: string, header: ColumnDef<T, unknown>['header'], meta?: { columnLabel?: string }) {
    if (meta?.columnLabel) return meta.columnLabel
    if (typeof header === 'string') return header
    return colId
  }

  const showGridToolbar = toolbarMode !== 'none' && !registerBar

  const reorderableColumns = table.getAllLeafColumns().filter((col) => col.getCanHide())

  const columnChooser = toolbarMode !== 'none' ? (
    <div className="relative shrink-0" ref={columnMenuRef}>
      <Button
        variant="secondary"
        size="sm"
        type="button"
        onClick={() => setShowColumnChooser((v) => !v)}
        aria-expanded={showColumnChooser}
        aria-haspopup="true"
        className="ent-data-grid__columns-btn"
      >
        <Columns3 className="h-3.5 w-3.5" /> Columns
      </Button>
      {showColumnChooser && (
        <div
          className="ent-data-grid__column-chooser absolute right-0 top-full z-[80] mt-1 max-h-80 w-72 overflow-y-auto rounded-lg border border-erp-border bg-erp-surface p-2 shadow-erp-md"
          role="dialog"
          aria-label="Show and reorder columns"
        >
          <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
            Drag to reorder · toggle to show/hide
          </p>
          {reorderableColumns.map((col) => {
            const label = columnChooserLabel(col.id, col.columnDef.header, col.columnDef.meta)
            return (
              <div
                key={col.id}
                draggable
                onDragStart={(e) => {
                  setDragColumnId(col.id)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', col.id)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const from = e.dataTransfer.getData('text/plain') || dragColumnId
                  if (from) reorderColumn(from, col.id)
                  setDragColumnId(null)
                }}
                onDragEnd={() => setDragColumnId(null)}
                className={cn(
                  'ent-data-grid__column-chooser-row flex items-center gap-1 rounded-md px-1 py-1 hover:bg-erp-surface-alt',
                  dragColumnId === col.id && 'ent-data-grid__column-chooser-row--dragging',
                )}
              >
                <span
                  className="ent-data-grid__column-drag cursor-grab text-erp-muted active:cursor-grabbing"
                  title="Drag to reorder"
                  aria-hidden
                >
                  <GripVertical className="h-4 w-4" />
                </span>
                <Checkbox
                  label={label}
                  checked={col.getIsVisible()}
                  onChange={col.getToggleVisibilityHandler()}
                  className="min-w-0 flex-1"
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  ) : null

  if (loading) {
    return (
      <SkeletonTable
        rows={currentPageSize > 10 ? 10 : currentPageSize}
        cols={Math.min(columns.length, 8)}
        showToolbar={false}
      />
    )
  }

  return (
    <div className={cn(
      'ent-data-grid ent-data-grid--comfortable',
      registerBar && 'ent-data-grid--register',
      densityClass,
      // Register grids keep overflow visible so the Columns panel is not clipped
      // under sticky table headers (thead th uses z-20 inside .erp-table-wrap).
      registerBar ? 'overflow-visible' : 'overflow-hidden',
      'rounded-erp border border-erp-border bg-erp-surface shadow-erp',
    )}>
      {registerBar ? (
        <div className="ent-data-grid__register-bar ent-data-grid__register-bar--merged">
          <div className="ent-data-grid__register-bar-row">
            {recordLabel ? (
              <p className="ent-data-grid__record-label ent-data-grid__record-label--inline">
                {recordLabel} <span>({totalRows})</span>
              </p>
            ) : null}
            <div className="ent-data-grid__register-bar-body">
              {isValidElement(registerBar)
                ? cloneElement(
                    registerBar as ReactElement<{ columnsControl?: ReactNode }>,
                    { columnsControl: columnChooser },
                  )
                : registerBar}
            </div>
          </div>
        </div>
      ) : null}
      {showGridToolbar && (
        <div className="erp-list-toolbar">
          {(toolbarMode === 'full' || (toolbarMode === 'compact' && showCompactSearch)) ? (
            <div className="erp-list-toolbar-left flex items-center gap-3">
              {recordLabel ? (
                <p className="ent-data-grid__record-label">
                  {recordLabel} <span>({totalRows})</span>
                </p>
              ) : null}
              <div className="erp-search-field erp-search-field--sm min-w-[180px] max-w-xs flex-1">
                <Search className="erp-search-field__icon" strokeWidth={2} aria-hidden />
                <input
                  type="search"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="erp-input erp-search-field__input text-[13px]"
                  aria-label={searchPlaceholder}
                />
              </div>
              {filterSlot}
            </div>
          ) : recordLabel || filterSlot ? (
            <div className="erp-list-toolbar-left flex items-center gap-3">
              {recordLabel ? (
                <p className="ent-data-grid__record-label">
                  {recordLabel} <span>({totalRows})</span>
                </p>
              ) : null}
              {filterSlot}
            </div>
          ) : null}
          {toolbarMode === 'full' && (
            <Button variant="secondary" size="sm" type="button">
              <Filter className="h-3.5 w-3.5" /> Filters
            </Button>
          )}
          <div className="erp-list-toolbar-right">
            {columnChooser}
            {showToolbarView ? (
            <div className="relative" ref={viewMenuRef}>
              {onViewChange ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => setShowViewMenu((v) => !v)}
                    aria-expanded={showViewMenu}
                    aria-haspopup="listbox"
                    className="min-w-[9rem] justify-between gap-2"
                  >
                    <span className="truncate">View: {resolvedActiveView}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  </Button>
                  {showViewMenu && (
                    <ul
                      className="absolute right-0 top-full z-20 mt-1 max-h-64 min-w-[11rem] overflow-y-auto rounded-lg border border-erp-border bg-erp-surface py-1 shadow-erp-md"
                      role="listbox"
                      aria-label="Saved views"
                    >
                      {resolvedViewOptions.map((view) => (
                        <li key={view}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={view === resolvedActiveView}
                            className={cn(
                              'w-full px-3 py-2 text-left text-[13px] transition-colors hover:bg-erp-surface-alt',
                              view === resolvedActiveView && 'bg-erp-primary-soft font-semibold text-erp-primary',
                            )}
                            onClick={() => {
                              onViewChange(view)
                              setShowViewMenu(false)
                            }}
                          >
                            {view}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <label className="flex items-center gap-1.5 whitespace-nowrap text-[12px] text-erp-muted">
                  <span className="font-medium text-erp-text">View</span>
                  <select
                    value={resolvedActiveView}
                    className="erp-input h-8 min-w-[8rem] py-0 text-[12px] font-medium"
                    disabled
                    aria-label="Current view"
                  >
                    {resolvedViewOptions.map((view) => (
                      <option key={view} value={view}>{view}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            ) : null}
            {showToolbarExport ? (
            <Button variant="secondary" size="sm" type="button" onClick={exportCsv} className="erp-list-toolbar-export">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            ) : null}
          </div>
        </div>
      )}

      {selectedCount > 0 && bulkActions ? bulkActions : null}

      <div className={cn(stickyHeader && 'erp-table-wrap')}>
        <table className={cn(
          'erp-table',
          compact && 'erp-table-compact',
          zebra && 'erp-table-zebra',
          stickyFirstColumn && 'erp-table-sticky-first',
          stickyFirstColumn && selectable && 'erp-table-sticky-first--with-select',
          hasCustomActionsColumn && 'erp-table-has-actions-col',
        )}>
          <thead>
            {table.getHeaderGroups().map((hg) => {
              const firstVisibleColumnId = hg.headers.find((h) => h.column.getIsVisible())?.column.id
              return (
                <tr key={hg.id}>
                  {selectable && (
                    <th className="erp-table-select-cell w-10">
                      <Checkbox
                        checked={table.getIsAllPageRowsSelected()}
                        indeterminate={
                          table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
                        }
                        onChange={table.getToggleAllPageRowsSelectedHandler()}
                        aria-label="Select all rows"
                      />
                    </th>
                  )}
                  {hg.headers.map((header) =>
                    header.column.getIsVisible() ? (
                      <th
                        key={header.id}
                        className={cn(
                          entMetaToClasses(
                            header.column.columnDef.meta as EnterpriseColumnMeta | undefined,
                          ),
                          header.column.columnDef.meta?.align === 'right' && 'ent-align-right',
                          header.column.columnDef.meta?.align === 'center' && 'ent-align-center',
                          header.column.id === 'actions' && 'erp-table-actions-cell',
                          stickyFirstColumn &&
                            header.column.id === firstVisibleColumnId &&
                            'erp-table-sticky-data-cell',
                        )}
                      >
                        {header.isPlaceholder ? null : (
                          <button
                            type="button"
                            className={cn(
                              'inline-flex items-center gap-1',
                              header.column.getCanSort() && 'cursor-pointer hover:text-erp-text',
                              header.column.columnDef.meta?.align === 'right' && 'ml-auto',
                            )}
                            onClick={header.column.getToggleSortingHandler()}
                            aria-label={
                              header.column.getCanSort()
                                ? `Sort by ${typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : header.id}`
                                : undefined
                            }
                            aria-sort={
                              header.column.getIsSorted() === 'asc'
                                ? 'ascending'
                                : header.column.getIsSorted() === 'desc'
                                  ? 'descending'
                                  : header.column.getCanSort()
                                    ? 'none'
                                    : undefined
                            }
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              <span className="text-erp-muted">
                                {header.column.getIsSorted() === 'asc' ? (
                                  <ArrowUp className="h-3.5 w-3.5" />
                                ) : header.column.getIsSorted() === 'desc' ? (
                                  <ArrowDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                                )}
                              </span>
                            )}
                          </button>
                        )}
                      </th>
                    ) : null,
                  )}
                  {hasRowActions && <th className="w-12 ent-align-center">Actions</th>}
                </tr>
              )
            })}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (hasRowActions ? 1 : 0) + (selectable ? 1 : 0)}>
                  <EmptyState icon={Archive} title={emptyMessage} action={emptyAction} />
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={(e) => handleRowClick(row.original, e)}
                  className={cn(
                    'group',
                    (onRowSelect || onRowQuickView) && 'cursor-pointer',
                    (selectedRowId === row.id || (selectable && row.getIsSelected())) && 'erp-row-selected',
                  )}
                >
                  {selectable && (
                    <td className="erp-table-select-cell w-10" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={row.getIsSelected()}
                        disabled={!row.getCanSelect()}
                        onChange={row.getToggleSelectedHandler()}
                        aria-label={row.getCanSelect() ? 'Select row' : 'Row cannot be selected'}
                        title={
                          row.getCanSelect()
                            ? undefined
                            : 'Converted / cancelled rows cannot be selected'
                        }
                      />
                    </td>
                  )}
                  {row.getVisibleCells().map((cell, cellIndex) => (
                    <td
                      key={cell.id}
                      onClick={cell.column.id === 'actions' ? (e) => e.stopPropagation() : undefined}
                      className={cn(
                        entMetaToClasses(cell.column.columnDef.meta as EnterpriseColumnMeta | undefined),
                        cell.column.columnDef.meta?.align === 'right' && 'num ent-align-right',
                        cell.column.columnDef.meta?.align === 'center' && 'ent-align-center',
                        (cell.column.columnDef.meta as EnterpriseColumnMeta | undefined)?.cellClass,
                        cell.column.id === 'actions' && 'erp-table-actions-cell',
                        stickyFirstColumn && cellIndex === 0 && 'erp-table-sticky-data-cell',
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                  {hasRowActions && (
                    <td className="ent-align-right">
                      <div className="inline-flex gap-0.5">
                        {onRowQuickView && (
                          <button type="button" className="rounded p-1 text-erp-primary hover:bg-erp-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-erp-primary" title="Quick view" aria-label="Quick view record" onClick={(e) => { e.stopPropagation(); onRowQuickView(row.original) }}>
                            <PanelLeft className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}
                        {onRowView && (
                          <button type="button" className="rounded p-1 text-erp-text hover:bg-erp-surface-alt hover:text-erp-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-erp-primary" title="View" aria-label="View record" onClick={() => onRowView(row.original)}>
                            <Eye className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}
                        {onRowEdit && (
                          <button type="button" className="rounded p-1 text-erp-text hover:bg-erp-surface-alt hover:text-erp-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-erp-primary" title="Edit" aria-label="Edit record" onClick={() => onRowEdit(row.original)}>
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}
                        {onRowPrint && (
                          <button type="button" className="rounded p-1 text-erp-text hover:bg-erp-surface-alt hover:text-erp-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-erp-primary" title="Print" aria-label="Print record" onClick={() => onRowPrint(row.original)}>
                            <Printer className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}
                        {onRowHistory && (
                          <button type="button" className="rounded p-1 text-erp-text hover:bg-erp-surface-alt hover:text-erp-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-erp-primary" title="History" aria-label="View history" onClick={() => onRowHistory(row.original)}>
                            <History className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(showPagination && totalRows > 0) || footer ? (
        <div className="ent-data-grid__footer">
          {showPagination && totalRows > 0 ? (
            <EnterprisePagination
              from={from}
              to={to}
              total={totalRows}
              pageIndex={pageIndex}
              pageCount={pageCount}
              pageSize={resolvedPageSize}
              pageSizeOptions={pageSizeOptions}
              onPageChange={(i) => table.setPageIndex(i)}
              onPageSizeChange={handlePageSizeChange}
            />
          ) : (
            <p className="text-xs text-erp-muted">{footer}</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    align?: 'left' | 'right' | 'center'
    cellClass?: string
    /** Label shown in column visibility chooser when header is not a plain string */
    columnLabel?: string
  }
}

/** Backward-compatible alias */
export { DataGrid as DataTable }
