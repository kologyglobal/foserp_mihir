import type { PurchaseTimelineEvent } from '@/services/purchase/purchaseTimelineApi'

/** Map PR/PO lifecycle audit + status_history verbs to one bucket. */
function lifecycleBucket(action: string): string | null {
  const u = action.toUpperCase()
  if (u === 'PR_CREATED' || u === 'CREATED' || u === 'CREATE') return 'created'
  if (u === 'PR_SUBMITTED' || u === 'SUBMITTED' || u === 'SUBMIT') return 'submitted'
  if (u === 'PR_APPROVED' || u === 'APPROVED' || u === 'APPROVE') return 'approved'
  if (u === 'PR_REJECTED' || u === 'REJECTED' || u === 'REJECT') return 'rejected'
  if (u === 'PR_SENT_BACK' || u === 'SENT_BACK') return 'sent_back'
  if (u === 'PR_CANCELLED' || u === 'CANCELLED' || u === 'CANCEL') return 'cancelled'
  if (u === 'PR_REOPENED' || u === 'REOPENED' || u === 'REOPEN') return 'reopened'
  return null
}

function mergeTimelinePair(
  a: PurchaseTimelineEvent,
  b: PurchaseTimelineEvent,
): PurchaseTimelineEvent {
  const status = a.source === 'status_history' ? a : b.source === 'status_history' ? b : null
  const audit = a.source === 'audit' ? a : b.source === 'audit' ? b : null
  const base = status ?? audit ?? a
  if (!status || !audit) return base
  return {
    ...base,
    id: status.id,
    source: 'status_history',
    previousValue: audit.previousValue ?? status.previousValue,
    newValue: audit.newValue ?? status.newValue,
    remarks: status.remarks ?? audit.remarks,
    actorName: status.actorName ?? audit.actorName,
    actorId: status.actorId ?? audit.actorId,
    timestamp: status.timestamp,
  }
}

function lifecycleDedupeTimeKey(timestamp: string, bucket: string | null): string {
  if (bucket) return timestamp.slice(0, 16)
  return timestamp.slice(0, 19)
}

/** Collapse audit + status_history pairs that describe the same lifecycle moment. */
export function dedupePurchaseTimelineEvents(events: PurchaseTimelineEvent[]): PurchaseTimelineEvent[] {
  const byKey = new Map<string, PurchaseTimelineEvent>()

  for (const event of events) {
    const bucket = lifecycleBucket(event.action)
    const timeKey = lifecycleDedupeTimeKey(event.timestamp, bucket)
    const key = bucket
      ? `lc:${bucket}|${timeKey}|${event.actorId ?? ''}`
      : `raw:${event.source}|${event.action}|${timeKey}|${event.id}`

    const existing = byKey.get(key)
    byKey.set(key, existing ? mergeTimelinePair(existing, event) : event)
  }

  return [...byKey.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}
