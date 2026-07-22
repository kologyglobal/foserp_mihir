import type { VendorPaymentAdjustmentAccountingRole, VendorPaymentAdjustmentType } from '@prisma/client'
import {
  add,
  convertToBase,
  isPositive,
  isZero,
  multiply,
  roundExchangeRate,
  subtract,
  toDecimal,
} from '../../../shared/finance-decimal.js'
import { calcError, calcWarning, VENDOR_PAYMENT_CALC_CODES } from './vendor-payment-calculation.errors.js'
import { formatDecimal4 } from './vendor-payment-decimal.js'
import type {
  VendorPaymentAdjustmentInput,
  VendorPaymentCalculatedAdjustment,
  VendorPaymentCalculationConfiguration,
  VendorPaymentCalculationTotals,
  VendorPaymentValidationIssue,
} from './vendor-payment-calculation.types.js'

const ZERO = toDecimal(0)

const DEFAULT_ROLE_BY_TYPE: Partial<Record<VendorPaymentAdjustmentType, VendorPaymentAdjustmentAccountingRole>> = {
  TDS: 'SETTLEMENT_CREDIT',
  DISCOUNT: 'SETTLEMENT_CREDIT',
  RETENTION: 'SETTLEMENT_CREDIT',
  WITHHOLDING: 'SETTLEMENT_CREDIT',
  BANK_CHARGE: 'PAYMENT_EXPENSE_DEBIT',
  PROCESSING_CHARGE: 'PAYMENT_EXPENSE_DEBIT',
}

function resolveAdjustmentAmount(
  adj: VendorPaymentAdjustmentInput,
  errors: VendorPaymentValidationIssue[],
): { amount: ReturnType<typeof toDecimal>; rate: string | null; base: string | null } {
  const hasAmount = adj.amount != null && adj.amount !== ''
  const hasRate = adj.rate != null && adj.rate !== ''
  const hasBase = adj.calculationBaseAmount != null && adj.calculationBaseAmount !== ''

  if (hasAmount && hasRate && hasBase) {
    const derived = multiply(toDecimal(adj.calculationBaseAmount!), toDecimal(adj.rate!).div(100))
    const explicit = toDecimal(adj.amount!)
    if (!explicit.eq(formatDecimal4(derived))) {
      errors.push(
        calcError(
          VENDOR_PAYMENT_CALC_CODES.ADJUSTMENT_AMOUNT_INVALID,
          `Adjustment line ${adj.lineNumber}: amount conflicts with rate × base`,
          'amount',
          { lineNumber: adj.lineNumber, adjustmentLineId: adj.id },
        ),
      )
    }
    return { amount: explicit, rate: adj.rate!, base: adj.calculationBaseAmount! }
  }

  if (hasRate && hasBase) {
    const rate = toDecimal(adj.rate!)
    const base = toDecimal(adj.calculationBaseAmount!)
    if (rate.isNegative()) {
      errors.push(
        calcError(VENDOR_PAYMENT_CALC_CODES.TDS_RATE_INVALID, `Adjustment line ${adj.lineNumber}: rate must be >= 0`, 'rate', {
          lineNumber: adj.lineNumber,
        }),
      )
    }
    if (base.isNegative()) {
      errors.push(
        calcError(VENDOR_PAYMENT_CALC_CODES.TDS_BASE_INVALID, `Adjustment line ${adj.lineNumber}: base must be >= 0`, 'calculationBaseAmount', {
          lineNumber: adj.lineNumber,
        }),
      )
    }
    // Rate is percentage (e.g. 10 = 10%)
    return {
      amount: multiply(base, rate.div(100)),
      rate: adj.rate!,
      base: adj.calculationBaseAmount!,
    }
  }

  if (hasAmount) {
    return { amount: toDecimal(adj.amount!), rate: adj.rate ?? null, base: adj.calculationBaseAmount ?? null }
  }

  errors.push(
    calcError(
      VENDOR_PAYMENT_CALC_CODES.ADJUSTMENT_AMOUNT_INVALID,
      `Adjustment line ${adj.lineNumber}: amount or rate+base is required`,
      'amount',
      { lineNumber: adj.lineNumber },
    ),
  )
  return { amount: ZERO, rate: null, base: null }
}

function validateRoleCompatibility(
  adj: VendorPaymentAdjustmentInput,
  errors: VendorPaymentValidationIssue[],
  warnings: VendorPaymentValidationIssue[],
): void {
  const expected = DEFAULT_ROLE_BY_TYPE[adj.adjustmentType]
  if (adj.accountingRole === 'INFORMATION_ONLY') return

  if (adj.adjustmentType === 'ROUND_OFF') {
    if (adj.accountingRole !== 'ROUND_OFF_DEBIT' && adj.accountingRole !== 'ROUND_OFF_CREDIT') {
      errors.push(
        calcError(
          VENDOR_PAYMENT_CALC_CODES.ADJUSTMENT_ROLE_INVALID,
          `Round-off line ${adj.lineNumber} must use ROUND_OFF_DEBIT or ROUND_OFF_CREDIT`,
          'accountingRole',
          { lineNumber: adj.lineNumber },
        ),
      )
    }
    return
  }

  if (expected && adj.accountingRole !== expected) {
    errors.push(
      calcError(
        VENDOR_PAYMENT_CALC_CODES.ADJUSTMENT_ROLE_INVALID,
        `Adjustment line ${adj.lineNumber}: ${adj.adjustmentType} normally requires ${expected}`,
        'accountingRole',
        { lineNumber: adj.lineNumber },
      ),
    )
  }

  if (adj.adjustmentType === 'OTHER') {
    warnings.push(
      calcWarning(
        VENDOR_PAYMENT_CALC_CODES.OTHER_ADJUSTMENT_REVIEW_REQUIRED,
        `Other adjustment on line ${adj.lineNumber} requires review`,
        'adjustmentType',
        { lineNumber: adj.lineNumber },
      ),
    )
  }
}

export interface VendorPaymentAdjustmentCalculationResult {
  adjustments: VendorPaymentCalculatedAdjustment[]
  totals: VendorPaymentCalculationTotals
  errors: VendorPaymentValidationIssue[]
  warnings: VendorPaymentValidationIssue[]
}

/**
 * Pure adjustment aggregation — payment / settlement / cash-outflow equations.
 * Does not touch the database.
 */
export function calculateVendorPaymentAdjustments(
  paymentAmountInput: string,
  adjustmentsInput: VendorPaymentAdjustmentInput[],
  exchangeRate: string,
  configuration?: VendorPaymentCalculationConfiguration,
): VendorPaymentAdjustmentCalculationResult {
  const errors: VendorPaymentValidationIssue[] = []
  const warnings: VendorPaymentValidationIssue[] = []
  const rate = roundExchangeRate(exchangeRate)

  const paymentAmount = toDecimal(paymentAmountInput)
  if (!isPositive(paymentAmount)) {
    errors.push(
      calcError(VENDOR_PAYMENT_CALC_CODES.AMOUNT_INVALID, 'Payment amount must be greater than zero', 'paymentAmount'),
    )
  }

  const sorted = [...adjustmentsInput].sort((a, b) => a.lineNumber - b.lineNumber)
  const seen = new Set<number>()
  for (const adj of sorted) {
    if (seen.has(adj.lineNumber)) {
      errors.push(
        calcError(
          VENDOR_PAYMENT_CALC_CODES.ADJUSTMENT_LINE_DUPLICATE,
          `Duplicate adjustment lineNumber ${adj.lineNumber}`,
          'lineNumber',
          { lineNumber: adj.lineNumber },
        ),
      )
    }
    seen.add(adj.lineNumber)
    if (!adj.description?.trim()) {
      errors.push(
        calcError(VENDOR_PAYMENT_CALC_CODES.ADJUSTMENT_TYPE_INVALID, `Adjustment line ${adj.lineNumber} requires a description`, 'description', {
          lineNumber: adj.lineNumber,
        }),
      )
    }
    validateRoleCompatibility(adj, errors, warnings)
  }

  let tdsAmount = ZERO
  let discountAmount = ZERO
  let retentionAmount = ZERO
  let withholdingAmount = ZERO
  let otherSettlementCreditAmount = ZERO
  let bankChargeAmount = ZERO
  let processingChargeAmount = ZERO
  let otherPaymentExpenseAmount = ZERO
  let roundOffDebitAmount = ZERO
  let roundOffCreditAmount = ZERO

  const calculated: VendorPaymentCalculatedAdjustment[] = []

  for (const adj of sorted) {
    const { amount, rate: adjRate, base } = resolveAdjustmentAmount(adj, errors)
    if (amount.isNegative() || isZero(amount)) {
      if (!isZero(amount) || adj.accountingRole !== 'INFORMATION_ONLY') {
        if (amount.isNegative() || (isZero(amount) && adj.accountingRole !== 'INFORMATION_ONLY')) {
          errors.push(
            calcError(
              VENDOR_PAYMENT_CALC_CODES.ADJUSTMENT_AMOUNT_INVALID,
              `Adjustment line ${adj.lineNumber}: amount must be positive`,
              'amount',
              { lineNumber: adj.lineNumber },
            ),
          )
        }
      }
    }

    const isInfo = adj.accountingRole === 'INFORMATION_ONLY'
    const affectsSettlement =
      !isInfo &&
      (adj.accountingRole === 'SETTLEMENT_CREDIT' ||
        adj.accountingRole === 'ROUND_OFF_CREDIT' ||
        adj.accountingRole === 'ROUND_OFF_DEBIT')
    const affectsCashOutflow = !isInfo && adj.accountingRole === 'PAYMENT_EXPENSE_DEBIT'

    if (!isInfo && isPositive(amount)) {
      switch (adj.accountingRole) {
        case 'SETTLEMENT_CREDIT':
          switch (adj.adjustmentType) {
            case 'TDS':
              tdsAmount = add(tdsAmount, amount)
              break
            case 'DISCOUNT':
              discountAmount = add(discountAmount, amount)
              break
            case 'RETENTION':
              retentionAmount = add(retentionAmount, amount)
              break
            case 'WITHHOLDING':
              withholdingAmount = add(withholdingAmount, amount)
              break
            default:
              otherSettlementCreditAmount = add(otherSettlementCreditAmount, amount)
              break
          }
          break
        case 'PAYMENT_EXPENSE_DEBIT':
          switch (adj.adjustmentType) {
            case 'BANK_CHARGE':
              bankChargeAmount = add(bankChargeAmount, amount)
              break
            case 'PROCESSING_CHARGE':
              processingChargeAmount = add(processingChargeAmount, amount)
              break
            default:
              otherPaymentExpenseAmount = add(otherPaymentExpenseAmount, amount)
              break
          }
          break
        case 'ROUND_OFF_DEBIT':
          roundOffDebitAmount = add(roundOffDebitAmount, amount)
          break
        case 'ROUND_OFF_CREDIT':
          roundOffCreditAmount = add(roundOffCreditAmount, amount)
          break
        default:
          break
      }
    }

    calculated.push({
      id: adj.id ?? null,
      lineNumber: adj.lineNumber,
      adjustmentType: adj.adjustmentType,
      accountingRole: adj.accountingRole,
      description: adj.description,
      amount: formatDecimal4(amount),
      baseAmount: formatDecimal4(convertToBase(amount, rate)),
      calculationBaseAmount: base,
      rate: adjRate,
      sectionCode: adj.sectionCode ?? null,
      statutoryReference: adj.statutoryReference ?? null,
      accountId: adj.accountId ?? null,
      costCentreId: adj.costCentreId ?? null,
      projectReference: adj.projectReference ?? null,
      departmentReference: adj.departmentReference ?? null,
      affectsSettlement,
      affectsCashOutflow,
      isInformationOnly: isInfo,
    })
  }

  const settlementAdjustmentAmount = add(
    add(add(tdsAmount, discountAmount), add(retentionAmount, withholdingAmount)),
    otherSettlementCreditAmount,
  )
  const paymentExpenseAmount = add(add(bankChargeAmount, processingChargeAmount), otherPaymentExpenseAmount)
  const netRoundOffAmount = subtract(roundOffCreditAmount, roundOffDebitAmount)

  const vendorSettlementAmount = add(add(paymentAmount, settlementAdjustmentAmount), netRoundOffAmount)
  const cashOutflowAmount = add(paymentAmount, paymentExpenseAmount)

  const allowedRoundOff = toDecimal(configuration?.allowedRoundOffDifference ?? '1')
  const absRoundOff = add(roundOffDebitAmount, roundOffCreditAmount)
  if (absRoundOff.gt(allowedRoundOff)) {
    errors.push(
      calcError(
        VENDOR_PAYMENT_CALC_CODES.ROUND_OFF_EXCEEDS_LIMIT,
        `Round-off ${formatDecimal4(absRoundOff)} exceeds allowed difference ${formatDecimal4(allowedRoundOff)}`,
        'roundOff',
      ),
    )
  }

  if (!isPositive(vendorSettlementAmount) && errors.every((e) => e.code !== VENDOR_PAYMENT_CALC_CODES.AMOUNT_INVALID)) {
    errors.push(
      calcError(
        VENDOR_PAYMENT_CALC_CODES.SETTLEMENT_AMOUNT_INVALID,
        'Vendor settlement amount must be greater than zero',
        'vendorSettlementAmount',
      ),
    )
  }

  if (!isPositive(cashOutflowAmount) && isPositive(paymentAmount)) {
    errors.push(
      calcError(VENDOR_PAYMENT_CALC_CODES.CASH_OUTFLOW_INVALID, 'Cash outflow amount must be greater than zero', 'cashOutflowAmount'),
    )
  }

  if (isPositive(tdsAmount) && tdsAmount.gt(vendorSettlementAmount)) {
    errors.push(
      calcError(VENDOR_PAYMENT_CALC_CODES.TDS_AMOUNT_INVALID, 'TDS amount cannot exceed vendor settlement amount', 'tdsAmount'),
    )
  }

  const totals: VendorPaymentCalculationTotals = {
    paymentAmount: formatDecimal4(paymentAmount),
    tdsAmount: formatDecimal4(tdsAmount),
    discountAmount: formatDecimal4(discountAmount),
    retentionAmount: formatDecimal4(retentionAmount),
    withholdingAmount: formatDecimal4(withholdingAmount),
    otherSettlementCreditAmount: formatDecimal4(otherSettlementCreditAmount),
    settlementAdjustmentAmount: formatDecimal4(settlementAdjustmentAmount),
    bankChargeAmount: formatDecimal4(bankChargeAmount),
    processingChargeAmount: formatDecimal4(processingChargeAmount),
    otherPaymentExpenseAmount: formatDecimal4(otherPaymentExpenseAmount),
    paymentExpenseAmount: formatDecimal4(paymentExpenseAmount),
    roundOffDebitAmount: formatDecimal4(roundOffDebitAmount),
    roundOffCreditAmount: formatDecimal4(roundOffCreditAmount),
    netRoundOffAmount: formatDecimal4(netRoundOffAmount),
    vendorSettlementAmount: formatDecimal4(vendorSettlementAmount),
    cashOutflowAmount: formatDecimal4(cashOutflowAmount),
  }

  return { adjustments: calculated, totals, errors, warnings }
}
