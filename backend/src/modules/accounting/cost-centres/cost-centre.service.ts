import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { getRouteParam } from '../../../types/request-context.js'
import type { CostCentreTreeQuery, CreateCostCentreInput, ListCostCentresQuery, UpdateCostCentreInput } from './cost-centre.validation.js'
import * as repo from './cost-centre.repository.js'

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

export async function listRecords(_req: Request, tenantId: string, query: ListCostCentresQuery) {
  return repo.listCostCentres(tenantId, query)
}

export async function getTree(_req: Request, tenantId: string, query: CostCentreTreeQuery) {
  return repo.getCostCentreTree(tenantId, query)
}

export async function createRecord(req: Request, tenantId: string, input: CreateCostCentreInput) {
  const audit = auditMeta(req)
  const record = await repo.createCostCentre(tenantId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'cost_centre',
    entityId: record.id,
    action: 'CREATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function updateRecord(req: Request, tenantId: string, id: string, input: UpdateCostCentreInput) {
  const audit = auditMeta(req)
  const record = await repo.updateCostCentre(tenantId, id, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'cost_centre',
    entityId: id,
    action: 'UPDATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function activateRecord(req: Request, tenantId: string, id: string) {
  const audit = auditMeta(req)
  const record = await repo.activateCostCentre(tenantId, id)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'cost_centre',
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
  const record = await repo.deactivateCostCentre(tenantId, id)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'cost_centre',
    entityId: getRouteParam(req, 'id'),
    action: 'DEACTIVATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}
