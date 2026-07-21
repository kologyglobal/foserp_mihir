import { prisma } from '../../../config/database.js'
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

  // Prefer audit rows when both capture the same lifecycle moment (same action + second).
  const seen = new Set<string>()
  const deduped: PurchaseTimelineEventDto[] = []
  for (const event of events.sort((a, b) => b.timestamp.localeCompare(a.timestamp))) {
    const key = `${event.action}|${event.timestamp.slice(0, 19)}|${event.source}`
    const softKey = `${event.action}|${event.timestamp.slice(0, 19)}`
    if (event.source === 'status_history' && seen.has(`audit:${softKey}`)) continue
    if (event.source === 'audit') seen.add(`audit:${softKey}`)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(event)
  }

  return deduped
}

export { isTimelineEntityType, TIMELINE_ENTITY_MAP }
