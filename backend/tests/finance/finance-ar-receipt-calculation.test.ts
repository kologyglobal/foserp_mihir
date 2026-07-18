import { describe, it, expect } from 'vitest'
import { add, toDecimal } from '../../src/modules/accounting/shared/finance-decimal.js'
import { calculateCustomerReceipt } from '../../src/modules/accounting/receivables/receipts/calculation/customer-receipt-calculation.service.js'
import type { CustomerReceiptCalculationInput } from '../../src/modules/accounting/receivables/receipts/calculation/customer-receipt-calculation.types.js'
import { RECEIPT_ERROR_CODES, RECEIPT_WARNING_CODES } from '../../src/modules/accounting/receivables/receipts/calculation/customer-receipt-calculation.errors.js'

const TENANT = '11111111-1111-4111-8111-111111111111'
const LE = '22222222-2222-4222-8222-222222222222'
const CUSTOMER = '33333333-3333-4333-8333-333333333333'
const BANK = '44444444-4444-4444-8444-444444444444'
const AR = '55555555-5555-4555-8555-555555555555'
const TDS_ACCT = '66666666-6666-4666-8666-666666666666'
const CHARGE_ACCT = '77777777-7777-4777-8777-777777777777'
const OTHER_ACCT = '88888888-8888-4888-8888-888888888888'
const INV = '99999999-9999-4999-8999-999999999999'
const OI = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const INV2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const OI2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function baseInput(overrides: Partial<CustomerReceiptCalculationInput> = {}): CustomerReceiptCalculationInput {
  return {
    tenantId: TENANT,
    legalEntityId: LE,
    customerId: CUSTOMER,
    receiptDate: '2026-06-15',
    postingDate: '2026-06-15',
    paymentMethod: 'BANK_TRANSFER',
    currencyCode: 'INR',
    exchangeRate: '1',
    bankCashAmount: '100000.0000',
    bankCashAccountId: BANK,
    customerReceivableAccountId: AR,
    bankReference: 'NEFT-001',
    ...overrides,
  }
}

describe('Finance Phase 3B2 — customer receipt calculation', () => {
  it('keeps 0.1 + 0.2 exact via Decimal', () => {
    expect(add('0.1', '0.2').toFixed(4)).toBe('0.3000')
  })

  it('computes simple bank receipt: bank = gross = allocatable', () => {
    const result = calculateCustomerReceipt(baseInput())
    expect(result.valid).toBe(true)
    expect(result.bankCashAmount).toBe('100000.0000')
    expect(result.customerTdsAmount).toBe('0.0000')
    expect(result.bankChargeAmount).toBe('0.0000')
    expect(result.otherDeductionAmount).toBe('0.0000')
    expect(result.grossReceiptAmount).toBe('100000.0000')
    expect(result.allocatableAmount).toBe('100000.0000')
    expect(result.proposedAllocatedAmount).toBe('0.0000')
    expect(result.unallocatedAmount).toBe('100000.0000')
    expect(result.postingPreview.balanced).toBe(true)
    expect(result.postingPreview.totalDebit).toBe('100000.0000')
    expect(result.postingPreview.totalCredit).toBe('100000.0000')
    expect(result.postingPreview.creditLines[0]?.partyType).toBe('CUSTOMER')
    expect(result.postingPreview.creditLines[0]?.partyId).toBe(CUSTOMER)
  })

  it('computes TDS amount mode: bank 98000 + TDS 2000 = gross 100000', () => {
    const result = calculateCustomerReceipt(
      baseInput({
        bankCashAmount: '98000',
        customerTds: { mode: 'AMOUNT', value: '2000', accountId: TDS_ACCT, sectionCode: '194C' },
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.bankCashAmount).toBe('98000.0000')
    expect(result.customerTdsAmount).toBe('2000.0000')
    expect(result.grossReceiptAmount).toBe('100000.0000')
    expect(result.allocatableAmount).toBe('100000.0000')
    expect(result.postingPreview.debitLines.some((l) => l.accountRole === 'TDS_RECEIVABLE')).toBe(true)
    expect(result.postingPreview.balanced).toBe(true)
  })

  it('computes TDS percentage mode from user-supplied base', () => {
    const result = calculateCustomerReceipt(
      baseInput({
        bankCashAmount: '98000',
        customerTds: {
          mode: 'PERCENTAGE',
          value: '2',
          calculationBase: '100000',
          accountId: TDS_ACCT,
          sectionCode: '194C',
        },
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.customerTdsAmount).toBe('2000.0000')
    expect(result.grossReceiptAmount).toBe('100000.0000')
    expect(result.warnings.some((w) => w.code === RECEIPT_WARNING_CODES.CUSTOMER_TDS_BASE_USER_SUPPLIED)).toBe(true)
  })

  it('rejects negative TDS and missing percentage base', () => {
    const neg = calculateCustomerReceipt(
      baseInput({ customerTds: { mode: 'AMOUNT', value: '-1', accountId: TDS_ACCT } }),
    )
    expect(neg.valid).toBe(false)
    expect(
      neg.errors.some(
        (e) =>
          e.code === RECEIPT_ERROR_CODES.CUSTOMER_TDS_AMOUNT_INVALID || e.code === 'VALIDATION_ERROR',
      ),
    ).toBe(true)

    const noBase = calculateCustomerReceipt(
      baseInput({ customerTds: { mode: 'PERCENTAGE', value: '2', accountId: TDS_ACCT } }),
    )
    expect(noBase.valid).toBe(false)
    expect(noBase.errors.some((e) => e.code === RECEIPT_ERROR_CODES.CUSTOMER_TDS_BASE_REQUIRED)).toBe(true)
  })

  it('rejects TDS percentage above maximum', () => {
    const result = calculateCustomerReceipt(
      baseInput({
        customerTds: { mode: 'PERCENTAGE', value: '150', calculationBase: '100000', accountId: TDS_ACCT },
      }),
      { maxTdsPercentage: '100' },
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === RECEIPT_ERROR_CODES.CUSTOMER_TDS_PERCENTAGE_INVALID)).toBe(true)
  })

  it('allows zero TDS without requiring TDS account in pure calc', () => {
    const result = calculateCustomerReceipt(baseInput({ customerTds: { mode: 'NONE' } }))
    expect(result.valid).toBe(true)
    expect(result.customerTdsAmount).toBe('0.0000')
  })

  it('includes bank charges in gross settlement', () => {
    const result = calculateCustomerReceipt(
      baseInput({
        bankCashAmount: '99500',
        bankCharges: [{ description: 'NEFT fee', amount: '500', accountId: CHARGE_ACCT }],
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.bankChargeAmount).toBe('500.0000')
    expect(result.grossReceiptAmount).toBe('100000.0000')
    expect(result.allocatableAmount).toBe('100000.0000')
    expect(result.postingPreview.balanced).toBe(true)
  })

  it('sums multiple bank charges and rejects negative', () => {
    const ok = calculateCustomerReceipt(
      baseInput({
        bankCashAmount: '99000',
        bankCharges: [
          { description: 'Fee A', amount: '400', accountId: CHARGE_ACCT },
          { description: 'Fee B', amount: '600', accountId: CHARGE_ACCT },
        ],
      }),
    )
    expect(ok.bankChargeAmount).toBe('1000.0000')
    expect(ok.grossReceiptAmount).toBe('100000.0000')

    const bad = calculateCustomerReceipt(
      baseInput({
        bankCharges: [{ description: 'Bad', amount: '0', accountId: CHARGE_ACCT }],
      }),
    )
    expect(bad.valid).toBe(false)
    expect(bad.errors.some((e) => e.code === RECEIPT_ERROR_CODES.BANK_CHARGE_AMOUNT_INVALID)).toBe(true)
  })

  it('calculates other deductions and requires account + description', () => {
    const ok = calculateCustomerReceipt(
      baseInput({
        bankCashAmount: '99000',
        otherDeductions: [
          { code: 'SHORT', description: 'Short payment', amount: '1000', accountId: OTHER_ACCT },
        ],
      }),
    )
    expect(ok.valid).toBe(true)
    expect(ok.otherDeductionAmount).toBe('1000.0000')
    expect(ok.grossReceiptAmount).toBe('100000.0000')
    expect(ok.warnings.some((w) => w.code === RECEIPT_WARNING_CODES.OTHER_DEDUCTION_REVIEW_REQUIRED)).toBe(true)

    const missingAcct = calculateCustomerReceipt(
      baseInput({
        bankCashAmount: '99000',
        otherDeductions: [{ code: 'SHORT', description: 'Short', amount: '1000' }],
      }),
    )
    expect(missingAcct.valid).toBe(false)
    expect(missingAcct.errors.some((e) => e.code === RECEIPT_ERROR_CODES.OTHER_DEDUCTION_ACCOUNT_MISSING)).toBe(true)
  })

  it('preserves gross invariant across combined components', () => {
    const result = calculateCustomerReceipt(
      baseInput({
        bankCashAmount: '97000',
        customerTds: { mode: 'AMOUNT', value: '2000', accountId: TDS_ACCT, sectionCode: '194Q' },
        bankCharges: [{ description: 'Fee', amount: '500', accountId: CHARGE_ACCT }],
        otherDeductions: [{ code: 'ADJ', description: 'Adj', amount: '500', accountId: OTHER_ACCT }],
      }),
    )
    const recomputed = add(
      add(result.bankCashAmount, result.customerTdsAmount),
      add(result.bankChargeAmount, result.otherDeductionAmount),
    )
    expect(recomputed.toFixed(4)).toBe(result.grossReceiptAmount)
    expect(result.grossReceiptAmount).toBe('100000.0000')
    expect(result.postingPreview.balanced).toBe(true)
    expect(result.postingPreview.totalCredit).toBe(result.grossReceiptAmount)
  })

  it('rejects zero/negative bank amount', () => {
    const zero = calculateCustomerReceipt(baseInput({ bankCashAmount: '0' }))
    expect(zero.valid).toBe(false)
    expect(zero.errors.some((e) => e.code === RECEIPT_ERROR_CODES.CUSTOMER_RECEIPT_BANK_AMOUNT_INVALID)).toBe(true)

    const neg = calculateCustomerReceipt(baseInput({ bankCashAmount: '-100' }))
    expect(neg.valid).toBe(false)
    expect(
      neg.errors.some(
        (e) =>
          e.code === RECEIPT_ERROR_CODES.CUSTOMER_RECEIPT_BANK_AMOUNT_INVALID ||
          e.code === 'VALIDATION_ERROR',
      ),
    ).toBe(true)
  })

  it('computes proposed allocations and unallocated without mutating anything', () => {
    const result = calculateCustomerReceipt(
      baseInput({
        proposedAllocations: [
          { invoiceId: INV, invoiceOpenItemId: OI, allocationAmount: '40000' },
          { invoiceId: INV2, invoiceOpenItemId: OI2, allocationAmount: '30000' },
        ],
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.proposedAllocatedAmount).toBe('70000.0000')
    expect(result.unallocatedAmount).toBe('30000.0000')
    expect(result.warnings.some((w) => w.code === RECEIPT_WARNING_CODES.UNALLOCATED_RECEIPT_REMAINS)).toBe(true)
  })

  it('rejects proposed allocations exceeding receivable', () => {
    const result = calculateCustomerReceipt(
      baseInput({
        proposedAllocations: [
          { invoiceId: INV, invoiceOpenItemId: OI, allocationAmount: '150000' },
        ],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === RECEIPT_ERROR_CODES.RECEIPT_ALLOCATION_EXCEEDS_RECEIPT)).toBe(true)
  })

  it('combines duplicate open-item proposals with warning', () => {
    const result = calculateCustomerReceipt(
      baseInput({
        proposedAllocations: [
          { invoiceId: INV, invoiceOpenItemId: OI, allocationAmount: '10000' },
          { invoiceId: INV, invoiceOpenItemId: OI, allocationAmount: '15000' },
        ],
      }),
    )
    expect(result.proposedAllocatedAmount).toBe('25000.0000')
    expect(result.warnings.some((w) => w.code === RECEIPT_ERROR_CODES.RECEIPT_ALLOCATION_DUPLICATE)).toBe(true)
  })

  it('applies base currency rate = 1 and converts foreign amounts', () => {
    const inr = calculateCustomerReceipt(baseInput({ currencyCode: 'INR', exchangeRate: '1' }))
    expect(inr.exchangeRate).toBe('1.00000000')
    expect(inr.baseGrossReceiptAmount).toBe(inr.grossReceiptAmount)

    const usd = calculateCustomerReceipt(
      baseInput({
        currencyCode: 'USD',
        exchangeRate: '83.25000000',
        bankCashAmount: '1000',
      }),
      { multiCurrencyEnabled: true, baseCurrencyCode: 'INR' },
    )
    expect(usd.valid).toBe(true)
    expect(usd.baseBankCashAmount).toBe(toDecimal('1000').mul('83.25000000').toFixed(4))
    expect(usd.baseGrossReceiptAmount).toBe(usd.baseBankCashAmount)
  })

  it('rejects foreign currency when multi-currency disabled', () => {
    const result = calculateCustomerReceipt(
      baseInput({ currencyCode: 'USD', exchangeRate: '83' }),
      { multiCurrencyEnabled: false, baseCurrencyCode: 'INR' },
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === RECEIPT_ERROR_CODES.RECEIPT_MULTI_CURRENCY_DISABLED)).toBe(true)
  })

  it('rejects zero/negative exchange rate for foreign currency', () => {
    const result = calculateCustomerReceipt(
      baseInput({ currencyCode: 'USD', exchangeRate: '0' }),
      { multiCurrencyEnabled: true },
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === RECEIPT_ERROR_CODES.RECEIPT_EXCHANGE_RATE_INVALID)).toBe(true)
  })

  it('preserves four-decimal amounts and eight-decimal rates', () => {
    const result = calculateCustomerReceipt(
      baseInput({
        bankCashAmount: '12345.6789',
        currencyCode: 'USD',
        exchangeRate: '82.12345678',
      }),
      { multiCurrencyEnabled: true },
    )
    expect(result.bankCashAmount).toBe('12345.6789')
    expect(result.exchangeRate).toBe('82.12345678')
  })
})
