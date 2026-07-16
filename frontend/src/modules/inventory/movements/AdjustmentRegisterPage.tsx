import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Check, Eye, Plus, RefreshCw, Send, SlidersHorizontal, XCircle } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { SmartFilterBar } from '@/components/design-system/SmartFilterBar'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import { TableLink } from '@/components/ui/AppLink'
import { EnterpriseRowActionsMenu, type RowActionItem } from '@/design-system/enterprise/EnterpriseTablePrimitives'
import { MovementRegisterTabs } from '@/components/inventory/movements/MovementPreviewPanels'
import {
  approveAdjustmentDemo,
  getAdjustments,
  postAdjustmentDemo,
  rejectAdjustmentDemo,
  seedDemoPhase3IfEmpty,
  submitAdjustment,
  InventoryServiceError,
} from '@/services/inventory'
import type { InventoryAdjustmentListRow } from '@/types/inventoryDomain'
import { ADJUSTMENT_REGISTER_TABS, ADJUSTMENT_STATUS_LABELS, ADJUSTMENT_TYPE_LABELS } from '@/utils/inventoryMovementLabels'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { notify } from '@/store/toastStore'

export function AdjustmentRegisterPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'all'
  const [rows, setRows] = useState<InventoryAdjustmentListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const statusFilter = ADJUSTMENT_REGISTER_TABS.find((t) => t.id === tab)?.status ?? undefined

  const load = useCallback(async () => {
    setLoading(true)
    try {
      await seedDemoPhase3IfEmpty()
      setRows(await getAdjustments({ status: statusFilter ?? undefined, search: search || undefined }))
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => { void load() }, [load])

  const columns = useMemo<ColumnDef<InventoryAdjustmentListRow>[]>(
    () => [
      {
        accessorKey: 'documentNumber',
        header: 'Adjustment Number',
        cell: ({ row }) => (
          <TableLink to={`/inventory/movements/adjustments/${row.original.id}`} className="font-mono">
            {row.original.documentNumber}
          </TableLink>
        ),
      },
      { accessorKey: 'adjustmentDate', header: 'Date', cell: ({ row }) => formatDate(row.original.adjustmentDate) },
      { accessorKey: 'adjustmentType', header: 'Type', cell: ({ row }) => ADJUSTMENT_TYPE_LABELS[row.original.adjustmentType] },
      { accessorKey: 'warehouseName', header: 'Warehouse' },
      { accessorKey: 'itemCount', header: 'Items', cell: ({ row }) => formatNumber(row.original.itemCount) },
      { accessorKey: 'quantityDifference', header: 'Qty Diff', cell: ({ row }) => formatNumber(row.original.quantityDifference) },
      { accessorKey: 'adjustmentValue', header: 'Value', cell: ({ row }) => formatCurrency(row.original.adjustmentValue) },
      { accessorKey: 'reason', header: 'Reason' },
      {
        accessorKey: 'approvalStatus',
        header: 'Approval',
        cell: ({ row }) => row.original.approvalStatus.replace('_', ' '),
      },
      {
        accessorKey: 'postingStatus',
        header: 'Posting',
        cell: ({ row }) => row.original.postingStatus.replace('_', ' '),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusDot label={ADJUSTMENT_STATUS_LABELS[row.original.status]} tone={statusToneFromLabel(ADJUSTMENT_STATUS_LABELS[row.original.status])} />
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const r = row.original
          const actions: RowActionItem[] = [
            { id: 'view', label: 'View', icon: Eye, onClick: () => navigate(`/inventory/movements/adjustments/${r.id}`) },
          ]
          if (r.status === 'draft' && perms.canSubmitAdjustment) {
            actions.push({
              id: 'submit',
              label: 'Submit',
              icon: Send,
              onClick: () => void submitAdjustment(r.id).then(() => { notify.success('Submitted'); void load() }).catch((e) => notify.error(e instanceof InventoryServiceError ? e.message : 'Submit failed')),
            })
          }
          if (r.status === 'pending_approval' && perms.canApproveAdjustment) {
            actions.push({
              id: 'approve',
              label: 'Approve',
              icon: Check,
              onClick: () => void approveAdjustmentDemo(r.id).then(() => { notify.success('Approved'); void load() }).catch((e) => notify.error(e instanceof InventoryServiceError ? e.message : 'Approve failed')),
            })
            actions.push({
              id: 'reject',
              label: 'Reject',
              icon: XCircle,
              onClick: () => void rejectAdjustmentDemo(r.id).then(() => { notify.success('Rejected'); void load() }).catch((e) => notify.error(e instanceof InventoryServiceError ? e.message : 'Reject failed')),
            })
          }
          if (['approved', 'draft'].includes(r.status) && perms.canPostAdjustment && r.postingStatus !== 'posted') {
            actions.push({
              id: 'post',
              label: 'Post',
              icon: Check,
              onClick: () => void postAdjustmentDemo(r.id).then(() => { notify.success('Posted'); void load() }).catch((e) => notify.error(e instanceof InventoryServiceError ? e.message : 'Post failed')),
            })
          }
          return <EnterpriseRowActionsMenu actions={actions} />
        },
      },
    ],
    [navigate, perms, load],
  )

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title="Inventory Adjustments"
      description="Stock corrections with conditional approval and accounting preview."
      breadcrumbs={[{ label: 'Inventory & Warehouse', to: '/inventory' }, { label: 'Adjustments' }]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/movements/adjustments"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={perms.canCreateAdjustment ? { id: 'new', label: 'Quick Adjustment', icon: Plus, onClick: () => navigate('/inventory/movements/adjustments/new') } : undefined}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      )}
    >
      <MovementRegisterTabs tabs={ADJUSTMENT_REGISTER_TABS} activeTab={tab} onChange={(id) => setSearchParams((p) => { p.set('tab', id); return p })} />
      <SmartFilterBar className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search adjustment no, reason…" />
      </SmartFilterBar>
      {loading ? <LoadingState variant="table" /> : null}
      {!loading && rows.length === 0 ? <EmptyState icon={SlidersHorizontal} title="No adjustments" description="Record a stock correction with reason and system-calculated value." /> : null}
      {!loading && rows.length > 0 ? <DataTable columns={columns} data={rows} /> : null}
    </OperationalPageShell>
  )
}
