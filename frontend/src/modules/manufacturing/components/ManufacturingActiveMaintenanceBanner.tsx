import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { getActiveMaintenanceTicket, type MaintenanceTicket } from '@/services/api/maintenanceApi'
import { isApiMode } from '@/config/apiConfig'

/**
 * Compact manufacturing banner when a machine has an open maintenance ticket.
 * Does not cancel WO — Maintenance owns availability; Manufacturing owns Hold/Resume/Alternate.
 */
export function ManufacturingActiveMaintenanceBanner({ machineId }: { machineId?: string | null }) {
  const [ticket, setTicket] = useState<MaintenanceTicket | null>(null)

  useEffect(() => {
    if (!isApiMode() || !machineId) {
      setTicket(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await getActiveMaintenanceTicket(machineId)
        if (!cancelled) setTicket(res.data ?? null)
      } catch {
        if (!cancelled) setTicket(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [machineId])

  if (!ticket) return null

  return (
    <div className="mb-3 flex flex-wrap items-start gap-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-950">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">
          MACHINE DOWN · {ticket.ticketNumber}
          {ticket.failureCategory ? ` · ${ticket.failureCategory}` : ''}
        </div>
        <div className="text-[12px]">
          {ticket.status.replaceAll('_', ' ')}
          {ticket.downtimeLabel ? ` · Downtime ${ticket.downtimeLabel}` : ''}
        </div>
        <div className="mt-0.5 text-[12px] text-rose-900/80 line-clamp-2">{ticket.problem}</div>
      </div>
      <Link
        to={`/maintenance/tickets/${ticket.id}`}
        className="shrink-0 rounded border border-rose-300 bg-white px-2 py-1 text-[12px] font-semibold text-rose-900 hover:bg-rose-100"
      >
        View Maintenance
      </Link>
    </div>
  )
}
