import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Eye, Package, RefreshCw, XCircle } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpDataGrid } from '@/components/erp/ErpDataGrid'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { EnterpriseRowActionsMenu, type RowActionItem } from '@/design-system/enterprise'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  cancelInventoryReservation,
  listInventoryReservations,
  type InventoryStockReservation,
} from '@/services/api/inventoryApi'
import { formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { appConfirm } from '@/store/confirmDialogStore'

const RESERVATION_STATUS_TONE: Record<string, 'success' | 'warning' | 'critical' | 'info' | 'neutral'> = {
  ACTIVE: 'info',
  FULFILLED: 'success',
  CANCELLED: 'neutral',
  EXPIRED: 'warning',
}

type ResRow = InventoryStockReservation & {
  item?: { code?: string; name?: string }
  warehouse?: { code?: string; name?: string }
}

export function StoreReservationsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<ResRow[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    void token
    setLoading(true)
    try {
      const res = await listInventoryReservations({ status: 'ACTIVE', limit: 300 })
      setRows((res.data ?? []) as ResRow[])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const release = async (id: string) => {
    const ok = await appConfirm({
      title: 'Release reservation',
      description: 'Release remaining reserved quantity for this demand?',
      confirmLabel: 'Release',
    })
    if (!ok) return
    setBusyId(id)
    try {
      await cancelInventoryReservation(id)
      notify.success('Reservation released')
      setToken((n) => n + 1)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not release reservation')
    } finally {
      setBusyId(null)
    }
  }

  const columns: ColumnDef<ResRow, unknown>[] = useMemo(
    () => [
      {
        accessorKey: 'reservationNumber',
        header: 'Reservation',
        meta: { columnLabel: 'Reservation' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono">
            {row.original.reservationNumber ?? row.original.id.slice(0, 8)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: { columnLabel: 'Status' },
        cell: ({ row }) => (
          <DynamicsStatusChip
            label={row.original.status}
            tone={RESERVATION_STATUS_TONE[String(row.original.status).toUpperCase()] ?? 'neutral'}
          />
        ),
      },
      {
        id: 'item',
        accessorFn: (r) => (r.item ? `${r.item.code} · ${r.item.name}` : r.itemId),
        header: 'Item',
        meta: { columnLabel: 'Item' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono">
            {row.original.item ? `${row.original.item.code} · ${row.original.item.name}` : row.original.itemId}
          </span>
        ),
      },
      {
        id: 'warehouse',
        accessorFn: (r) => r.warehouse?.name ?? r.warehouseId,
        header: 'Warehouse',
        meta: { columnLabel: 'Warehouse' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.warehouse?.name ?? row.original.warehouseId}</span>
        ),
      },
      {
        id: 'demand',
        accessorFn: (r) => r.demandType,
        header: 'Demand',
        meta: { columnLabel: 'Demand' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-erp-muted">
            {row.original.demandType}
            {row.original.referenceNo ?? row.original.demandId ? (
              <span> · {row.original.referenceNo ?? row.original.demandId}</span>
            ) : null}
          </span>
        ),
      },
      {
        accessorKey: 'quantity',
        header: 'Reserved',
        meta: { align: 'right', columnLabel: 'Reserved' },
        cell: ({ row }) => (
          <span className="tabular-nums">{formatNumber(Number(row.original.quantity))}</span>
        ),
      },
      {
        id: 'remaining',
        accessorFn: (r) => Number(r.remainingQty ?? r.quantity ?? 0),
        header: 'Remaining',
        meta: { align: 'right', columnLabel: 'Remaining' },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatNumber(Number(row.original.remainingQty ?? row.original.quantity ?? 0))}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Since',
        meta: { columnLabel: 'Since' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-erp-muted">{formatDate(row.original.createdAt)}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const r = row.original
          const isActive = String(r.status).toUpperCase() === 'ACTIVE'
          const actions: RowActionItem[] = [
            { id: 'item-360', label: 'Item 360', icon: Eye, onClick: () => navigate(`/inventory/stock/${r.itemId}`) },
            ...(isActive
              ? [
                  {
                    id: 'release',
                    label: 'Release',
                    icon: XCircle,
                    onClick: () => void release(r.id),
                    disabled: busyId === r.id,
                  },
                ]
              : []),
          ]
          return (
            <div
              className={busyId === r.id ? 'pointer-events-none opacity-50' : undefined}
              onClick={(e) => e.stopPropagation()}
            >
              <EnterpriseRowActionsMenu actions={actions} />
            </div>
          )
        },
      },
    ],
    [busyId, navigate],
  )

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Store"
      title="Reservations"
      description="Reserved vs available. Release frees stock for other demands — balance stays ledger-backed."
      breadcrumbs={[
        { label: 'Store', to: '/inventory' },
        { label: 'Reservations' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/store/reservations"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'refresh',
            label: 'Refresh',
            icon: RefreshCw,
            onClick: () => setToken((n) => n + 1),
          }}
          secondaryActions={[
            { id: 'picking', label: 'Material Picking', onClick: () => navigate('/inventory/store/picking') },
            { id: 'register', label: 'Full register', onClick: () => navigate('/inventory/reservations') },
          ]}
        />
      )}
    >
      {loading ? <LoadingState variant="table" rows={6} /> : null}
      {!loading && rows.length === 0 ? (
        <EmptyState icon={Package} title="No active reservations" description="Production, sales, or manual reservations will appear here." />
      ) : null}
      {!loading && rows.length > 0 ? (
        <EnterpriseRegisterTableShell>
          <ErpDataGrid
            data={rows}
            columns={columns}
            getRowId={(r) => r.id}
            stickyFirstColumn
            showCompactSearch={false}
            enableColumnSorting={false}
            onRowQuickView={(r) => navigate(`/inventory/stock/${r.itemId}`)}
          />
        </EnterpriseRegisterTableShell>
      ) : null}
    </OperationalPageShell>
  )
}
