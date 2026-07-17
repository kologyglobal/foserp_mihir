import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import type { CreatePostingRuleInput, ListPostingRulesQuery, UpdatePostingRuleInput } from './ledger.schemas.js'
import * as repo from './posting-rule.repository.js'

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

export async function listRecords(_req: Request, tenantId: string, query: ListPostingRulesQuery) {
  return repo.listPostingRules(tenantId, query)
}

export async function getRecord(tenantId: string, id: string) {
  return repo.findPostingRuleById(tenantId, id)
}

export async function createRecord(req: Request, tenantId: string, input: CreatePostingRuleInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.createPostingRule(tenantId, userId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'posting_rule',
    entityId: record.id,
    action: 'CREATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function updateRecord(req: Request, tenantId: string, id: string, input: UpdatePostingRuleInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const before = await repo.findPostingRuleById(tenantId, id)
  const record = await repo.updatePostingRule(tenantId, id, userId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'posting_rule',
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
  const before = await repo.findPostingRuleById(tenantId, id)
  const record = await repo.activatePostingRule(tenantId, id, userId)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'posting_rule',
    entityId: id,
    action: 'ACTIVATE',
    oldValues: before,
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function deactivateRecord(req: Request, tenantId: string, id: string) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const before = await repo.findPostingRuleById(tenantId, id)
  const record = await repo.deactivatePostingRule(tenantId, id, userId)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'posting_rule',
    entityId: id,
    action: 'DEACTIVATE',
    oldValues: before,
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function createVersionRecord(req: Request, tenantId: string, id: string, input: UpdatePostingRuleInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.createPostingRuleVersion(tenantId, userId, id, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'posting_rule',
    entityId: record.id,
    action: 'VERSION_CREATED',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}
