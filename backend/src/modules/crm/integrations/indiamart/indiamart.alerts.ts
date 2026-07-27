import type {
  IndiaMartAlertSeverity,
  IndiaMartAlertType,
  IndiaMartConnection,
  IndiaMartEnquiry,
  Prisma,
} from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import type { IndiaMartConfigurationJson } from './indiamart.types.js'
import { computeSlaStatus } from './indiamart.ingest.js'

export async function upsertAlert(input: {
  tenantId: string
  connectionId?: string | null
  enquiryId?: string | null
  syncRunId?: string | null
  alertType: IndiaMartAlertType
  severity?: IndiaMartAlertSeverity
  title: string
  message: string
  href?: string | null
  dedupeKey: string
  metadata?: Record<string, unknown>
}) {
  return prisma.indiaMartAlert.upsert({
    where: {
      tenantId_dedupeKey: { tenantId: input.tenantId, dedupeKey: input.dedupeKey },
    },
    create: {
      tenantId: input.tenantId,
      connectionId: input.connectionId ?? null,
      enquiryId: input.enquiryId ?? null,
      syncRunId: input.syncRunId ?? null,
      alertType: input.alertType,
      severity: input.severity ?? 'INFO',
      title: input.title,
      message: input.message,
      href: input.href ?? null,
      dedupeKey: input.dedupeKey,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
    update: {
      title: input.title,
      message: input.message,
      severity: input.severity ?? 'INFO',
      href: input.href ?? null,
      isRead: false,
      readAt: null,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  })
}

export async function maybeCreateAlertsForEnquiry(
  connection: IndiaMartConnection,
  enquiry: IndiaMartEnquiry,
) {
  const cfg = (connection.configurationJson ?? {}) as IndiaMartConfigurationJson
  const href = `/crm/integrations/indiamart/inbox`

  if (enquiry.assignedUserId) {
    await upsertAlert({
      tenantId: connection.tenantId,
      connectionId: connection.id,
      enquiryId: enquiry.id,
      alertType: 'NEW_ENQUIRY_ASSIGNED',
      severity: 'INFO',
      title: 'New IndiaMART enquiry assigned',
      message: `${enquiry.buyerName ?? 'Buyer'} — ${enquiry.productName ?? enquiry.subject ?? enquiry.externalEnquiryId}`,
      href,
      dedupeKey: `assigned:${enquiry.id}`,
    })
  }

  const highValue = cfg.highValueThreshold ?? 500_000
  if (enquiry.estimatedOrderValue != null && Number(enquiry.estimatedOrderValue) >= highValue) {
    await upsertAlert({
      tenantId: connection.tenantId,
      connectionId: connection.id,
      enquiryId: enquiry.id,
      alertType: 'HIGH_VALUE_ENQUIRY',
      severity: 'WARNING',
      title: 'High-value IndiaMART enquiry',
      message: `Estimated value ₹${Number(enquiry.estimatedOrderValue).toLocaleString('en-IN')} — ${enquiry.buyerCompanyName ?? enquiry.buyerName ?? enquiry.externalEnquiryId}`,
      href,
      dedupeKey: `highvalue:${enquiry.id}`,
    })
  }

  if (
    enquiry.matchStatus === 'POSSIBLE_DUPLICATE' ||
    (enquiry.matchStatus === 'EXISTING_LEAD' && connection.duplicateBehaviour === 'SEND_TO_REVIEW')
  ) {
    await upsertAlert({
      tenantId: connection.tenantId,
      connectionId: connection.id,
      enquiryId: enquiry.id,
      alertType: 'DUPLICATE_NEEDS_REVIEW',
      severity: 'WARNING',
      title: 'IndiaMART enquiry needs review',
      message: `Possible duplicate / existing match for ${enquiry.buyerName ?? enquiry.externalEnquiryId}`,
      href,
      dedupeKey: `dup:${enquiry.id}`,
    })
  }

  if (enquiry.slaStatus === 'OVERDUE') {
    await upsertAlert({
      tenantId: connection.tenantId,
      connectionId: connection.id,
      enquiryId: enquiry.id,
      alertType: 'SLA_OVERDUE',
      severity: 'CRITICAL',
      title: 'IndiaMART enquiry overdue',
      message: `${enquiry.buyerName ?? 'Buyer'} waiting beyond escalation SLA`,
      href,
      dedupeKey: `sla-overdue:${enquiry.id}`,
    })
  } else if (enquiry.slaStatus === 'DUE_SOON') {
    await upsertAlert({
      tenantId: connection.tenantId,
      connectionId: connection.id,
      enquiryId: enquiry.id,
      alertType: 'SLA_DUE_SOON',
      severity: 'WARNING',
      title: 'IndiaMART enquiry due soon',
      message: `${enquiry.buyerName ?? 'Buyer'} approaching first-response SLA`,
      href,
      dedupeKey: `sla-due:${enquiry.id}`,
    })
  }
}

export async function refreshSlaAndAlerts(tenantId: string, connection: IndiaMartConnection) {
  const cfg = (connection.configurationJson ?? {}) as IndiaMartConfigurationJson
  const open = await prisma.indiaMartEnquiry.findMany({
    where: {
      tenantId,
      importStatus: { in: ['NOT_IMPORTED', 'AUTO_IMPORTED', 'MANUALLY_IMPORTED', 'LINKED_TO_EXISTING'] },
      processingStatus: { notIn: ['IGNORED'] },
      OR: [{ firstContactedAt: null }, { slaStatus: { in: ['WITHIN_SLA', 'DUE_SOON', 'OVERDUE'] } }],
    },
    take: 500,
    orderBy: { receivedAt: 'asc' },
  })

  for (const enquiry of open) {
    const next = computeSlaStatus(enquiry.receivedAt ?? enquiry.enquiryDate, enquiry.firstContactedAt, cfg)
    if (next && next !== enquiry.slaStatus) {
      const updated = await prisma.indiaMartEnquiry.update({
        where: { id: enquiry.id },
        data: { slaStatus: next },
      })
      await maybeCreateAlertsForEnquiry(connection, updated)
    } else if (enquiry.slaStatus === 'OVERDUE' || enquiry.slaStatus === 'DUE_SOON') {
      await maybeCreateAlertsForEnquiry(connection, enquiry)
    }
  }
}

export async function listAlerts(tenantId: string, opts?: { unreadOnly?: boolean; limit?: number }) {
  return prisma.indiaMartAlert.findMany({
    where: {
      tenantId,
      ...(opts?.unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: opts?.limit ?? 50,
  })
}

export async function markAlertRead(tenantId: string, id: string, userId: string) {
  return prisma.indiaMartAlert.updateMany({
    where: { id, tenantId },
    data: { isRead: true, readAt: new Date(), readById: userId },
  })
}

export async function markAllAlertsRead(tenantId: string, userId: string) {
  return prisma.indiaMartAlert.updateMany({
    where: { tenantId, isRead: false },
    data: { isRead: true, readAt: new Date(), readById: userId },
  })
}
