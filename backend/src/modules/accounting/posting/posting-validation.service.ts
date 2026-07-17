import type { DraftVoucherLineInput } from '../ledger/ledger.types.js'
import {
  computeLineTotals,
  validateBalancedVoucher,
  validateBranchOwnership,
  validateCostCentrePostingEligibility,
  validateVoucherLinesStructure,
} from '../ledger/ledger.validators.js'
import { resolvePostingLines } from './posting-account-resolution.service.js'
import {
  assertFinanceActivated,
  assertNonZeroTotals,
  normalizePostingCurrency,
} from './posting-currency.service.js'
import { resolvePostingPeriod } from './posting-period.service.js'
import type { PostingRequest, ValidatedPostingData } from './posting.types.js'
import { PostingError } from './posting.errors.js'

function toDraftLines(lines: Awaited<ReturnType<typeof resolvePostingLines>>): DraftVoucherLineInput[] {
  return lines.map((line) => ({
    lineNumber: line.lineNumber,
    accountId: line.accountId,
    partyType: line.partyType ?? undefined,
    partyId: line.partyId ?? undefined,
    partyNameSnapshot: line.partyNameSnapshot ?? undefined,
    debitAmount: line.debitAmount,
    creditAmount: line.creditAmount,
    baseDebitAmount: line.baseDebitAmount,
    baseCreditAmount: line.baseCreditAmount,
    currencyCode: line.currencyCode,
    exchangeRate: line.exchangeRate,
    costCentreId: line.costCentreId ?? undefined,
    projectReference: line.projectReference ?? undefined,
    departmentReference: line.departmentReference ?? undefined,
    referenceDocumentType: line.referenceDocumentType ?? undefined,
    referenceDocumentId: line.referenceDocumentId ?? undefined,
    referenceDocumentLineId: line.referenceDocumentLineId ?? undefined,
    dueDate: line.dueDate ?? undefined,
    lineNarration: line.lineNarration ?? undefined,
  }))
}

export async function validatePostingRequest(
  tenantId: string,
  request: PostingRequest,
): Promise<ValidatedPostingData> {
  if (!request.lines || request.lines.length < 2) {
    throw new PostingError('INSUFFICIENT_LINES', 'At least two posting lines are required')
  }

  const settings = await assertFinanceActivated(tenantId, request.legalEntityId)

  const branchCheck = await validateBranchOwnership(tenantId, request.legalEntityId, request.branchId)
  if (!branchCheck.valid) {
    throw new PostingError('VALIDATION_FAILED', branchCheck.errors[0]?.message ?? 'Invalid branch', mapErrors(branchCheck.errors))
  }

  const { financialYear, period } = await resolvePostingPeriod(tenantId, request.legalEntityId, request.postingDate)

  const resolvedLines = await resolvePostingLines(
    tenantId,
    request.legalEntityId,
    request.lines,
    request.postingPurpose,
    settings.allowManualControlAccountPosting,
  )

  const currencyNormalized = await normalizePostingCurrency(
    tenantId,
    request.legalEntityId,
    request,
    settings,
    resolvedLines,
  )

  const draftLines = toDraftLines(currencyNormalized.lines)
  const structure = validateVoucherLinesStructure(draftLines)
  if (!structure.valid) {
    throw new PostingError('VALIDATION_FAILED', structure.errors[0]?.message ?? 'Invalid line structure', mapErrors(structure.errors))
  }

  assertNonZeroTotals(draftLines)

  const balanced = validateBalancedVoucher(draftLines)
  if (!balanced.valid) {
    const code = balanced.errors[0]?.code === 'UNBALANCED_BASE' ? 'UNBALANCED_BASE' : 'UNBALANCED'
    throw new PostingError(code, balanced.errors[0]?.message ?? 'Voucher is not balanced', mapErrors(balanced.errors))
  }

  for (const line of draftLines) {
    const ccCheck = await validateCostCentrePostingEligibility(tenantId, request.legalEntityId, line.costCentreId)
    if (!ccCheck.valid) {
      throw new PostingError('VALIDATION_FAILED', ccCheck.errors[0]?.message ?? 'Invalid cost centre', mapErrors(ccCheck.errors))
    }
  }

  const totals = computeLineTotals(draftLines)

  return {
    request,
    financialYearId: financialYear.id,
    accountingPeriodId: period.id,
    baseCurrency: settings.baseCurrency ?? 'INR',
    resolvedLines: currencyNormalized.lines,
    totalDebit: totals.totalDebit.toString(),
    totalCredit: totals.totalCredit.toString(),
    baseTotalDebit: totals.baseTotalDebit.toString(),
    baseTotalCredit: totals.baseTotalCredit.toString(),
    voucherCurrency: currencyNormalized.voucherCurrency,
    voucherExchangeRate: currencyNormalized.voucherExchangeRate,
  }
}

function mapErrors(errors: Array<{ field?: string; message: string }>): Array<{ field: string; message: string }> {
  return errors.map((e) => ({ field: e.field ?? 'posting', message: e.message }))
}
