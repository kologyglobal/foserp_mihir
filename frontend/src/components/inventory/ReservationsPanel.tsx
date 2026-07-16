import { useCallback, useEffect, useState } from 'react'
import {
  changeReservationDemo,
  createReservationDemo,
  getReservations,
  releaseReservationDemo,
} from '@/services/inventory/traceabilityService'
import type { InventoryReservationRecord, ReservationFilter, ReservationSource } from '@/types/inventoryDomain'
import {
  RESERVATION_SOURCE_LABELS,
  RESERVATION_STATUS_LABELS,
} from '@/utils/inventoryTraceabilityLabels'
import { formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { notify } from '@/store/toastStore'
import { InventoryServiceError } from '@/services/inventory'

export interface ReservationsPanelProps {
  itemId?: string
  warehouseId?: string
  referenceNo?: string
  compact?: boolean
  onRefresh?: () => void
}

export function ReservationsPanel({
  itemId,
  warehouseId,
  referenceNo,
  compact = false,
  onRefresh,
}: ReservationsPanelProps) {
  const perms = useInventoryPermissions()
  const [rows, setRows] = useState<InventoryReservationRecord[]>([])
  const [loading, setLoading] = useState(true)

  const filter: ReservationFilter = {
    itemId,
    warehouseId,
    referenceNo,
    status: compact ? 'reserved' : undefined,
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getReservations(filter)
      setRows(data)
    } finally {
      setLoading(false)
    }
  }, [itemId, warehouseId, referenceNo, compact])

  useEffect(() => { void load() }, [load])

  async function handleRelease(id: string) {
    try {
      await releaseReservationDemo(id)
      notify.success('Reservation released')
      void load()
      onRefresh?.()
    } catch (e) {
      notify.error(e instanceof InventoryServiceError ? e.message : 'Release failed')
    }
  }

  if (!perms.canViewReservations) {
    return <p className="text-[12px] text-erp-muted">Reservations require inventory.reservations.view.</p>
  }

  if (loading) return <p className="text-[12px] text-erp-muted">Loading reservations…</p>

  if (rows.length === 0) {
    return <p className="text-[12px] text-erp-muted">No reservations for this context.</p>
  }

  return (
    <table className="erp-table w-full text-[12px]">
      <thead>
        <tr>
          <th>Source</th>
          <th>Reference</th>
          <th>Batch</th>
          <th className="text-right">Qty</th>
          <th>Status</th>
          <th>Priority</th>
          {!compact ? <th>Created</th> : null}
          {perms.canManageReservations ? <th /> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{RESERVATION_SOURCE_LABELS[r.source]}</td>
            <td className="font-mono">{r.referenceNo}</td>
            <td className="font-mono">{r.batchNo ?? '—'}</td>
            <td className="text-right font-mono">{formatNumber(r.reservedQty)} / {formatNumber(r.qty)}</td>
            <td>{RESERVATION_STATUS_LABELS[r.status]}</td>
            <td>{r.priority}</td>
            {!compact ? <td>{formatDate(r.createdAt.slice(0, 10))}</td> : null}
            {perms.canManageReservations && ['reserved', 'partially_reserved'].includes(r.status) ? (
              <td>
                <button
                  type="button"
                  className="text-[11px] text-erp-primary underline"
                  onClick={() => void handleRelease(r.id)}
                >
                  Release
                </button>
              </td>
            ) : perms.canManageReservations ? <td /> : null}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export async function createContextReservation(input: {
  itemId: string
  warehouseId: string
  qty: number
  source: ReservationSource
  referenceNo: string
  batchId?: string | null
}) {
  return createReservationDemo({
    ...input,
    reservationMode: 'manual',
  })
}

export async function changeContextReservation(id: string, patch: Parameters<typeof changeReservationDemo>[1]) {
  return changeReservationDemo(id, patch)
}
