import { compare, formatForPersistence, sumDecimals, subtract, toDecimal } from '../../shared/finance-decimal.js'

export interface BankStatementHeaderInput {
  openingBalance: number | string
  closingBalance: number | string
  totalCreditAmount: number | string
  totalDebitAmount: number | string
  periodStartDate: Date
  periodEndDate: Date
  statementDate: Date
  currencyCode: string
  treasuryAccountCurrencyCode: string
}

export interface BankStatementValidationResult {
  valid: boolean
  errors: string[]
}

const BALANCE_EQUATION_TOLERANCE = '0.01'

export function validateStatementHeader(input: BankStatementHeaderInput): BankStatementValidationResult {
  const errors: string[] = []

  const opening = toDecimal(input.openingBalance)
  const credits = toDecimal(input.totalCreditAmount)
  const debits = toDecimal(input.totalDebitAmount)
  const closing = toDecimal(input.closingBalance)
  const expectedClosing = subtract(sumDecimals([opening, credits]), debits)

  if (compare(expectedClosing, closing) !== 0 && Math.abs(Number(formatForPersistence(expectedClosing)) - Number(formatForPersistence(closing))) > Number(BALANCE_EQUATION_TOLERANCE)) {
    errors.push(
      `Balance equation failed: opening (${formatForPersistence(opening)}) + credits (${formatForPersistence(credits)}) - debits (${formatForPersistence(debits)}) = ${formatForPersistence(expectedClosing)}, expected closing balance ${formatForPersistence(closing)}`,
    )
  }

  if (input.periodStartDate.getTime() > input.periodEndDate.getTime()) {
    errors.push('periodStartDate must not be after periodEndDate')
  }

  if (
    input.statementDate.getTime() < input.periodStartDate.getTime() ||
    input.statementDate.getTime() > addDays(input.periodEndDate, 31).getTime()
  ) {
    errors.push('statementDate is outside a plausible range for the given statement period')
  }

  if (input.currencyCode !== input.treasuryAccountCurrencyCode) {
    errors.push(
      `Statement currency (${input.currencyCode}) does not match treasury account currency (${input.treasuryAccountCurrencyCode})`,
    )
  }

  return { valid: errors.length === 0, errors }
}

export interface BankStatementLineTotalsInput {
  lines: Array<{ direction: 'CREDIT' | 'DEBIT'; amount: number | string }>
}

export function computeLineTotals(input: BankStatementLineTotalsInput): { creditTotal: string; debitTotal: string } {
  const creditLines = input.lines.filter((l) => l.direction === 'CREDIT').map((l) => l.amount)
  const debitLines = input.lines.filter((l) => l.direction === 'DEBIT').map((l) => l.amount)
  return {
    creditTotal: formatForPersistence(sumDecimals(creditLines)),
    debitTotal: formatForPersistence(sumDecimals(debitLines)),
  }
}

export function validateLineTotalsMatchHeader(
  lineTotals: { creditTotal: string; debitTotal: string },
  header: { totalCreditAmount: number | string; totalDebitAmount: number | string },
): BankStatementValidationResult {
  const errors: string[] = []
  if (compare(lineTotals.creditTotal, header.totalCreditAmount) !== 0) {
    errors.push(
      `Sum of credit lines (${lineTotals.creditTotal}) does not match header totalCreditAmount (${formatForPersistence(header.totalCreditAmount)})`,
    )
  }
  if (compare(lineTotals.debitTotal, header.totalDebitAmount) !== 0) {
    errors.push(
      `Sum of debit lines (${lineTotals.debitTotal}) does not match header totalDebitAmount (${formatForPersistence(header.totalDebitAmount)})`,
    )
  }
  return { valid: errors.length === 0, errors }
}

/** Operational validate — transitions statement to VALIDATED or VALIDATION_FAILED. */
export function validateStatementOperational(input: {
  header: BankStatementHeaderInput
  lines: BankStatementLineTotalsInput['lines']
}): BankStatementValidationResult {
  const headerResult = validateStatementHeader(input.header)
  const totals = computeLineTotals({ lines: input.lines })
  const lineResult = validateLineTotalsMatchHeader(totals, {
    totalCreditAmount: input.header.totalCreditAmount,
    totalDebitAmount: input.header.totalDebitAmount,
  })
  const errors = [...headerResult.errors, ...lineResult.errors]
  return { valid: errors.length === 0, errors }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}
