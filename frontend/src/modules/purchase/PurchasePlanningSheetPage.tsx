import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { ClipboardList, RefreshCw, ShoppingCart } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { CrmFilterDrawer } from '@/components/crm/CrmFilterDrawer'
import { CrmListFilterBar, CrmListSortSelect } from '@/components/crm/CrmListFilterBar'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpDataGrid } from '@/components/erp/ErpDataGrid'
import { ErpButton, ErpButtonGroup } from '@/components/erp/ErpButton'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/design-system/components/Modal'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { useCrmFilterDrawer } from '@/hooks/useCrmFilterDrawer'
import {
  canSelectPlanningRowForPo,
  createPurchaseOrdersFromPlanningSelection,
  getPurchaseOrderSeriesOptions,
  getPurchasePlanningSheet,
  PurchaseServiceError,
  updatePurchasePlanningSheetRow,
  PURCHASE_PLANNING_PRIORITY_LABELS,
  PURCHASE_PLANNING_PURCHASE_TYPE_LABELS,
  PURCHASE_PLANNING_STATUS_LABELS,
  PURCHASE_PLANNING_PRIORITIES,
  PURCHASE_PLANNING_PURCHASE_TYPES,
  PURCHASE_PLANNING_STATUSES,
  PURCHASE_ITEM_CATEGORY_LABELS,
  type PurchaseOrderSeriesOption,
} from '@/services/purchase'
import type {
  PurchasePlanningPurchaseType,
  PurchasePlanningSheetRow,
  PurchasePlanningStatus,
} from '@/types/purchaseDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { purchaseBreadcrumbs } from '@/utils/purchaseNavigation'
import { notify } from '@/store/toastStore'
import type { CrmFilterField, CrmFilterValues } from '@/types/crmListFilters'

type SortKey = 'planningDate' | 'requiredByDate' | 'priority' | 'status' | 'planningNumber'

const DEFAULT_FILTERS: CrmFilterValues = {
  search: '',
  department: '',
  vendor: '',
  buyer: '',
  priority: '',
  status: '',
  purchaseType: '',
  planningDateFrom: '',
  planningDateTo: '',
  requiredByFrom: '',
  requiredByTo: '',
}

function filterRows(rows: PurchasePlanningSheetRow[], f: CrmFilterValues) {
  const q = String(f.search ?? '')
    .trim()
    .toLowerCase()
  return rows.filter((r) => {
    if (q) {
      const hay = [
        r.planningNumber,
        r.purchaseRequisitionNumber,
        r.itemCode,
        r.itemName,
        r.department,
        r.preferredVendorName,
        r.buyerName,
      ]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (f.department && r.department !== f.department) return false
    if (f.vendor && r.preferredVendorName !== f.vendor) return false
    if (f.buyer && r.buyerName !== f.buyer) return false
    if (f.priority && r.priority !== f.priority) return false
    if (f.status && r.status !== f.status) return false
    if (f.purchaseType && r.purchaseType !== f.purchaseType) return false
    if (f.planningDateFrom && r.planningDate < String(f.planningDateFrom)) return false
    if (f.planningDateTo && r.planningDate > String(f.planningDateTo)) return false
    if (f.requiredByFrom && r.requiredByDate < String(f.requiredByFrom)) return false
    if (f.requiredByTo && r.requiredByDate > String(f.requiredByTo)) return false
    return true
  })
}

function sortRows(rows: PurchasePlanningSheetRow[], sortBy: SortKey) {
  const list = [...rows]
  const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })
  switch (sortBy) {
    case 'planningNumber':
      return list.sort((a, b) => cmp(a.planningNumber, b.planningNumber))
    case 'requiredByDate':
      return list.sort((a, b) => cmp(a.requiredByDate, b.requiredByDate))
    case 'priority':
      return list.sort((a, b) => cmp(a.priority, b.priority))
    case 'status':
      return list.sort((a, b) => cmp(a.status, b.status))
    default:
      return list.sort((a, b) => cmp(b.planningDate, a.planningDate))
  }
}

export function PurchasePlanningSheetPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<PurchasePlanningSheetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<CrmFilterValues>(DEFAULT_FILTERS)
  const [sortBy, setSortBy] = useState<SortKey>('planningDate')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creatingPo, setCreatingPo] = useState(false)
  const [seriesOpen, setSeriesOpen] = useState(false)
  const [seriesOptions, setSeriesOptions] = useState<PurchaseOrderSeriesOption[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sheet = await getPurchasePlanningSheet()
      setRows(sheet)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load planning sheet')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const departmentOptions = useMemo(
    () => [...new Set(rows.map((r) => r.department).filter(Boolean))].sort(),
    [rows],
  )
  const vendorOptions = useMemo(
    () => [...new Set(rows.map((r) => r.preferredVendorName).filter(Boolean) as string[])].sort(),
    [rows],
  )
  const buyerOptions = useMemo(
    () => [...new Set(rows.map((r) => r.buyerName).filter(Boolean))].sort(),
    [rows],
  )

  const filterFields = useMemo<CrmFilterField[]>(
    () => [
      { key: 'planningDateFrom', label: 'Planning date from', type: 'date' },
      { key: 'planningDateTo', label: 'Planning date to', type: 'date' },
      { key: 'requiredByFrom', label: 'Required by from', type: 'date' },
      { key: 'requiredByTo', label: 'Required by to', type: 'date' },
      {
        key: 'department',
        label: 'Department',
        type: 'select',
        options: departmentOptions.map((d) => ({ value: d, label: d })),
      },
      {
        key: 'vendor',
        label: 'Vendor',
        type: 'select',
        options: vendorOptions.map((v) => ({ value: v, label: v })),
      },
      {
        key: 'buyer',
        label: 'Purchase owner',
        type: 'select',
        options: buyerOptions.map((b) => ({ value: b, label: b })),
      },
      {
        key: 'priority',
        label: 'Priority',
        type: 'select',
        options: PURCHASE_PLANNING_PRIORITIES.map((p) => ({
          value: p,
          label: PURCHASE_PLANNING_PRIORITY_LABELS[p],
        })),
      },
      {
        key: 'status',
        label: 'Planning status',
        type: 'select',
        options: PURCHASE_PLANNING_STATUSES.map((s) => ({
          value: s,
          label: PURCHASE_PLANNING_STATUS_LABELS[s],
        })),
      },
      {
        key: 'purchaseType',
        label: 'Purchase type',
        type: 'select',
        options: PURCHASE_PLANNING_PURCHASE_TYPES.map((t) => ({
          value: t,
          label: PURCHASE_PLANNING_PURCHASE_TYPE_LABELS[t],
        })),
      },
    ],
    [departmentOptions, vendorOptions, buyerOptions],
  )

  const filterDrawer = useCrmFilterDrawer({
    values: filters,
    onChange: setFilters,
    fields: filterFields,
    formatChipValue: (key, value) => {
      if (key === 'priority') return PURCHASE_PLANNING_PRIORITY_LABELS[value as keyof typeof PURCHASE_PLANNING_PRIORITY_LABELS] ?? value
      if (key === 'status') return PURCHASE_PLANNING_STATUS_LABELS[value as PurchasePlanningStatus] ?? value
      if (key === 'purchaseType')
        return PURCHASE_PLANNING_PURCHASE_TYPE_LABELS[value as PurchasePlanningPurchaseType] ?? value
      return String(value)
    },
  })

  const filtered = useMemo(() => sortRows(filterRows(rows, filters), sortBy), [rows, filters, sortBy])

  const selectedRows = useMemo(() => rows.filter((r) => r.actionMessage), [rows])
  const selectedReadyCount = useMemo(
    () => selectedRows.filter((r) => canSelectPlanningRowForPo(r)).length,
    [selectedRows],
  )

  const toggleActionMessage = async (row: PurchasePlanningSheetRow, checked: boolean) => {
    setBusyId(row.id)
    try {
      await updatePurchasePlanningSheetRow(row.id, { actionMessage: checked })
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, actionMessage: checked } : r)),
      )
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Could not update selection')
    } finally {
      setBusyId(null)
    }
  }

  const openCreatePoDialog = async () => {
    if (selectedRows.length === 0) {
      notify.error('Tick Action Message on at least one row to create a PO')
      return
    }
    const notReady = selectedRows.filter((r) => !canSelectPlanningRowForPo(r))
    if (notReady.length) {
      notify.error(
        `${notReady.length} selected row(s) need vendor, quantity, and rate before Create PO`,
      )
      return
    }
    try {
      const options = await getPurchaseOrderSeriesOptions()
      setSeriesOptions(options)
      setSeriesOpen(true)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Could not load number series')
    }
  }

  const confirmCreatePo = async () => {
    const series = seriesOptions[0]
    if (!series) {
      notify.error('Purchase Order number series is not configured in Setup')
      return
    }
    setCreatingPo(true)
    try {
      const orders = await createPurchaseOrdersFromPlanningSelection(
        selectedRows.map((r) => r.id),
        { seriesPrefix: series.prefix },
      )
      notify.success(
        orders.length === 1
          ? `Purchase order ${orders[0].documentNumber} created`
          : `${orders.length} purchase orders created`,
      )
      setSeriesOpen(false)
      await load()
      if (orders.length === 1) navigate(`/purchase/orders/${orders[0].id}`)
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Could not create PO')
    } finally {
      setCreatingPo(false)
    }
  }

  const masterSeries = seriesOptions[0]

  const columns = useMemo<ColumnDef<PurchasePlanningSheetRow, unknown>[]>(
    () => [
      {
        id: 'type',
        header: 'Type',
        meta: { columnLabel: 'Type' },
        cell: ({ row }) =>
          PURCHASE_ITEM_CATEGORY_LABELS[row.original.itemCategory] ??
          row.original.itemCategory ??
          '—',
      },
      {
        id: 'actionMessage',
        header: 'Action Message',
        meta: { columnLabel: 'Action Message', align: 'center' },
        cell: ({ row }) => {
          const r = row.original
          const readOnly = r.status === 'completed' || r.status === 'cancelled' || r.status === 'po_created'
          return (
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--erp-primary,#2563eb)]"
              checked={Boolean(r.actionMessage)}
              disabled={readOnly || busyId === r.id}
              aria-label="Action Message"
              onChange={(e) => void toggleActionMessage(r, e.target.checked)}
            />
          )
        },
      },
      {
        id: 'itemCode',
        header: 'Item Code',
        meta: { columnLabel: 'Item Code' },
        cell: ({ row }) => (
          <span className="font-mono text-[12px]">{row.original.itemCode || '—'}</span>
        ),
      },
      {
        id: 'description',
        header: 'Description',
        meta: { columnLabel: 'Description' },
        cell: ({ row }) => row.original.itemName || '—',
      },
      {
        id: 'uom',
        header: 'UOM',
        meta: { columnLabel: 'UOM' },
        cell: ({ row }) => row.original.uom || '—',
      },
      {
        id: 'quantity',
        header: 'Quantity',
        meta: { columnLabel: 'Quantity', align: 'right' },
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.requiredQuantity}</span>
        ),
      },
      {
        id: 'reqDate',
        header: 'Req Date',
        meta: { columnLabel: 'Req Date' },
        cell: ({ row }) => formatDate(row.original.requiredByDate),
      },
      {
        id: 'rate',
        header: 'Rate',
        meta: { columnLabel: 'Rate', align: 'right' },
        cell: ({ row }) => (
          <span className="tabular-nums">{formatCurrency(row.original.expectedRate)}</span>
        ),
      },
      {
        id: 'vendorNumber',
        header: 'Vendor Number',
        meta: { columnLabel: 'Vendor Number' },
        cell: ({ row }) => (
          <span className="font-mono text-[12px]">
            {row.original.preferredVendorCode || '—'}
          </span>
        ),
      },
      {
        id: 'orderDate',
        header: 'Order Date',
        meta: { columnLabel: 'Order Date' },
        cell: ({ row }) =>
          row.original.orderDate ? formatDate(row.original.orderDate) : '—',
      },
      {
        id: 'reqNo',
        header: 'Req. No',
        meta: { columnLabel: 'Req. No' },
        cell: ({ row }) => (
          <TableLink to={`/purchase/requisitions/${row.original.purchaseRequisitionId}`}>
            {row.original.purchaseRequisitionNumber}
          </TableLink>
        ),
      },
    ],
    [busyId],
  )

  return (
    <>
      <OperationalPageShell
        title="Purchase Planning Sheet"
        description="Direct-purchase demand from approved PRs where RFQ is not required — one row per item"
        badge="Purchase"
        variant="dynamics"
        breadcrumbs={purchaseBreadcrumbs('Purchase Planning Sheet')}
        favoritePath="/purchase/planning-sheet"
        commandBar={
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={{
              id: 'create-po',
              label:
                selectedRows.length > 0
                  ? `Create Purchase Order (${selectedRows.length})`
                  : 'Create Purchase Order',
              icon: ShoppingCart,
              onClick: () => void openCreatePoDialog(),
              disabled: creatingPo || selectedReadyCount === 0,
              disabledReason:
                selectedRows.length === 0
                  ? 'Select rows with Action Message first'
                  : selectedReadyCount === 0
                    ? 'Selected rows need vendor, quantity, and rate'
                    : undefined,
            }}
            secondaryActions={[
              {
                id: 'refresh',
                label: 'Refresh',
                icon: RefreshCw,
                onClick: () => void load(),
              },
            ]}
          />
        }
      >
        {loading ? (
          <LoadingState label="Loading purchase planning sheet…" />
        ) : error ? (
          <EmptyState
            icon={ClipboardList}
            title="Could not load planning sheet"
            description={error}
            action={
              <button type="button" className="erp-btn erp-btn--primary text-[13px]" onClick={() => void load()}>
                Retry
              </button>
            }
          />
        ) : (
          <EnterpriseRegisterTableShell className="min-w-0">
            <ErpDataGrid
              data={filtered}
              columns={columns}
              getRowId={(r) => r.id}
              showCompactSearch={false}
              enableColumnSorting={false}
              stickyFirstColumn
              emptyMessage={
                rows.length === 0
                  ? 'No planning rows yet. Approved PRs with RFQ not required create one row per item automatically.'
                  : 'No rows match filters.'
              }
              toolbar={
                <CrmListFilterBar
                  search={String(filters.search ?? '')}
                  onSearchChange={(search) => setFilters((f) => ({ ...f, search }))}
                  searchPlaceholder="Search planning no, PR, item, vendor…"
                  activeFilterCount={filterDrawer.activeCount}
                  onOpenFilters={filterDrawer.openDrawer}
                  chips={filterDrawer.chips}
                  onRemoveChip={filterDrawer.removeChip}
                  onClearAll={() => setFilters(DEFAULT_FILTERS)}
                  className="crm-list-filter-bar--embedded"
                  showCommandPaletteHint={false}
                  sort={
                    <CrmListSortSelect
                      value={sortBy}
                      onChange={(v) => setSortBy(v as SortKey)}
                      aria-label="Sort planning sheet"
                      options={[
                        { value: 'planningDate', label: 'Planning date' },
                        { value: 'requiredByDate', label: 'Required by' },
                        { value: 'priority', label: 'Priority' },
                        { value: 'status', label: 'Status' },
                        { value: 'planningNumber', label: 'Planning no.' },
                      ]}
                    />
                  }
                />
              }
            />
          </EnterpriseRegisterTableShell>
        )}
      </OperationalPageShell>

      <CrmFilterDrawer
        open={filterDrawer.open}
        title="Filter planning sheet"
        fields={filterFields}
        values={filterDrawer.draft}
        onChange={(next) => filterDrawer.setDraft({ ...filterDrawer.draft, ...next })}
        onApply={filterDrawer.applyFilters}
        onReset={filterDrawer.resetDraft}
        onClose={filterDrawer.closeDrawer}
      />

      <Modal
        open={seriesOpen}
        onClose={() => !creatingPo && setSeriesOpen(false)}
        closeDisabled={creatingPo}
        title="Create Purchase Order"
        description="PO numbers will use the Purchase Order series from Purchase Setup."
        size="sm"
        footer={
          <ErpButtonGroup className="justify-end">
            <ErpButton
              type="button"
              variant="secondary"
              disabled={creatingPo}
              onClick={() => setSeriesOpen(false)}
            >
              Cancel
            </ErpButton>
            <ErpButton
              type="button"
              variant="primary"
              icon={ShoppingCart}
              disabled={creatingPo || !masterSeries}
              onClick={() => void confirmCreatePo()}
            >
              {creatingPo ? 'Creating…' : 'Create PO'}
            </ErpButton>
          </ErpButtonGroup>
        }
      >
        <p className="text-[13px] text-erp-text">
          Create purchase order
          {selectedRows.length === 1 ? '' : 's'} from{' '}
          <span className="font-semibold">{selectedRows.length}</span> selected line
          {selectedRows.length === 1 ? '' : 's'}
          {masterSeries ? (
            <>
              {' '}
              using series <span className="font-mono font-semibold">{masterSeries.prefix}</span>
            </>
          ) : null}
          .
        </p>
      </Modal>
    </>
  )
}
