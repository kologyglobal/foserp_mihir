import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
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
