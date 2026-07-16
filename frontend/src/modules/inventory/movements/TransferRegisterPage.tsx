import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, GitBranch, Plus, RefreshCw, Send, Truck, XCircle } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { SmartFilterBar } from '@/components/design-system/SmartFilterBar'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import { TableLink } from '@/components/ui/AppLink'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
} from '@/design-system/enterprise/EnterpriseTablePrimitives'
import { MovementRegisterTabs } from '@/components/inventory/movements/MovementPreviewPanels'
import {
  cancelTransferDemo,
  dispatchTransferDemo,
  getTransfers,
  markTransferInTransitDemo,
  receiveTransferDemo,
  seedDemoPhase3IfEmpty,
  InventoryServiceError,
} from '@/services/inventory'
import type { InventoryTransferListRow } from '@/types/inventoryDomain'
import { TRANSFER_REGISTER_TABS, TRANSFER_STATUS_LABELS, TRANSFER_TYPE_LABELS } from '@/utils/inventoryMovementLabels'
import { formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { notify } from '@/store/toastStore'

export function TransferRegisterPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'all'
  const [rows, setRows] = useState<InventoryTransferListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const statusFilter = TRANSFER_REGISTER_TABS.find((t) => t.id === tab)?.status ?? undefined

  const load = useCallback(async () => {
    setLoading(true)
    try {
      await seedDemoPhase3IfEmpty()
      setRows(await getTransfers({ status: statusFilter ?? undefined, search: search || undefined }))
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => { void load() }, [load])

  const columns = useMemo<ColumnDef<InventoryTransferListRow>[]>(
    () => [
      {
        accessorKey: 'documentNumber',
        header: 'Transfer Number',
        cell: ({ row }) => (
          <TableLink to={`/inventory/movements/transfers/${row.original.id}`} className="font-mono">
            {row.original.documentNumber}
          </TableLink>
        ),
      },
      { accessorKey: 'transferDate', header: 'Date', cell: ({ row }) => formatDate(row.original.transferDate) },
      {
        accessorKey: 'transferType',
        header: 'Type',
        cell: ({ row }) => TRANSFER_TYPE_LABELS[row.original.transferType],
      },
      { accessorKey: 'fromWarehouseName', header: 'From Warehouse' },
      { accessorKey: 'toWarehouseName', header: 'To Warehouse' },
      { accessorKey: 'itemCount', header: 'Items', cell: ({ row }) => formatNumber(row.original.itemCount) },
      { accessorKey: 'transferQty', header: 'Transfer Qty', cell: ({ row }) => formatNumber(row.original.transferQty) },
      { accessorKey: 'dispatchedQty', header: 'Dispatched', cell: ({ row }) => formatNumber(row.original.dispatchedQty) },
      { accessorKey: 'receivedQty', header: 'Received', cell: ({ row }) => formatNumber(row.original.receivedQty) },
      {
        accessorKey: 'expectedReceiptDate',
        header: 'Expected Receipt',
        cell: ({ row }) => (row.original.expectedReceiptDate ? formatDate(row.original.expectedReceiptDate) : '—'),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusDot label={TRANSFER_STATUS_LABELS[row.original.status]} tone={statusToneFromLabel(TRANSFER_STATUS_LABELS[row.original.status])} />
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const r = row.original
          const actions: RowActionItem[] = [
            { id: 'view', label: 'View', icon: Eye, onClick: () => navigate(`/inventory/movements/transfers/${r.id}`) },
          ]
          if (r.status === 'draft' && perms.canDispatchTransfer) {
            actions.push({
              id: 'dispatch',
              label: 'Dispatch',
              icon: Send,
              onClick: () => void dispatchTransferDemo(r.id).then(() => { notify.success('Transfer dispatched'); void load() }).catch((e) => notify.error(e instanceof InventoryServiceError ? e.message : 'Dispatch failed')),
            })
          }
          if (r.status === 'dispatched' && perms.canReceiveTransfer) {
            actions.push({
              id: 'transit',
              label: 'Mark In Transit',
              icon: Truck,
              onClick: () => void markTransferInTransitDemo(r.id).then(() => { notify.success('Marked in transit'); void load() }).catch((e) => notify.error(e instanceof InventoryServiceError ? e.message : 'Failed')),
            })
          }
          if (['dispatched', 'in_transit', 'partially_received'].includes(r.status) && perms.canReceiveTransfer) {
            actions.push({
              id: 'receive',
              label: 'Receive',
              icon: Truck,
              onClick: () => void receiveTransferDemo(r.id).then(() => { notify.success('Transfer received'); void load() }).catch((e) => notify.error(e instanceof InventoryServiceError ? e.message : 'Receive failed')),
            })
          }
          if (['draft', 'dispatched', 'in_transit'].includes(r.status) && perms.canCancelTransfer) {
            actions.push({
              id: 'cancel',
              label: 'Cancel',
              icon: XCircle,
              onClick: () => void cancelTransferDemo(r.id).then(() => { notify.success('Transfer cancelled'); void load() }).catch((e) => notify.error(e instanceof InventoryServiceError ? e.message : 'Cancel failed')),
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
      title="Stock Transfer Register"
      description="Warehouse, plant and bin transfers with dispatch and receipt tracking."
      breadcrumbs={[{ label: 'Inventory & Warehouse', to: '/inventory' }, { label: 'Transfers' }]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/movements/transfers"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={perms.canCreateTransfer ? { id: 'new', label: 'Quick Transfer', icon: Plus, onClick: () => navigate('/inventory/movements/transfers/new') } : undefined}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      )}
    >
      <MovementRegisterTabs
        tabs={TRANSFER_REGISTER_TABS}
        activeTab={tab}
        onChange={(id) => setSearchParams((p) => { p.set('tab', id); return p })}
      />
      <SmartFilterBar className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search transfer no, warehouse…" />
      </SmartFilterBar>
      {loading ? <LoadingState variant="table" /> : null}
      {!loading && rows.length === 0 ? <EmptyState icon={GitBranch} title="No transfers" description="Create a quick transfer to move stock between warehouses." /> : null}
      {!loading && rows.length > 0 ? <DataTable columns={columns} data={rows} /> : null}
    </OperationalPageShell>
  )
}
