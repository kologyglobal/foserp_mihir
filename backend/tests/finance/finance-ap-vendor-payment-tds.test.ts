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
    bankCharge: acct('acc-bank-charge', '5400', 'Bank Charges'),
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
    paymentAmount: '90000',
    paymentReference: 'NEFT-TDS',
    adjustments: [
      {
        lineNumber: 1,
        adjustmentType: 'TDS',
        accountingRole: 'SETTLEMENT_CREDIT',
        description: 'TDS 194C',
        amount: '10000',
        sectionCode: '194C',
      },
    ],
    configuration: {
      baseCurrencyCode: 'INR',
      tdsEnabled: true,
      tdsAtPaymentEnabled: true,
      accounts: baseAccounts(),
      requireOpenPayableForSettlementPurpose: false,
    },
    ...overrides,
  }
}

describe('Finance Phase 4B2 — vendor payment TDS', () => {
  it('1. TDS at payment — settlement 100k, cash 90k, balanced preview', () => {
    const result = calculateVendorPaymentSync(baseInput())

    expect(result.totals.vendorSettlementAmount).toBe('100000.0000')
    expect(result.totals.cashOutflowAmount).toBe('90000.0000')
    expect(result.totals.tdsAmount).toBe('10000.0000')
    expect(result.accountingPreview.isBalanced).toBe(true)

    const payable = result.accountingPreview.lines.find((l) => l.component === 'VENDOR_PAYABLE')
    const bank = result.accountingPreview.lines.find((l) => l.component === 'PAYMENT_ACCOUNT')
    const tds = result.accountingPreview.lines.find((l) => l.component === 'TDS_PAYABLE')

    expect(payable?.debitAmount).toBe('100000.0000')
    expect(bank?.creditAmount).toBe('90000.0000')
    expect(tds?.creditAmount).toBe('10000.0000')
  })

  it('2. rate-based TDS calculation', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        paymentAmount: '90000',
        adjustments: [
          {
            lineNumber: 1,
            adjustmentType: 'TDS',
            accountingRole: 'SETTLEMENT_CREDIT',
            description: 'TDS 10%',
            rate: '10',
            calculationBaseAmount: '100000',
            sectionCode: '194C',
          },
        ],
      }),
    )
    expect(result.totals.tdsAmount).toBe('10000.0000')
    expect(result.totals.vendorSettlementAmount).toBe('100000.0000')
  })

  it('3. double recognition blocked when TDS already at invoice', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        configuration: {
          baseCurrencyCode: 'INR',
          tdsEnabled: true,
          tdsAtPaymentEnabled: true,
          tdsAlreadyRecognisedAtInvoice: true,
          accounts: baseAccounts(),
          requireOpenPayableForSettlementPurpose: false,
        },
      }),
    )
    expect(result.validation.errors.some((e) => e.code === VENDOR_PAYMENT_CALC_CODES.TDS_DOUBLE_RECOGNITION)).toBe(true)
  })

  it('4. TDS disabled configuration blocks TDS lines', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        configuration: {
          baseCurrencyCode: 'INR',
          tdsEnabled: false,
          tdsAtPaymentEnabled: false,
          accounts: baseAccounts(),
          requireOpenPayableForSettlementPurpose: false,
        },
      }),
    )
    expect(result.validation.errors.some((e) => e.code === VENDOR_PAYMENT_CALC_CODES.TDS_CONFIGURATION_MISSING)).toBe(
      true,
    )
  })

  it('5. missing TDS account blocks readiness when TDS non-zero', () => {
    const accounts = baseAccounts()
    delete accounts.tdsPayable
    const result = calculateVendorPaymentSync(
      baseInput({
        configuration: {
          baseCurrencyCode: 'INR',
          tdsEnabled: true,
          tdsAtPaymentEnabled: true,
          accounts,
          requireOpenPayableForSettlementPurpose: false,
        },
      }),
    )
    expect(result.accountReadiness.isReady).toBe(false)
    expect(result.validation.errors.some((e) => e.code === VENDOR_PAYMENT_CALC_CODES.TDS_ACCOUNT_MISSING)).toBe(true)
  })

  it('6. TDS review warning without allocation context', () => {
    const result = calculateVendorPaymentSync(baseInput())
    expect(result.validation.warnings.some((w) => w.code === VENDOR_PAYMENT_CALC_CODES.TDS_REVIEW_REQUIRED)).toBe(true)
  })
})
