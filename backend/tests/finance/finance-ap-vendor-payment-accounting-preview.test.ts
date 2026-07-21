import { describe, it, expect } from 'vitest'
import { calculateVendorPaymentSync } from '../../src/modules/accounting/payables/vendor-payments/calculation/vendor-payment-calculation.service.js'
import { buildVendorPaymentAccountingPreview } from '../../src/modules/accounting/payables/vendor-payments/calculation/vendor-payment-accounting-preview.service.js'
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
    bankCharge: acct('acc-bank-charge', '5400', 'Bank Charges'),
    processingCharge: acct('acc-proc', '5410', 'Processing Charges'),
    roundOffDebit: acct('acc-round', '5900', 'Round Off'),
    roundOffCredit: acct('acc-round', '5900', 'Round Off'),
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
    paymentReference: 'NEFT-PREV',
    adjustments: [],
    configuration: {
      baseCurrencyCode: 'INR',
      accounts: baseAccounts(),
      requireOpenPayableForSettlementPurpose: false,
    },
    ...overrides,
  }
}

describe('Finance Phase 4B2 — vendor payment accounting preview', () => {
  it('1. simple balanced Dr/Cr', () => {
    const result = calculateVendorPaymentSync(baseInput())
    expect(result.accountingPreview.debitTotal).toBe(result.accountingPreview.creditTotal)
    expect(result.accountingPreview.difference).toBe('0.0000')
    expect(result.accountingPreview.baseDifference).toBe('0.0000')
  })

  it('2. TDS + bank charge combined preview', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        paymentAmount: '90000',
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
            adjustmentType: 'BANK_CHARGE',
            accountingRole: 'PAYMENT_EXPENSE_DEBIT',
            description: 'Bank charge',
            amount: '500',
          },
        ],
      }),
    )

    expect(result.accountingPreview.isBalanced).toBe(true)
    expect(result.accountingPreview.vendorPayableDebitAmount).toBe('100000.0000')
    expect(result.accountingPreview.paymentAccountCreditAmount).toBe('90500.0000')

    const components = result.accountingPreview.lines.map((l) => l.component)
    expect(components).toContain('VENDOR_PAYABLE')
    expect(components).toContain('BANK_CHARGE')
    expect(components).toContain('PAYMENT_ACCOUNT')
    expect(components).toContain('TDS_PAYABLE')
  })

  it('3. discount preview', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        paymentAmount: '98000',
        adjustments: [
          {
            lineNumber: 1,
            adjustmentType: 'DISCOUNT',
            accountingRole: 'SETTLEMENT_CREDIT',
            description: 'Discount',
            amount: '2000',
          },
        ],
      }),
    )
    expect(result.accountingPreview.lines.find((l) => l.component === 'DISCOUNT_RECEIVED')?.creditAmount).toBe(
      '2000.0000',
    )
    expect(result.accountingPreview.isBalanced).toBe(true)
  })

  it('4. retention preview', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        paymentAmount: '95000',
        adjustments: [
          {
            lineNumber: 1,
            adjustmentType: 'RETENTION',
            accountingRole: 'SETTLEMENT_CREDIT',
            description: 'Retention',
            amount: '5000',
          },
        ],
      }),
    )
    expect(result.accountingPreview.lines.find((l) => l.component === 'RETENTION_PAYABLE')?.creditAmount).toBe(
      '5000.0000',
    )
  })

  it('5. vendor payable debit carries party tracking', () => {
    const result = calculateVendorPaymentSync(baseInput())
    const payable = result.accountingPreview.lines.find((l) => l.component === 'VENDOR_PAYABLE')
    expect(payable?.partyType).toBe('VENDOR')
    expect(payable?.partyId).toBe('vendor-a')
    expect(payable?.direction).toBe('DEBIT')
  })

  it('6. unbalanced preview protection via injected defect', () => {
    const result = calculateVendorPaymentSync(baseInput())
    const broken = buildVendorPaymentAccountingPreview({
      input: baseInput(),
      totals: {
        ...result.totals,
        // Force mismatch: claim cash outflow differs from payment without expense lines
        cashOutflowAmount: '99999.0000',
      },
      baseTotals: {
        ...result.baseTotals,
        baseCashOutflowAmount: '99999.0000',
      },
      adjustments: result.adjustments,
      accountReadiness: result.accountReadiness,
    })

    expect(broken.isBalanced).toBe(false)
    expect(broken.issues.some((i) => i.code === VENDOR_PAYMENT_CALC_CODES.ACCOUNTING_PREVIEW_UNBALANCED)).toBe(true)
  })

  it('7. preview line ordering is stable', () => {
    const a = calculateVendorPaymentSync(
      baseInput({
        paymentAmount: '90000',
        adjustments: [
          {
            lineNumber: 1,
            adjustmentType: 'TDS',
            accountingRole: 'SETTLEMENT_CREDIT',
            description: 'TDS',
            amount: '10000',
          },
          {
            lineNumber: 2,
            adjustmentType: 'BANK_CHARGE',
            accountingRole: 'PAYMENT_EXPENSE_DEBIT',
            description: 'Bank',
            amount: '100',
          },
        ],
      }),
    )
    const b = calculateVendorPaymentSync(
      baseInput({
        paymentAmount: '90000',
        adjustments: [
          {
            lineNumber: 1,
            adjustmentType: 'TDS',
            accountingRole: 'SETTLEMENT_CREDIT',
            description: 'TDS',
            amount: '10000',
          },
          {
            lineNumber: 2,
            adjustmentType: 'BANK_CHARGE',
            accountingRole: 'PAYMENT_EXPENSE_DEBIT',
            description: 'Bank',
            amount: '100',
          },
        ],
      }),
    )
    expect(a.accountingPreview.lines.map((l) => `${l.sequence}:${l.component}`)).toEqual(
      b.accountingPreview.lines.map((l) => `${l.sequence}:${l.component}`),
    )
  })
})
