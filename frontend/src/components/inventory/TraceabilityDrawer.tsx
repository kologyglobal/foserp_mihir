import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CrmDrawerShell } from '../crm/CrmDrawerShell'
import { LoadingState } from '@/design-system/components/LoadingState'
import { getInventoryTraceability } from '@/services/inventory/traceabilityService'
import type { InventoryTraceabilityResult } from '@/types/inventoryDomain'
import { formatDate } from '@/utils/dates/format'
import { formatNumber } from '@/utils/formatters/currency'

export interface TraceabilityDrawerProps {
  open: boolean
  entityType: 'item' | 'batch' | 'serial'
  entityId: string | null
  onClose: () => void
}

export function TraceabilityDrawer({ open, entityType, entityId, onClose }: TraceabilityDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<InventoryTraceabilityResult | null>(null)

  useEffect(() => {
    if (!open || !entityId) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    getInventoryTraceability(entityType, entityId)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [open, entityType, entityId])

  return (
    <CrmDrawerShell
      open={open}
      onClose={onClose}
      title="Traceability"
      subtitle={data?.entityLabel}
      width="lg"
    >
      {loading ? <LoadingState variant="card" /> : null}
      {!loading && !data ? <p className="text-sm text-erp-muted">No traceability data.</p> : null}
      {!loading && data ? (
        <div className="space-y-2">
          <p className="text-[12px] text-erp-muted">
            Timeline: item → movement, batch → receipt/issue, serial → dispatch, production, returns.
          </p>
          <table className="erp-table w-full text-[12px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Event</th>
                <th>Document</th>
                <th>Warehouse</th>
                <th className="text-right">Qty</th>
                <th>User</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.events.length === 0 ? (
                <tr><td colSpan={7} className="text-erp-muted">No events recorded.</td></tr>
              ) : data.events.map((e) => (
                <tr key={e.id}>
                  <td>{formatDate(e.eventDate)}</td>
                  <td>{e.eventLabel}</td>
                  <td>
                    {e.documentHref ? (
                      <Link to={e.documentHref} className="font-mono text-erp-primary hover:underline" onClick={onClose}>
                        {e.documentNo}
                      </Link>
                    ) : (
                      <span className="font-mono">{e.documentNo}</span>
                    )}
                  </td>
                  <td>{e.warehouseName ?? '—'}</td>
                  <td className="text-right font-mono">{e.qty != null ? formatNumber(e.qty) : '—'}</td>
                  <td>{e.userName}</td>
                  <td>{e.status ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </CrmDrawerShell>
  )
}
