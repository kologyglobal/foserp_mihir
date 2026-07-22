import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import * as repo from './machine.repository.js'
import type { CreateMachineInput, ListMachinesQuery, SetMachineStatusInput, UpdateMachineInput } from './machine.schemas.js'

async function audit(req: Request, tenantId: string, entityId: string, action: string, oldValues: unknown, newValues: unknown) {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'manufacturing',
    entity: 'manufacturingMachine',
    entityId,
    action,
    oldValues,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

export async function listRecords(tenantId: string, query: ListMachinesQuery) {
  return repo.listMachines(tenantId, query)
}

export async function getRecord(tenantId: string, id: string) {
  return repo.getMachine(tenantId, id)
}

export async function createRecord(req: Request, tenantId: string, input: CreateMachineInput) {
  const userId = req.context?.userId ?? ''
  const record = await repo.createMachine(tenantId, userId, input)
  await audit(req, tenantId, record.id, 'CREATE', undefined, record)
  return record
}

export async function updateRecord(req: Request, tenantId: string, id: string, input: UpdateMachineInput) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getMachine(tenantId, id)
  const record = await repo.updateMachine(tenantId, id, userId, input)
  await audit(req, tenantId, id, 'UPDATE', before, record)
  return record
}

export async function deleteRecord(req: Request, tenantId: string, id: string) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getMachine(tenantId, id)
  const record = await repo.softDeleteMachine(tenantId, id, userId)
  await audit(req, tenantId, id, 'DELETE', before, record)
  return record
}

export async function activateRecord(req: Request, tenantId: string, id: string) {
  const userId = req.context?.userId ?? ''
  const record = await repo.setMachineActive(tenantId, id, userId, true)
  await audit(req, tenantId, id, 'ACTIVATE', undefined, record)
  return record
}

export async function deactivateRecord(req: Request, tenantId: string, id: string) {
  const userId = req.context?.userId ?? ''
  const record = await repo.setMachineActive(tenantId, id, userId, false)
  await audit(req, tenantId, id, 'DEACTIVATE', undefined, record)
  return record
}

export async function setStatus(req: Request, tenantId: string, id: string, input: SetMachineStatusInput) {
  const userId = req.context?.userId ?? ''
  const record = await repo.setMachineStatus(tenantId, id, userId, input.status)
  await audit(req, tenantId, id, 'STATUS_CHANGE', undefined, record)
  return record
}
