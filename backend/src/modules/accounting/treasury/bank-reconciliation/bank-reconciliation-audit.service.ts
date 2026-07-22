import { createAuditLog } from '../../../../services/audit.service.js'
import type { ReconciliationContext } from './bank-reconciliation.types.js'

export async function auditBankReconciliation(
  context: ReconciliationContext,
  entity: string,
  entityId: string,
  action: string,
  newValues?: unknown,
  oldValues?: unknown,
): Promise<void> {
  await createAuditLog({
    tenantId: context.tenantId,
    userId: context.userId,
    module: 'finance',
    entity,
    entityId,
    action,
    oldValues,
    newValues,
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent ?? null,
  })
}
