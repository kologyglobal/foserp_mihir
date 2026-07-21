import { describe, it, expect } from 'vitest'
import { prisma } from '../../src/config/database.js'
import { calculateVendorInvoice, calculateVendorInvoiceSync } from '../../src/modules/accounting/payables/vendor-invoices/calculation/vendor-invoice-calculation.service.js'
import { calculateVendorInvoiceAmounts } from '../../src/modules/accounting/payables/vendor-invoices/calculation/vendor-invoice-amounts.service.js'
import { assertBaseCurrencyRate } from '../../src/modules/accounting/payables/vendor-invoices/calculation/vendor-invoice-currency-calculator.service.js'
import { toDecimal } from '../../src/modules/accounting/shared/finance-decimal.js'
import { VENDOR_INVOICE_CALC_CODES } from '../../src/modules/accounting/payables/vendor-invoices/calculation/vendor-invoice-calculation.errors.js'
import type {
  VendorInvoiceCalculationAccountsOverride,
  VendorInvoiceCalculationInput,
  VendorInvoiceValidationIssue,
} from '../../src/modules/accounting/payables/vendor-invoices/calculation/vendor-invoice-calculation.types.js'

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

function acct(id: string, code: string, name: string): { id: string; code: string; name: string } {
  return { id, code, name }
}

function baseAccounts(): VendorInvoiceCalculationAccountsOverride {
  return {
    purchaseOrDebit: acct('acc-expense', '5100', 'Operating Expense'),
    vendorPayable: acct('acc-payable', '2100', 'Trade Payables'),
    inputCgst: acct('acc-cgst', '1461', 'Input CGST'),
    inputSgst: acct('acc-sgst', '1462', 'Input SGST'),
    inputIgst: acct('acc-igst', '1463', 'Input IGST'),
    inputCess: acct('acc-cess', '1464', 'Input Cess'),
    tdsPayable: acct('acc-tds', '2210', 'TDS Payable'),
    freight: acct('acc-freight', '5200', 'Freight Inward'),
    otherCharge: acct('acc-other-charge', '5300', 'Other Charges'),
    roundOff: acct('acc-round-off', '5900', 'Round Off'),
    rcmCgstPayable: acct('acc-rcm-cgst', '2420', 'RCM CGST Payable'),
    rcmSgstPayable: acct('acc-rcm-sgst', '2421', 'RCM SGST Payable'),
    rcmIgstPayable: acct('acc-rcm-igst', '2422', 'RCM IGST Payable'),
  }
}

function baseInput(overrides: Partial<VendorInvoiceCalculationInput> = {}): VendorInvoiceCalculationInput {
  return {
    legalEntityId: '00000000-0000-4000-8000-0000000000a1',
    companyStateCode: '27',
    placeOfSupply: '27',
    vendorId: 'vendor-a',
    taxTreatment: 'REGULAR',
    itcEligibility: 'ELIGIBLE',
    tdsRecognitionMode: 'NOT_APPLICABLE',
    currencyCode: 'INR',
    exchangeRate: '1',
    supplierInvoiceNumber: 'INV-001',
    configuration: { roundingMode: 'NONE', accounts: baseAccounts() },
    lines: [
      {
        lineNumber: 1,
        lineType: 'EXPENSE',
        description: 'Consulting',
        quantity: '1',
        unitPrice: '100000',
        gstRate: '18',
        debitAccountId: 'acc-expense',
      },
    ],
    ...overrides,
  }
}

function findWarningCode(warnings: VendorInvoiceValidationIssue[], code: string): boolean {
  return warnings.some((w) => w.code === code)
}

function findErrorCode(errors: VendorInvoiceValidationIssue[], code: string): boolean {
  return errors.some((e) => e.code === code)
}

describe('Finance Phase 4A2 — vendor invoice calculation (pure sync)', () => {
  it('1. basic intra-state expense line — CGST+SGST, balanced preview', () => {
    const result = calculateVendorInvoiceSync(baseInput())

    expect(result.totals.taxableAmount).toBe('100000.0000')
    expect(result.totals.inputCgstAmount).toBe('9000.0000')
    expect(result.totals.inputSgstAmount).toBe('9000.0000')
    expect(result.totals.inputIgstAmount).toBe('0.0000')
    expect(result.totals.invoiceGrandTotal).toBe('118000.0000')
    expect(result.totals.vendorPayableAmount).toBe('118000.0000')

    expect(result.accountingPreview.isBalanced).toBe(true)
    expect(result.accountingPreview.totalDebit).toBe('118000.0000')
    expect(result.accountingPreview.totalCredit).toBe('118000.0000')

    const lineDebit = result.accountingPreview.lines.find((l) => l.component === 'LINE_DEBIT')
    const inputTaxDebit = result.accountingPreview.lines.filter((l) => l.component === 'INPUT_CGST' || l.component === 'INPUT_SGST')
    const payableCredit = result.accountingPreview.lines.find((l) => l.component === 'VENDOR_PAYABLE')

    expect(lineDebit?.debitAmount).toBe('100000.0000')
    expect(inputTaxDebit.reduce((sum, l) => sum + Number(l.debitAmount), 0)).toBe(18000)
    expect(payableCredit?.creditAmount).toBe('118000.0000')
  })

  it('2. inter-state purchase — IGST only, no CGST/SGST', () => {
    const result = calculateVendorInvoiceSync(
      baseInput({ placeOfSupply: '29', supplyType: 'INTER_STATE' }),
    )

    expect(result.supplyType).toBe('INTER_STATE')
    expect(result.totals.inputIgstAmount).toBe('18000.0000')
    expect(result.totals.inputCgstAmount).toBe('0.0000')
    expect(result.totals.inputSgstAmount).toBe('0.0000')
    expect(result.totals.invoiceGrandTotal).toBe('118000.0000')
    expect(result.validation.isValid).toBe(true)
  })

  it('3. tax-inclusive line derives taxable and reconciles to the inclusive price', () => {
    const result = calculateVendorInvoiceSync(
      baseInput({
        lines: [
          {
            lineNumber: 1,
            lineType: 'EXPENSE',
            description: 'Inclusive consulting',
            quantity: '1',
            unitPrice: '1180',
            gstRate: '18',
            isTaxInclusive: true,
            debitAccountId: 'acc-expense',
          },
        ],
      }),
    )

    expect(result.lines[0]!.taxableAmount).toBe('1000.0000')
    expect(result.lines[0]!.lineTotal).toBe('1180.0000')
    expect(result.totals.invoiceGrandTotal).toBe('1180.0000')
    expect(findErrorCode(result.validation.errors, VENDOR_INVOICE_CALC_CODES.INCLUSIVE_TAX_MISMATCH)).toBe(false)
  })

  it('4. line percentage discount reduces taxable base before tax', () => {
    const result = calculateVendorInvoiceSync(
      baseInput({
        lines: [
          {
            lineNumber: 1,
            lineType: 'EXPENSE',
            description: 'Discounted line',
            quantity: '1',
            unitPrice: '1000',
            gstRate: '18',
            lineDiscountType: 'PERCENTAGE',
            lineDiscountValue: '10',
            debitAccountId: 'acc-expense',
          },
        ],
      }),
    )

    expect(result.lines[0]!.discountAmount).toBe('100.0000')
    expect(result.lines[0]!.taxableAmount).toBe('900.0000')
  })

  it('5. header AMOUNT discount allocates proportionally with residual on the last eligible line', () => {
    const result = calculateVendorInvoiceSync(
      baseInput({
        invoiceDiscountType: 'AMOUNT',
        invoiceDiscountValue: '10',
        lines: [
          { lineNumber: 1, lineType: 'EXPENSE', description: 'Line A', quantity: '1', unitPrice: '100', debitAccountId: 'acc-expense' },
          { lineNumber: 2, lineType: 'EXPENSE', description: 'Line B', quantity: '1', unitPrice: '300', debitAccountId: 'acc-expense' },
        ],
      }),
    )

    const [lineA, lineB] = result.lines
    expect(lineA!.discountAmount).toBe('2.5000')
    expect(lineB!.discountAmount).toBe('7.5000')
    expect(Number(lineA!.discountAmount) + Number(lineB!.discountAmount)).toBe(10)
  })

  it('6. non-taxed header freight adds to the grand total exactly once', () => {
    const result = calculateVendorInvoiceSync(baseInput({ freightAmount: '1000' }))

    expect(result.totals.freightAmount).toBe('1000.0000')
    expect(result.totals.freightTaxableAmount).toBe('0.0000')
    expect(result.totals.invoiceGrandTotal).toBe('119000.0000')
    expect(result.totals.vendorPayableAmount).toBe('119000.0000')

    const freightLines = result.accountingPreview.lines.filter((l) => l.component === 'FREIGHT')
    expect(freightLines).toHaveLength(1)
    expect(freightLines[0]!.debitAmount).toBe('1000.0000')
    expect(result.accountingPreview.isBalanced).toBe(true)
  })

  it('7. eligible ITC — full GST recoverable, excluded from the expense debit', () => {
    const result = calculateVendorInvoiceSync(baseInput({ itcEligibility: 'ELIGIBLE' }))

    expect(result.lines[0]!.recoverableTaxAmount).toBe('18000.0000')
    expect(result.lines[0]!.nonRecoverableTaxAmount).toBe('0.0000')

    const lineDebit = result.accountingPreview.lines.find((l) => l.component === 'LINE_DEBIT')
    expect(lineDebit?.debitAmount).toBe('100000.0000')
  })

  it('8. ineligible ITC — full GST non-recoverable, folded into the expense debit, no input tax preview lines', () => {
    const result = calculateVendorInvoiceSync(baseInput({ itcEligibility: 'INELIGIBLE' }))

    expect(result.lines[0]!.recoverableTaxAmount).toBe('0.0000')
    expect(result.lines[0]!.nonRecoverableTaxAmount).toBe('18000.0000')

    const lineDebit = result.accountingPreview.lines.find((l) => l.component === 'LINE_DEBIT')
    const inputTaxLines = result.accountingPreview.lines.filter((l) => l.component === 'INPUT_CGST' || l.component === 'INPUT_SGST')

    expect(lineDebit?.debitAmount).toBe('118000.0000')
    expect(inputTaxLines).toHaveLength(0)
    expect(result.accountingPreview.isBalanced).toBe(true)
  })

  it('9. partially eligible ITC splits recoverable/non-recoverable per itcEligiblePercent', () => {
    const result = calculateVendorInvoiceSync(
      baseInput({ itcEligibility: 'PARTIALLY_ELIGIBLE', itcEligiblePercent: '50' }),
    )

    expect(result.lines[0]!.recoverableTaxAmount).toBe('9000.0000')
    expect(result.lines[0]!.nonRecoverableTaxAmount).toBe('9000.0000')
    expect(result.accountingPreview.isBalanced).toBe(true)
  })

  it('10. TDS at invoice reduces vendor payable and posts a TDS payable credit', () => {
    const result = calculateVendorInvoiceSync(
      baseInput({ tdsRecognitionMode: 'AT_INVOICE', tdsRate: '10' }),
    )

    expect(result.totals.tdsBaseAmount).toBe('100000.0000')
    expect(result.totals.tdsAmount).toBe('10000.0000')
    expect(result.totals.vendorPayableAmount).toBe('108000.0000')

    const tdsCredit = result.accountingPreview.lines.find((l) => l.component === 'TDS_PAYABLE')
    const payableCredit = result.accountingPreview.lines.find((l) => l.component === 'VENDOR_PAYABLE')
    expect(tdsCredit?.creditAmount).toBe('10000.0000')
    expect(payableCredit?.creditAmount).toBe('108000.0000')
    expect(result.accountingPreview.isBalanced).toBe(true)
  })

  it('11. TDS at payment keeps posting amount zero — informational estimate only, no TDS credit line', () => {
    const result = calculateVendorInvoiceSync(
      baseInput({ tdsRecognitionMode: 'AT_PAYMENT', tdsRate: '10' }),
    )

    expect(result.totals.tdsAmount).toBe('0.0000')
    expect(result.totals.estimatedTdsAmount).toBe('10000.0000')
    expect(result.totals.vendorPayableAmount).toBe('118000.0000')

    const tdsCredit = result.accountingPreview.lines.find((l) => l.component === 'TDS_PAYABLE')
    expect(tdsCredit).toBeUndefined()
    expect(findWarningCode(result.validation.warnings, VENDOR_INVOICE_CALC_CODES.TDS_AT_PAYMENT_NOTICE)).toBe(true)
    expect(result.accountingPreview.isBalanced).toBe(true)
  })

  it('12. blank TDS rate under AT_INVOICE fails schema validation', () => {
    const result = calculateVendorInvoiceSync(
      baseInput({ tdsRecognitionMode: 'AT_INVOICE', tdsRate: '' }),
    )

    expect(result.validation.isValid).toBe(false)
    expect(
      result.validation.errors.some(
        (e) => e.code === VENDOR_INVOICE_CALC_CODES.VALIDATION_ERROR && e.field === 'tdsRate',
      ),
    ).toBe(true)
  })

  it('13. reverse charge excludes self-assessed tax from vendor payable and posts RCM payable credits', () => {
    const result = calculateVendorInvoiceSync(baseInput({ taxTreatment: 'REVERSE_CHARGE' }))

    expect(result.isReverseCharge).toBe(true)
    expect(result.totals.rcmCgstAmount).toBe('9000.0000')
    expect(result.totals.rcmSgstAmount).toBe('9000.0000')
    expect(result.totals.rcmTotalTaxAmount).toBe('18000.0000')
    expect(result.totals.vendorPayableAmount).toBe('100000.0000')

    const rcmCredits = result.accountingPreview.lines.filter((l) => l.component === 'RCM_CGST_PAYABLE' || l.component === 'RCM_SGST_PAYABLE')
    expect(rcmCredits).toHaveLength(2)
    expect(result.accountingPreview.isBalanced).toBe(true)
  })

  it('14. foreign currency converts base totals by the exchange rate; preview stays balanced on the transaction side', () => {
    const result = calculateVendorInvoiceSync(baseInput({ currencyCode: 'USD', exchangeRate: '1.5' }))

    expect(result.totals.invoiceGrandTotal).toBe('118000.0000')
    expect(result.baseTotals.invoiceGrandTotal).toBe('177000.0000')
    expect(result.baseTotals.vendorPayableAmount).toBe('177000.0000')
    expect(result.accountingPreview.isBalanced).toBe(true)
    expect(result.accountingPreview.totalDebit).toBe('118000.0000')
  })

  it('15. base-currency invoices must use an exchange rate of 1 (assertBaseCurrencyRate)', () => {
    // Not yet wired into the calculation pipeline (dead-code guard) — exercised directly here.
    const okErrors: VendorInvoiceValidationIssue[] = []
    assertBaseCurrencyRate('INR', 'INR', toDecimal('1'), okErrors)
    expect(okErrors).toHaveLength(0)

    const badErrors: VendorInvoiceValidationIssue[] = []
    assertBaseCurrencyRate('INR', 'INR', toDecimal('1.01'), badErrors)
    expect(findErrorCode(badErrors, VENDOR_INVOICE_CALC_CODES.BASE_CURRENCY_RATE_INVALID)).toBe(true)
  })

  it('16. calculation is deterministic across repeated runs of the same input', () => {
    const input = baseInput({ tdsRecognitionMode: 'AT_INVOICE', tdsRate: '10', freightAmount: '250' })
    const run1 = calculateVendorInvoiceSync(input)
    const run2 = calculateVendorInvoiceSync(input)

    const snapshot = (r: typeof run1) =>
      JSON.stringify({
        totals: r.totals,
        lines: r.lines,
        previewLines: r.accountingPreview.lines,
        codes: [...r.validation.errors, ...r.validation.warnings].map((i) => i.code),
      })

    expect(snapshot(run1)).toBe(snapshot(run2))
  })

  it('18. missing vendor payable account leaves account readiness and validation invalid', () => {
    const accounts = baseAccounts()
    delete accounts.vendorPayable

    const result = calculateVendorInvoiceSync(baseInput({ configuration: { roundingMode: 'NONE', accounts } }))

    expect(result.accountReadiness.isReady).toBe(false)
    expect(result.validation.isValid).toBe(false)
    expect(findErrorCode(result.validation.errors, VENDOR_INVOICE_CALC_CODES.ACCOUNT_NOT_CONFIGURED)).toBe(true)
  })

  it('19. NIL_RATED treatment computes zero tax — vendor payable equals taxable amount', () => {
    const result = calculateVendorInvoiceSync(baseInput({ taxTreatment: 'NIL_RATED' }))

    expect(result.totals.inputCgstAmount).toBe('0.0000')
    expect(result.totals.inputSgstAmount).toBe('0.0000')
    expect(result.totals.taxableAmount).toBe('100000.0000')
    expect(result.totals.vendorPayableAmount).toBe('100000.0000')
  })

  it('20. pending-review ITC treats tax as recoverable but raises a review warning', () => {
    const result = calculateVendorInvoiceSync(baseInput({ itcEligibility: 'PENDING_REVIEW' }))

    expect(result.lines[0]!.recoverableTaxAmount).toBe('18000.0000')
    expect(findWarningCode(result.validation.warnings, VENDOR_INVOICE_CALC_CODES.ITC_PENDING_REVIEW)).toBe(true)
  })
})

describe('Finance Phase 4A2 — vendor invoice amounts core (calculateVendorInvoiceAmounts)', () => {
  it('rejects negative unit price via line calculator validation', () => {
    const result = calculateVendorInvoiceAmounts(
      baseInput({
        lines: [
          { lineNumber: 1, lineType: 'EXPENSE', description: 'Bad price', quantity: '1', unitPrice: '-100' },
        ],
      }),
    )

    expect(findErrorCode(result.issues.errors, VENDOR_INVOICE_CALC_CODES.UNIT_PRICE_INVALID)).toBe(true)
  })
})

describe.skipIf(!dbAvailable)('Finance Phase 4A2 — vendor invoice calculation side effects (live DB)', () => {
  it('17. calculateVendorInvoice with detection/readiness/preview disabled never creates a vendor invoice row', async () => {
    const before = await prisma.vendorInvoice.count()

    const input = baseInput()
    await calculateVendorInvoice(input, {
      tenantId: '00000000-0000-4000-8000-0000000000ff',
      legalEntityId: input.legalEntityId,
      includeDuplicateDetection: false,
      includeAccountReadiness: false,
      includeAccountingPreview: false,
    })

    const after = await prisma.vendorInvoice.count()
    expect(after).toBe(before)
  })
})

describe('Finance Phase 4A2 — duplicate assessment placeholder (sync)', () => {
  it('emptyVendorInvoiceDuplicateAssessment via sync path is always NONE/non-blocking', () => {
    const result = calculateVendorInvoiceSync(baseInput())
    expect(result.duplicateAssessment.riskLevel).toBe('NONE')
    expect(result.duplicateAssessment.isBlocking).toBe(false)
  })
})
