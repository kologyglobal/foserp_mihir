import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Download,
  Package,
  PackageCheck,
  Printer,
  RefreshCw,
  Share2,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../../components/tables/DataTable'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { CrmListFilterBar, CrmListSortSelect } from '../../components/crm/CrmListFilterBar'
import { Input } from '../../components/forms/Inputs'
import { TableLink } from '../../components/ui/AppLink'
import { CommandBar, CommandBarButton, CommandBarGroup } from '../../components/ui/CommandBar'
import { ErpButton } from '../../components/erp/ErpButton'
import { Toast } from '../../components/ui/Toast'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useMasterStore } from '../../store/masterStore'
import { useUIStore } from '../../store/uiStore'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { cn } from '../../utils/cn'
import { DEFAULT_GRN_EXCESS_TOLERANCE_PCT } from '../../types/purchase'
import type { GrnHeader, PurchaseOrder } from '../../types/purchase'
import { StatusDot, statusToneFromLabel } from '../../components/design-system/StatusDot'
import { formatStatus } from '../../components/ui/Badge'
import { downloadTextFile } from '../../utils/purchaseOrderExport'

const RECEIVABLE_PO_STATUSES = ['sent', 'partial', 'released'] as const

type OpenReceiptRow = {
  key: string
  poId: string
  poNo: string
  poLineId: string
  vendorId: string
  itemId: string
  warehouseId: string
  orderedQty: number
  receivedQty: number
  remainingQty: number
  rate: number
  expectedDate: string
  poStatus: PurchaseOrder['status']
}

function buildOpenReceiptRows(purchaseOrders: PurchaseOrder[]): OpenReceiptRow[] {
  const rows: OpenReceiptRow[] = []
  for (const po of purchaseOrders) {
    if (!RECEIVABLE_PO_STATUSES.includes(po.status as (typeof RECEIVABLE_PO_STATUSES)[number])) continue
    for (const line of po.lines) {
      const remaining = Math.max(0, line.qty - line.receivedQty)
      if (remaining <= 0) continue
      rows.push({
        key: `${po.id}-${line.id}`,
        poId: po.id,
        poNo: po.poNo,
        poLineId: line.id,
        vendorId: po.vendorId,
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        orderedQty: line.qty,
        receivedQty: line.receivedQty,
        remainingQty: remaining,
        rate: line.rate,
        expectedDate: line.requiredDate,
        poStatus: po.status,
      })
    }
  }
  return rows.sort((a, b) => a.poNo.localeCompare(b.poNo) || a.itemId.localeCompare(b.itemId))
}

function grnTotalQty(grn: GrnHeader): number {
  return grn.lines.reduce((s, l) => s + l.receivedQty, 0)
}

function grnTotalValue(grn: GrnHeader): number {
  return grn.lines.reduce((s, l) => s + l.receivedQty * l.rate, 0)
}

function exportGrnListTsv(
  grns: GrnHeader[],
  getVendor: ReturnType<typeof useMasterStore.getState>['getVendor'],
  getWarehouse: ReturnType<typeof useMasterStore.getState>['getWarehouse'],
): string {
  const header = [
    'GRN No.',
    'Status',
    'PO No.',
    'Vendor',
    'Warehouse',
    'GRN Date',
    'Posted At',
    'QC',
    'Lines',
    'Received Qty',
    'Value',
    'Created By',
  ]
  const rows = grns.map((g) => [
    g.grnNo,
    formatStatus(g.status),
    g.poNo,
    getVendor(g.vendorId)?.vendorName ?? '',
    getWarehouse(g.warehouseId)?.warehouseCode ?? '',
    g.grnDate,
    g.postedAt ? g.postedAt.slice(0, 10) : '',
    g.qcRequired ? 'Required' : 'No',
    String(g.lines.length),
    String(grnTotalQty(g)),
    String(grnTotalValue(g)),
    g.createdByName,
  ])
  return [header, ...rows].map((row) => row.join('\t')).join('\n')
}

export function GrnRegisterPage() {
  const navigate = useNavigate()
  const purchaseOrders = usePurchaseStore((s) => s.purchaseOrders)
  const grns = usePurchaseStore((s) => s.grns)
  const postGrn = usePurchaseStore((s) => s.postGrn)
  const getVendor = useMasterStore((s) => s.getVendor)
  const getItem = useMasterStore((s) => s.getItem)
  const getWarehouse = useMasterStore((s) => s.getWarehouse)
  const uoms = useMasterStore((s) => s.uoms)
  const items = useMasterStore((s) => s.items)
  const openDetailPanel = useUIStore((s) => s.openDetailPanel)

  const [activeTab, setActiveTab] = useState<'receive' | 'register'>('receive')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [savedView, setSavedView] = useState('All GRNs')
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({})
  const [postingKey, setPostingKey] = useState<string | null>(null)

  const openReceiptRows = useMemo(
    () => buildOpenReceiptRows(purchaseOrders),
    [purchaseOrders, refreshKey],
  )

  const openPoCount = useMemo(
    () => new Set(openReceiptRows.map((r) => r.poId)).size,
    [openReceiptRows],
  )

  const openLineCount = openReceiptRows.length
  const openQtyTotal = useMemo(
    () => openReceiptRows.reduce((s, r) => s + r.remainingQty, 0),
    [openReceiptRows],
  )

  const filteredGrns = useMemo(() => {
    let list = [...grns]
    if (statusFilter) list = list.filter((g) => g.status === statusFilter)
    if (search) {
      const s = search.toLowerCase()
      list = list.filter((g) => {
        const vendor = getVendor(g.vendorId)
        return (
          g.grnNo.toLowerCase().includes(s) ||
          g.poNo.toLowerCase().includes(s) ||
          (vendor?.vendorName ?? '').toLowerCase().includes(s) ||
          g.createdByName.toLowerCase().includes(s)
        )
      })
    }
    return list.sort((a, b) => b.grnDate.localeCompare(a.grnDate) || b.grnNo.localeCompare(a.grnNo))
  }, [grns, statusFilter, search, getVendor, refreshKey])

  const filteredReceiveRows = useMemo(() => {
    if (!search) return openReceiptRows
    const s = search.toLowerCase()
    return openReceiptRows.filter((r) => {
      const item = getItem(r.itemId)
      const vendor = getVendor(r.vendorId)
      return (
        r.poNo.toLowerCase().includes(s) ||
        (item?.itemCode ?? '').toLowerCase().includes(s) ||
        (item?.itemName ?? '').toLowerCase().includes(s) ||
        (vendor?.vendorName ?? '').toLowerCase().includes(s)
      )
    })
  }, [openReceiptRows, search, getItem, getVendor])

  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function getReceiveQty(row: OpenReceiptRow): string {
    if (receiveQty[row.key] !== undefined) return receiveQty[row.key]!
    return String(row.remainingQty)
  }

  function maxReceivable(row: OpenReceiptRow): number {
    return row.remainingQty * (1 + DEFAULT_GRN_EXCESS_TOLERANCE_PCT / 100)
  }

  const handlePostLine = useCallback(
    (row: OpenReceiptRow) => {
      const qty = Number(getReceiveQty(row))
      if (!Number.isFinite(qty) || qty <= 0) {
        show('Enter a receive quantity greater than zero')
        return
      }
      if (qty > maxReceivable(row) + 0.0001) {
        show(`Max receivable ${formatNumber(maxReceivable(row))} (incl. ${DEFAULT_GRN_EXCESS_TOLERANCE_PCT}% tolerance)`)
        return
      }
      setPostingKey(row.key)
      const r = postGrn(row.poId, [{ poLineId: row.poLineId, receivedQty: qty }])
      setPostingKey(null)
      if (r.ok && r.grnId) {
        const remaining = Math.max(0, row.remainingQty - qty)
        show(
          remaining > 0
            ? `Partial GRN posted — ${formatNumber(qty)} received, ${formatNumber(remaining)} remaining on line`
            : `GRN posted — line fully received`,
        )
        setReceiveQty((prev) => {
          const next = { ...prev }
          delete next[row.key]
          return next
        })
        setRefreshKey((k) => k + 1)
      } else {
        show(r.error ?? 'Failed to post GRN')
      }
    },
    [receiveQty, postGrn],
  )

  const handleExportGrns = useCallback(() => {
    const tsv = exportGrnListTsv(filteredGrns, getVendor, getWarehouse)
    downloadTextFile('grn-register.xls', tsv, 'application/vnd.ms-excel')
  }, [filteredGrns, getVendor, getWarehouse])

  function openGrnQuickView(grn: GrnHeader) {
    setSelectedRowId(grn.id)
    openDetailPanel({
      title: grn.grnNo,
      subtitle: grn.poNo,
      fields: [
        { label: 'Status', value: formatStatus(grn.status) },
        { label: 'PO', value: grn.poNo },
        { label: 'Vendor', value: getVendor(grn.vendorId)?.vendorName ?? '—' },
        { label: 'Warehouse', value: getWarehouse(grn.warehouseId)?.warehouseName ?? '—' },
        { label: 'GRN Date', value: formatDate(grn.grnDate) },
        { label: 'Lines', value: String(grn.lines.length) },
        { label: 'Received Qty', value: formatNumber(grnTotalQty(grn)) },
        { label: 'Value', value: formatCurrency(grnTotalValue(grn)) },
        { label: 'QC', value: grn.qcRequired ? 'Required' : 'No' },
        { label: 'Posted', value: grn.postedAt ? formatDate(grn.postedAt.slice(0, 10)) : '—' },
      ],
      links: [
        { label: 'Open GRN', href: `/purchase/grn/${grn.id}` },
        { label: 'View PO', href: `/purchase/orders/${grn.poId}` },
      ],
      timeline: [
        { id: 'created', label: 'Created', time: formatDate(grn.createdAt), status: 'done' },
        { id: 'status', label: formatStatus(grn.status), time: formatDate(grn.grnDate), status: 'current' },
      ],
    })
  }

  const grnColumns = useMemo<ColumnDef<GrnHeader, unknown>[]>(
    () => [
      {
        accessorKey: 'grnNo',
        header: 'No.',
        meta: { columnLabel: 'GRN No.' },
        cell: ({ row }) => (
          <TableLink to={`/purchase/grn/${row.original.id}`} className="erp-cell-key font-mono text-[13px]">
            {row.original.grnNo}
          </TableLink>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: { columnLabel: 'Status' },
        cell: ({ row }) => (
          <StatusDot label={row.original.status} tone={statusToneFromLabel(row.original.status)} />
        ),
      },
      {
        accessorKey: 'poNo',
        header: 'PO No.',
        meta: { columnLabel: 'PO No.' },
        cell: ({ row }) => (
          <TableLink to={`/purchase/orders/${row.original.poId}`} className="font-mono text-[13px]">
            {row.original.poNo}
          </TableLink>
        ),
      },
      {
        accessorKey: 'vendorId',
        header: 'Vendor',
        meta: { columnLabel: 'Vendor' },
        cell: ({ row }) => getVendor(row.original.vendorId)?.vendorName ?? '—',
      },
      {
        accessorKey: 'warehouseId',
        header: 'Warehouse',
        meta: { columnLabel: 'Warehouse' },
        cell: ({ row }) => getWarehouse(row.original.warehouseId)?.warehouseCode ?? '—',
      },
      {
        accessorKey: 'grnDate',
        header: 'GRN Date',
        meta: { columnLabel: 'GRN Date' },
        cell: ({ row }) => formatDate(row.original.grnDate),
      },
      {
        id: 'receivedQty',
        header: 'Received Qty',
        meta: { align: 'right', columnLabel: 'Received Qty' },
        cell: ({ row }) => formatNumber(grnTotalQty(row.original)),
      },
      {
        id: 'value',
        header: 'Value',
        meta: { align: 'right', columnLabel: 'Value' },
        cell: ({ row }) => formatCurrency(grnTotalValue(row.original)),
      },
      {
        accessorKey: 'qcRequired',
        header: 'QC',
        meta: { columnLabel: 'QC' },
        cell: ({ row }) => (row.original.qcRequired ? 'Required' : '—'),
      },
      {
        id: 'lines',
        header: 'Lines',
        meta: { align: 'right', columnLabel: 'Lines' },
        cell: ({ row }) => row.original.lines.length,
      },
      {
        accessorKey: 'postedAt',
        header: 'Posted',
        meta: { columnLabel: 'Posted' },
        cell: ({ row }) => (row.original.postedAt ? formatDate(row.original.postedAt.slice(0, 10)) : '—'),
      },
      {
        accessorKey: 'createdByName',
        header: 'Created By',
        meta: { columnLabel: 'Created By' },
      },
    ],
    [getVendor, getWarehouse],
  )

  const receiveColumns = useMemo<ColumnDef<OpenReceiptRow, unknown>[]>(
    () => [
      {
        accessorKey: 'poNo',
        header: 'PO No.',
        meta: { columnLabel: 'PO No.' },
        cell: ({ row }) => (
          <TableLink to={`/purchase/orders/${row.original.poId}`} className="erp-cell-key font-mono text-[13px]">
            {row.original.poNo}
          </TableLink>
        ),
      },
      {
        accessorKey: 'vendorId',
        header: 'Vendor',
        meta: { columnLabel: 'Vendor' },
        cell: ({ row }) => getVendor(row.original.vendorId)?.vendorName ?? '—',
      },
      {
        accessorKey: 'itemId',
        header: 'Item',
        meta: { columnLabel: 'Item' },
        cell: ({ row }) => {
          const item = getItem(row.original.itemId)
          return <span className="font-mono text-[13px]">{item?.itemCode ?? '—'}</span>
        },
      },
      {
        id: 'description',
        header: 'Description',
        meta: { columnLabel: 'Description' },
        cell: ({ row }) => {
          const item = getItem(row.original.itemId)
          return (
            <span className="block max-w-[160px] truncate" title={item?.itemName}>
              {item?.itemName ?? '—'}
            </span>
          )
        },
      },
      {
        accessorKey: 'warehouseId',
        header: 'Warehouse',
        meta: { columnLabel: 'Warehouse' },
        cell: ({ row }) => getWarehouse(row.original.warehouseId)?.warehouseCode ?? '—',
      },
      {
        accessorKey: 'orderedQty',
        header: 'Ordered',
        meta: { align: 'right', columnLabel: 'Ordered' },
        cell: ({ row }) => formatNumber(row.original.orderedQty),
      },
      {
        accessorKey: 'receivedQty',
        header: 'Received',
        meta: { align: 'right', columnLabel: 'Received' },
        cell: ({ row }) => formatNumber(row.original.receivedQty),
      },
      {
        accessorKey: 'remainingQty',
        header: 'Remaining',
        meta: { align: 'right', columnLabel: 'Remaining' },
        cell: ({ row }) => (
          <span className={cn('font-semibold tabular-nums', row.original.remainingQty > 0 && 'text-erp-primary')}>
            {formatNumber(row.original.remainingQty)}
          </span>
        ),
      },
      {
        id: 'receiveQty',
        header: 'Receive Qty',
        meta: { align: 'right', columnLabel: 'Receive Qty' },
        cell: ({ row }) => (
          <Input
            type="number"
            min={0}
            step="any"
            className="ml-auto h-8 w-24 text-right tabular-nums"
            value={getReceiveQty(row.original)}
            onChange={(e) => setReceiveQty((prev) => ({ ...prev, [row.original.key]: e.target.value }))}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
      {
        id: 'uom',
        header: 'UOM',
        meta: { columnLabel: 'UOM' },
        cell: ({ row }) => {
          const item = items.find((i) => i.id === row.original.itemId)
          return uoms.find((u) => u.id === item?.baseUomId)?.uomCode ?? 'Nos'
        },
      },
      {
        accessorKey: 'expectedDate',
        header: 'Required',
        meta: { columnLabel: 'Required' },
        cell: ({ row }) => formatDate(row.original.expectedDate),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <ErpButton
            type="button"
            size="sm"
            variant="secondary"
            icon={Package}
            disabled={postingKey === row.original.key}
            onClick={(e) => {
              e.stopPropagation()
              handlePostLine(row.original)
            }}
          >
            Post
          </ErpButton>
        ),
      },
    ],
    [getVendor, getItem, getWarehouse, items, uoms, receiveQty, postingKey, handlePostLine],
  )

  return (
    <>
      <Toast message={toast} />
      <OperationalPageShell
        title="Goods Receipt"
        description="Receive against open purchase orders — partial GRN supported with remaining qty tracking"
        badge="Purchase"
        variant="dynamics"
        favoritePath="/purchase/grn"
        commandBar={
          <CommandBar>
            <CommandBarGroup label="Actions">
              <CommandBarButton
                icon={Package}
                label="Receive Goods"
                onClick={() => setActiveTab('receive')}
                primary={activeTab === 'receive'}
              />
              <CommandBarButton
                icon={PackageCheck}
                label="Posted GRNs"
                onClick={() => setActiveTab('register')}
                primary={activeTab === 'register'}
              />
              <CommandBarButton icon={Download} label="Export Excel" onClick={handleExportGrns} />
              <CommandBarButton icon={Printer} label="Print" onClick={() => window.print()} />
              <CommandBarButton icon={RefreshCw} label="Refresh" onClick={() => setRefreshKey((k) => k + 1)} />
            </CommandBarGroup>
            <CommandBarGroup label="Navigate">
              <CommandBarButton icon={Truck} label="Purchase Orders" onClick={() => navigate('/purchase/orders')} />
              <CommandBarButton icon={ShoppingCart} label="RFQs" onClick={() => navigate('/purchase/rfqs')} />
            </CommandBarGroup>
            <CommandBarGroup label="Views">
              <CommandBarButton icon={SlidersHorizontal} label="Save View" onClick={() => setSavedView('All GRNs')} />
              <CommandBarButton icon={Share2} label="Share View" onClick={() => undefined} />
            </CommandBarGroup>
          </CommandBar>
        }
        insights={[
          { label: 'Open POs', value: openPoCount, accent: 'blue' },
          { label: 'Open Lines', value: openLineCount, accent: openLineCount > 0 ? 'amber' : 'green' },
          { label: 'Remaining Qty', value: formatNumber(openQtyTotal), accent: 'amber' },
          { label: 'Posted GRNs', value: grns.length, accent: 'green' },
          { label: 'Pending QC', value: grns.filter((g) => g.qcRequired && g.status !== 'posted').length, accent: 'red' },
          { label: 'Posted Today', value: grns.filter((g) => g.grnDate === new Date().toISOString().slice(0, 10)).length, accent: 'slate' },
        ]}
        filterBar={
          <CrmListFilterBar
            className="crm-list-filter-bar--purchase"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={
              activeTab === 'receive' ? 'Search PO, item, vendor…' : 'Search GRN, PO, vendor…'
            }
            showCommandPaletteHint={false}
            chips={[
              ...(activeTab === 'register' && statusFilter
                ? [{ id: 'status', label: formatStatus(statusFilter) }]
                : []),
            ]}
            onRemoveChip={(id) => {
              if (id === 'status') setStatusFilter('')
            }}
            onClearAll={() => {
              setStatusFilter('')
              setSearch('')
            }}
            savedView={savedView}
            onSavedViewChange={setSavedView}
            savedViews={['My View']}
            sort={
              activeTab === 'register' ? (
                <CrmListSortSelect
                  value={statusFilter}
                  onChange={setStatusFilter}
                  aria-label="Filter GRNs by status"
                  options={[
                    { value: '', label: 'All statuses' },
                    { value: 'posted', label: 'Posted' },
                    { value: 'pending_qc', label: 'Pending QC' },
                    { value: 'draft', label: 'Draft' },
                    { value: 'cancelled', label: 'Cancelled' },
                  ]}
                />
              ) : undefined
            }
          />
        }
      >
        <div className="mb-3 flex gap-2 border-b border-erp-border pb-2">
          <button
            type="button"
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'receive'
                ? 'bg-erp-primary text-white'
                : 'text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text',
            )}
            onClick={() => setActiveTab('receive')}
          >
            Receive Goods ({openLineCount})
          </button>
          <button
            type="button"
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'register'
                ? 'bg-erp-primary text-white'
                : 'text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text',
            )}
            onClick={() => setActiveTab('register')}
          >
            Posted GRNs ({grns.length})
          </button>
        </div>

        {activeTab === 'receive' ? (
          <DataTable
            data={filteredReceiveRows}
            columns={receiveColumns}
            stickyFirstColumn
            zebra
            toolbar="compact"
            showCompactSearch={false}
            pageSize={50}
            getRowId={(r) => r.key}
            emptyMessage="No open PO lines to receive. Send a purchase order to the vendor first."
            exportFileName="open-grn-lines"
          />
        ) : (
          <DataTable
            data={filteredGrns}
            columns={grnColumns}
            stickyFirstColumn
            zebra
            selectable
            getRowId={(g) => g.id}
            toolbar="compact"
            showCompactSearch={false}
            pageSize={50}
            selectedRowId={selectedRowId}
            onRowSelect={(row) => setSelectedRowId(row.id)}
            onRowQuickView={openGrnQuickView}
            onRowView={(g) => navigate(`/purchase/grn/${g.id}`)}
            onExport={handleExportGrns}
            showToolbarExport
            emptyMessage="No goods receipts posted yet."
            exportFileName="grn-register"
          />
        )}
      </OperationalPageShell>
    </>
  )
}
