import type { ManufacturingRuntimeChangeRule, ProductionRuntimeChangeType, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'

/** One active default rule per changeType (risk service uses first active match). */
const DEFAULT_RULES: Array<{
  changeType: ProductionRuntimeChangeType
  name: string
  approvalRequired: boolean
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  configJson?: Prisma.InputJsonValue
}> = [
  { changeType: 'QUANTITY_CHANGE', name: 'Default quantity rule', approvalRequired: false, riskLevel: 'LOW', configJson: { qtyTolerancePct: 10 } },
  { changeType: 'DUE_DATE_CHANGE', name: 'Default due-date rule', approvalRequired: false, riskLevel: 'LOW', configJson: { dueDateDelayDays: 7 } },
  { changeType: 'PRIORITY_CHANGE', name: 'Default priority rule', approvalRequired: false, riskLevel: 'LOW' },
  { changeType: 'SUPERVISOR_CHANGE', name: 'Default supervisor rule', approvalRequired: false, riskLevel: 'LOW' },
  { changeType: 'OPERATOR_CHANGE', name: 'Default operator rule', approvalRequired: false, riskLevel: 'LOW' },
  { changeType: 'MACHINE_CHANGE', name: 'Default machine rule', approvalRequired: false, riskLevel: 'MEDIUM' },
  { changeType: 'WORK_CENTRE_CHANGE', name: 'Default work centre rule', approvalRequired: false, riskLevel: 'MEDIUM' },
  { changeType: 'ADD_OPERATION', name: 'Default add-operation rule', approvalRequired: false, riskLevel: 'MEDIUM' },
  { changeType: 'REPEAT_OPERATION', name: 'Default repeat-operation rule', approvalRequired: false, riskLevel: 'MEDIUM' },
  { changeType: 'SKIP_OPERATION', name: 'Default skip-operation rule', approvalRequired: false, riskLevel: 'LOW' },
  { changeType: 'CONVERT_TO_JOB_WORK', name: 'Default convert-to-job-work rule', approvalRequired: true, riskLevel: 'HIGH' },
  { changeType: 'WORK_ORDER_HOLD', name: 'Default WO hold rule', approvalRequired: false, riskLevel: 'LOW' },
  { changeType: 'WORK_ORDER_RESUME', name: 'Default WO resume rule', approvalRequired: false, riskLevel: 'LOW' },
  { changeType: 'STAGE_HOLD', name: 'Default stage hold rule', approvalRequired: false, riskLevel: 'LOW' },
  { changeType: 'STAGE_RESUME', name: 'Default stage resume rule', approvalRequired: false, riskLevel: 'LOW' },
]

/** Idempotent seed of default ManufacturingRuntimeChangeRule rows for a tenant. */
export async function ensureDefaultRuntimeChangeRules(
  tenantId: string,
  userId?: string,
): Promise<ManufacturingRuntimeChangeRule[]> {
  const existing = await prisma.manufacturingRuntimeChangeRule.findMany({ where: { tenantId } })
  if (existing.length > 0) return existing

  await prisma.manufacturingRuntimeChangeRule.createMany({
    data: DEFAULT_RULES.map((rule) => ({
      tenantId,
      changeType: rule.changeType,
      name: rule.name,
      approvalRequired: rule.approvalRequired,
      riskLevel: rule.riskLevel,
      configJson: rule.configJson ?? undefined,
      isActive: true,
      createdBy: userId ?? null,
      updatedBy: userId ?? null,
    })),
  })
  return prisma.manufacturingRuntimeChangeRule.findMany({ where: { tenantId } })
}
