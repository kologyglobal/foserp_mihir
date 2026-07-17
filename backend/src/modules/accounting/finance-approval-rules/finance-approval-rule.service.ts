import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import type { CreateApprovalRuleInput, ListApprovalRulesQuery, UpdateApprovalRuleInput } from './finance-approval-rule.validation.js'
import * as repo from './finance-approval-rule.repository.js'

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

export async function listRecords(_req: Request, tenantId: string, query: ListApprovalRulesQuery) {
  return repo.listApprovalRules(tenantId, query)
}

export async function getRecord(tenantId: string, id: string) {
  return repo.getApprovalRule(tenantId, id)
}

export async function createRecord(req: Request, tenantId: string, input: CreateApprovalRuleInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.createApprovalRule(tenantId, userId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'approval_rule',
    entityId: record.id,
    action: 'CREATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function updateRecord(req: Request, tenantId: string, id: string, input: UpdateApprovalRuleInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const before = await repo.getApprovalRule(tenantId, id)
  const record = await repo.updateApprovalRule(tenantId, id, userId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'approval_rule',
    entityId: id,
    action: 'UPDATE',
    oldValues: before,
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function deleteRecord(req: Request, tenantId: string, id: string) {
  const audit = auditMeta(req)
  const before = await repo.getApprovalRule(tenantId, id)
  await repo.deleteApprovalRule(tenantId, id)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'approval_rule',
    entityId: id,
    action: 'DELETE',
    oldValues: before,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
}
