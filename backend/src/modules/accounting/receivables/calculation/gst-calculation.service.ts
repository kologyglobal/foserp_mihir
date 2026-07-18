import { Prisma } from '@prisma/client'
import {
  add,
  compare,
  divide,
  isZero,
  multiply,
  roundPercentage,
  roundTax,
  subtract,
  toDecimal,
} from '../../shared/finance-decimal.js'
import type { SalesInvoiceSupplyType, SalesInvoiceTaxTreatment } from '../sales-invoices/sales-invoice.types.js'
import type { CalculationIssue, TaxSummaryByRate } from './sales-invoice-calculation.types.js'
import { calcError, calcWarning } from './sales-invoice-calculation.errors.js'
import { isZeroGstSupply } from './gst-supply-determination.service.js'
import type { RawLineAmounts } from './sales-invoice-line-calculation.service.js'
import { formatDecimal4, formatDecimal6 } from './sales-invoice-line-calculation.service.js'
import type { ChargeTaxSlice } from './invoice-charge-calculation.service.js'

export interface LineTaxBreakdown {
  lineNumber: number
  taxableAmount: Prisma.Decimal
  cgstRate: Prisma.Decimal
  cgstAmount: Prisma.Decimal
  sgstRate: Prisma.Decimal
  sgstAmount: Prisma.Decimal
  igstRate: Prisma.Decimal
  igstAmount: Prisma.Decimal
  cessRate: Prisma.Decimal
  cessAmount: Prisma.Decimal
  lineTotal: Prisma.Decimal
}

const INCLUSIVE_TOLERANCE = toDecimal('0.01')

/**
 * Split combined GST rate into CGST/SGST (intra) or IGST (inter).
 * Cess is always computed separately on taxable base.
 */
export function splitGstRate(
  gstRate: Prisma.Decimal,
  supplyType: SalesInvoiceSupplyType,
  zeroGst: boolean,
): { cgstRate: Prisma.Decimal; sgstRate: Prisma.Decimal; igstRate: Prisma.Decimal } {
  if (zeroGst || isZero(gstRate)) {
    return {
      cgstRate: new Prisma.Decimal(0),
      sgstRate: new Prisma.Decimal(0),
      igstRate: new Prisma.Decimal(0),
    }
  }
  if (supplyType === 'INTRA_STATE') {
    const half = roundPercentage(divide(gstRate, 2))
    const other = roundPercentage(subtract(gstRate, half))
    return { cgstRate: half, sgstRate: other, igstRate: new Prisma.Decimal(0) }
  }
  return {
    cgstRate: new Prisma.Decimal(0),
    sgstRate: new Prisma.Decimal(0),
    igstRate: gstRate,
  }
}

/** Compute GST + cess amounts from taxable base and split rates. */
export function computeTaxFromTaxable(
  taxable: Prisma.Decimal,
  cgstRate: Prisma.Decimal,
  sgstRate: Prisma.Decimal,
  igstRate: Prisma.Decimal,
  cessRate: Prisma.Decimal,
): Pick<LineTaxBreakdown, 'cgstAmount' | 'sgstAmount' | 'igstAmount' | 'cessAmount'> {
  const cgstAmount = roundTax(multiply(taxable, divide(cgstRate, 100)))
  const sgstAmount = roundTax(multiply(taxable, divide(sgstRate, 100)))
  const igstAmount = roundTax(multiply(taxable, divide(igstRate, 100)))
  const cessAmount = roundTax(multiply(taxable, divide(cessRate, 100)))
  return { cgstAmount, sgstAmount, igstAmount, cessAmount }
}

/**
 * Tax-inclusive derivation uses GST-only divisor: taxable = inclusive ÷ (1 + GST÷100).
 * Cess is applied on that taxable base afterward (not in the divisor).
 * When cessRate>0, lineTotal = taxable + GST + cess (may exceed the inclusive input);
 * emit CESS_ON_INCLUSIVE_EXCEEDS_PRICE if |lineTotal − inclusive| > 0.01.
 */
function deriveTaxableFromInclusive(
  inclusiveValue: Prisma.Decimal,
  gstRate: Prisma.Decimal,
  cessRate: Prisma.Decimal,
  supplyType: SalesInvoiceSupplyType,
  zeroGst: boolean,
  lineNumber: number,
  errors: CalculationIssue[],
  warnings: CalculationIssue[],
): { taxable: Prisma.Decimal; taxes: ReturnType<typeof computeTaxFromTaxable>; rates: ReturnType<typeof splitGstRate>; lineTotal: Prisma.Decimal } {
  const rates = splitGstRate(gstRate, supplyType, zeroGst)
  const effectiveGstRate = zeroGst
    ? new Prisma.Decimal(0)
    : add(add(rates.cgstRate, rates.sgstRate), rates.igstRate)
  const divisor = add(1, divide(effectiveGstRate, 100))
  const taxable = roundTax(divide(inclusiveValue, divisor))
  const taxes = computeTaxFromTaxable(taxable, rates.cgstRate, rates.sgstRate, rates.igstRate, cessRate)
  const lineTotal = roundTax(
    add(taxable, add(taxes.cgstAmount, add(taxes.sgstAmount, add(taxes.igstAmount, taxes.cessAmount)))),
  )

  if (isZero(cessRate)) {
    const diff = subtract(inclusiveValue, lineTotal).abs()
    if (compare(diff, INCLUSIVE_TOLERANCE) > 0) {
      errors.push(
        calcError(
          'INCLUSIVE_TAX_MISMATCH',
          `Tax-inclusive line ${lineNumber} components do not reconcile within tolerance (${diff.toFixed(4)})`,
          `lines[${lineNumber}]`,
        ),
      )
    }
  } else {
    const diff = subtract(lineTotal, inclusiveValue).abs()
    if (compare(diff, INCLUSIVE_TOLERANCE) > 0) {
      warnings.push(
        calcWarning(
          'CESS_ON_INCLUSIVE_EXCEEDS_PRICE',
          `Tax-inclusive line ${lineNumber} with cess exceeds inclusive price by ${diff.toFixed(4)}`,
          `lines[${lineNumber}]`,
        ),
      )
    }
  }

  return { taxable, taxes, rates, lineTotal: isZero(cessRate) ? inclusiveValue : lineTotal }
}

export function computeLineTaxes(
  line: RawLineAmounts,
  allocatedInvoiceDiscount: Prisma.Decimal,
  supplyType: SalesInvoiceSupplyType,
  taxTreatment: SalesInvoiceTaxTreatment,
  errors: CalculationIssue[],
  warnings: CalculationIssue[],
): LineTaxBreakdown {
  const zeroGst = isZeroGstSupply(supplyType, taxTreatment)
  const preTaxBase = roundTax(subtract(line.netBeforeInvoiceDiscount, allocatedInvoiceDiscount))

  if (line.isTaxInclusive && !zeroGst && !isZero(line.gstRate)) {
    const { taxable, taxes, rates, lineTotal } = deriveTaxableFromInclusive(
      preTaxBase,
      line.gstRate,
      line.cessRate,
      supplyType,
      zeroGst,
      line.lineNumber,
      errors,
      warnings,
    )
    return {
      lineNumber: line.lineNumber,
      taxableAmount: taxable,
      cgstRate: rates.cgstRate,
      cgstAmount: taxes.cgstAmount,
      sgstRate: rates.sgstRate,
      sgstAmount: taxes.sgstAmount,
      igstRate: rates.igstRate,
      igstAmount: taxes.igstAmount,
      cessRate: line.cessRate,
      cessAmount: taxes.cessAmount,
      lineTotal,
    }
  }

  const taxableAmount = preTaxBase
  const rates = splitGstRate(line.gstRate, supplyType, zeroGst)
  const taxes = computeTaxFromTaxable(taxableAmount, rates.cgstRate, rates.sgstRate, rates.igstRate, line.cessRate)
  const lineTotal = roundTax(
    add(taxableAmount, add(taxes.cgstAmount, add(taxes.sgstAmount, add(taxes.igstAmount, taxes.cessAmount)))),
  )

  return {
    lineNumber: line.lineNumber,
    taxableAmount,
    cgstRate: rates.cgstRate,
    cgstAmount: taxes.cgstAmount,
    sgstRate: rates.sgstRate,
    sgstAmount: taxes.sgstAmount,
    igstRate: rates.igstRate,
    igstAmount: taxes.igstAmount,
    cessRate: line.cessRate,
    cessAmount: taxes.cessAmount,
    lineTotal,
  }
}

export function toCalculatedLine(
  line: RawLineAmounts,
  allocatedInvoiceDiscount: Prisma.Decimal,
  tax: LineTaxBreakdown,
): import('./sales-invoice-calculation.types.js').CalculatedSalesInvoiceLine {
  return {
    lineNumber: line.lineNumber,
    quantity: formatDecimal6(line.quantity),
    unitPrice: formatDecimal4(line.unitPrice),
    grossAmount: formatDecimal4(line.grossAmount),
    lineDiscountAmount: formatDecimal4(line.lineDiscountAmount),
    allocatedInvoiceDiscount: formatDecimal4(allocatedInvoiceDiscount),
    taxableAmount: formatDecimal4(tax.taxableAmount),
    cgstRate: formatDecimal4(tax.cgstRate),
    cgstAmount: formatDecimal4(tax.cgstAmount),
    sgstRate: formatDecimal4(tax.sgstRate),
    sgstAmount: formatDecimal4(tax.sgstAmount),
    igstRate: formatDecimal4(tax.igstRate),
    igstAmount: formatDecimal4(tax.igstAmount),
    cessRate: formatDecimal4(tax.cessRate),
    cessAmount: formatDecimal4(tax.cessAmount),
    lineTotal: formatDecimal4(tax.lineTotal),
    hsnCode: line.hsnCode,
    description: line.description,
    itemId: line.itemId,
    itemCodeSnapshot: line.itemCodeSnapshot,
    itemNameSnapshot: line.itemNameSnapshot,
    uomSnapshot: line.uomSnapshot,
    revenueAccountId: line.revenueAccountId,
    costCentreId: line.costCentreId,
    isTaxInclusive: line.isTaxInclusive,
  }
}

function mergeTaxBucket(
  buckets: Map<string, TaxSummaryByRate>,
  gstRate: Prisma.Decimal,
  cessRate: Prisma.Decimal,
  taxable: Prisma.Decimal,
  cgst: Prisma.Decimal,
  sgst: Prisma.Decimal,
  igst: Prisma.Decimal,
  cess: Prisma.Decimal,
): void {
  const key = `${gstRate.toFixed(4)}|${cessRate.toFixed(4)}`
  const existing = buckets.get(key) ?? {
    gstRate: formatDecimal4(gstRate),
    cessRate: formatDecimal4(cessRate),
    taxableAmount: '0.0000',
    cgstAmount: '0.0000',
    sgstAmount: '0.0000',
    igstAmount: '0.0000',
    cessAmount: '0.0000',
    totalTaxAmount: '0.0000',
  }
  existing.taxableAmount = formatDecimal4(add(toDecimal(existing.taxableAmount), taxable))
  existing.cgstAmount = formatDecimal4(add(toDecimal(existing.cgstAmount), cgst))
  existing.sgstAmount = formatDecimal4(add(toDecimal(existing.sgstAmount), sgst))
  existing.igstAmount = formatDecimal4(add(toDecimal(existing.igstAmount), igst))
  existing.cessAmount = formatDecimal4(add(toDecimal(existing.cessAmount), cess))
  existing.totalTaxAmount = formatDecimal4(
    add(
      toDecimal(existing.cgstAmount),
      add(toDecimal(existing.sgstAmount), add(toDecimal(existing.igstAmount), toDecimal(existing.cessAmount))),
    ),
  )
  buckets.set(key, existing)
}

export function buildTaxSummary(
  calculatedLines: import('./sales-invoice-calculation.types.js').CalculatedSalesInvoiceLine[],
  chargeSlices: ChargeTaxSlice[] = [],
): TaxSummaryByRate[] {
  const buckets = new Map<string, TaxSummaryByRate>()

  for (const line of calculatedLines) {
    const gstRate = add(add(toDecimal(line.cgstRate), toDecimal(line.sgstRate)), toDecimal(line.igstRate))
    mergeTaxBucket(
      buckets,
      gstRate,
      toDecimal(line.cessRate),
      toDecimal(line.taxableAmount),
      toDecimal(line.cgstAmount),
      toDecimal(line.sgstAmount),
      toDecimal(line.igstAmount),
      toDecimal(line.cessAmount),
    )
  }

  for (const slice of chargeSlices) {
    mergeTaxBucket(
      buckets,
      slice.gstRate,
      slice.cessRate,
      slice.taxableAmount,
      slice.cgstAmount,
      slice.sgstAmount,
      slice.igstAmount,
      slice.cessAmount,
    )
  }

  return [...buckets.values()].sort((a, b) => compare(toDecimal(a.gstRate), toDecimal(b.gstRate)))
}
