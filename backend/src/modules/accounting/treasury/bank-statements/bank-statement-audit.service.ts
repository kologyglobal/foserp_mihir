import type { Request } from 'express'
import { createAuditLog, auditFromRequest } from '../../../../services/audit.service.js'

function meta(req: Request) {
  return auditFromRequest(req)
}

export async function auditStatementAction(
  req: Request,
  action: string,
  entityId: string,
  oldValues?: unknown,
  newValues?: unknown,
): Promise<void> {
  const audit = meta(req)
  await createAuditLog({
    tenantId: audit.tenantId,
    userId: audit.userId,
    module: 'finance.treasury',
    entity: 'BankStatement',
    entityId,
    action,
    oldValues,
    newValues,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
}

export async function auditImportBatchAction(
  req: Request,
  action: string,
  entityId: string,
  oldValues?: unknown,
  newValues?: unknown,
): Promise<void> {
  const audit = meta(req)
  await createAuditLog({
    tenantId: audit.tenantId,
    userId: audit.userId,
    module: 'finance.treasury',
    entity: 'BankStatementImportBatch',
    entityId,
    action,
    oldValues,
    newValues,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
}

export async function auditMappingTemplateAction(
  req: Request,
  action: string,
  entityId: string,
  oldValues?: unknown,
  newValues?: unknown,
): Promise<void> {
  const audit = meta(req)
  await createAuditLog({
    tenantId: audit.tenantId,
    userId: audit.userId,
    module: 'finance.treasury',
    entity: 'BankStatementColumnMappingTemplate',
    entityId,
    action,
    oldValues,
    newValues,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
}
