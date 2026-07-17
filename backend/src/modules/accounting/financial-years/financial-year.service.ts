import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import type { CreateFinancialYearInput, ListFinancialYearsQuery, UpdateFinancialYearInput } from './financial-year.validation.js'
import * as repo from './financial-year.repository.js'

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

export async function listRecords(_req: Request, tenantId: string, query: ListFinancialYearsQuery) {
  return repo.listFinancialYears(tenantId, query)
}

export async function getRecord(tenantId: string, id: string) {
  return repo.getFinancialYear(tenantId, id)
}

export async function createRecord(req: Request, tenantId: string, input: CreateFinancialYearInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.createFinancialYear(tenantId, userId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'financial_year',
    entityId: record.id,
    action: 'CREATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function updateRecord(req: Request, tenantId: string, id: string, input: UpdateFinancialYearInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const before = await repo.getFinancialYear(tenantId, id)
  const record = await repo.updateFinancialYear(tenantId, id, userId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'financial_year',
    entityId: id,
    action: 'UPDATE',
    oldValues: before,
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function activateRecord(req: Request, tenantId: string, id: string) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.activateFinancialYear(tenantId, id, userId)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'financial_year',
    entityId: id,
    action: 'ACTIVATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function closeRecord(req: Request, tenantId: string, id: string) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.closeFinancialYear(tenantId, id, userId)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'financial_year',
    entityId: id,
    action: 'CLOSE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}
