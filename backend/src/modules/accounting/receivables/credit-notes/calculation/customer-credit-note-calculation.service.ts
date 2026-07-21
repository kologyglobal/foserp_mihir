import { convertToBase, formatForPersistence, roundQuantity, sumDecimals, toDecimal } from '../../../shared/finance-decimal.js'
import type { CustomerCreditNoteCalculation, CreditNoteLineCalculation } from '../customer-credit-note.types.js'

export interface CreditNoteCalculationSourceLine {
  id?: string | null
  itemId?: string | null
  itemCodeSnapshot?: string | null
  itemNameSnapshot?: string | null
  hsnCodeSnapshot?: string | null
  uomSnapshot?: string | null
  description?: string | null
  quantity: string
  unitRate: string
  grossAmount: string
  discountAmount: string
  taxableAmount: string
  cgstRate: string
  cgstAmount: string
  sgstRate: string
  sgstAmount: string
  igstRate: string
  igstAmount: string
  cessRate: string
  cessAmount: string
  lineTotal: string
  revenueAccountId?: string | null
  costCentreId?: string | null
}

export interface CreditNoteCalculationInputLine {
  lineNumber: number
  adjustmentMode: 'FULL_LINE' | 'QUANTITY' | 'VALUE' | 'RATE' | 'TAX_ONLY' | 'FULL_INVOICE'
  originalInvoiceLineId?: string | null
  quantity?: string
  value?: string
  revisedUnitRate?: string | null
  source: CreditNoteCalculationSourceLine
  revenueReversalAccountId?: string | null
  costCentreId?: string | null
}

export interface CreditNoteCalculationInput {
  exchangeRate: string
  freightAmount?: string
  otherChargesAmount?: string
  roundOffAmount?: string
  lines: CreditNoteCalculationInputLine[]
}

function ratioAmount(amount: string, ratio: import('@prisma/client').Prisma.Decimal): string {
  return formatForPersistence(toDecimal(amount).mul(ratio))
}

export function calculateCustomerCreditNote(input: CreditNoteCalculationInput): CustomerCreditNoteCalculation {
  const errors: Array<{ field: string; message: string }> = []
  const lines: CreditNoteLineCalculation[] = input.lines.map((line) => {
    const source = line.source
    const originalQty = toDecimal(source.quantity)
    let quantity = originalQty
    let ratio = toDecimal(1)
    let taxable = toDecimal(source.taxableAmount)

    if (line.adjustmentMode === 'QUANTITY') {
      quantity = toDecimal(line.quantity ?? '0')
      if (quantity.lte(0) || quantity.gt(originalQty)) {
        errors.push({ field: `lines.${line.lineNumber}.quantity`, message: 'Quantity must be positive and not exceed invoice quantity' })
      }
      ratio = originalQty.isZero() ? toDecimal(0) : quantity.div(originalQty)
      taxable = toDecimal(source.taxableAmount).mul(ratio)
    } else if (line.adjustmentMode === 'VALUE') {
      taxable = toDecimal(line.value ?? '0')
      if (taxable.lte(0) || taxable.gt(toDecimal(source.taxableAmount))) {
        errors.push({ field: `lines.${line.lineNumber}.value`, message: 'Value must be positive and not exceed invoice taxable value' })
      }
      ratio = toDecimal(source.taxableAmount).isZero() ? toDecimal(0) : taxable.div(source.taxableAmount)
      quantity = originalQty.mul(ratio)
    } else if (line.adjustmentMode === 'RATE') {
      const revised = toDecimal(line.revisedUnitRate ?? source.unitRate)
      if (revised.lt(0) || revised.gte(toDecimal(source.unitRate))) {
        errors.push({ field: `lines.${line.lineNumber}.revisedUnitRate`, message: 'Revised rate must be lower than original rate' })
      }
      quantity = line.quantity ? toDecimal(line.quantity) : originalQty
      taxable = toDecimal(source.unitRate).sub(revised).mul(quantity)
      ratio = toDecimal(source.taxableAmount).isZero() ? toDecimal(0) : taxable.div(source.taxableAmount)
    } else if (line.adjustmentMode === 'TAX_ONLY') {
      taxable = toDecimal(0)
      if (line.value) {
        ratio = toDecimal(source.lineTotal).isZero() ? toDecimal(0) : toDecimal(line.value).div(source.lineTotal)
      }
    }

    const taxRatio = line.adjustmentMode === 'TAX_ONLY' ? ratio : (
      toDecimal(source.taxableAmount).isZero() ? ratio : taxable.div(source.taxableAmount)
    )
    const gross = line.adjustmentMode === 'TAX_ONLY' ? '0' : ratioAmount(source.grossAmount, ratio)
    const discount = line.adjustmentMode === 'TAX_ONLY' ? '0' : ratioAmount(source.discountAmount, ratio)
    const cgst = ratioAmount(source.cgstAmount, taxRatio)
    const sgst = ratioAmount(source.sgstAmount, taxRatio)
    const igst = ratioAmount(source.igstAmount, taxRatio)
    const cess = ratioAmount(source.cessAmount, taxRatio)
    const taxableString = formatForPersistence(taxable)
    const total = sumDecimals([taxableString, cgst, sgst, igst, cess])

    return {
      lineNumber: line.lineNumber,
      originalInvoiceLineId: line.originalInvoiceLineId ?? source.id ?? null,
      adjustmentMode: line.adjustmentMode,
      itemId: source.itemId ?? null,
      itemCodeSnapshot: source.itemCodeSnapshot ?? null,
      itemNameSnapshot: source.itemNameSnapshot ?? null,
      hsnCodeSnapshot: source.hsnCodeSnapshot ?? null,
      uomSnapshot: source.uomSnapshot ?? null,
      description: source.description ?? null,
      quantity: roundQuantity(quantity).toFixed(6),
      unitRate: formatForPersistence(source.unitRate),
      revisedUnitRate: line.revisedUnitRate ?? null,
      grossAmount: gross,
      discountAmount: discount,
      taxableAmount: taxableString,
      cgstRate: formatForPersistence(source.cgstRate),
      cgstAmount: cgst,
      sgstRate: formatForPersistence(source.sgstRate),
      sgstAmount: sgst,
      igstRate: formatForPersistence(source.igstRate),
      igstAmount: igst,
      cessRate: formatForPersistence(source.cessRate),
      cessAmount: cess,
      lineTotal: formatForPersistence(total),
      revenueReversalAccountId: line.revenueReversalAccountId ?? source.revenueAccountId ?? null,
      costCentreId: line.costCentreId ?? source.costCentreId ?? null,
    }
  })

  const total = (key: keyof CreditNoteLineCalculation) =>
    formatForPersistence(sumDecimals(lines.map((line) => String(line[key] ?? '0'))))
  const taxableAmount = total('taxableAmount')
  const cgstAmount = total('cgstAmount')
  const sgstAmount = total('sgstAmount')
  const igstAmount = total('igstAmount')
  const cessAmount = total('cessAmount')
  const totalTaxAmount = formatForPersistence(sumDecimals([cgstAmount, sgstAmount, igstAmount, cessAmount]))
  const discountAmount = total('discountAmount')
  const freightAmount = formatForPersistence(input.freightAmount ?? '0')
  const otherChargesAmount = formatForPersistence(input.otherChargesAmount ?? '0')
  const roundOffAmount = formatForPersistence(input.roundOffAmount ?? '0')
  const grandTotal = formatForPersistence(sumDecimals([
    taxableAmount, totalTaxAmount, freightAmount, otherChargesAmount, roundOffAmount,
  ]))
  if (toDecimal(grandTotal).lte(0)) errors.push({ field: 'grandTotal', message: 'Credit note total must be positive' })
  const base = (value: string) => formatForPersistence(convertToBase(value, input.exchangeRate))

  return {
    valid: errors.length === 0,
    errors,
    lines,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    cessAmount,
    totalTaxAmount,
    discountAmount,
    freightAmount,
    otherChargesAmount,
    roundOffAmount,
    grandTotal,
    baseTaxableAmount: base(taxableAmount),
    baseCgstAmount: base(cgstAmount),
    baseSgstAmount: base(sgstAmount),
    baseIgstAmount: base(igstAmount),
    baseCessAmount: base(cessAmount),
    baseTotalTaxAmount: base(totalTaxAmount),
    baseDiscountAmount: base(discountAmount),
    baseFreightAmount: base(freightAmount),
    baseOtherChargesAmount: base(otherChargesAmount),
    baseRoundOffAmount: base(roundOffAmount),
    baseGrandTotal: base(grandTotal),
  }
}
