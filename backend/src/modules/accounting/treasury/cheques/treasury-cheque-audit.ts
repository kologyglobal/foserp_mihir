import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'

export async function auditTreasuryCheque(
  req: Request,
  tenantId: string,
  chequeId: string,
  action: string,
  newValues?: unknown,
): Promise<void> {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'finance',
    entity: 'treasury_cheque',
    entityId: chequeId,
    action,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}
