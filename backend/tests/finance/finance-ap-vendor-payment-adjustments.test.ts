import { describe, it, expect } from 'vitest'
import { calculateVendorPaymentSync } from '../../src/modules/accounting/payables/vendor-payments/calculation/vendor-payment-calculation.service.js'
import { VENDOR_PAYMENT_CALC_CODES } from '../../src/modules/accounting/payables/vendor-payments/calculation/vendor-payment-calculation.errors.js'
import type {
  VendorPaymentCalculationAccountsOverride,
  VendorPaymentCalculationInput,
} from '../../src/modules/accounting/payables/vendor-payments/calculation/vendor-payment-calculation.types.js'

function acct(id: string, code: string, name: string) {
  return { id, code, name }
}

function baseAccounts(): VendorPaymentCalculationAccountsOverride {
  return {
    vendorPayable: acct('acc-payable', '2100', 'Trade Payables'),
    paymentAccount: acct('acc-bank', '1100', 'Bank Account'),
    tdsPayable: acct('acc-tds', '2210', 'TDS Payable'),
    discountReceived: acct('acc-discount', '4200', 'Discount Received'),
    retentionPayable: acct('acc-retention', '2205', 'Retention Payable'),
    withholdingPayable: acct('acc-withhold', '2215', 'Withholding Payable'),
    bankCharge: acct('acc-bank-charge', '5400', 'Bank Charges'),
    processingCharge: acct('acc-proc', '5410', 'Processing Charges'),
    roundOffDebit: acct('acc-round', '5900', 'Round Off'),
    roundOffCredit: acct('acc-round', '5900', 'Round Off'),
    otherAdjustment: acct('acc-other', '5999', 'Other'),
  }
}

function baseInput(overrides: Partial<VendorPaymentCalculationInput> = {}): VendorPaymentCalculationInput {
  return {
    legalEntityId: '00000000-0000-4000-8000-0000000000a1',
    vendorId: 'vendor-a',
    paymentPurpose: 'INVOICE_SETTLEMENT',
    paymentMethod: 'BANK_TRANSFER',
    documentDate: '2026-07-15',
    paymentDate: '2026-07-15',
    currencyCode: 'INR',
    exchangeRate: '1',
    paymentAmount: '100000',
    paymentReference: 'NEFT-ADJ',
    adjustments: [],
    configuration: {
      baseCurrencyCode: 'INR',
      accounts: baseAccounts(),
      allowedRoundOffDifference: '1',
      requireOpenPayableForSettlementPurpose: false,
    },
    ...overrides,
  }
}

describe('Finance Phase 4B2 — vendor payment adjustments', () => {
  it('1. discount received', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        paymentAmount: '98000',
        adjustments: [
          {
            lineNumber: 1,
            adjustmentType: 'DISCOUNT',
            accountingRole: 'SETTLEMENT_CREDIT',
            description: 'Early payment discount',
            amount: '2000',
          },
        ],
      }),
    )
    expect(result.totals.vendorSettlementAmount).toBe('100000.0000')
    expect(result.totals.cashOutflowAmount).toBe('98000.0000')
    expect(result.totals.discountAmount).toBe('2000.0000')
    expect(result.accountingPreview.lines.find((l) => l.component === 'DISCOUNT_RECEIVED')?.creditAmount).toBe(
      '2000.0000',
    )
  })

  it('2. retention liability credit', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        paymentAmount: '95000',
        adjustments: [
          {
            lineNumber: 1,
            adjustmentType: 'RETENTION',
            accountingRole: 'SETTLEMENT_CREDIT',
            description: 'Contract retention',
            amount: '5000',
          },
        ],
      }),
    )
    expect(result.totals.retentionAmount).toBe('5000.0000')
    expect(result.totals.vendorSettlementAmount).toBe('100000.0000')
    const retention = result.accountingPreview.lines.find((l) => l.component === 'RETENTION_PAYABLE')
    expect(retention?.creditAmount).toBe('5000.0000')
    expect(retention?.accountId).toBe('acc-retention')
  })

  it('3. bank charge increases cash outflow only', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        adjustments: [
          {
            lineNumber: 1,
            adjustmentType: 'BANK_CHARGE',
            accountingRole: 'PAYMENT_EXPENSE_DEBIT',
            description: 'Bank charges',
            amount: '500',
          },
        ],
      }),
    )
    expect(result.totals.vendorSettlementAmount).toBe('100000.0000')
    expect(result.totals.cashOutflowAmount).toBe('100500.0000')
    expect(result.openItemPreview.originalAmount).toBe('100000.0000')
  })

  it('4. multiple adjustments aggregate correctly', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        paymentAmount: '82500',
        adjustments: [
          {
            lineNumber: 1,
            adjustmentType: 'TDS',
            accountingRole: 'SETTLEMENT_CREDIT',
            description: 'TDS',
            amount: '10000',
            sectionCode: '194C',
          },
          {
            lineNumber: 2,
            adjustmentType: 'DISCOUNT',
            accountingRole: 'SETTLEMENT_CREDIT',
            description: 'Discount',
            amount: '2000',
          },
          {
            lineNumber: 3,
            adjustmentType: 'RETENTION',
            accountingRole: 'SETTLEMENT_CREDIT',
            description: 'Retention',
            amount: '5000',
          },
          {
            lineNumber: 4,
            adjustmentType: 'BANK_CHARGE',
            accountingRole: 'PAYMENT_EXPENSE_DEBIT',
            description: 'Bank',
            amount: '300',
          },
          {
            lineNumber: 5,
            adjustmentType: 'PROCESSING_CHARGE',
            accountingRole: 'PAYMENT_EXPENSE_DEBIT',
            description: 'Processing',
            amount: '200',
          },
        ],
      }),
    )

    expect(result.totals.settlementAdjustmentAmount).toBe('17000.0000')
    expect(result.totals.paymentExpenseAmount).toBe('500.0000')
    expect(result.totals.vendorSettlementAmount).toBe('99500.0000')
    expect(result.totals.cashOutflowAmount).toBe('83000.0000')
    expect(result.accountingPreview.isBalanced).toBe(true)
    expect(result.adjustments).toHaveLength(5)
  })

  it('5. round-off credit increases settlement', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        paymentAmount: '99999.5000',
        adjustments: [
          {
            lineNumber: 1,
            adjustmentType: 'ROUND_OFF',
            accountingRole: 'ROUND_OFF_CREDIT',
            description: 'Round off',
            amount: '0.5000',
          },
        ],
      }),
    )
    expect(result.totals.vendorSettlementAmount).toBe('100000.0000')
    expect(result.totals.roundOffCreditAmount).toBe('0.5000')
  })

  it('6. round-off exceeds limit', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        adjustments: [
          {
            lineNumber: 1,
            adjustmentType: 'ROUND_OFF',
            accountingRole: 'ROUND_OFF_CREDIT',
            description: 'Excess round off',
            amount: '5',
          },
        ],
      }),
    )
    expect(result.validation.errors.some((e) => e.code === VENDOR_PAYMENT_CALC_CODES.ROUND_OFF_EXCEEDS_LIMIT)).toBe(
      true,
    )
  })

  it('7. duplicate line numbers rejected', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        adjustments: [
          {
            lineNumber: 1,
            adjustmentType: 'DISCOUNT',
            accountingRole: 'SETTLEMENT_CREDIT',
            description: 'A',
            amount: '100',
          },
          {
            lineNumber: 1,
            adjustmentType: 'RETENTION',
            accountingRole: 'SETTLEMENT_CREDIT',
            description: 'B',
            amount: '100',
          },
        ],
        paymentAmount: '99800',
      }),
    )
    expect(result.validation.errors.some((e) => e.code === VENDOR_PAYMENT_CALC_CODES.ADJUSTMENT_LINE_DUPLICATE)).toBe(
      true,
    )
  })

  it('8. OTHER adjustment emits review warning', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        paymentAmount: '99000',
        adjustments: [
          {
            lineNumber: 1,
            adjustmentType: 'OTHER',
            accountingRole: 'SETTLEMENT_CREDIT',
            description: 'Special deduction',
            amount: '1000',
          },
        ],
      }),
    )
    expect(
      result.validation.warnings.some((w) => w.code === VENDOR_PAYMENT_CALC_CODES.OTHER_ADJUSTMENT_REVIEW_REQUIRED),
    ).toBe(true)
  })

  it('9. INFORMATION_ONLY does not affect totals', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        adjustments: [
          {
            lineNumber: 1,
            adjustmentType: 'OTHER',
            accountingRole: 'INFORMATION_ONLY',
            description: 'Memo only',
            amount: '9999',
          },
        ],
      }),
    )
    expect(result.totals.vendorSettlementAmount).toBe('100000.0000')
    expect(result.totals.cashOutflowAmount).toBe('100000.0000')
    expect(result.accountingPreview.lines.every((l) => l.component !== 'OTHER_ADJUSTMENT')).toBe(true)
  })
})
