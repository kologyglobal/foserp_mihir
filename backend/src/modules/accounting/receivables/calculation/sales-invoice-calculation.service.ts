import { Prisma } from '@prisma/client'
import {
  add,
  convertToBase,
  roundExchangeRate,
  sumDecimals,
  toDecimal,
} from '../../shared/finance-decimal.js'
import type {
  CalculatedSalesInvoiceLine,
  SalesInvoiceCalculationInput,
  SalesInvoiceCalculationResult,
} from './sales-invoice-calculation.types.js'
import { salesInvoiceCalculationInputSchema } from './sales-invoice-calculation.schemas.js'
import { calcError } from './sales-invoice-calculation.errors.js'
import { computeRawLineAmounts, formatDecimal4 } from './sales-invoice-line-calculation.service.js'
import { allocateInvoiceDiscount } from './invoice-discount-allocation.service.js'
import { determineSupplyType } from './gst-supply-determination.service.js'
import { buildTaxSummary, computeLineTaxes, toCalculatedLine } from './gst-calculation.service.js'
import {
  computeInvoiceCharges,
  computePreRoundTotal,
  sumChargeTaxable,
  sumChargeTaxes,
} from './invoice-charge-calculation.service.js'
import { applyRounding } from './invoice-rounding.service.js'

/**
 * Sales invoice calculation order:
 * 1. Line gross = qty × unitPrice (qty>0, unitPrice>=0)
 * 2. Line discount (PERCENTAGE or AMOUNT)
 * 3. Invoice discount proportional allocation; remainder to last eligible line with value>0
 * 4. Taxable = gross − lineDisc − allocatedInvDisc (or tax-inclusive derivation)
 * 5. GST supply type determination
 * 6. Split rates / compute CGST+SGST or IGST per line + cess
 * 7. Freight + other charges (taxable or non-taxable)
 * 8. Rounding
 * 9. Grand total + baseGrandTotal
 * 10. Tax summary by rate (lines + charge slices)
 */
export function calculateSalesInvoice(input: SalesInvoiceCalculationInput): SalesInvoiceCalculationResult {
  const errors: import('./sales-invoice-calculation.types.js').CalculationIssue[] = []
  const warnings: import('./sales-invoice-calculation.types.js').CalculationIssue[] = []

  const parsed = salesInvoiceCalculationInputSchema.safeParse(input)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(calcError('VALIDATION_ERROR', issue.message, issue.path.join('.')))
    }
    return emptyResult(errors, warnings, input.supplyType ?? 'INTRA_STATE')
  }

  const data = parsed.data
  if (!data.legalEntityStateCode) {
    errors.push(calcError('LEGAL_ENTITY_STATE_REQUIRED', 'Legal entity state code is required for calculation', 'legalEntityStateCode'))
  }

  const supply = determineSupplyType(
    data.taxTreatment,
    data.legalEntityStateCode,
    data.placeOfSupply,
    data.supplyType,
  )
  errors.push(...supply.errors)

  const rawLines = computeRawLineAmounts(data.lines, errors, warnings)
  const allocation = allocateInvoiceDiscount(
    rawLines,
    data.invoiceDiscountType,
    data.invoiceDiscountValue,
    errors,
  )

  const calculatedLines: CalculatedSalesInvoiceLine[] = []
  let subtotal = new Prisma.Decimal(0)
  let lineDiscountTotal = new Prisma.Decimal(0)
  let taxableTotal = new Prisma.Decimal(0)
  let cgstTotal = new Prisma.Decimal(0)
  let sgstTotal = new Prisma.Decimal(0)
  let igstTotal = new Prisma.Decimal(0)
  let cessTotal = new Prisma.Decimal(0)
  let lineGrandTotal = new Prisma.Decimal(0)

  for (const line of rawLines) {
    const allocated = allocation.byLine.get(line.lineNumber) ?? new Prisma.Decimal(0)
    const tax = computeLineTaxes(line, allocated, supply.supplyType, data.taxTreatment, errors, warnings)
    calculatedLines.push(toCalculatedLine(line, allocated, tax))

    subtotal = add(subtotal, line.grossAmount)
    lineDiscountTotal = add(lineDiscountTotal, line.lineDiscountAmount)
    taxableTotal = add(taxableTotal, tax.taxableAmount)
    cgstTotal = add(cgstTotal, tax.cgstAmount)
    sgstTotal = add(sgstTotal, tax.sgstAmount)
    igstTotal = add(igstTotal, tax.igstAmount)
    cessTotal = add(cessTotal, tax.cessAmount)
    lineGrandTotal = add(lineGrandTotal, tax.lineTotal)
  }

  const charges = computeInvoiceCharges({
    lineTotalSum: lineGrandTotal,
    freightMode: data.freightMode ?? 'NON_TAXABLE',
    freightAmount: data.freightAmount,
    freightTaxRate: data.freightTaxRate,
    otherChargesAmount: data.otherChargesAmount,
    otherCharges: data.otherCharges,
    supplyType: supply.supplyType,
    taxTreatment: data.taxTreatment,
    errors,
  })

  const chargeTaxes = sumChargeTaxes(charges)
  taxableTotal = add(taxableTotal, sumChargeTaxable(charges))
  cgstTotal = add(cgstTotal, chargeTaxes.cgst)
  sgstTotal = add(sgstTotal, chargeTaxes.sgst)
  igstTotal = add(igstTotal, chargeTaxes.igst)

  const preRoundTotal = computePreRoundTotal(lineGrandTotal, charges)

  const rounding = applyRounding(
    preRoundTotal,
    data.roundingMode ?? 'NONE',
    data.manualRoundOff,
    data.roundingTolerance,
    errors,
  )

  const totalTax = sumDecimals([cgstTotal, sgstTotal, igstTotal, cessTotal])
  const exchangeRate = roundExchangeRate(data.exchangeRate ?? '1')

  const baseSubtotal = convertToBase(subtotal, exchangeRate)
  const baseLineDiscount = convertToBase(lineDiscountTotal, exchangeRate)
  const baseInvoiceDiscount = convertToBase(allocation.totalInvoiceDiscount, exchangeRate)
  const baseDiscount = add(baseLineDiscount, baseInvoiceDiscount)
  const baseTaxable = convertToBase(taxableTotal, exchangeRate)
  const baseCgst = convertToBase(cgstTotal, exchangeRate)
  const baseSgst = convertToBase(sgstTotal, exchangeRate)
  const baseIgst = convertToBase(igstTotal, exchangeRate)
  const baseCess = convertToBase(cessTotal, exchangeRate)
  const baseTotalTax = convertToBase(totalTax, exchangeRate)
  const baseRoundOff = convertToBase(toDecimal(rounding.roundOffAmount), exchangeRate)
  const baseTotal = convertToBase(toDecimal(rounding.totalAmount), exchangeRate)

  const taxSummary = buildTaxSummary(calculatedLines, charges.taxSummarySlices)

  assertGrandTotalInvariant(lineGrandTotal, charges, rounding, errors)

  return {
    valid: errors.length === 0,
    derivedSupplyType: supply.derivedSupplyType,
    supplyType: supply.supplyType,
    lines: calculatedLines,
    subtotalAmount: formatDecimal4(subtotal),
    lineDiscountTotal: formatDecimal4(lineDiscountTotal),
    invoiceDiscountAmount: formatDecimal4(allocation.totalInvoiceDiscount),
    taxableAmount: formatDecimal4(taxableTotal),
    cgstAmount: formatDecimal4(cgstTotal),
    sgstAmount: formatDecimal4(sgstTotal),
    igstAmount: formatDecimal4(igstTotal),
    cessAmount: formatDecimal4(cessTotal),
    totalTaxAmount: formatDecimal4(totalTax),
    freightAmount: formatDecimal4(charges.freightAmount),
    freightTaxableAmount: formatDecimal4(charges.freightTaxableAmount),
    freightCgstAmount: formatDecimal4(charges.freightCgstAmount),
    freightSgstAmount: formatDecimal4(charges.freightSgstAmount),
    freightIgstAmount: formatDecimal4(charges.freightIgstAmount),
    otherChargesAmount: formatDecimal4(charges.otherChargesAmount),
    otherChargesTaxableAmount: formatDecimal4(charges.otherChargesTaxableAmount),
    otherChargesCgstAmount: formatDecimal4(charges.otherChargesCgstAmount),
    otherChargesSgstAmount: formatDecimal4(charges.otherChargesSgstAmount),
    otherChargesIgstAmount: formatDecimal4(charges.otherChargesIgstAmount),
    preRoundTotal,
    roundOffAmount: rounding.roundOffAmount,
    totalAmount: rounding.totalAmount,
    baseSubtotalAmount: formatDecimal4(baseSubtotal),
    baseDiscountAmount: formatDecimal4(baseDiscount),
    baseTaxableAmount: formatDecimal4(baseTaxable),
    baseCgstAmount: formatDecimal4(baseCgst),
    baseSgstAmount: formatDecimal4(baseSgst),
    baseIgstAmount: formatDecimal4(baseIgst),
    baseCessAmount: formatDecimal4(baseCess),
    baseTotalTaxAmount: formatDecimal4(baseTotalTax),
    baseRoundOffAmount: formatDecimal4(baseRoundOff),
    baseTotalAmount: formatDecimal4(baseTotal),
    taxSummary,
    errors,
    warnings,
  }
}

function assertGrandTotalInvariant(
  lineGrandTotal: Prisma.Decimal,
  charges: ReturnType<typeof computeInvoiceCharges>,
  rounding: { roundOffAmount: string; totalAmount: string },
  errors: import('./sales-invoice-calculation.types.js').CalculationIssue[],
): void {
  const expectedPreRound = add(lineGrandTotal, charges.chargePreRoundAddition)
  const expectedTotal = add(expectedPreRound, toDecimal(rounding.roundOffAmount))
  if (!expectedTotal.eq(toDecimal(rounding.totalAmount))) {
    errors.push(calcError('INVOICE_TOTAL_CALCULATION_INVALID', 'Grand total does not reconcile with line totals and adjustments'))
  }
}

function emptyResult(
  errors: import('./sales-invoice-calculation.types.js').CalculationIssue[],
  warnings: import('./sales-invoice-calculation.types.js').CalculationIssue[],
  supplyType: import('../sales-invoices/sales-invoice.types.js').SalesInvoiceSupplyType,
): SalesInvoiceCalculationResult {
  const zero = '0.0000'
  return {
    valid: false,
    derivedSupplyType: supplyType,
    supplyType,
    lines: [],
    subtotalAmount: zero,
    lineDiscountTotal: zero,
    invoiceDiscountAmount: zero,
    taxableAmount: zero,
    cgstAmount: zero,
    sgstAmount: zero,
    igstAmount: zero,
    cessAmount: zero,
    totalTaxAmount: zero,
    freightAmount: zero,
    freightTaxableAmount: zero,
    freightCgstAmount: zero,
    freightSgstAmount: zero,
    freightIgstAmount: zero,
    otherChargesAmount: zero,
    otherChargesTaxableAmount: zero,
    otherChargesCgstAmount: zero,
    otherChargesSgstAmount: zero,
    otherChargesIgstAmount: zero,
    preRoundTotal: zero,
    roundOffAmount: zero,
    totalAmount: zero,
    baseSubtotalAmount: zero,
    baseDiscountAmount: zero,
    baseTaxableAmount: zero,
    baseCgstAmount: zero,
    baseSgstAmount: zero,
    baseIgstAmount: zero,
    baseCessAmount: zero,
    baseTotalTaxAmount: zero,
    baseRoundOffAmount: zero,
    baseTotalAmount: zero,
    taxSummary: [],
    errors,
    warnings,
  }
}
