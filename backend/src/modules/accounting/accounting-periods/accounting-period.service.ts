import type { AccountingPeriodStatus } from '@prisma/client'
import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { getTodayInTimezone, toDateOnlyString } from '../shared/finance.helpers.js'
import { resolvePeriodByDate } from '../posting/posting-period.service.js'
import type {
  GeneratePeriodsInput,
  ListPeriodsQuery,
  ReopenPeriodInput,
  UpdatePeriodInput,
  UpsertChecklistAcksInput,
} from './accounting-period.validation.js'
import * as repo from './accounting-period.repository.js'
import * as checklistAckService from './period-close-checklist-ack.service.js'
import * as readinessService from './period-close-readiness.service.js'

/** Period snapshot for readiness / enablement responses. */
export type OpenPeriodCheckPeriod = {
  id: string
  /** Period display code — AccountingPeriod has `name` (no separate code column). */
  code: string
  periodNumber: number
  name: string
  startDate: string
  endDate: string
  status: AccountingPeriodStatus
}

export type OpenPeriodCheckResult = {
  /** YYYY-MM-DD used for containment (tenant TZ today, or explicit override). */
  postingDateChecked: string
  openFinancialPeriodExists: boolean
  period: OpenPeriodCheckPeriod | null
}

function normalizePostingDateInput(value: string | Date): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
    return toDateOnlyString(new Date(trimmed))
  }
  return toDateOnlyString(value)
}

/**
 * Resolve whether postingDate falls in an OPEN (or REOPENED) accounting period.
 * Uses the same FY/period resolution path as central posting (`resolvePeriodByDate`).
 * Enablement readiness must still not replace posting-time `resolvePostingPeriod`.
 */
export async function checkOpenAccountingPeriod(
  tenantId: string,
  legalEntityId: string,
  postingDate?: string | Date | null,
): Promise<OpenPeriodCheckResult> {
  let postingDateChecked: string
  if (postingDate != null && String(postingDate).trim() !== '') {
    postingDateChecked = normalizePostingDateInput(postingDate)
  } else {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { timezone: true },
    })
    postingDateChecked = getTodayInTimezone(tenant?.timezone || 'Asia/Kolkata')
  }

  try {
    const resolved = await resolvePeriodByDate(tenantId, legalEntityId, postingDateChecked)
    const status = resolved.period.status
    // OPEN required by product rule; REOPENED also postable via resolvePostingPeriod.
    const open = status === 'OPEN' || status === 'REOPENED'
    const period: OpenPeriodCheckPeriod = {
      id: resolved.period.id,
      code: resolved.period.name,
      periodNumber: resolved.period.periodNumber,
      name: resolved.period.name,
      startDate: toDateOnlyString(resolved.period.startDate),
      endDate: toDateOnlyString(resolved.period.endDate),
      status,
    }
    return {
      postingDateChecked,
      openFinancialPeriodExists: open,
      /** Include period even when closed/under review so callers see which period matched the date. */
      period,
    }
  } catch {
    return {
      postingDateChecked,
      openFinancialPeriodExists: false,
      period: null,
    }
  }
}

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

export async function listRecords(_req: Request, tenantId: string, query: ListPeriodsQuery) {
  return repo.listPeriods(tenantId, query)
}

export async function getRecord(tenantId: string, id: string) {
  return repo.getPeriod(tenantId, id)
}

export async function getCloseReadiness(tenantId: string, id: string) {
  return readinessService.getCloseReadiness(tenantId, id)
}

export async function listChecklistAcks(tenantId: string, id: string) {
  return checklistAckService.listChecklistAcks(tenantId, id)
}

export async function upsertChecklistAcks(
  req: Request,
  tenantId: string,
  id: string,
  input: UpsertChecklistAcksInput,
) {
  const userId = req.context?.userId ?? ''
  const items = await checklistAckService.upsertChecklistAcks(tenantId, id, userId, input.items)
  const audit = auditMeta(req)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'period_close_checklist_ack',
    entityId: id,
    action: 'UPDATE',
    newValues: { count: items.length },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return items
}

export async function generateRecord(req: Request, tenantId: string, input: GeneratePeriodsInput) {
  const audit = auditMeta(req)
  const records = await repo.generatePeriods(tenantId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'accounting_period',
    entityId: input.financialYearId,
    action: 'CREATE',
    newValues: { count: records.length },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return records
}

export async function updateRecord(req: Request, tenantId: string, id: string, input: UpdatePeriodInput) {
  const audit = auditMeta(req)
  const before = await repo.getPeriod(tenantId, id)
  const record = await repo.updatePeriod(tenantId, id, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'accounting_period',
    entityId: id,
    action: 'UPDATE',
    oldValues: before,
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function markUnderReviewRecord(req: Request, tenantId: string, id: string) {
  const audit = auditMeta(req)
  const record = await repo.markUnderReview(tenantId, id)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'accounting_period',
    entityId: id,
    action: 'UPDATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function closeRecord(req: Request, tenantId: string, id: string) {
  const audit = auditMeta(req)
  await readinessService.assertCloseAllowed(tenantId, id)
  const userId = req.context?.userId ?? ''
  const record = await repo.closePeriod(tenantId, id, userId)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'accounting_period',
    entityId: id,
    action: 'CLOSE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function reopenRecord(req: Request, tenantId: string, id: string, input: ReopenPeriodInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.reopenPeriod(tenantId, id, userId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'accounting_period',
    entityId: id,
    action: 'REOPEN',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}
