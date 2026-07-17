import type { Account, AccountingPeriod, AccountingVoucher, FinancialYear } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import { add, compare, convertToBase, isNegative, isPositive, isZero, sumDecimals, toDecimal } from '../shared/finance-decimal.js'
import type {
  DraftVoucherLineInput,
  LedgerValidationError,
  LedgerValidationResult,
  VoucherStatus,
} from './ledger.types.js'
import { EDITABLE_VOUCHER_STATUSES } from './ledger.types.js'

function ok(): LedgerValidationResult {
  return { valid: true, errors: [] }
}

function fail(errors: LedgerValidationError[]): LedgerValidationResult {
  return { valid: false, errors }
}

function err(code: string, message: string, field?: string): LedgerValidationError {
  return { code, message, ...(field ? { field } : {}) }
}

export async function assertTenantLegalEntityOwnership(
  tenantId: string,
  legalEntityId: string,
): Promise<{ valid: boolean; errors: LedgerValidationError[]; entity?: Awaited<ReturnType<typeof getLegalEntityOrThrow>> }> {
  try {
    const entity = await getLegalEntityOrThrow(tenantId, legalEntityId)
    return { valid: true, errors: [], entity }
  } catch {
    return fail([err('LEGAL_ENTITY_NOT_FOUND', 'Legal entity not found or not owned by tenant', 'legalEntityId')])
  }
}

export async function validateBranchOwnership(
  tenantId: string,
  legalEntityId: string,
  branchId: string | null | undefined,
): Promise<LedgerValidationResult> {
  if (!branchId) return ok()
  const branch = await prisma.branch.findFirst({ where: { id: branchId, tenantId, legalEntityId } })
  if (!branch) {
    return fail([err('BRANCH_NOT_FOUND', 'Branch not found in legal entity', 'branchId')])
  }
  if (!branch.isActive) {
    return fail([err('BRANCH_INACTIVE', 'Branch is not active', 'branchId')])
  }
  return ok()
}

export async function validateFinancialYearOwnership(
  tenantId: string,
  legalEntityId: string,
  financialYearId: string,
): Promise<LedgerValidationResult & { financialYear?: FinancialYear }> {
  const fy = await prisma.financialYear.findFirst({
    where: { id: financialYearId, tenantId, legalEntityId },
  })
  if (!fy) {
    return fail([err('FINANCIAL_YEAR_NOT_FOUND', 'Financial year not found in legal entity', 'financialYearId')])
  }
  return { ...ok(), financialYear: fy }
}

export async function validatePeriodOwnership(
  tenantId: string,
  legalEntityId: string,
  financialYearId: string,
  accountingPeriodId: string,
): Promise<LedgerValidationResult & { period?: AccountingPeriod }> {
  const period = await prisma.accountingPeriod.findFirst({
    where: {
      id: accountingPeriodId,
      tenantId,
      legalEntityId,
      financialYearId,
    },
  })
  if (!period) {
    return fail([
      err(
        'PERIOD_NOT_FOUND',
        'Accounting period not found or does not belong to the financial year and legal entity',
        'accountingPeriodId',
      ),
    ])
  }
  return { ...ok(), period }
}

export async function validateAccountPostingEligibility(
  tenantId: string,
  legalEntityId: string,
  accountId: string,
  partyType?: string | null,
  partyId?: string | null,
): Promise<LedgerValidationResult & { account?: Account }> {
  const account = await prisma.account.findFirst({ where: { id: accountId, tenantId, legalEntityId } })
  if (!account) {
    return fail([err('ACCOUNT_NOT_FOUND', 'Account not found in legal entity', 'accountId')])
  }
  if (account.isGroup) {
    return fail([err('ACCOUNT_IS_GROUP', 'Group accounts cannot be used for posting', 'accountId')])
  }
  if (!account.isActive) {
    return fail([err('ACCOUNT_INACTIVE', 'Inactive accounts cannot be used for posting', 'accountId')])
  }
  const requiresParty =
    account.requiresParty ||
    account.accountType === 'CUSTOMER_RECEIVABLE' ||
    account.accountType === 'VENDOR_PAYABLE'
  if (requiresParty && (!partyType || !partyId)) {
    return fail([
      err('PARTY_REQUIRED', 'Party type and party id are required for this account', 'partyId'),
    ])
  }
  return { ...ok(), account }
}

export async function validateCostCentrePostingEligibility(
  tenantId: string,
  legalEntityId: string,
  costCentreId: string | null | undefined,
): Promise<LedgerValidationResult> {
  if (!costCentreId) return ok()
  const cc = await prisma.costCentre.findFirst({ where: { id: costCentreId, tenantId, legalEntityId } })
  if (!cc) {
    return fail([err('COST_CENTRE_NOT_FOUND', 'Cost centre not found in legal entity', 'costCentreId')])
  }
  if (cc.isGroup) {
    return fail([err('COST_CENTRE_IS_GROUP', 'Group cost centres cannot be used for posting', 'costCentreId')])
  }
  if (!cc.isActive) {
    return fail([err('COST_CENTRE_INACTIVE', 'Inactive cost centres cannot be used for posting', 'costCentreId')])
  }
  return ok()
}

export function validateVoucherEditability(
  status: VoucherStatus,
  mode: 'updateDraft' | 'changeStatus' = 'updateDraft',
): LedgerValidationResult {
  if (mode === 'updateDraft') {
    if (!EDITABLE_VOUCHER_STATUSES.includes(status)) {
      return fail([
        err(
          'VOUCHER_NOT_EDITABLE',
          `Voucher in status ${status} cannot be edited; only DRAFT or SENT_BACK are editable`,
          'status',
        ),
      ])
    }
    return ok()
  }
  return ok()
}

export function validateReversalEligibility(
  sourceVoucher: Pick<AccountingVoucher, 'id' | 'tenantId' | 'legalEntityId' | 'status' | 'reversedByVoucherId'>,
  reversalVoucherId: string,
  tenantId: string,
  legalEntityId: string,
): LedgerValidationResult {
  const errors: LedgerValidationError[] = []
  if (sourceVoucher.id === reversalVoucherId) {
    errors.push(err('SELF_REVERSAL', 'A voucher cannot reverse itself', 'reversalOfVoucherId'))
  }
  if (sourceVoucher.tenantId !== tenantId || sourceVoucher.legalEntityId !== legalEntityId) {
    errors.push(err('CROSS_ENTITY_REVERSAL', 'Reversal must be within the same tenant and legal entity', 'legalEntityId'))
  }
  if (sourceVoucher.status !== 'POSTED') {
    errors.push(err('SOURCE_NOT_POSTED', 'Only POSTED vouchers can be reversed', 'status'))
  }
  if (sourceVoucher.reversedByVoucherId) {
    errors.push(err('ALREADY_REVERSED', 'Target voucher has already been reversed', 'reversedByVoucherId'))
  }
  return errors.length ? fail(errors) : ok()
}

export function validateVoucherLinesStructure(lines: DraftVoucherLineInput[]): LedgerValidationResult {
  const errors: LedgerValidationError[] = []
  const lineNumbers = new Set<number>()

  for (const line of lines) {
    const prefix = `lines[${line.lineNumber}]`
    if (lineNumbers.has(line.lineNumber)) {
      errors.push(err('DUPLICATE_LINE_NUMBER', `Duplicate line number ${line.lineNumber}`, `${prefix}.lineNumber`))
    }
    lineNumbers.add(line.lineNumber)

    const debit = toDecimal(line.debitAmount)
    const credit = toDecimal(line.creditAmount)
    const rate = toDecimal(line.exchangeRate ?? '1')
    const currency = line.currencyCode ?? 'INR'

    if (isNegative(debit) || isNegative(credit)) {
      errors.push(err('NEGATIVE_AMOUNT', 'Debit and credit amounts must not be negative', prefix))
    }
    if (isZero(debit) && isZero(credit)) {
      errors.push(err('ZERO_LINE', 'Line must have a positive debit or credit amount', prefix))
    }
    if (isPositive(debit) && isPositive(credit)) {
      errors.push(err('BOTH_DEBIT_CREDIT', 'Line cannot have both debit and credit amounts', prefix))
    }
    if (!isPositive(debit) && !isPositive(credit)) {
      errors.push(err('NO_AMOUNT', 'Line must have exactly one positive debit or credit amount', prefix))
    }
    if (!currency || currency.trim().length === 0) {
      errors.push(err('INVALID_CURRENCY', 'Currency code is required', `${prefix}.currencyCode`))
    }
    if (!isPositive(rate)) {
      errors.push(err('INVALID_EXCHANGE_RATE', 'Exchange rate must be greater than zero', `${prefix}.exchangeRate`))
    }
  }

  return errors.length ? fail(errors) : ok()
}

export function validateBalancedVoucher(lines: DraftVoucherLineInput[]): LedgerValidationResult {
  const structure = validateVoucherLinesStructure(lines)
  if (!structure.valid) return structure

  let totalDebit = toDecimal(0)
  let totalCredit = toDecimal(0)
  let baseTotalDebit = toDecimal(0)
  let baseTotalCredit = toDecimal(0)

  for (const line of lines) {
    const debit = toDecimal(line.debitAmount)
    const credit = toDecimal(line.creditAmount)
    const rate = toDecimal(line.exchangeRate ?? '1')
    totalDebit = add(totalDebit, debit)
    totalCredit = add(totalCredit, credit)

    const baseDebit = line.baseDebitAmount != null ? toDecimal(line.baseDebitAmount) : convertToBase(debit, rate)
    const baseCredit = line.baseCreditAmount != null ? toDecimal(line.baseCreditAmount) : convertToBase(credit, rate)
    baseTotalDebit = add(baseTotalDebit, baseDebit)
    baseTotalCredit = add(baseTotalCredit, baseCredit)
  }

  const errors: LedgerValidationError[] = []
  if (compare(totalDebit, totalCredit) !== 0) {
    errors.push(err('UNBALANCED', `Total debit (${totalDebit}) must equal total credit (${totalCredit})`))
  }
  if (compare(baseTotalDebit, baseTotalCredit) !== 0) {
    errors.push(
      err(
        'UNBALANCED_BASE',
        `Base total debit (${baseTotalDebit}) must equal base total credit (${baseTotalCredit})`,
      ),
    )
  }
  return errors.length ? fail(errors) : ok()
}

export async function validateVoucherLinesWithMasters(
  tenantId: string,
  legalEntityId: string,
  lines: DraftVoucherLineInput[],
): Promise<LedgerValidationResult> {
  const structure = validateVoucherLinesStructure(lines)
  if (!structure.valid) return structure

  const errors: LedgerValidationError[] = []
  for (const line of lines) {
    const prefix = `lines[${line.lineNumber}]`
    const accountResult = await validateAccountPostingEligibility(
      tenantId,
      legalEntityId,
      line.accountId,
      line.partyType,
      line.partyId,
    )
    if (!accountResult.valid) errors.push(...accountResult.errors.map((e) => ({ ...e, field: e.field ?? `${prefix}.accountId` })))

    const ccResult = await validateCostCentrePostingEligibility(tenantId, legalEntityId, line.costCentreId)
    if (!ccResult.valid) errors.push(...ccResult.errors)
  }
  return errors.length ? fail(errors) : ok()
}

export function computeLineTotals(lines: DraftVoucherLineInput[]) {
  const debitAmounts = lines.map((l) => l.debitAmount)
  const creditAmounts = lines.map((l) => l.creditAmount)
  const baseDebitAmounts = lines.map((l) =>
    l.baseDebitAmount ?? convertToBase(l.debitAmount, l.exchangeRate ?? '1').toString(),
  )
  const baseCreditAmounts = lines.map((l) =>
    l.baseCreditAmount ?? convertToBase(l.creditAmount, l.exchangeRate ?? '1').toString(),
  )
  return {
    totalDebit: sumDecimals(debitAmounts),
    totalCredit: sumDecimals(creditAmounts),
    baseTotalDebit: sumDecimals(baseDebitAmounts),
    baseTotalCredit: sumDecimals(baseCreditAmounts),
  }
}
