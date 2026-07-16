import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Package, Pencil, Plus, RefreshCw, XCircle } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
} from '@/design-system/enterprise/EnterpriseTablePrimitives'
import { getReceipts, cancelReceiptDemo, postReceiptDemo, seedDemoMovementsIfEmpty } from '@/services/inventory'
import type { InventoryReceiptListRow } from '@/types/inventoryDomain'
import { RECEIPT_REGISTER_TABS, RECEIPT_SOURCE_LABELS, RECEIPT_STATUS_LABELS } from '@/utils/inventoryMovementLabels'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { MovementDemoBanner } from '@/components/inventory/movements/movementShared'
import { QualityReviewDrawer } from '@/components/inventory/movements/QualityReviewDrawer'
import { getReceiptById } from '@/services/inventory'
import type { InventoryReceipt } from '@/types/inventoryDomain'

export function ReceiptsRegisterPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') ?? 'all')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<InventoryReceiptListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshToken, setRefreshToken] = useState(0)
  const [qualityReceipt, setQualityReceipt] = useState<InventoryReceipt | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    await seedDemoMovementsIfEmpty()
    const tabDef = RECEIPT_REGISTER_TABS.find((t) => t.id === tab)
    setRows(await getReceipts({ status: tabDef?.status ?? undefined, search }))
    setLoading(false)
  }, [tab, search, refreshToken])

  useEffect(() => { void load() }, [load])

  const columns = useMemo<ColumnDef<InventoryReceiptListRow>[]>(() => [
    {
      accessorKey: 'documentNumber',
      header: 'Document',
      cell: ({ row }) => <TableLink to={`/inventory/movements/receipts/${row.original.id}`}>{row.original.documentNumber}</TableLink>,
    },
    { accessorKey: 'documentDate', header: 'Date', cell: ({ row }) => formatDate(row.original.documentDate) },
    { accessorKey: 'sourceType', header: 'Source', cell: ({ row }) => RECEIPT_SOURCE_LABELS[row.original.sourceType] },
    { accessorKey: 'sourceDocumentNo', header: 'Source Doc' },
    { accessorKey: 'warehouseName', header: 'Warehouse' },
    { accessorKey: 'vendorName', header: 'Vendor' },
    { accessorKey: 'totalReceivedQty', header: 'Qty', cell: ({ row }) => <span className="font-mono">{row.original.totalReceivedQty}</span> },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusDot label={RECEIPT_STATUS_LABELS[row.original.status]} tone={statusToneFromLabel(row.original.status)} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const actions: RowActionItem[] = [
          { id: 'view', label: 'View', icon: Eye, onClick: () => navigate(`/inventory/movements/receipts/${row.original.id}`) },
        ]
        if (row.original.status === 'draft' && perms.canEditReceipt) {
          actions.push({ id: 'edit', label: 'Edit Draft', icon: Pencil, onClick: () => navigate(`/inventory/movements/receipts/${row.original.id}/edit`) })
        }
        if (['pending_receipt', 'partially_received'].includes(row.original.status) && perms.canEditReceipt) {
          actions.push({ id: 'continue', label: 'Continue Receipt', onClick: () => navigate(`/inventory/movements/receipts/${row.original.id}/edit`) })
        }
        if (row.original.status === 'quality_hold' && perms.canInspectQuality) {
          actions.push({ id: 'quality', label: 'Review Quality', onClick: async () => setQualityReceipt(await getReceiptById(row.original.id)) })
        }
        if (['draft', 'pending_receipt', 'partially_received'].includes(row.original.status) && perms.canPostReceipt) {
          actions.push({ id: 'post', label: 'Post Demo', onClick: async () => { try { await postReceiptDemo(row.original.id); notify.success('Posted'); setRefreshToken((n) => n + 1) } catch (e) { notify.error(e instanceof Error ? e.message : 'Failed') } } })
        }
        if (!['posted', 'cancelled'].includes(row.original.status) && perms.canCancelReceipt) {
          actions.push({ id: 'cancel', label: 'Cancel', icon: XCircle, onClick: async () => { await cancelReceiptDemo(row.original.id); notify.success('Cancelled'); setRefreshToken((n) => n + 1) } })
        }
        return <EnterpriseRowActionsMenu actions={actions} />
      },
    },
  ], [navigate, perms])

  if (!perms.canViewReceipts) {
    return <OperationalPageShell variant="dynamics" layout="enterprise" badge="Inventory" title="Receipts" breadcrumbs={[{ label: 'Inventory', to: '/inventory' }, { label: 'Receipts' }]} autoBreadcrumbs={false}><EmptyState icon={Package} title="Access denied" /></OperationalPageShell>
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title="Receipts Register"
      description="Material receipts from purchase, production, transfers and returns."
      breadcrumbs={[{ label: 'Inventory & Warehouse', to: '/inventory' }, { label: 'Receipts' }]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/movements/receipts"
      commandBar={<ErpCommandBar inline sticky={false} primaryAction={perms.canCreateReceipt ? { id: 'new', label: 'Quick Receipt', icon: Plus, onClick: () => navigate('/inventory/movements/receipts/new') } : undefined} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) }]} />}
    >
      <MovementDemoBanner />
      <div className="mb-4 flex flex-wrap gap-2">
        {RECEIPT_REGISTER_TABS.map((t) => (
          <button key={t.id} type="button" className={`erp-btn h-8 px-3 text-[12px] ${tab === t.id ? 'erp-btn-primary' : 'erp-btn-ghost'}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
        <SearchInput value={search} onChange={setSearch} placeholder="Search…" className="max-w-xs" />
      </div>
      {loading ? <LoadingState variant="table" /> : null}
      {!loading && rows.length === 0 ? <EmptyState icon={Package} title="No receipts" /> : null}
      {!loading && rows.length > 0 ? <DataTable columns={columns} data={rows} /> : null}
      <QualityReviewDrawer open={Boolean(qualityReceipt)} receipt={qualityReceipt} onClose={() => setQualityReceipt(null)} onUpdated={() => setRefreshToken((n) => n + 1)} />
    </OperationalPageShell>
  )
}
