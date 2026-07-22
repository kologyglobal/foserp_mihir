import { Prisma, type VendorPaymentPurpose } from '@prisma/client'
import { convertToBase, isPositive, isZero, max, roundExchangeRate, subtract, toDecimal } from '../../../shared/finance-decimal.js'
import { findVendorPayableOpenItemPosition as findPositionAggregate } from '../../open-items/payable-open-item.repository.js'
import { calcError, calcWarning, VENDOR_PAYMENT_CALC_CODES } from './vendor-payment-calculation.errors.js'
import { formatDecimal4 } from './vendor-payment-decimal.js'
import type {
  VendorPaymentCalculationConfiguration,
  VendorPaymentPositionResult,
  VendorPaymentPositionSnapshot,
  VendorPaymentValidationIssue,
} from './vendor-payment-calculation.types.js'

function emptyPosition(): VendorPaymentPositionSnapshot {
  const z = '0.0000'
  return {
    vendorCreditOutstanding: z,
    vendorDebitOutstanding: z,
    netVendorPayable: z,
    baseVendorCreditOutstanding: z,
    baseVendorDebitOutstanding: z,
    baseNetVendorPayable: z,
  }
}

/**
 * Read-only aggregate of active vendor payable open items (CREDIT vs DEBIT outstanding).
 * No mutations.
 */
export async function findVendorPayableOpenItemPosition(params: {
  tenantId: string
  legalEntityId: string
  vendorId: string
  currencyCode: string
  exchangeRate: string
}): Promise<VendorPaymentPositionSnapshot> {
  const agg = await findPositionAggregate({
    tenantId: params.tenantId,
    legalEntityId: params.legalEntityId,
    vendorId: params.vendorId,
    currencyCode: params.currencyCode,
  })

  const credit = toDecimal(agg.creditOutstanding)
  const debit = toDecimal(agg.debitOutstanding)
  const rate = roundExchangeRate(params.exchangeRate)
  const net = subtract(credit, debit)
  return {
    vendorCreditOutstanding: formatDecimal4(credit),
    vendorDebitOutstanding: formatDecimal4(debit),
    netVendorPayable: formatDecimal4(net),
    baseVendorCreditOutstanding: formatDecimal4(convertToBase(credit, rate)),
    baseVendorDebitOutstanding: formatDecimal4(convertToBase(debit, rate)),
    baseNetVendorPayable: formatDecimal4(convertToBase(net, rate)),
  }
}

export function assessVendorPaymentPosition(params: {
  position: VendorPaymentPositionSnapshot
  vendorSettlementAmount: string
  paymentPurpose: VendorPaymentPurpose
  configuration?: VendorPaymentCalculationConfiguration
}): {
  result: VendorPaymentPositionResult
  errors: VendorPaymentValidationIssue[]
  warnings: VendorPaymentValidationIssue[]
} {
  const { position, vendorSettlementAmount, paymentPurpose, configuration } = params
  const errors: VendorPaymentValidationIssue[] = []
  const warnings: VendorPaymentValidationIssue[] = []

  const settlement = toDecimal(vendorSettlementAmount)
  const creditOutstanding = toDecimal(position.vendorCreditOutstanding)
  const excess = max(subtract(settlement, creditOutstanding), 0)

  let purposeConsistent = true
  let suggestedPurpose: VendorPaymentPurpose | null = null

  const requireOpen = configuration?.requireOpenPayableForSettlementPurpose ?? false
  const blockOver = configuration?.blockOverSettlementForInvoicePurpose ?? false
  const allowMixed = configuration?.allowOverSettlementAsMixedAdvance ?? true

  if (paymentPurpose === 'INVOICE_SETTLEMENT') {
    if (isZero(creditOutstanding) || !isPositive(creditOutstanding)) {
      purposeConsistent = false
      warnings.push(
        calcWarning(
          VENDOR_PAYMENT_CALC_CODES.NO_OPEN_VENDOR_INVOICES,
          'No open vendor credit payables found for invoice settlement purpose',
          'paymentPurpose',
        ),
      )
      if (requireOpen) {
        errors.push(
          calcError(
            VENDOR_PAYMENT_CALC_CODES.NO_OPEN_VENDOR_INVOICES,
            'Invoice settlement requires eligible vendor credit outstanding',
            'paymentPurpose',
          ),
        )
      }
    }
    if (isPositive(excess)) {
      purposeConsistent = false
      suggestedPurpose = 'MIXED'
      warnings.push(
        calcWarning(
          VENDOR_PAYMENT_CALC_CODES.SETTLEMENT_EXCEEDS_OUTSTANDING,
          `Settlement exceeds credit outstanding by ${formatDecimal4(excess)}`,
          'vendorSettlementAmount',
        ),
      )
      warnings.push(
        calcWarning(
          VENDOR_PAYMENT_CALC_CODES.PURPOSE_MAY_BE_MIXED,
          'Consider MIXED purpose when settlement exceeds outstanding',
          'paymentPurpose',
        ),
      )
      if (blockOver && !allowMixed) {
        errors.push(
          calcError(
            VENDOR_PAYMENT_CALC_CODES.SETTLEMENT_EXCEEDS_OUTSTANDING,
            'Settlement exceeds outstanding and over-settlement is blocked',
            'vendorSettlementAmount',
          ),
        )
      }
    }
  } else if (paymentPurpose === 'ADVANCE') {
    if (isPositive(creditOutstanding)) {
      warnings.push(
        calcWarning(
          VENDOR_PAYMENT_CALC_CODES.ADVANCE_WITH_OPEN_PAYABLES,
          'Vendor has open payables — allocation may be more appropriate than a pure advance',
          'paymentPurpose',
        ),
      )
    }
  } else if (paymentPurpose === 'MIXED') {
    if (isPositive(excess)) {
      warnings.push(
        calcWarning(
          VENDOR_PAYMENT_CALC_CODES.UNALLOCATED_AFTER_POSTING,
          `Excess ${formatDecimal4(excess)} will remain as allocatable debit / advance residual after posting`,
          'vendorSettlementAmount',
        ),
      )
    }
  }

  return {
    result: {
      ...position,
      proposedVendorSettlementAmount: formatDecimal4(settlement),
      excessSettlementAmount: formatDecimal4(excess),
      purposeConsistent,
      suggestedPurpose,
    },
    errors,
    warnings,
  }
}

export function resolvePositionSnapshot(
  configuration: VendorPaymentCalculationConfiguration | undefined,
  _exchangeRate: string,
): VendorPaymentPositionSnapshot {
  return configuration?.vendorPositionOverride ?? emptyPosition()
}

/** Re-export Prisma Decimal for callers that need typed sums. */
export type PayablePositionDecimal = Prisma.Decimal
