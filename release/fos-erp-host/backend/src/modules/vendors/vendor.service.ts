import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../services/audit.service.js'
import type { VendorLookupQuery, ListVendorsQuery } from './vendor.validation.js'
import * as repo from './vendor.repository.js'

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

export async function listRecords(_req: Request, tenantId: string, query: ListVendorsQuery) {
  return repo.listVendors(tenantId, query)
}

export async function getRecord(tenantId: string, id: string) {
  return repo.getVendor(tenantId, id)
}

export async function createRecord(req: Request, tenantId: string, input: Record<string, unknown>) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.createVendor(tenantId, userId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'master',
    entity: 'masterVendor',
    entityId: record.id,
    action: 'CREATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function updateRecord(
  req: Request,
  tenantId: string,
  id: string,
  input: Record<string, unknown>,
) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const before = await repo.getVendor(tenantId, id)
  const record = await repo.updateVendor(tenantId, id, userId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'master',
    entity: 'masterVendor',
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
  const userId = req.context?.userId ?? ''
  const before = await repo.getVendor(tenantId, id)
  const record = await repo.softDeleteVendor(tenantId, id, userId)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'master',
    entity: 'masterVendor',
    entityId: id,
    action: 'DELETE',
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
  const record = await repo.setVendorStatus(tenantId, id, userId, 'ACTIVE')
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'master',
    entity: 'masterVendor',
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
  const record = await repo.setVendorStatus(tenantId, id, userId, 'INACTIVE')
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'master',
    entity: 'masterVendor',
    entityId: id,
    action: 'DEACTIVATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function listLookups(_req: Request, tenantId: string, query: VendorLookupQuery) {
  return repo.listVendorLookups(tenantId, query)
}
