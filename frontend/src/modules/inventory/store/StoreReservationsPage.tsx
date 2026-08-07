import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
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
import { cn } from '@/utils/cn'

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
      const res = await listInventoryReservations({ status: 'ACTIVE', limit: 100 })
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
      {loading ? <LoadingState variant="card" /> : null}
      {!loading && rows.length === 0 ? (
        <EmptyState icon={Package} title="No active reservations" description="Production, sales, or manual reservations will appear here." />
      ) : null}
      {!loading && rows.length > 0 ? (
        <ul className="store-card-list">
          {rows.map((r) => {
            const remaining = Number(r.remainingQty ?? r.quantity ?? 0)
            const itemLabel = r.item ? `${r.item.code} · ${r.item.name}` : r.itemId
            const whLabel = r.warehouse?.name ?? r.warehouseId
            const isActive = String(r.status).toUpperCase() === 'ACTIVE'
            return (
              <li key={r.id}>
                <div className="store-action-card">
                  <div className="store-action-card__top">
                    <span className={cn('inv-hub-badge', isActive ? 'inv-hub-badge--info' : 'inv-hub-badge--warning')}>
                      {r.status}
                    </span>
                    <span className="store-action-card__domain">{r.demandType}</span>
                  </div>
                  <div className="store-action-card__title">{itemLabel}</div>
                  <div className="store-action-card__detail">
                    {whLabel} · ref {r.referenceNo ?? r.demandId} · reserved {formatNumber(Number(r.quantity))} · remaining{' '}
                    {formatNumber(remaining)}
                  </div>
                  <div className="store-action-card__detail text-[11px]">
                    Since {formatDate(r.createdAt)} · #{r.reservationNumber ?? r.id.slice(0, 8)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="erp-btn erp-btn-secondary h-9 px-3 text-[13px]"
                      onClick={() => navigate(`/inventory/stock/${r.itemId}`)}
                    >
                      Item 360
                    </button>
                    {isActive ? (
                      <button
                        type="button"
                        className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
                        disabled={busyId === r.id}
                        onClick={() => void release(r.id)}
                      >
                        Release
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </OperationalPageShell>
  )
}
