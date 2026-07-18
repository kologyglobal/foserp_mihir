import { prisma } from '../../../../config/database.js'
import type { CalculationIssue } from '../calculation/sales-invoice-calculation.types.js'
import { calcError, calcWarning } from '../calculation/sales-invoice-calculation.errors.js'

export async function validateLineCostCentres(
  tenantId: string,
  legalEntityId: string,
  costCentreIds: Array<string | null | undefined>,
): Promise<CalculationIssue[]> {
  const issues: CalculationIssue[] = []
  const uniqueIds = [...new Set(costCentreIds.filter((id): id is string => Boolean(id)))]

  for (const costCentreId of uniqueIds) {
    const cc = await prisma.costCentre.findFirst({
      where: { id: costCentreId, tenantId, legalEntityId },
    })
    if (!cc) {
      issues.push(calcError('COST_CENTRE_NOT_FOUND', `Cost centre ${costCentreId} not found`, 'costCentreId'))
      continue
    }
    if (!cc.isActive) {
      issues.push(calcError('COST_CENTRE_INACTIVE', `Cost centre ${cc.code} is inactive`, 'costCentreId'))
    }
    if (cc.isGroup) {
      issues.push(calcError('COST_CENTRE_IS_GROUP', `Cost centre ${cc.code} is a group and cannot be posted`, 'costCentreId'))
    }
  }

  if (uniqueIds.length === 0) {
    issues.push(calcWarning('NO_COST_CENTRE', 'No cost centre assigned on invoice lines'))
  }

  return issues
}
