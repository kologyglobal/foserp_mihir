import type { AccountingPeriod, FinanceSettings } from '@prisma/client'
import { assertFinanceActivated } from '../posting/posting-currency.service.js'
import { enforcePeriodOpenForPosting, resolvePeriodByDate } from '../posting/posting-period.service.js'
import { parseDateOnly } from '../shared/finance.helpers.js'
import {
  validateBalancedVoucher,
  validateBranchOwnership,
  validateVoucherLinesStructure,
  validateVoucherLinesWithMasters,
  computeLineTotals,
} from '../ledger/ledger.validators.js'
import type { DraftVoucherLineInput, LedgerValidationError } from '../ledger/ledger.types.js'
import { resolveJournalApproval } from './journal-approval.service.js'
import type { JournalLineInput, JournalValidationReport, JournalWithLines } from './journal.types.js'

function err(code: string, message: string, field?: string): LedgerValidationError {
  return { code, message, ...(field ? { field } : {}) }
}

function normalizeLines(lines: JournalLineInput[]): DraftVoucherLineInput[] {
  return lines.map((line, index) => ({
    ...line,
    lineNumber: line.lineNumber ?? index + 1,
    debitAmount: line.debitAmount ?? '0',
    creditAmount: line.creditAmount ?? '0',
  }))
}

function checkPeriodForSubmit(
  period: AccountingPeriod,
  postingDate: Date,
  settings: FinanceSettings | null,
  errors: LedgerValidationError[],
): void {
  if (period.status === 'CLOSED') {
    errors.push(err('ACCOUNTING_PERIOD_CLOSED', 'Accounting period is closed — submission is not allowed', 'postingDate'))
    return
  }
  if (period.status === 'UNDER_REVIEW') {
    errors.push(err('ACCOUNTING_PERIOD_UNDER_REVIEW', 'Accounting period is under review — submission is not allowed', 'postingDate'))
    return
  }
  if (period.status !== 'OPEN' && period.status !== 'REOPENED') {
    errors.push(err('ACCOUNTING_PERIOD_CLOSED', `Accounting period status ${period.status} does not allow submission`, 'postingDate'))
    return
  }

  try {
    enforcePeriodOpenForPosting(period, postingDate, settings)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Posting period validation failed'
    errors.push(err('BACKDATED_POSTING_NOT_ALLOWED', message, 'postingDate'))
  }
}

function checkPeriodForDraft(
  period: AccountingPeriod,
  warnings: LedgerValidationError[],
): void {
  if (period.status === 'CLOSED') {
    warnings.push(err('ACCOUNTING_PERIOD_CLOSED', 'Accounting period is closed — you can save the draft but cannot submit until the period is reopened', 'postingDate'))
  } else if (period.status === 'UNDER_REVIEW') {
    warnings.push(err('ACCOUNTING_PERIOD_UNDER_REVIEW', 'Accounting period is under review — submission will be blocked until review completes', 'postingDate'))
  } else if (period.status !== 'OPEN' && period.status !== 'REOPENED') {
    warnings.push(err('ACCOUNTING_PERIOD_CLOSED', `Accounting period status ${period.status} will block submission`, 'postingDate'))
  }
}

export async function validateJournal(
  tenantId: string,
  journal: JournalWithLines,
  mode: 'draft' | 'submit' = 'draft',
): Promise<JournalValidationReport> {
  const errors: LedgerValidationError[] = []
  const warnings: LedgerValidationError[] = []

  try {
    await assertFinanceActivated(tenantId, journal.legalEntityId)
  } catch (e) {
    errors.push(err('FINANCE_NOT_ACTIVATED', e instanceof Error ? e.message : 'Finance not activated'))
  }

  const draftLines = normalizeLines(
    journal.lines.map((line) => ({
      lineNumber: line.lineNumber,
      accountId: line.accountId,
      partyType: line.partyType as DraftVoucherLineInput['partyType'],
      partyId: line.partyId,
      partyNameSnapshot: line.partyNameSnapshot,
      debitAmount: line.debitAmount.toString(),
      creditAmount: line.creditAmount.toString(),
      baseDebitAmount: line.baseDebitAmount.toString(),
      baseCreditAmount: line.baseCreditAmount.toString(),
      currencyCode: line.currencyCode,
      exchangeRate: line.exchangeRate.toString(),
      costCentreId: line.costCentreId,
      projectReference: line.projectReference,
      departmentReference: line.departmentReference,
      referenceDocumentType: line.referenceDocumentType,
      referenceDocumentId: line.referenceDocumentId,
      referenceDocumentLineId: line.referenceDocumentLineId,
      dueDate: line.dueDate ? line.dueDate.toISOString().slice(0, 10) : null,
      lineNarration: line.lineNarration,
    })),
  )

  if (draftLines.length < 2) {
    errors.push(err('INSUFFICIENT_LINES', 'At least two journal lines are required', 'lines'))
  }

  const branchCheck = await validateBranchOwnership(tenantId, journal.legalEntityId, journal.branchId)
  if (!branchCheck.valid) errors.push(...branchCheck.errors)

  const structure = validateVoucherLinesStructure(draftLines)
  if (!structure.valid) errors.push(...structure.errors)

  const masters = await validateVoucherLinesWithMasters(tenantId, journal.legalEntityId, draftLines)
  if (!masters.valid) errors.push(...masters.errors)

  const balance = validateBalancedVoucher(draftLines)
  if (!balance.valid) errors.push(...balance.errors)

  let periodContext: Awaited<ReturnType<typeof resolvePeriodByDate>> | null = null
  try {
    periodContext = await resolvePeriodByDate(tenantId, journal.legalEntityId, journal.postingDate.toISOString().slice(0, 10))
    if (periodContext.financialYear.status !== 'ACTIVE') {
      errors.push(err('FINANCIAL_YEAR_INACTIVE', 'Financial year is not active', 'postingDate'))
    }
    if (periodContext.financialYear.id !== journal.financialYearId || periodContext.period.id !== journal.accountingPeriodId) {
      warnings.push(err('PERIOD_MISMATCH', 'Posting date resolves to a different financial year or period than stored on the voucher', 'postingDate'))
    }
    if (mode === 'submit') {
      checkPeriodForSubmit(periodContext.period, parseDateOnly(journal.postingDate.toISOString().slice(0, 10)), periodContext.settings, errors)
    } else {
      checkPeriodForDraft(periodContext.period, warnings)
    }
  } catch (e) {
    errors.push(err('ACCOUNTING_PERIOD_NOT_FOUND', e instanceof Error ? e.message : 'Could not resolve posting period', 'postingDate'))
  }

  const totals = computeLineTotals(draftLines)
  const approval = await resolveJournalApproval(tenantId, journal.legalEntityId, totals.totalDebit.toString(), totals.totalCredit.toString())

  if (mode === 'submit' && approval.required && !approval.canSubmit && approval.blockReason) {
    errors.push(err('JOURNAL_APPROVAL_BLOCKED', approval.blockReason))
  }

  return {
    valid: errors.length === 0,
    summary: {
      totalDebit: totals.totalDebit.toFixed(4),
      totalCredit: totals.totalCredit.toFixed(4),
      baseTotalDebit: totals.baseTotalDebit.toFixed(4),
      baseTotalCredit: totals.baseTotalCredit.toFixed(4),
      lineCount: draftLines.length,
    },
    errors,
    warnings,
    approval,
  }
}

export async function validateJournalInput(
  tenantId: string,
  legalEntityId: string,
  postingDate: string,
  lines: JournalLineInput[],
  branchId?: string | null,
  mode: 'draft' | 'submit' = 'draft',
): Promise<JournalValidationReport> {
  const draftLines = normalizeLines(lines)
  const errors: LedgerValidationError[] = []
  const warnings: LedgerValidationError[] = []

  try {
    await assertFinanceActivated(tenantId, legalEntityId)
  } catch (e) {
    errors.push(err('FINANCE_NOT_ACTIVATED', e instanceof Error ? e.message : 'Finance not activated'))
  }

  if (draftLines.length < 2) {
    errors.push(err('INSUFFICIENT_LINES', 'At least two journal lines are required', 'lines'))
  }

  const branchCheck = await validateBranchOwnership(tenantId, legalEntityId, branchId)
  if (!branchCheck.valid) errors.push(...branchCheck.errors)

  const structure = validateVoucherLinesStructure(draftLines)
  if (!structure.valid) errors.push(...structure.errors)

  const masters = await validateVoucherLinesWithMasters(tenantId, legalEntityId, draftLines)
  if (!masters.valid) errors.push(...masters.errors)

  const balance = validateBalancedVoucher(draftLines)
  if (!balance.valid) errors.push(...balance.errors)

  try {
    const periodContext = await resolvePeriodByDate(tenantId, legalEntityId, postingDate)
    if (periodContext.financialYear.status !== 'ACTIVE') {
      errors.push(err('FINANCIAL_YEAR_INACTIVE', 'Financial year is not active', 'postingDate'))
    }
    if (mode === 'submit') {
      checkPeriodForSubmit(periodContext.period, parseDateOnly(postingDate), periodContext.settings, errors)
    } else {
      checkPeriodForDraft(periodContext.period, warnings)
    }
  } catch (e) {
    errors.push(err('ACCOUNTING_PERIOD_NOT_FOUND', e instanceof Error ? e.message : 'Could not resolve posting period', 'postingDate'))
  }

  const totals = computeLineTotals(draftLines)
  const approval = await resolveJournalApproval(tenantId, legalEntityId, totals.totalDebit.toString(), totals.totalCredit.toString())

  if (mode === 'submit' && approval.required && !approval.canSubmit && approval.blockReason) {
    errors.push(err('JOURNAL_APPROVAL_BLOCKED', approval.blockReason))
  }

  return {
    valid: errors.length === 0,
    summary: {
      totalDebit: totals.totalDebit.toFixed(4),
      totalCredit: totals.totalCredit.toFixed(4),
      baseTotalDebit: totals.baseTotalDebit.toFixed(4),
      baseTotalCredit: totals.baseTotalCredit.toFixed(4),
      lineCount: draftLines.length,
    },
    errors,
    warnings,
    approval,
  }
}

export { normalizeLines }
