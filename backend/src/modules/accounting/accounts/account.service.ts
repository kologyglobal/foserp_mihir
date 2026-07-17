import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import type { AccountTreeQuery, ApplyTemplateInput, CreateAccountInput, ListAccountsQuery, UpdateAccountInput } from './account.validation.js'
import * as repo from './account.repository.js'

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

export async function listRecords(_req: Request, tenantId: string, query: ListAccountsQuery) {
  return repo.listAccounts(tenantId, query)
}

export async function getTree(_req: Request, tenantId: string, query: AccountTreeQuery) {
  return repo.getAccountTree(tenantId, query)
}

export async function getRecord(tenantId: string, id: string) {
  return repo.getAccount(tenantId, id)
}

export async function createRecord(req: Request, tenantId: string, input: CreateAccountInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.createAccount(tenantId, userId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'account',
    entityId: record.id,
    action: 'CREATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function updateRecord(req: Request, tenantId: string, id: string, input: UpdateAccountInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const before = await repo.getAccount(tenantId, id)
  const record = await repo.updateAccount(tenantId, id, userId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'account',
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
  const record = await repo.activateAccount(tenantId, id, userId)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'account',
    entityId: id,
    action: 'ACTIVATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function deactivateRecord(req: Request, tenantId: string, id: string) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.deactivateAccount(tenantId, id, userId)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'account',
    entityId: id,
    action: 'DEACTIVATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function applyTemplateRecord(req: Request, tenantId: string, input: ApplyTemplateInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const count = await repo.applyCoaTemplate(tenantId, userId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'account',
    entityId: input.legalEntityId,
    action: 'CREATE',
    newValues: { templateId: input.templateId, accountCount: count },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return { accountCount: count, templateId: input.templateId }
}
