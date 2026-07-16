import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { resolveUserNames } from '../../../shared/index.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import * as repo from './crm-master.repository.js'
import type { CrmMasterKind } from './crm-master.constants.js'
import type { CreateCrmMasterInput, ListCrmMastersQuery, UpdateCrmMasterInput } from './crm-master.validation.js'

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

async function withUserNames<T extends { createdBy?: string; modifiedBy?: string }>(
  tenantId: string,
  rows: T[],
): Promise<Array<T & { createdByName?: string; modifiedByName?: string }>> {
  const nameMap = await resolveUserNames(
    rows.flatMap((r) => [r.createdBy, r.modifiedBy]),
    tenantId,
    prisma,
  )
  return rows.map((row) => ({
    ...row,
    createdByName: row.createdBy ? nameMap.get(row.createdBy) : undefined,
    modifiedByName: row.modifiedBy ? nameMap.get(row.modifiedBy) : undefined,
  }))
}

async function withUserName<T extends { createdBy?: string; modifiedBy?: string }>(
  tenantId: string,
  row: T,
): Promise<T & { createdByName?: string; modifiedByName?: string }> {
  const [enriched] = await withUserNames(tenantId, [row])
  return enriched
}

export async function listMasters(tenantId: string, kind: CrmMasterKind, query: ListCrmMastersQuery) {
  const result = await repo.listMasters(tenantId, kind, query)
  return {
    ...result,
    items: await withUserNames(tenantId, result.items),
  }
}

export async function lookupMasters(tenantId: string, kind: CrmMasterKind) {
  const rows = await repo.lookupMasters(tenantId, kind)
  return withUserNames(tenantId, rows)
}

export async function getMaster(tenantId: string, kind: CrmMasterKind, id: string) {
  const row = await repo.findMasterById(tenantId, kind, id)
  if (!row) throw new NotFoundError('CRM master record not found')
  return withUserName(tenantId, row)
}

export async function createMaster(req: Request, tenantId: string, kind: CrmMasterKind, input: CreateCrmMasterInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  try {
    const record = await repo.createMaster(tenantId, kind, userId, input)
    const enriched = await withUserName(tenantId, record)
    await createAuditLog({
      tenantId,
      userId: audit.userId,
      module: 'crm',
      entity: 'crmMaster',
      entityId: record.id,
      action: 'CREATE',
      newValues: enriched,
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    })
    return enriched
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      throw new ValidationError('Duplicate code for this master kind', [{ field: 'code', message: 'Already exists' }])
    }
    throw err
  }
}

export async function updateMaster(
  req: Request,
  tenantId: string,
  kind: CrmMasterKind,
  id: string,
  input: UpdateCrmMasterInput,
) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const before = await getMaster(tenantId, kind, id)
  if (before.systemControlled && input.code) {
    throw new ValidationError('System-controlled master cannot change code')
  }
  const record = await repo.updateMaster(tenantId, kind, id, userId, input)
  const enriched = await withUserName(tenantId, record)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'crm',
    entity: 'crmMaster',
    entityId: id,
    action: 'UPDATE',
    oldValues: before,
    newValues: enriched,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return enriched
}

export async function deleteMaster(req: Request, tenantId: string, kind: CrmMasterKind, id: string) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const before = await getMaster(tenantId, kind, id)
  if (before.systemControlled) {
    throw new ValidationError('System-controlled master cannot be deleted')
  }
  const record = await repo.softDeleteMaster(tenantId, kind, id, userId)
  const enriched = await withUserName(tenantId, record)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'crm',
    entity: 'crmMaster',
    entityId: id,
    action: 'DELETE',
    oldValues: before,
    newValues: enriched,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return enriched
}

export async function activateMaster(req: Request, tenantId: string, kind: CrmMasterKind, id: string) {
  const userId = req.context?.userId ?? ''
  const record = await repo.setMasterStatus(tenantId, kind, id, userId, 'active')
  return withUserName(tenantId, record)
}

export async function deactivateMaster(req: Request, tenantId: string, kind: CrmMasterKind, id: string) {
  const userId = req.context?.userId ?? ''
  const record = await repo.setMasterStatus(tenantId, kind, id, userId, 'inactive')
  return withUserName(tenantId, record)
}

export async function listAllMastersForSync(tenantId: string) {
  // Keep critical lead-source codes present for older tenants (e.g. existing_customer)
  await repo.ensureSeedRows(tenantId, null, [
    { kind: 'lead-sources', code: 'website', name: 'Website', sortOrder: 1, attributes: { sourceType: 'Digital' } },
    { kind: 'lead-sources', code: 'referral', name: 'Referral', sortOrder: 2, attributes: { sourceType: 'Relationship' } },
    { kind: 'lead-sources', code: 'cold_call', name: 'Cold Calling', sortOrder: 3, attributes: { sourceType: 'Outbound' } },
    { kind: 'lead-sources', code: 'trade_show', name: 'Trade Show', sortOrder: 4, attributes: { sourceType: 'Event' } },
    { kind: 'lead-sources', code: 'existing_customer', name: 'Existing Customer', sortOrder: 5, attributes: { sourceType: 'Account' } },
    { kind: 'lead-sources', code: 'indiamart', name: 'IndiaMART', sortOrder: 6, attributes: { sourceType: 'Digital' } },
    { kind: 'lead-sources', code: 'other', name: 'Other', sortOrder: 99, attributes: { sourceType: 'Other' } },
  ])
  const { CRM_MASTER_SEED_ROWS } = await import('./crm-master.seed-data.js')
  // Keep sync-ensure in lockstep with seed + UI masters (incl. opportunity pipeline stages + attachment types)
  const ensureKinds = [
    'payment-terms',
    'industries',
    'opportunity-stages',
    'opportunity-priorities',
    'lost-reasons',
    'commercial-terms',
    'document-types',
  ] as const
  for (const kind of ensureKinds) {
    const rows = CRM_MASTER_SEED_ROWS.filter((r) => r.kind === kind)
    if (rows.length > 0) await repo.ensureSeedRows(tenantId, null, rows)
  }
  const rows = await repo.listAllMastersByTenant(tenantId)
  return withUserNames(tenantId, rows)
}
