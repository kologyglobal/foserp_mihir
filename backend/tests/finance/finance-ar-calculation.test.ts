import { describe, it, expect } from 'vitest'
import { add, toDecimal } from '../../src/modules/accounting/shared/finance-decimal.js'
import { calculateSalesInvoice } from '../../src/modules/accounting/receivables/calculation/sales-invoice-calculation.service.js'
import type { SalesInvoiceCalculationInput } from '../../src/modules/accounting/receivables/calculation/sales-invoice-calculation.types.js'

const LE_ID = '00000000-0000-4000-8000-000000000001'

function baseInput(overrides: Partial<SalesInvoiceCalculationInput> = {}): SalesInvoiceCalculationInput {
  return {
    legalEntityId: LE_ID,
    legalEntityStateCode: '27',
    placeOfSupply: '27',
    taxTreatment: 'REGISTERED',
    supplyType: 'INTRA_STATE',
    currencyCode: 'INR',
    exchangeRate: '1',
    roundingMode: 'NONE',
    lines: [
      {
        lineNumber: 1,
        quantity: '10',
        unitPrice: '100',
        gstRate: '18',
      },
    ],
    ...overrides,
  }
}

describe('Finance Phase 3A2 — sales invoice calculation', () => {
  it('computes intra-state GST split (9+9) and grand total', () => {
    const result = calculateSalesInvoice(baseInput())
    expect(result.valid).toBe(true)
    expect(result.supplyType).toBe('INTRA_STATE')
    expect(result.lines[0]!.cgstRate).toBe('9.0000')
    expect(result.lines[0]!.sgstRate).toBe('9.0000')
    expect(result.lines[0]!.igstRate).toBe('0.0000')
    expect(result.lines[0]!.taxableAmount).toBe('1000.0000')
    expect(result.lines[0]!.cgstAmount).toBe('90.0000')
    expect(result.lines[0]!.sgstAmount).toBe('90.0000')
    expect(result.totalAmount).toBe('1180.0000')
    expect(result.baseTotalAmount).toBe('1180.0000')
  })

  it('computes inter-state IGST only', () => {
    const result = calculateSalesInvoice(
      baseInput({
        legalEntityStateCode: '27',
        placeOfSupply: '29',
        supplyType: 'INTER_STATE',
        lines: [{ lineNumber: 1, quantity: '1', unitPrice: '1000', gstRate: '18' }],
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.lines[0]!.igstRate).toBe('18.0000')
    expect(result.lines[0]!.igstAmount).toBe('180.0000')
    expect(result.totalAmount).toBe('1180.0000')
  })

  it('allocates invoice discount proportionally with remainder on last eligible line', () => {
    const result = calculateSalesInvoice(
      baseInput({
        lines: [
          { lineNumber: 1, quantity: '1', unitPrice: '100', gstRate: '18' },
          { lineNumber: 2, quantity: '1', unitPrice: '300', gstRate: '18' },
        ],
        invoiceDiscountType: 'AMOUNT',
        invoiceDiscountValue: '10',
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.invoiceDiscountAmount).toBe('10.0000')
    const alloc1 = toDecimal(result.lines[0]!.allocatedInvoiceDiscount)
    const alloc2 = toDecimal(result.lines[1]!.allocatedInvoiceDiscount)
    expect(alloc1.add(alloc2).toFixed(4)).toBe('10.0000')
    expect(alloc2.gt(alloc1)).toBe(true)
  })

  it('applies line percentage discount before invoice discount', () => {
    const result = calculateSalesInvoice(
      baseInput({
        lines: [
          {
            lineNumber: 1,
            quantity: '2',
            unitPrice: '500',
            gstRate: '18',
            lineDiscountType: 'PERCENTAGE',
            lineDiscountValue: '10',
          },
        ],
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.lineDiscountTotal).toBe('100.0000')
    expect(result.lines[0]!.taxableAmount).toBe('900.0000')
    expect(result.totalAmount).toBe('1062.0000')
  })

  it('derives taxable from tax-inclusive pricing', () => {
    const result = calculateSalesInvoice(
      baseInput({
        lines: [
          {
            lineNumber: 1,
            quantity: '1',
            unitPrice: '1180',
            gstRate: '18',
            isTaxInclusive: true,
          },
        ],
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.lines[0]!.taxableAmount).toBe('1000.0000')
    expect(result.lines[0]!.lineTotal).toBe('1180.0000')
    expect(result.totalAmount).toBe('1180.0000')
  })

  it('adds non-taxable freight and legacy other charges before rounding', () => {
    const result = calculateSalesInvoice(
      baseInput({
        freightMode: 'NON_TAXABLE',
        freightAmount: '50',
        otherChargesAmount: '25',
        lines: [{ lineNumber: 1, quantity: '1', unitPrice: '100', gstRate: '18' }],
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.freightAmount).toBe('50.0000')
    expect(result.freightTaxableAmount).toBe('0.0000')
    expect(result.otherChargesAmount).toBe('25.0000')
    expect(result.cgstAmount).toBe('9.0000')
    expect(result.totalAmount).toBe('193.0000')
  })

  it('applies taxable intra-state freight with GST in totals', () => {
    const result = calculateSalesInvoice(
      baseInput({
        freightMode: 'TAXABLE',
        freightAmount: '100',
        freightTaxRate: '18',
        lines: [{ lineNumber: 1, quantity: '1', unitPrice: '1000', gstRate: '18' }],
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.freightTaxableAmount).toBe('100.0000')
    expect(result.freightCgstAmount).toBe('9.0000')
    expect(result.freightSgstAmount).toBe('9.0000')
    expect(result.cgstAmount).toBe('99.0000')
    expect(result.sgstAmount).toBe('99.0000')
    expect(result.taxableAmount).toBe('1100.0000')
    expect(result.totalAmount).toBe('1298.0000')
  })

  it('applies taxable inter-state freight with IGST', () => {
    const result = calculateSalesInvoice(
      baseInput({
        legalEntityStateCode: '27',
        placeOfSupply: '29',
        supplyType: 'INTER_STATE',
        freightMode: 'TAXABLE',
        freightAmount: '100',
        freightTaxRate: '18',
        lines: [{ lineNumber: 1, quantity: '1', unitPrice: '1000', gstRate: '18' }],
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.freightIgstAmount).toBe('18.0000')
    expect(result.igstAmount).toBe('198.0000')
    expect(result.totalAmount).toBe('1298.0000')
  })

  it('handles multiple taxable and non-taxable other charges', () => {
    const result = calculateSalesInvoice(
      baseInput({
        lines: [{ lineNumber: 1, quantity: '1', unitPrice: '100', gstRate: '18' }],
        otherCharges: [
          {
            code: 'PACK',
            description: 'Packing',
            amount: '50',
            taxRate: '18',
            includeInTaxableValue: true,
          },
          {
            code: 'INS',
            description: 'Insurance',
            amount: '20',
            includeInTaxableValue: false,
          },
        ],
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.otherChargesAmount).toBe('70.0000')
    expect(result.otherChargesTaxableAmount).toBe('50.0000')
    expect(result.otherChargesCgstAmount).toBe('4.5000')
    expect(result.otherChargesSgstAmount).toBe('4.5000')
    expect(result.totalAmount).toBe('197.0000')
  })

  it('rejects negative freight', () => {
    const result = calculateSalesInvoice(
      baseInput({
        freightAmount: '-10',
        lines: [{ lineNumber: 1, quantity: '1', unitPrice: '100', gstRate: '18' }],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVOICE_FREIGHT_INVALID')).toBe(true)
  })

  it('applies NEAREST_UNIT rounding', () => {
    const result = calculateSalesInvoice(
      baseInput({
        roundingMode: 'NEAREST_UNIT',
        lines: [{ lineNumber: 1, quantity: '1', unitPrice: '100.40', gstRate: '18' }],
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.totalAmount).toBe('118.0000')
    expect(result.roundOffAmount).toBe('-0.4720')
  })

  it('applies NEAREST_0_05 rounding', () => {
    const result = calculateSalesInvoice(
      baseInput({
        roundingMode: 'NEAREST_0_05',
        lines: [{ lineNumber: 1, quantity: '1', unitPrice: '100.33', gstRate: '18' }],
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.totalAmount).toBe('118.4000')
  })

  it('accepts manual rounding within tolerance', () => {
    const result = calculateSalesInvoice(
      baseInput({
        roundingMode: 'MANUAL',
        manualRoundOff: '0.50',
        roundingTolerance: '1.00',
        lines: [{ lineNumber: 1, quantity: '1', unitPrice: '100', gstRate: '18' }],
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.roundOffAmount).toBe('0.5000')
    expect(result.totalAmount).toBe('118.5000')
  })

  it('rejects manual rounding outside tolerance', () => {
    const result = calculateSalesInvoice(
      baseInput({
        roundingMode: 'MANUAL',
        manualRoundOff: '2.00',
        roundingTolerance: '1.00',
        lines: [{ lineNumber: 1, quantity: '1', unitPrice: '100', gstRate: '18' }],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'ROUND_OFF_EXCEEDS_TOLERANCE')).toBe(true)
  })

  it('computes cess on taxable amount', () => {
    const result = calculateSalesInvoice(
      baseInput({
        lines: [{ lineNumber: 1, quantity: '1', unitPrice: '1000', gstRate: '18', cessRate: '1' }],
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.cessAmount).toBe('10.0000')
    expect(result.totalAmount).toBe('1190.0000')
  })

  it('builds multi-rate tax summary including charge slices', () => {
    const result = calculateSalesInvoice(
      baseInput({
        freightMode: 'TAXABLE',
        freightAmount: '100',
        freightTaxRate: '5',
        lines: [
          { lineNumber: 1, quantity: '1', unitPrice: '100', gstRate: '5' },
          { lineNumber: 2, quantity: '1', unitPrice: '100', gstRate: '18' },
        ],
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.taxSummary.length).toBeGreaterThanOrEqual(2)
  })

  it('flags supply type mismatch', () => {
    const result = calculateSalesInvoice(
      baseInput({
        legalEntityStateCode: '27',
        placeOfSupply: '29',
        supplyType: 'INTRA_STATE',
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'SUPPLY_TYPE_MISMATCH')).toBe(true)
  })

  it('warns on custom GST rate', () => {
    const result = calculateSalesInvoice(
      baseInput({
        lines: [{ lineNumber: 1, quantity: '1', unitPrice: '100', gstRate: '15' }],
      }),
    )
    expect(result.warnings.some((w) => w.code === 'CUSTOM_TAX_RATE_USED')).toBe(true)
  })

  it('errors on invalid GST rate', () => {
    const result = calculateSalesInvoice(
      baseInput({
        lines: [{ lineNumber: 1, quantity: '1', unitPrice: '100', gstRate: '150' }],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVOICE_TAX_RATE_INVALID')).toBe(true)
  })

  it('rejects zero quantity', () => {
    const result = calculateSalesInvoice(
      baseInput({
        lines: [{ lineNumber: 1, quantity: '0', unitPrice: '100', gstRate: '18' }],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVOICE_QUANTITY_INVALID')).toBe(true)
  })

  it('rejects line discount above gross', () => {
    const result = calculateSalesInvoice(
      baseInput({
        lines: [
          {
            lineNumber: 1,
            quantity: '1',
            unitPrice: '100',
            gstRate: '18',
            lineDiscountType: 'AMOUNT',
            lineDiscountValue: '150',
          },
        ],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVOICE_LINE_DISCOUNT_INVALID')).toBe(true)
  })

  it('rejects invoice discount above eligible value', () => {
    const result = calculateSalesInvoice(
      baseInput({
        invoiceDiscountType: 'AMOUNT',
        invoiceDiscountValue: '5000',
        lines: [{ lineNumber: 1, quantity: '1', unitPrice: '100', gstRate: '18' }],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVOICE_DISCOUNT_EXCEEDS_VALUE')).toBe(true)
  })

  it('adds decimals exactly via finance-decimal', () => {
    expect(add('0.1', '0.2').toFixed(4)).toBe('0.3000')
  })

  it('maintains grand total invariant', () => {
    const result = calculateSalesInvoice(
      baseInput({
        roundingMode: 'NEAREST_0_05',
        freightMode: 'TAXABLE',
        freightAmount: '10.33',
        freightTaxRate: '12',
        invoiceDiscountType: 'PERCENTAGE',
        invoiceDiscountValue: '5',
        lines: [
          { lineNumber: 1, quantity: '3.5', unitPrice: '99.99', gstRate: '12', cessRate: '0.5' },
          { lineNumber: 2, quantity: '2', unitPrice: '250', gstRate: '18' },
        ],
      }),
    )
    expect(result.errors.some((e) => e.code === 'INVOICE_TOTAL_CALCULATION_INVALID')).toBe(false)
  })

  it('zeroes GST for export without tax', () => {
    const result = calculateSalesInvoice(
      baseInput({
        taxTreatment: 'EXPORT_WITHOUT_TAX',
        supplyType: 'EXPORT',
        placeOfSupply: '96',
        lines: [{ lineNumber: 1, quantity: '1', unitPrice: '1000', gstRate: '18' }],
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.totalTaxAmount).toBe('0.0000')
    expect(result.totalAmount).toBe('1000.0000')
  })
})
