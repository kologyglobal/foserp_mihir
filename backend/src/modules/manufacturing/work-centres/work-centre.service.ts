import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import * as repo from './work-centre.repository.js'
import type { CreateWorkCentreInput, ListWorkCentresQuery, UpdateWorkCentreInput } from './work-centre.schemas.js'

export async function listRecords(tenantId: string, query: ListWorkCentresQuery) {
  return repo.listWorkCentres(tenantId, query)
}

export async function getRecord(tenantId: string, id: string) {
  return repo.getWorkCentre(tenantId, id)
}

export async function createRecord(req: Request, tenantId: string, input: CreateWorkCentreInput) {
  const audit = auditFromRequest(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.createWorkCentre(tenantId, userId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'manufacturing',
    entity: 'manufacturingWorkCentre',
    entityId: record.id,
    action: 'CREATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function updateRecord(req: Request, tenantId: string, id: string, input: UpdateWorkCentreInput) {
  const audit = auditFromRequest(req)
  const userId = req.context?.userId ?? ''
  const before = await repo.getWorkCentre(tenantId, id)
  const record = await repo.updateWorkCentre(tenantId, id, userId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'manufacturing',
    entity: 'manufacturingWorkCentre',
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
  const audit = auditFromRequest(req)
  const userId = req.context?.userId ?? ''
  const before = await repo.getWorkCentre(tenantId, id)
  const record = await repo.softDeleteWorkCentre(tenantId, id, userId)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'manufacturing',
    entity: 'manufacturingWorkCentre',
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
  const audit = auditFromRequest(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.setWorkCentreActive(tenantId, id, userId, true)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'manufacturing',
    entity: 'manufacturingWorkCentre',
    entityId: id,
    action: 'ACTIVATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function deactivateRecord(req: Request, tenantId: string, id: string) {
  const audit = auditFromRequest(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.setWorkCentreActive(tenantId, id, userId, false)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'manufacturing',
    entity: 'manufacturingWorkCentre',
    entityId: id,
    action: 'DEACTIVATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}
