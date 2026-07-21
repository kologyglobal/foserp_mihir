import { Prisma } from '@prisma/client'
import {
  add,
  compare,
  isNegative,
  isPositive,
  isZero,
  multiply,
  roundExchangeRate,
  subtract,
  sumDecimals,
  toDecimal,
} from '../../../shared/finance-decimal.js'
import { applyRounding } from '../../../receivables/calculation/invoice-rounding.service.js'
import type {
  VendorInvoiceCalculatedLine,
  VendorInvoiceCalculationBaseTotals,
  VendorInvoiceCalculationInput,
  VendorInvoiceCalculationTotals,
  VendorInvoiceHeaderDiscountType,
  VendorInvoicePurchaseSupplyType,
  VendorInvoiceValidationIssue,
} from './vendor-invoice-calculation.types.js'
import { vendorInvoiceCalculationInputSchema } from './vendor-invoice-calculation.schemas.js'
import { calcError, VENDOR_INVOICE_CALC_CODES } from './vendor-invoice-calculation.errors.js'
import { computeRawLineAmounts } from './vendor-invoice-line-calculator.service.js'
import type { RawVendorInvoiceLineAmounts } from './vendor-invoice-line-calculator.service.js'
import {
  computeChargeTax,
  computeLineTax,
  determinePurchaseSupplyType,
  isZeroTaxTreatment,
} from './vendor-invoice-tax-calculator.service.js'
import type { VendorInvoiceLineTaxResult } from './vendor-invoice-tax-calculator.service.js'
import { calculateTds } from './vendor-invoice-tds-calculator.service.js'
import { assertBaseCurrencyRate, convertAllTotals } from './vendor-invoice-currency-calculator.service.js'
import { formatDecimal4, formatDecimal6 } from './vendor-invoice-decimal.js'


const ZERO = new Prisma.Decimal(0)
const ZERO_STR = '0.0000'

/** Structurally compatible with receivables/calculation invoice-rounding.service's internal CalculationIssue shape. */
interface RoundingCompatIssue {
  code: string
  message: string
  field?: string
  severity: 'error' | 'warning'
}

export interface VendorInvoiceRcmTaxTotals {
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  totalTaxAmount: string
}

export interface VendorInvoiceAmountsCalculationResult {
  lines: VendorInvoiceCalculatedLine[]
  totals: VendorInvoiceCalculationTotals
  baseTotals: VendorInvoiceCalculationBaseTotals
  issues: { errors: VendorInvoiceValidationIssue[]; warnings: VendorInvoiceValidationIssue[] }
  derivedSupplyType: VendorInvoicePurchaseSupplyType
  supplyType: VendorInvoicePurchaseSupplyType
  isRcm: boolean
  rcmTaxTotals: VendorInvoiceRcmTaxTotals
}

interface HeaderDiscountAllocation {
  byLine: Map<number, Prisma.Decimal>
  totalDiscount: Prisma.Decimal
}

/**
 * Proportional header discount allocation across lines with netBeforeHeaderDiscount > 0.
 * Rounding remainder goes to the last eligible line (highest lineNumber) so allocations sum exactly.
 * Mirrors receivables/calculation/invoice-discount-allocation.service.ts, adapted for AP field names.
 */
function allocateHeaderDiscount(
  lines: RawVendorInvoiceLineAmounts[],
  discountType: VendorInvoiceHeaderDiscountType | undefined,
  discountValue: string | undefined,
  errors: VendorInvoiceValidationIssue[],
): HeaderDiscountAllocation {
  const byLine = new Map<number, Prisma.Decimal>()
  for (const line of lines) {
    byLine.set(line.lineNumber, ZERO)
  }

  if (!discountType || !discountValue || isZero(discountValue)) {
    return { byLine, totalDiscount: ZERO }
  }

  const value = toDecimal(discountValue)
  if (isNegative(value)) {
    errors.push(calcError(VENDOR_INVOICE_CALC_CODES.HEADER_DISCOUNT_EXCEEDS_VALUE, 'Header discount cannot be negative', 'invoiceDiscountValue'))
    return { byLine, totalDiscount: ZERO }
  }

  const eligible = lines.filter((l) => isPositive(l.netBeforeHeaderDiscount))
  if (eligible.length === 0) {
    errors.push(
      calcError(VENDOR_INVOICE_CALC_CODES.HEADER_DISCOUNT_ALLOCATION_FAILED, 'No lines eligible for header discount allocation', 'invoiceDiscountValue'),
    )
    return { byLine, totalDiscount: ZERO }
  }

  const eligibleTotal = sumDecimals(eligible.map((l) => l.netBeforeHeaderDiscount))
  let totalDiscount: Prisma.Decimal

  if (discountType === 'PERCENTAGE') {
    if (compare(value, 100) > 0) {
      errors.push(
        calcError(VENDOR_INVOICE_CALC_CODES.HEADER_DISCOUNT_EXCEEDS_VALUE, 'Header discount percentage cannot exceed 100', 'invoiceDiscountValue'),
      )
      return { byLine, totalDiscount: ZERO }
    }
    totalDiscount = toDecimal(formatDecimal4(multiply(eligibleTotal, value.div(100))))
  } else {
    totalDiscount = toDecimal(formatDecimal4(value))
    if (compare(totalDiscount, eligibleTotal) > 0) {
      errors.push(
        calcError(VENDOR_INVOICE_CALC_CODES.HEADER_DISCOUNT_EXCEEDS_VALUE, 'Header discount amount exceeds eligible line value', 'invoiceDiscountValue'),
      )
      return { byLine, totalDiscount: ZERO }
    }
  }

  if (isZero(totalDiscount)) {
    return { byLine, totalDiscount: ZERO }
  }

  let allocated = ZERO
  const lastEligible = eligible.reduce((max, l) => (l.lineNumber > max.lineNumber ? l : max), eligible[0]!)

  for (const line of eligible) {
    if (line.lineNumber === lastEligible.lineNumber) continue
    const share = toDecimal(formatDecimal4(multiply(totalDiscount, line.netBeforeHeaderDiscount.div(eligibleTotal))))
    byLine.set(line.lineNumber, share)
    allocated = add(allocated, share)
  }

  const remainder = toDecimal(formatDecimal4(subtract(totalDiscount, allocated)))
  byLine.set(lastEligible.lineNumber, remainder)

  const sumAllocated = sumDecimals([...byLine.values()])
  if (!sumAllocated.eq(totalDiscount)) {
    const diff = subtract(totalDiscount, sumAllocated)
    const current = byLine.get(lastEligible.lineNumber) ?? ZERO
    byLine.set(lastEligible.lineNumber, add(current, diff))
  }

  return { byLine, totalDiscount }
}

function parseNonNegativeAmount(
  value: string | undefined,
  field: string,
  errorCode: string,
  errors: VendorInvoiceValidationIssue[],
): Prisma.Decimal {
  if (!value || isZero(value)) return ZERO
  const amount = toDecimal(value)
  if (isNegative(amount)) {
    errors.push(calcError(errorCode, `${field} cannot be negative`, field))
    return ZERO
  }
  return toDecimal(formatDecimal4(amount))
}

function toCalculatedLine(
  line: RawVendorInvoiceLineAmounts,
  allocatedHeaderDiscount: Prisma.Decimal,
  tax: VendorInvoiceLineTaxResult,
): VendorInvoiceCalculatedLine {
  const totalDiscountAmount = add(line.lineDiscountAmount, allocatedHeaderDiscount)
  return {
    lineNumber: line.lineNumber,
    lineType: line.lineType,
    description: line.description,
    itemId: line.itemId,
    itemCodeSnapshot: line.itemCodeSnapshot,
    itemNameSnapshot: line.itemNameSnapshot,
    hsnSacCode: line.hsnSacCode,
    quantity: formatDecimal6(line.quantity),
    uomId: line.uomId,
    uomCodeSnapshot: line.uomCodeSnapshot,
    unitPrice: formatDecimal4(line.unitPrice),
    grossAmount: formatDecimal4(line.grossAmount),
    discountPercent: formatDecimal4(line.discountPercent),
    discountAmount: formatDecimal4(totalDiscountAmount),
    taxableAmount: formatDecimal4(tax.taxableAmount),
    cgstRate: formatDecimal4(tax.cgstRate),
    cgstAmount: formatDecimal4(tax.cgstAmount),
    sgstRate: formatDecimal4(tax.sgstRate),
    sgstAmount: formatDecimal4(tax.sgstAmount),
    igstRate: formatDecimal4(tax.igstRate),
    igstAmount: formatDecimal4(tax.igstAmount),
    cessRate: formatDecimal4(tax.cessRate),
    cessAmount: formatDecimal4(tax.cessAmount),
    recoverableTaxAmount: formatDecimal4(tax.recoverableTaxAmount),
    nonRecoverableTaxAmount: formatDecimal4(tax.nonRecoverableTaxAmount),
    lineTotal: formatDecimal4(tax.lineTotal),
    isTaxInclusive: line.isTaxInclusive,
    isReverseCharge: tax.isReverseCharge,
    itcEligibility: tax.effectiveItcEligibility,
    itcEligiblePercent: formatDecimal4(tax.effectiveItcEligiblePercent),
    debitAccountId: line.debitAccountId,
    costCentreId: line.costCentreId,
    projectReference: line.projectReference,
    departmentReference: line.departmentReference,
    taxTreatment: tax.effectiveTaxTreatment,
    sourceLinkType: line.sourceLinkType,
    sourceDocumentId: line.sourceDocumentId,
    sourceDocumentNumber: line.sourceDocumentNumber,
    sourceDocumentLineId: line.sourceDocumentLineId,
  }
}

function zeroTotals(): VendorInvoiceCalculationTotals {
  return {
    grossAmount: ZERO_STR,
    discountAmount: ZERO_STR,
    taxableAmount: ZERO_STR,
    inputCgstAmount: ZERO_STR,
    inputSgstAmount: ZERO_STR,
    inputIgstAmount: ZERO_STR,
    inputCessAmount: ZERO_STR,
    otherRecoverableTaxAmount: ZERO_STR,
    nonRecoverableTaxAmount: ZERO_STR,
    freightAmount: ZERO_STR,
    freightTaxableAmount: ZERO_STR,
    freightCgstAmount: ZERO_STR,
    freightSgstAmount: ZERO_STR,
    freightIgstAmount: ZERO_STR,
    otherChargeAmount: ZERO_STR,
    otherChargeTaxableAmount: ZERO_STR,
    otherChargeCgstAmount: ZERO_STR,
    otherChargeSgstAmount: ZERO_STR,
    otherChargeIgstAmount: ZERO_STR,
    preRoundTotal: ZERO_STR,
    roundOffAmount: ZERO_STR,
    invoiceGrandTotal: ZERO_STR,
    rcmCgstAmount: ZERO_STR,
    rcmSgstAmount: ZERO_STR,
    rcmIgstAmount: ZERO_STR,
    rcmCessAmount: ZERO_STR,
    rcmTotalTaxAmount: ZERO_STR,
    tdsBaseAmount: ZERO_STR,
    tdsAmount: ZERO_STR,
    estimatedTdsAmount: ZERO_STR,
    vendorPayableAmount: ZERO_STR,
  }
}

function emptyResult(
  errors: VendorInvoiceValidationIssue[],
  warnings: VendorInvoiceValidationIssue[],
  supplyType: VendorInvoicePurchaseSupplyType,
  isRcm: boolean,
): VendorInvoiceAmountsCalculationResult {
  const totals = zeroTotals()
  return {
    lines: [],
    totals,
    baseTotals: { ...totals },
    issues: { errors, warnings },
    derivedSupplyType: supplyType,
    supplyType,
    isRcm,
    rcmTaxTotals: { cgstAmount: ZERO_STR, sgstAmount: ZERO_STR, igstAmount: ZERO_STR, cessAmount: ZERO_STR, totalTaxAmount: ZERO_STR },
  }
}

/**
 * Pure, synchronous vendor invoice amount calculation — no DB access.
 *
 * Order: schema validation → line gross/discount → header discount allocation → per-line tax
 * (incl. RCM self-assessment + ITC recoverable split) → freight/other charge tax → pre-round total
 * → rounding → grand total → ITC aggregates → TDS → vendor payable → base-currency conversion.
 */
export function calculateVendorInvoiceAmounts(input: VendorInvoiceCalculationInput): VendorInvoiceAmountsCalculationResult {
  const errors: VendorInvoiceValidationIssue[] = []
  const warnings: VendorInvoiceValidationIssue[] = []

  const parsed = vendorInvoiceCalculationInputSchema.safeParse(input)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(calcError(VENDOR_INVOICE_CALC_CODES.VALIDATION_ERROR, issue.message, issue.path.join('.')))
    }
    return emptyResult(errors, warnings, input.supplyType ?? 'INTRA_STATE', input.taxTreatment === 'REVERSE_CHARGE')
  }

  const data = parsed.data
  const zeroTax = isZeroTaxTreatment(data.taxTreatment)
  const isRcm = data.taxTreatment === 'REVERSE_CHARGE'

  const supply = determinePurchaseSupplyType(
    data.companyStateCode,
    data.placeOfSupply,
    data.vendorStateCode,
    data.supplyType,
    errors,
    zeroTax,
  )

  const rawLines = computeRawLineAmounts(data.lines, errors, warnings)
  const headerDiscount = allocateHeaderDiscount(rawLines, data.invoiceDiscountType, data.invoiceDiscountValue, errors)

  const headerItcEligibility = data.itcEligibility ?? 'PENDING_REVIEW'
  const headerItcEligiblePercent = data.itcEligiblePercent != null ? toDecimal(data.itcEligiblePercent) : null

  const calculatedLines: VendorInvoiceCalculatedLine[] = []

  let grossTotal = ZERO
  let discountTotal = ZERO
  let taxableTotal = ZERO
  let cgstTotal = ZERO
  let sgstTotal = ZERO
  let igstTotal = ZERO
  let cessTotal = ZERO
  let nonRecoverableTotal = ZERO
  let lineGrandTotal = ZERO
  let rcmCgstTotal = ZERO
  let rcmSgstTotal = ZERO
  let rcmIgstTotal = ZERO
  let rcmCessTotal = ZERO

  for (const line of rawLines) {
    const allocated = headerDiscount.byLine.get(line.lineNumber) ?? ZERO
    const tax = computeLineTax(line, allocated, supply.supplyType, data.taxTreatment, headerItcEligibility, headerItcEligiblePercent, errors, warnings)
    calculatedLines.push(toCalculatedLine(line, allocated, tax))

    grossTotal = add(grossTotal, line.grossAmount)
    discountTotal = add(discountTotal, add(line.lineDiscountAmount, allocated))
    taxableTotal = add(taxableTotal, tax.taxableAmount)
    cgstTotal = add(cgstTotal, tax.cgstAmount)
    sgstTotal = add(sgstTotal, tax.sgstAmount)
    igstTotal = add(igstTotal, tax.igstAmount)
    cessTotal = add(cessTotal, tax.cessAmount)
    nonRecoverableTotal = add(nonRecoverableTotal, tax.nonRecoverableTaxAmount)
    lineGrandTotal = add(lineGrandTotal, tax.lineTotal)

    if (tax.isReverseCharge) {
      rcmCgstTotal = add(rcmCgstTotal, tax.cgstAmount)
      rcmSgstTotal = add(rcmSgstTotal, tax.sgstAmount)
      rcmIgstTotal = add(rcmIgstTotal, tax.igstAmount)
      rcmCessTotal = add(rcmCessTotal, tax.cessAmount)
    }
  }

  const freightAmount = parseNonNegativeAmount(data.freightAmount, 'freightAmount', VENDOR_INVOICE_CALC_CODES.FREIGHT_INVALID, errors)
  const freightTax = computeChargeTax(freightAmount, data.freightGstRate, supply.supplyType, zeroTax, 'freightGstRate', errors)

  const otherChargeAmount = parseNonNegativeAmount(data.otherChargeAmount, 'otherChargeAmount', VENDOR_INVOICE_CALC_CODES.OTHER_CHARGE_INVALID, errors)
  const otherChargeTax = computeChargeTax(otherChargeAmount, data.otherChargeGstRate, supply.supplyType, zeroTax, 'otherChargeGstRate', errors)

  if (isRcm) {
    rcmCgstTotal = add(rcmCgstTotal, add(freightTax.cgstAmount, otherChargeTax.cgstAmount))
    rcmSgstTotal = add(rcmSgstTotal, add(freightTax.sgstAmount, otherChargeTax.sgstAmount))
    rcmIgstTotal = add(rcmIgstTotal, add(freightTax.igstAmount, otherChargeTax.igstAmount))
  }

  cgstTotal = add(cgstTotal, add(freightTax.cgstAmount, otherChargeTax.cgstAmount))
  sgstTotal = add(sgstTotal, add(freightTax.sgstAmount, otherChargeTax.sgstAmount))
  igstTotal = add(igstTotal, add(freightTax.igstAmount, otherChargeTax.igstAmount))
  taxableTotal = add(taxableTotal, add(freightTax.taxableAmount, otherChargeTax.taxableAmount))

  const freightContribution = isRcm ? freightAmount : add(freightAmount, freightTax.totalTaxAmount)
  const otherChargeContribution = isRcm ? otherChargeAmount : add(otherChargeAmount, otherChargeTax.totalTaxAmount)

  const preRoundTotal = add(lineGrandTotal, add(freightContribution, otherChargeContribution))

  const roundingIssues: RoundingCompatIssue[] = []
  const roundingMode = data.configuration?.roundingMode ?? 'NONE'
  const rounding = applyRounding(
    formatDecimal4(preRoundTotal),
    roundingMode,
    data.configuration?.manualRoundOff,
    data.configuration?.roundingTolerance,
    roundingIssues,
  )
  for (const issue of roundingIssues) {
    const target = issue.severity === 'error' ? errors : warnings
    target.push({ code: issue.code, message: issue.message, field: issue.field, severity: issue.severity === 'error' ? 'ERROR' : 'WARNING' })
  }

  const invoiceGrandTotal = toDecimal(rounding.totalAmount)

  const expectedPreRound = add(lineGrandTotal, add(freightContribution, otherChargeContribution))
  const expectedTotal = add(expectedPreRound, toDecimal(rounding.roundOffAmount))
  if (!expectedTotal.eq(invoiceGrandTotal)) {
    errors.push(calcError(VENDOR_INVOICE_CALC_CODES.TOTAL_CALCULATION_INVALID, 'Grand total does not reconcile with line totals and charges'))
  }

  const tds = calculateTds(
    {
      mode: data.tdsRecognitionMode ?? 'NOT_APPLICABLE',
      rate: data.tdsRate,
      baseOverride: data.tdsBaseOverride,
      taxableAmount: taxableTotal,
      invoiceGrandTotal,
    },
    errors,
    warnings,
  )

  const rcmTotalTax = add(add(rcmCgstTotal, rcmSgstTotal), add(rcmIgstTotal, rcmCessTotal))

  const totals: VendorInvoiceCalculationTotals = {
    grossAmount: formatDecimal4(grossTotal),
    discountAmount: formatDecimal4(discountTotal),
    taxableAmount: formatDecimal4(taxableTotal),
    inputCgstAmount: formatDecimal4(cgstTotal),
    inputSgstAmount: formatDecimal4(sgstTotal),
    inputIgstAmount: formatDecimal4(igstTotal),
    inputCessAmount: formatDecimal4(cessTotal),
    otherRecoverableTaxAmount: ZERO_STR,
    nonRecoverableTaxAmount: formatDecimal4(nonRecoverableTotal),
    freightAmount: formatDecimal4(freightAmount),
    freightTaxableAmount: formatDecimal4(freightTax.taxableAmount),
    freightCgstAmount: formatDecimal4(freightTax.cgstAmount),
    freightSgstAmount: formatDecimal4(freightTax.sgstAmount),
    freightIgstAmount: formatDecimal4(freightTax.igstAmount),
    otherChargeAmount: formatDecimal4(otherChargeAmount),
    otherChargeTaxableAmount: formatDecimal4(otherChargeTax.taxableAmount),
    otherChargeCgstAmount: formatDecimal4(otherChargeTax.cgstAmount),
    otherChargeSgstAmount: formatDecimal4(otherChargeTax.sgstAmount),
    otherChargeIgstAmount: formatDecimal4(otherChargeTax.igstAmount),
    preRoundTotal: formatDecimal4(preRoundTotal),
    roundOffAmount: rounding.roundOffAmount,
    invoiceGrandTotal: rounding.totalAmount,
    rcmCgstAmount: formatDecimal4(rcmCgstTotal),
    rcmSgstAmount: formatDecimal4(rcmSgstTotal),
    rcmIgstAmount: formatDecimal4(rcmIgstTotal),
    rcmCessAmount: formatDecimal4(rcmCessTotal),
    rcmTotalTaxAmount: formatDecimal4(rcmTotalTax),
    tdsBaseAmount: formatDecimal4(tds.tdsBaseAmount),
    tdsAmount: formatDecimal4(tds.tdsAmount),
    estimatedTdsAmount: formatDecimal4(tds.estimatedTdsAmount),
    vendorPayableAmount: formatDecimal4(tds.vendorPayableAmount),
  }

  const exchangeRate = roundExchangeRate(data.exchangeRate ?? '1')
  assertBaseCurrencyRate(
    data.currencyCode ?? 'INR',
    data.configuration?.baseCurrencyCode ?? input.configuration?.baseCurrencyCode ?? 'INR',
    exchangeRate,
    errors,
  )
  const baseTotals = convertAllTotals(totals, exchangeRate.toFixed(8))

  return {
    lines: calculatedLines,
    totals,
    baseTotals,
    issues: { errors, warnings },
    derivedSupplyType: supply.derivedSupplyType,
    supplyType: supply.supplyType,
    isRcm,
    rcmTaxTotals: {
      cgstAmount: formatDecimal4(rcmCgstTotal),
      sgstAmount: formatDecimal4(rcmSgstTotal),
      igstAmount: formatDecimal4(rcmIgstTotal),
      cessAmount: formatDecimal4(rcmCessTotal),
      totalTaxAmount: formatDecimal4(rcmTotalTax),
    },
  }
}
