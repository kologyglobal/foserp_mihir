import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Package, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { isApiMode } from '@/config/apiConfig'
import {
  cancelInventoryReservation,
  listInventoryReservations,
  type InventoryStockReservation,
} from '@/services/api/inventoryApi'
import { inventoryApiFacade } from '@/services/inventory/inventoryApiFacade'
import { formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { appConfirm } from '@/store/confirmDialogStore'

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
      if (isApiMode()) {
        const res = await listInventoryReservations({ status: 'ACTIVE', limit: 100 })
        setRows((res.data ?? []) as ResRow[])
      } else {
        const demo = (await inventoryApiFacade.listReservations({})) as unknown as ResRow[]
        setRows(Array.isArray(demo) ? demo : [])
      }
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
      if (isApiMode()) {
        await cancelInventoryReservation(id)
        notify.success('Reservation released')
      } else {
        notify.info('Release runs against live API reservation engine in API mode.')
      }
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
      backLink={{ to: '/inventory', label: 'Store Dashboard' }}
      breadcrumbs={[
        { label: 'Store', to: '/inventory' },
        { label: 'Reservations' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/store/reservations"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="erp-btn erp-btn--ghost erp-btn--sm inline-flex items-center gap-1.5"
          onClick={() => setToken((n) => n + 1)}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Refresh
        </button>
        <Link to="/inventory/store/picking" className="erp-btn erp-btn--secondary erp-btn--sm">
          Picking
        </Link>
        <Link to="/inventory/reservations" className="erp-btn erp-btn--secondary erp-btn--sm">
          Full register
        </Link>
      </div>
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
            return (
              <li key={r.id}>
                <div className="store-action-card">
                  <div className="store-action-card__top">
                    <span className="store-action-card__severity">{r.status}</span>
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
                    {String(r.status).toUpperCase() === 'ACTIVE' || String(r.status).toLowerCase() === 'active' ? (
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
