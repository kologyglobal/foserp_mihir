import { describe, it, expect } from 'vitest'
import {
  calculateVendorPaymentSync,
  calculateVendorPayment,
} from '../../src/modules/accounting/payables/vendor-payments/calculation/vendor-payment-calculation.service.js'
import { VENDOR_PAYMENT_CALC_CODES } from '../../src/modules/accounting/payables/vendor-payments/calculation/vendor-payment-calculation.errors.js'
import { VENDOR_PAYMENT_CALCULATION_VERSION } from '../../src/modules/accounting/payables/vendor-payments/calculation/vendor-payment-calculation.types.js'
import type {
  VendorPaymentCalculationAccountsOverride,
  VendorPaymentCalculationInput,
  VendorPaymentValidationIssue,
} from '../../src/modules/accounting/payables/vendor-payments/calculation/vendor-payment-calculation.types.js'
import { prisma } from '../../src/config/database.js'

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
    otherAdjustment: acct('acc-other', '5999', 'Other Adjustment'),
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
    paymentReference: 'NEFT-001',
    adjustments: [],
    configuration: {
      baseCurrencyCode: 'INR',
      accounts: baseAccounts(),
      requireOpenPayableForSettlementPurpose: false,
    },
    ...overrides,
  }
}

function hasCode(issues: VendorPaymentValidationIssue[], code: string): boolean {
  return issues.some((i) => i.code === code)
}

describe('Finance Phase 4B2 — vendor payment calculation (pure sync)', () => {
  it('1. simple payment — settlement equals cash outflow, balanced preview', () => {
    const result = calculateVendorPaymentSync(baseInput())

    expect(result.calculationVersion).toBe(VENDOR_PAYMENT_CALCULATION_VERSION)
    expect(result.totals.paymentAmount).toBe('100000.0000')
    expect(result.totals.vendorSettlementAmount).toBe('100000.0000')
    expect(result.totals.cashOutflowAmount).toBe('100000.0000')
    expect(result.accountingPreview.isBalanced).toBe(true)
    expect(result.accountingPreview.isBaseBalanced).toBe(true)
    expect(result.accountingPreview.vendorPayableDebitAmount).toBe('100000.0000')
    expect(result.accountingPreview.paymentAccountCreditAmount).toBe('100000.0000')
    expect(result.openItemPreview.originalAmount).toBe('100000.0000')
    expect(result.openItemPreview.documentType).toBe('VENDOR_PAYMENT')
    expect(result.validation.isValid).toBe(true)
  })

  it('2. payment amount distinct from settlement and cash outflow', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        paymentAmount: '90000',
        adjustments: [
          {
            lineNumber: 1,
            adjustmentType: 'TDS',
            accountingRole: 'SETTLEMENT_CREDIT',
            description: 'TDS 194C',
            amount: '10000',
            sectionCode: '194C',
          },
          {
            lineNumber: 2,
            adjustmentType: 'BANK_CHARGE',
            accountingRole: 'PAYMENT_EXPENSE_DEBIT',
            description: 'NEFT charges',
            amount: '500',
          },
        ],
      }),
    )

    expect(result.totals.paymentAmount).toBe('90000.0000')
    expect(result.totals.vendorSettlementAmount).toBe('100000.0000')
    expect(result.totals.cashOutflowAmount).toBe('90500.0000')
    expect(result.totals.tdsAmount).toBe('10000.0000')
    expect(result.totals.bankChargeAmount).toBe('500.0000')
    expect(result.openItemPreview.originalAmount).toBe('100000.0000')
    expect(result.openItemPreview.originalAmount).not.toBe(result.totals.cashOutflowAmount)
  })

  it('3. vendor advance — DEBIT / VENDOR_ADVANCE open-item preview', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        paymentPurpose: 'ADVANCE',
        paymentAmount: '50000',
      }),
    )

    expect(result.validation.isValid).toBe(true)
    expect(result.totals.vendorSettlementAmount).toBe('50000.0000')
    expect(result.openItemPreview.documentType).toBe('VENDOR_ADVANCE')
    expect(result.openItemPreview.side).toBe('DEBIT')
    expect(result.accountingPreview.lines.find((l) => l.component === 'VENDOR_PAYABLE')?.debitAmount).toBe('50000.0000')
  })

  it('4. mixed payment excess settlement', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        paymentPurpose: 'MIXED',
        paymentAmount: '100000',
        configuration: {
          baseCurrencyCode: 'INR',
          accounts: baseAccounts(),
          vendorPositionOverride: {
            vendorCreditOutstanding: '80000.0000',
            vendorDebitOutstanding: '0.0000',
            netVendorPayable: '80000.0000',
            baseVendorCreditOutstanding: '80000.0000',
            baseVendorDebitOutstanding: '0.0000',
            baseNetVendorPayable: '80000.0000',
          },
        },
      }),
    )

    expect(result.paymentPosition.excessSettlementAmount).toBe('20000.0000')
    expect(result.validation.isValid).toBe(true)
    expect(result.openItemPreview.documentType).toBe('VENDOR_PAYMENT')
    expect(result.openItemPreview.originalAmount).toBe('100000.0000')
    expect(hasCode(result.validation.warnings, VENDOR_PAYMENT_CALC_CODES.UNALLOCATED_AFTER_POSTING)).toBe(true)
  })

  it('5. invoice settlement excess suggests MIXED', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        paymentPurpose: 'INVOICE_SETTLEMENT',
        paymentAmount: '100000',
        configuration: {
          baseCurrencyCode: 'INR',
          accounts: baseAccounts(),
          requireOpenPayableForSettlementPurpose: false,
          vendorPositionOverride: {
            vendorCreditOutstanding: '80000.0000',
            vendorDebitOutstanding: '0.0000',
            netVendorPayable: '80000.0000',
            baseVendorCreditOutstanding: '80000.0000',
            baseVendorDebitOutstanding: '0.0000',
            baseNetVendorPayable: '80000.0000',
          },
        },
      }),
    )

    expect(result.paymentPosition.excessSettlementAmount).toBe('20000.0000')
    expect(result.paymentPosition.suggestedPurpose).toBe('MIXED')
    expect(hasCode(result.validation.warnings, VENDOR_PAYMENT_CALC_CODES.SETTLEMENT_EXCEEDS_OUTSTANDING)).toBe(true)
    expect(hasCode(result.validation.warnings, VENDOR_PAYMENT_CALC_CODES.PURPOSE_MAY_BE_MIXED)).toBe(true)
  })

  it('6. foreign currency converts all components and balances base', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        currencyCode: 'USD',
        exchangeRate: '83.5',
        paymentAmount: '1000',
        adjustments: [
          {
            lineNumber: 1,
            adjustmentType: 'TDS',
            accountingRole: 'SETTLEMENT_CREDIT',
            description: 'TDS',
            amount: '100',
          },
          {
            lineNumber: 2,
            adjustmentType: 'BANK_CHARGE',
            accountingRole: 'PAYMENT_EXPENSE_DEBIT',
            description: 'Bank fee',
            amount: '5',
          },
        ],
        configuration: {
          baseCurrencyCode: 'INR',
          accounts: baseAccounts(),
          requireOpenPayableForSettlementPurpose: false,
        },
      }),
    )

    expect(result.baseTotals.basePaymentAmount).toBe('83500.0000')
    expect(result.baseTotals.baseTdsAmount).toBe('8350.0000')
    expect(result.baseTotals.baseBankChargeAmount).toBe('417.5000')
    expect(result.accountingPreview.isBaseBalanced).toBe(true)
    expect(result.accountingPreview.isBalanced).toBe(true)
  })

  it('7. base currency rejects non-unity exchange rate', () => {
    const result = calculateVendorPaymentSync(baseInput({ exchangeRate: '1.01' }))
    expect(hasCode(result.validation.errors, VENDOR_PAYMENT_CALC_CODES.BASE_CURRENCY_RATE_INVALID)).toBe(true)
  })

  it('8. cheque method requires cheque details', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        paymentMethod: 'CHEQUE',
        chequeNumber: null,
        chequeDate: null,
        configuration: {
          baseCurrencyCode: 'INR',
          accounts: baseAccounts(),
          requireChequeDetailsForCheque: true,
          requireOpenPayableForSettlementPurpose: false,
        },
      }),
    )
    expect(hasCode(result.validation.errors, VENDOR_PAYMENT_CALC_CODES.CHEQUE_DETAILS_REQUIRED)).toBe(true)
  })

  it('9. missing payment account blocks readiness', () => {
    const accounts = baseAccounts()
    delete accounts.paymentAccount
    const result = calculateVendorPaymentSync(
      baseInput({
        paymentAccountId: null,
        configuration: { baseCurrencyCode: 'INR', accounts, requireOpenPayableForSettlementPurpose: false },
      }),
    )
    expect(result.accountReadiness.isReady).toBe(false)
    expect(hasCode(result.validation.errors, VENDOR_PAYMENT_CALC_CODES.PAYMENT_ACCOUNT_MISSING)).toBe(true)
  })

  it('10. zero payment amount is invalid', () => {
    const result = calculateVendorPaymentSync(baseInput({ paymentAmount: '0' }))
    expect(hasCode(result.validation.errors, VENDOR_PAYMENT_CALC_CODES.AMOUNT_INVALID)).toBe(true)
  })

  it('11. determinism — identical snapshots across runs', () => {
    const input = baseInput({
      adjustments: [
        {
          lineNumber: 1,
          adjustmentType: 'DISCOUNT',
          accountingRole: 'SETTLEMENT_CREDIT',
          description: 'Early pay discount',
          amount: '2000',
        },
      ],
      paymentAmount: '98000',
    })
    const a = calculateVendorPaymentSync(input)
    const b = calculateVendorPaymentSync(input)
    expect(JSON.stringify(a.snapshot)).toBe(JSON.stringify(b.snapshot))
    expect(JSON.stringify(a.accountingPreview.lines)).toBe(JSON.stringify(b.accountingPreview.lines))
    expect(JSON.stringify(a.validation.errors)).toBe(JSON.stringify(b.validation.errors))
  })

  it('12. context legal entity mismatch throws', async () => {
    await expect(
      calculateVendorPayment(baseInput(), {
        legalEntityId: '00000000-0000-4000-8000-0000000000b2',
        tenantId: null,
      }),
    ).rejects.toMatchObject({ code: VENDOR_PAYMENT_CALC_CODES.CONTEXT_LEGAL_ENTITY_MISMATCH })
  })

  it('13. open-item amount equals vendor payable debit (bank charge excluded)', () => {
    const result = calculateVendorPaymentSync(
      baseInput({
        paymentAmount: '100000',
        adjustments: [
          {
            lineNumber: 1,
            adjustmentType: 'BANK_CHARGE',
            accountingRole: 'PAYMENT_EXPENSE_DEBIT',
            description: 'Charges',
            amount: '500',
          },
        ],
      }),
    )
    expect(result.openItemPreview.originalAmount).toBe(result.accountingPreview.vendorPayableDebitAmount)
    expect(result.openItemPreview.originalAmount).toBe(result.totals.vendorSettlementAmount)
    expect(result.totals.cashOutflowAmount).toBe('100500.0000')
  })
})

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

describe('Finance Phase 4B2 — side-effect free (live DB when available)', () => {
  it.skipIf(!dbAvailable)('calculation does not mutate payment / open-item / voucher tables', async () => {
    const countsBefore = await Promise.all([
      prisma.vendorPayment.count(),
      prisma.vendorPaymentAdjustmentLine.count(),
      prisma.payableOpenItem.count(),
      prisma.payableAllocationBatch.count(),
      prisma.postingEvent.count(),
      prisma.accountingVoucher.count(),
      prisma.generalLedgerEntry.count(),
    ])

    await calculateVendorPayment(baseInput({ tenantId: 'tenant-calc-test' }), {
      tenantId: 'tenant-calc-test',
      legalEntityId: baseInput().legalEntityId,
      includeVendorPosition: false,
    })

    const countsAfter = await Promise.all([
      prisma.vendorPayment.count(),
      prisma.vendorPaymentAdjustmentLine.count(),
      prisma.payableOpenItem.count(),
      prisma.payableAllocationBatch.count(),
      prisma.postingEvent.count(),
      prisma.accountingVoucher.count(),
      prisma.generalLedgerEntry.count(),
    ])

    expect(countsAfter).toEqual(countsBefore)
  })
})
