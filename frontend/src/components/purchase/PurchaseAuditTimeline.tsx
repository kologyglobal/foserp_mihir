import { useCallback, useEffect, useState } from 'react'
import { Clock, FileText } from 'lucide-react'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getPurchaseTimelineApi,
  type PurchaseTimelineEntityType,
  type PurchaseTimelineEvent,
} from '@/services/purchase/purchaseTimelineApi'
import { formatDateTime } from '@/utils/dates/format'
import { dedupePurchaseTimelineEvents } from '@/utils/purchaseTimelineDedup'
import { cn } from '@/utils/cn'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const STATUS_LABELS: Record<string, string> = {
  draft: 'Open',
  DRAFT: 'Open',
  pending_approval: 'Pending Approved',
  PENDING_APPROVAL: 'Pending Approved',
  approved: 'Approved',
  APPROVED: 'Approved',
  rejected: 'Rejected',
  REJECTED: 'Rejected',
  sent_back: 'Sent Back',
  SENT_BACK: 'Sent Back',
  released: 'Released',
  SENT_TO_VENDOR: 'Released',
  partially_received: 'Partially Received',
  PARTIALLY_RECEIVED: 'Partially Received',
  fully_received: 'Fully Received',
  FULLY_RECEIVED: 'Fully Received',
  invoiced: 'Invoiced',
  PARTIALLY_INVOICED: 'Partially Invoiced',
  FULLY_INVOICED: 'Invoiced',
  closed: 'Closed',
  CLOSED: 'Closed',
  cancelled: 'Cancelled',
  CANCELLED: 'Cancelled',
}

const ORIGIN_LABELS: Record<string, string> = {
  MANUAL: 'Manual',
  manual: 'Manual',
  PURCHASE_REQUISITION: 'Purchase Requisition',
  purchase_requisition: 'Purchase Requisition',
  QUOTATION_COMPARISON: 'Quotation Comparison',
  quotation_comparison: 'Quotation Comparison',
  VENDOR_QUOTATION: 'Vendor Quotation',
  vendor_quotation: 'Vendor Quotation',
  BLANKET_ORDER: 'Blanket Order',
  blanket_order: 'Blanket Order',
}

/** Keys safe to show to end users — never expose *Id / UUID fields. */
const FRIENDLY_FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  orderNumber: 'PO Number',
  documentNumber: 'Document No.',
  origin: 'Origin',
  quantity: 'Qty',
  rate: 'Rate',
  expectedRate: 'Expected rate',
  rfqRequired: 'RFQ required',
  rejectionReason: 'Reason',
  remarks: 'Remarks',
}

function isUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID_RE.test(value.trim())
}

function formatDisplayValue(key: string, value: unknown): string | null {
  if (value == null) return null
  if (isUuid(value)) return null
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)

  const text = String(value).trim()
  if (!text) return null
  if (isUuid(text)) return null

  if (key === 'status' || key.toLowerCase().endsWith('status')) {
    return STATUS_LABELS[text] ?? text.replace(/_/g, ' ')
  }
  if (key === 'origin') {
    return ORIGIN_LABELS[text] ?? text.replace(/_/g, ' ')
  }
  return text
}

function summarizeValue(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    if (isUuid(value)) return null
    if (typeof value === 'string' && STATUS_LABELS[value]) return STATUS_LABELS[value]
    return String(value)
  }
  if (typeof value !== 'object') return null

  const obj = value as Record<string, unknown>
  const bits: string[] = []

  for (const [key, label] of Object.entries(FRIENDLY_FIELD_LABELS)) {
    if (obj[key] === undefined || obj[key] === null) continue
    const formatted = formatDisplayValue(key, obj[key])
    if (!formatted) continue
    bits.push(`${label}: ${formatted}`)
  }

  if (bits.length) return bits.join(' · ')

  // Status-only / small change payloads without known keys
  for (const [key, raw] of Object.entries(obj)) {
    if (/id$/i.test(key) || key === 'id' || isUuid(raw)) continue
    if (typeof raw === 'object') continue
    const formatted = formatDisplayValue(key, raw)
    if (!formatted) continue
    const label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()
    bits.push(`${label.charAt(0).toUpperCase()}${label.slice(1)}: ${formatted}`)
    if (bits.length >= 3) break
  }

  return bits.length ? bits.join(' · ') : null
}

function formatActor(event: PurchaseTimelineEvent): string | null {
  const name = event.actorName?.trim()
  if (name && !isUuid(name)) return name
  return null
}

export function PurchaseAuditTimeline({
  entityType,
  entityId,
  title = 'Audit Timeline',
  showTitle = true,
  className,
}: {
  entityType: PurchaseTimelineEntityType
  entityId: string | null | undefined
  title?: string
  /** When embedded in an ErpCardSection that already has a title. */
  showTitle?: boolean
  /** @deprecated no longer used now that the timeline always loads from the live API. */
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
    setLoading(true)
    setError(null)
    try {
      const res = await getPurchaseTimelineApi(entityType, entityId)
      setEvents(dedupePurchaseTimelineEvents(res.data ?? []))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [entityId, entityType])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className={cn('erp-page-panel p-4', className)}>
      {showTitle ? (
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-erp-muted" aria-hidden />
          <h3 className="text-[14px] font-semibold text-erp-text">{title}</h3>
        </div>
      ) : null}
      {loading ? <LoadingState variant="table" rows={4} cols={1} /> : null}
      {!loading && error ? <p className="text-[13px] text-red-600">{error}</p> : null}
      {!loading && !error && events.length === 0 ? (
        <p className="text-[13px] text-erp-muted">No history recorded yet.</p>
      ) : null}
      {!loading && events.length > 0 ? (
        <div className="space-y-0">
          {events.map((event, idx) => {
            const prev = summarizeValue(event.previousValue)
            const next = summarizeValue(event.newValue)
            const actor = formatActor(event)
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
                    {actor ? ` · ${actor}` : ''}
                  </p>
                  {event.remarks ? (
                    <p className="mt-1 text-[12px] text-erp-text">{event.remarks}</p>
                  ) : null}
                  {(prev || next) && (
                    <p className="mt-1 text-[12px] text-erp-muted">
                      {prev && next ? (
                        <>
                          <span>{prev}</span>
                          {' → '}
                          <span>{next}</span>
                        </>
                      ) : (
                        <span>{next ?? prev}</span>
                      )}
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
      actorName: input.createdBy && !UUID_RE.test(input.createdBy) ? input.createdBy : null,
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
      actorName: extra.actor && !UUID_RE.test(extra.actor) ? extra.actor : null,
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
      actorName: input.updatedBy && !UUID_RE.test(input.updatedBy) ? input.updatedBy : null,
      timestamp: input.updatedAt,
      remarks: null,
      requestMetadata: null,
    })
  }
  return rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}
