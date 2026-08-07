import { prisma } from '../../../config/prisma.js'
import {
  isTimelineEntityType,
  purchaseAuditActionLabel,
  PURCHASE_AUDIT_ENTITY,
  TIMELINE_ENTITY_MAP,
  type TimelineEntityType,
} from '../shared/purchase-audit.js'

export type PurchaseTimelineEventDto = {
  id: string
  source: 'audit' | 'status_history'
  tenantId: string | null
  module: string
  entityType: string
  entityId: string
  action: string
  actionLabel: string
  previousValue: unknown
  newValue: unknown
  actorId: string | null
  actorName: string | null
  timestamp: string
  remarks: string | null
  requestMetadata: {
    ipAddress: string | null
    userAgent: string | null
  } | null
}

function iso(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString()
  if (typeof value === 'string') return value
  return value.toISOString()
}

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
  a: PurchaseTimelineEventDto,
  b: PurchaseTimelineEventDto,
): PurchaseTimelineEventDto {
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

export function dedupePurchaseTimelineEvents(
  events: PurchaseTimelineEventDto[],
): PurchaseTimelineEventDto[] {
  const byKey = new Map<string, PurchaseTimelineEventDto>()

  for (const event of events) {
    const bucket = lifecycleBucket(event.action)
    const key = bucket
      ? `lc:${bucket}|${event.timestamp.slice(0, 19)}|${event.actorId ?? ''}`
      : `raw:${event.source}|${event.action}|${event.timestamp.slice(0, 19)}|${event.id}`

    const existing = byKey.get(key)
    byKey.set(key, existing ? mergeTimelinePair(existing, event) : event)
  }

  return [...byKey.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

export async function getPurchaseTimeline(
  tenantId: string,
  entityType: TimelineEntityType,
  entityId: string,
): Promise<PurchaseTimelineEventDto[]> {
  const map = TIMELINE_ENTITY_MAP[entityType]
  const events: PurchaseTimelineEventDto[] = []

  const auditWhere: {
    tenantId: string
    module: string
    OR: Array<{ entity: string; entityId: string }>
  } = {
    tenantId,
    module: 'purchase',
    OR: [{ entity: map.auditEntity, entityId }],
  }

  // RFQ timeline also surfaces linked VQ / comparison events that reference this RFQ.
  if (entityType === 'rfq') {
    const [quotations, comparisons] = await Promise.all([
      prisma.vendorQuotation.findMany({
        where: { tenantId, requestForQuotationId: entityId, deletedAt: null },
        select: { id: true },
      }),
      prisma.vendorComparison.findMany({
        where: { tenantId, requestForQuotationId: entityId, deletedAt: null },
        select: { id: true },
      }),
    ])
    for (const q of quotations) {
      auditWhere.OR.push({ entity: PURCHASE_AUDIT_ENTITY.VQ, entityId: q.id })
    }
    for (const c of comparisons) {
      auditWhere.OR.push({ entity: PURCHASE_AUDIT_ENTITY.COMPARISON, entityId: c.id })
    }
  }

  const [audits, histories] = await Promise.all([
    prisma.auditLog.findMany({
      where: auditWhere,
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.purchaseStatusHistory.findMany({
      where: {
        tenantId,
        documentType: map.statusDocumentType,
        documentId: entityId,
      },
      orderBy: { actedAt: 'desc' },
      take: 200,
    }),
  ])

  for (const row of audits) {
    events.push({
      id: `audit:${row.id}`,
      source: 'audit',
      tenantId: row.tenantId,
      module: row.module,
      entityType: row.entity,
      entityId: row.entityId ?? entityId,
      action: row.action,
      actionLabel: purchaseAuditActionLabel(row.action),
      previousValue: row.oldValues ?? null,
      newValue: row.newValues ?? null,
      actorId: row.userId,
      actorName: null,
      timestamp: iso(row.createdAt),
      remarks: null,
      requestMetadata: {
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
      },
    })
  }

  for (const row of histories) {
    events.push({
      id: `status:${row.id}`,
      source: 'status_history',
      tenantId: row.tenantId,
      module: 'purchase',
      entityType: map.auditEntity,
      entityId: row.documentId,
      action: row.action,
      actionLabel: purchaseAuditActionLabel(row.action),
      previousValue: row.fromStatus ? { status: row.fromStatus } : null,
      newValue: row.toStatus ? { status: row.toStatus } : null,
      actorId: row.actorId,
      actorName: row.actorName,
      timestamp: iso(row.actedAt),
      remarks: row.remarks,
      requestMetadata: null,
    })
  }

  const deduped = dedupePurchaseTimelineEvents(events)

  // Resolve actor display names — never leave raw user UUIDs for the UI.
  const actorIds = [
    ...new Set(deduped.map((e) => e.actorId).filter((id): id is string => Boolean(id))),
  ]
  if (actorIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { tenantId, id: { in: actorIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    })
    const nameById = new Map(
      users.map((u) => {
        const full = `${u.firstName} ${u.lastName}`.trim()
        return [u.id, full || u.email] as const
      }),
    )
    for (const event of deduped) {
      if (event.actorName?.trim()) continue
      if (!event.actorId) continue
      event.actorName = nameById.get(event.actorId) ?? null
    }
  }

  return deduped
}

export { isTimelineEntityType, TIMELINE_ENTITY_MAP }
