import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import * as readRepo from '../bank-reconciliation/bank-reconciliation-read.repository.js'
import { createTreasuryAdjustmentDraftFromStatementLine } from './treasury-adjustment-draft.service.js'
import { serializeTreasuryAdjustment } from './treasury-adjustment-read.service.js'
import { TreasuryAdjustmentStatementPathDisabledError } from './treasury-adjustment.errors.js'
import type { CreateTreasuryAdjustmentFromStatementLineInput } from './treasury-adjustment.schemas.js'

/**
 * Statement-led draft creation for the "Create Bank Transaction" UI path.
 * Gated by FinanceSettings.useTreasuryAdjustmentsForStatementItems (default true).
 * When false, clients should use the legacy create-journal-draft path instead.
 */
export async function createTreasuryAdjustmentFromStatementLine(
  req: Request,
  tenantId: string,
  statementId: string,
  lineId: string,
  input: CreateTreasuryAdjustmentFromStatementLineInput,
) {
  const statement = await readRepo.getStatementOrThrow(tenantId, statementId)
  await readRepo.getStatementLineOrThrow(tenantId, statementId, lineId)

  const settings = await prisma.financeSettings.findFirst({
    where: { tenantId, legalEntityId: input.legalEntityId },
    select: { useTreasuryAdjustmentsForStatementItems: true },
  })
  // Default true when settings row missing (new tenants / pre-migration); explicit false blocks.
  if (settings?.useTreasuryAdjustmentsForStatementItems === false) {
    throw new TreasuryAdjustmentStatementPathDisabledError()
  }

  const { adjustment, calc } = await createTreasuryAdjustmentDraftFromStatementLine(req, tenantId, lineId, statement.treasuryAccountId, {
    legalEntityId: input.legalEntityId,
    branchId: input.branchId,
    adjustmentType: input.adjustmentType,
    direction: input.direction,
    adjustmentDate: input.adjustmentDate,
    currencyCode: input.currencyCode,
    exchangeRate: input.exchangeRate,
    narration: input.narration,
    internalNote: input.internalNote,
    approvalRequiredOverride: input.approvalRequiredOverride,
    lines: input.lines,
  })

  return serializeTreasuryAdjustment(req, adjustment, calc)
}
