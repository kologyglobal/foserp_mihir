import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../services/audit.service.js'
import type { MasterResourceConfig } from './master.registry.js'
import type { ListMastersQuery } from './master.validation.js'
import * as repo from './master.repository.js'

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

export async function listRecords(
  _req: Request,
  tenantId: string,
  config: MasterResourceConfig,
  query: ListMastersQuery,
) {
  return repo.listMasterRecords(tenantId, config, query)
}

export async function getRecord(tenantId: string, config: MasterResourceConfig, id: string) {
  return repo.getMasterRecord(tenantId, config, id)
}

export async function createRecord(
  req: Request,
  tenantId: string,
  config: MasterResourceConfig,
  input: Record<string, unknown>,
) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.createMasterRecord(tenantId, userId, config, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'master',
    entity: config.prismaModel,
    entityId: (record as { id: string }).id,
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
  config: MasterResourceConfig,
  id: string,
  input: Record<string, unknown>,
) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const before = await repo.getMasterRecord(tenantId, config, id)
  const record = await repo.updateMasterRecord(tenantId, id, userId, config, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'master',
    entity: config.prismaModel,
    entityId: id,
    action: 'UPDATE',
    oldValues: before,
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function deleteRecord(
  req: Request,
  tenantId: string,
  config: MasterResourceConfig,
  id: string,
) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const before = await repo.getMasterRecord(tenantId, config, id)
  const record = await repo.softDeleteMasterRecord(tenantId, id, userId, config)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'master',
    entity: config.prismaModel,
    entityId: id,
    action: 'DELETE',
    oldValues: before,
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function activateRecord(
  req: Request,
  tenantId: string,
  config: MasterResourceConfig,
  id: string,
) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.setMasterStatus(tenantId, id, userId, config, 'ACTIVE')
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'master',
    entity: config.prismaModel,
    entityId: id,
    action: 'ACTIVATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function deactivateRecord(
  req: Request,
  tenantId: string,
  config: MasterResourceConfig,
  id: string,
) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.setMasterStatus(tenantId, id, userId, config, 'INACTIVE')
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'master',
    entity: config.prismaModel,
    entityId: id,
    action: 'DEACTIVATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function listLookups(
  tenantId: string,
  config: MasterResourceConfig,
  extraFilter?: Record<string, unknown>,
) {
  return repo.listMasterLookups(tenantId, config, extraFilter)
}
