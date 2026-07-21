import { useCallback, useEffect, useState } from 'react'
import { Clock, FileText } from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getPurchaseTimelineApi,
  type PurchaseTimelineEntityType,
  type PurchaseTimelineEvent,
} from '@/services/purchase/purchaseTimelineApi'
import { formatDateTime } from '@/utils/dates/format'
import { cn } from '@/utils/cn'

function summarizeValue(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const bits: string[] = []
    for (const key of ['status', 'rfqRequired', 'buyerId', 'selectedVendorId', 'expectedRate', 'quantity', 'rate', 'rejectionReason']) {
      if (obj[key] !== undefined && obj[key] !== null) bits.push(`${key}: ${String(obj[key])}`)
    }
    if (bits.length) return bits.join(' · ')
    try {
      const raw = JSON.stringify(value)
      return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw
    } catch {
      return null
    }
  }
  return null
}

export function PurchaseAuditTimeline({
  entityType,
  entityId,
  title = 'Audit Timeline',
  demoEvents,
  className,
}: {
  entityType: PurchaseTimelineEntityType
  entityId: string | null | undefined
  title?: string
  /** Demo-mode fallback events when API is off. */
  demoEvents?: PurchaseTimelineEvent[]
  className?: string
}) {
  const [events, setEvents] = useState<PurchaseTimelineEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!entityId) {
      setEvents([])
      return
    }
    if (!isApiMode()) {
      setEvents(demoEvents ?? [])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await getPurchaseTimelineApi(entityType, entityId)
      setEvents(res.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [demoEvents, entityId, entityType])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className={cn('erp-page-panel p-4', className)}>
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-erp-muted" aria-hidden />
        <h3 className="text-[14px] font-semibold text-erp-text">{title}</h3>
      </div>
      {loading ? <LoadingState variant="table" rows={4} cols={1} /> : null}
      {!loading && error ? <p className="text-[13px] text-red-600">{error}</p> : null}
      {!loading && !error && events.length === 0 ? (
        <p className="text-[13px] text-erp-muted">No audit events recorded yet.</p>
      ) : null}
      {!loading && events.length > 0 ? (
        <div className="space-y-0">
          {events.map((event, idx) => {
            const prev = summarizeValue(event.previousValue)
            const next = summarizeValue(event.newValue)
            return (
              <div key={event.id} className="relative flex gap-3 pb-4">
                {idx < events.length - 1 ? (
                  <span className="absolute left-[11px] top-7 bottom-0 w-px bg-erp-border" aria-hidden />
                ) : null}
                <span className="relative z-[1] mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-erp-border bg-white text-erp-muted">
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-erp-text">{event.actionLabel}</p>
                  <p className="text-[12px] text-erp-muted">
                    {formatDateTime(event.timestamp)}
                    {event.actorName || event.actorId
                      ? ` · ${event.actorName ?? event.actorId}`
                      : ''}
                    {event.source === 'status_history' ? ' · status' : ''}
                  </p>
                  {event.remarks ? (
                    <p className="mt-1 text-[12px] text-erp-text">{event.remarks}</p>
                  ) : null}
                  {(prev || next) && (
                    <p className="mt-1 text-[12px] text-erp-muted">
                      {prev ? <span>From {prev}</span> : null}
                      {prev && next ? ' → ' : null}
                      {next ? <span>{prev ? `To ${next}` : next}</span> : null}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

/** Build lightweight demo timeline entries from document timestamps. */
export function buildDemoPurchaseTimeline(input: {
  entityId: string
  entityType: string
  createdAt?: string | null
  createdBy?: string | null
  updatedAt?: string | null
  updatedBy?: string | null
  statusLabel?: string | null
  extra?: Array<{ action: string; actionLabel: string; timestamp: string; actor?: string | null }>
}): PurchaseTimelineEvent[] {
  const rows: PurchaseTimelineEvent[] = []
  if (input.createdAt) {
    rows.push({
      id: `demo-created-${input.entityId}`,
      source: 'audit',
      tenantId: null,
      module: 'purchase',
      entityType: input.entityType,
      entityId: input.entityId,
      action: 'CREATED',
      actionLabel: 'Created',
      previousValue: null,
      newValue: input.statusLabel ? { status: input.statusLabel } : null,
      actorId: null,
      actorName: input.createdBy ?? null,
      timestamp: input.createdAt,
      remarks: null,
      requestMetadata: null,
    })
  }
  for (const extra of input.extra ?? []) {
    rows.push({
      id: `demo-${extra.action}-${extra.timestamp}`,
      source: 'audit',
      tenantId: null,
      module: 'purchase',
      entityType: input.entityType,
      entityId: input.entityId,
      action: extra.action,
      actionLabel: extra.actionLabel,
      previousValue: null,
      newValue: null,
      actorId: null,
      actorName: extra.actor ?? null,
      timestamp: extra.timestamp,
      remarks: null,
      requestMetadata: null,
    })
  }
  if (input.updatedAt && input.updatedAt !== input.createdAt) {
    rows.push({
      id: `demo-updated-${input.entityId}`,
      source: 'audit',
      tenantId: null,
      module: 'purchase',
      entityType: input.entityType,
      entityId: input.entityId,
      action: 'UPDATED',
      actionLabel: 'Updated',
      previousValue: null,
      newValue: null,
      actorId: null,
      actorName: input.updatedBy ?? null,
      timestamp: input.updatedAt,
      remarks: null,
      requestMetadata: null,
    })
  }
  return rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}
