import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { NotFoundError } from '../../../utils/errors.js'
import type { ListNumberSeriesQuery, UpsertNumberSeriesInput } from './finance-number-series.validation.js'
import * as repo from './finance-number-series.repository.js'

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

export async function listRecords(_req: Request, tenantId: string, query: ListNumberSeriesQuery) {
  return repo.listNumberSeries(tenantId, query)
}

export async function upsertRecords(req: Request, tenantId: string, input: UpsertNumberSeriesInput) {
  const audit = auditMeta(req)
  const records = await repo.upsertNumberSeries(tenantId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'finance_number_series',
    entityId: input.legalEntityId,
    action: 'UPDATE',
    newValues: { count: records.length },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return records
}

export async function previewNext(_req: Request, tenantId: string, legalEntityId: string | undefined, documentType: string | undefined) {
  if (!legalEntityId || !documentType) throw new NotFoundError('legalEntityId and documentType are required')
  return repo.previewNextNumber(tenantId, legalEntityId, documentType)
}
