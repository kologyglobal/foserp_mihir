import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import type { CreateBranchInput, ListBranchesQuery, UpdateBranchInput } from './branch.validation.js'
import * as repo from './branch.repository.js'

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

export async function listRecords(_req: Request, tenantId: string, legalEntityId: string, query: ListBranchesQuery) {
  return repo.listBranches(tenantId, legalEntityId, query)
}

export async function getRecord(tenantId: string, id: string) {
  return repo.getBranch(tenantId, id)
}

export async function createRecord(req: Request, tenantId: string, legalEntityId: string, input: CreateBranchInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.createBranch(tenantId, legalEntityId, userId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'branch',
    entityId: record.id,
    action: 'CREATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function updateRecord(req: Request, tenantId: string, id: string, input: UpdateBranchInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const before = await repo.getBranch(tenantId, id)
  const record = await repo.updateBranch(tenantId, id, userId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'branch',
    entityId: id,
    action: 'UPDATE',
    oldValues: before,
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function setDefaultRecord(req: Request, tenantId: string, id: string) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.setDefaultBranch(tenantId, id, userId)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'branch',
    entityId: id,
    action: 'SET_DEFAULT',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function activateRecord(req: Request, tenantId: string, id: string) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.activateBranch(tenantId, id, userId)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'branch',
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
  const record = await repo.deactivateBranch(tenantId, id, userId)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'branch',
    entityId: id,
    action: 'DEACTIVATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}
