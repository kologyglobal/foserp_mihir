import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { NotFoundError } from '../../../utils/errors.js'
import type { DefaultMappingsQuery, UpsertDefaultMappingsInput } from './default-mapping.validation.js'
import * as repo from './default-mapping.repository.js'

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

export async function listRecords(_req: Request, tenantId: string, query: DefaultMappingsQuery) {
  return repo.listMappings(tenantId, query)
}

export async function upsertRecords(req: Request, tenantId: string, input: UpsertDefaultMappingsInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const records = await repo.upsertMappings(tenantId, userId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'default_account_mapping',
    entityId: input.legalEntityId,
    action: 'MAP_ACCOUNT',
    newValues: { count: records.length },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return records
}

export async function validateRecords(_req: Request, tenantId: string, legalEntityId: string | undefined) {
  if (!legalEntityId) throw new NotFoundError('legalEntityId query parameter is required')
  return repo.validateMappings(tenantId, legalEntityId)
}
