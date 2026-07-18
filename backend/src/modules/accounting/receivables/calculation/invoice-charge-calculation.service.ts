import { Prisma } from '@prisma/client'
import {
  add,
  compare,
  isNegative,
  isZero,
  roundPercentage,
  roundTax,
  sumDecimals,
  toDecimal,
} from '../../shared/finance-decimal.js'
import type { SalesInvoiceSupplyType, SalesInvoiceTaxTreatment } from '../sales-invoices/sales-invoice.types.js'
import type { CalculationIssue, OtherChargeInput } from './sales-invoice-calculation.types.js'
import { calcError } from './sales-invoice-calculation.errors.js'
import { formatDecimal4 } from './sales-invoice-line-calculation.service.js'
import { computeTaxFromTaxable, splitGstRate } from './gst-calculation.service.js'
import { isZeroGstSupply } from './gst-supply-determination.service.js'

export interface ChargeTaxSlice {
  gstRate: Prisma.Decimal
  cessRate: Prisma.Decimal
  taxableAmount: Prisma.Decimal
  cgstAmount: Prisma.Decimal
  sgstAmount: Prisma.Decimal
  igstAmount: Prisma.Decimal
  cessAmount: Prisma.Decimal
}

export interface ChargeComputationResult {
  freightAmount: Prisma.Decimal
  freightTaxableAmount: Prisma.Decimal
  freightCgstAmount: Prisma.Decimal
  freightSgstAmount: Prisma.Decimal
  freightIgstAmount: Prisma.Decimal
  otherChargesAmount: Prisma.Decimal
  otherChargesTaxableAmount: Prisma.Decimal
  otherChargesCgstAmount: Prisma.Decimal
  otherChargesSgstAmount: Prisma.Decimal
  otherChargesIgstAmount: Prisma.Decimal
  nonTaxableChargeTotal: Prisma.Decimal
  chargePreRoundAddition: Prisma.Decimal
  taxSummarySlices: ChargeTaxSlice[]
}

export interface ChargeComputationInput {
  lineTotalSum: Prisma.Decimal
  freightMode: 'NON_TAXABLE' | 'TAXABLE'
  freightAmount?: string
  freightTaxRate?: string | null
  otherChargesAmount?: string
  otherCharges?: OtherChargeInput[]
  supplyType: SalesInvoiceSupplyType
  taxTreatment: SalesInvoiceTaxTreatment
  errors: CalculationIssue[]
}

function parseNonNegativeAmount(
  value: string | undefined,
  field: string,
  errorCode: string,
  errors: CalculationIssue[],
): Prisma.Decimal {
  if (!value || isZero(value)) return new Prisma.Decimal(0)
  const amount = toDecimal(value)
  if (isNegative(amount)) {
    errors.push(calcError(errorCode, `${field} cannot be negative`, field))
    return new Prisma.Decimal(0)
  }
  return roundTax(amount)
}

function taxChargeAmount(
  amount: Prisma.Decimal,
  taxRate: Prisma.Decimal,
  supplyType: SalesInvoiceSupplyType,
  zeroGst: boolean,
): { taxes: ReturnType<typeof computeTaxFromTaxable>; rates: ReturnType<typeof splitGstRate>; gstRate: Prisma.Decimal } {
  const gstRate = roundPercentage(taxRate)
  const rates = splitGstRate(gstRate, supplyType, zeroGst)
  const taxes = computeTaxFromTaxable(amount, rates.cgstRate, rates.sgstRate, rates.igstRate, new Prisma.Decimal(0))
  return { taxes, rates, gstRate }
}

export function computeInvoiceCharges(input: ChargeComputationInput): ChargeComputationResult {
  const { supplyType, taxTreatment, errors } = input
  const zeroGst = isZeroGstSupply(supplyType, taxTreatment)

  let freightAmount = parseNonNegativeAmount(
    input.freightAmount,
    'freightAmount',
    'INVOICE_FREIGHT_INVALID',
    errors,
  )
  let freightTaxable = new Prisma.Decimal(0)
  let freightCgst = new Prisma.Decimal(0)
  let freightSgst = new Prisma.Decimal(0)
  let freightIgst = new Prisma.Decimal(0)
  const taxSummarySlices: ChargeTaxSlice[] = []

  if (!isZero(freightAmount)) {
    if (input.freightMode === 'TAXABLE') {
      const taxRate = input.freightTaxRate ?? '0'
      if (compare(toDecimal(taxRate), 0) < 0 || compare(toDecimal(taxRate), 100) > 0) {
        errors.push(calcError('INVOICE_TAX_RATE_INVALID', 'Freight tax rate must be between 0 and 100', 'freightTaxRate'))
      } else {
        freightTaxable = freightAmount
        const { taxes, gstRate } = taxChargeAmount(freightAmount, toDecimal(taxRate), supplyType, zeroGst)
        freightCgst = taxes.cgstAmount
        freightSgst = taxes.sgstAmount
        freightIgst = taxes.igstAmount
        taxSummarySlices.push({
          gstRate,
          cessRate: new Prisma.Decimal(0),
          taxableAmount: freightTaxable,
          cgstAmount: freightCgst,
          sgstAmount: freightSgst,
          igstAmount: freightIgst,
          cessAmount: new Prisma.Decimal(0),
        })
      }
    }
  }

  let otherChargesTotal = parseNonNegativeAmount(
    input.otherChargesAmount,
    'otherChargesAmount',
    'INVOICE_OTHER_CHARGE_INVALID',
    errors,
  )
  let otherTaxable = new Prisma.Decimal(0)
  let otherCgst = new Prisma.Decimal(0)
  let otherSgst = new Prisma.Decimal(0)
  let otherIgst = new Prisma.Decimal(0)
  let otherNonTaxable = otherChargesTotal

  for (const [index, charge] of (input.otherCharges ?? []).entries()) {
    const amount = parseNonNegativeAmount(
      charge.amount,
      `otherCharges[${index}].amount`,
      'INVOICE_OTHER_CHARGE_INVALID',
      errors,
    )
    if (isZero(amount)) continue
    otherChargesTotal = add(otherChargesTotal, amount)

    if (charge.includeInTaxableValue) {
      const taxRate = charge.taxRate ?? '0'
      if (compare(toDecimal(taxRate), 0) < 0 || compare(toDecimal(taxRate), 100) > 0) {
        errors.push(
          calcError('INVOICE_TAX_RATE_INVALID', 'Other charge tax rate must be between 0 and 100', `otherCharges[${index}].taxRate`),
        )
        continue
      }
      otherTaxable = add(otherTaxable, amount)
      const { taxes, gstRate } = taxChargeAmount(amount, toDecimal(taxRate), supplyType, zeroGst)
      otherCgst = add(otherCgst, taxes.cgstAmount)
      otherSgst = add(otherSgst, taxes.sgstAmount)
      otherIgst = add(otherIgst, taxes.igstAmount)
      taxSummarySlices.push({
        gstRate,
        cessRate: new Prisma.Decimal(0),
        taxableAmount: amount,
        cgstAmount: taxes.cgstAmount,
        sgstAmount: taxes.sgstAmount,
        igstAmount: taxes.igstAmount,
        cessAmount: new Prisma.Decimal(0),
      })
    } else {
      otherNonTaxable = add(otherNonTaxable, amount)
    }
  }

  const freightNonTaxable = input.freightMode === 'NON_TAXABLE' ? freightAmount : new Prisma.Decimal(0)
  const freightTaxContribution = add(add(freightTaxable, freightCgst), add(freightSgst, freightIgst))
  const otherTaxContribution = add(add(otherTaxable, otherCgst), add(otherSgst, otherIgst))
  const nonTaxableChargeTotal = add(freightNonTaxable, otherNonTaxable)
  const chargePreRoundAddition = add(nonTaxableChargeTotal, add(freightTaxContribution, otherTaxContribution))

  void input.lineTotalSum

  return {
    freightAmount,
    freightTaxableAmount: freightTaxable,
    freightCgstAmount: freightCgst,
    freightSgstAmount: freightSgst,
    freightIgstAmount: freightIgst,
    otherChargesAmount: otherChargesTotal,
    otherChargesTaxableAmount: otherTaxable,
    otherChargesCgstAmount: otherCgst,
    otherChargesSgstAmount: otherSgst,
    otherChargesIgstAmount: otherIgst,
    nonTaxableChargeTotal,
    chargePreRoundAddition,
    taxSummarySlices,
  }
}

export function computePreRoundTotal(lineTotalSum: Prisma.Decimal, charges: ChargeComputationResult): string {
  return formatDecimal4(add(lineTotalSum, charges.chargePreRoundAddition))
}

export function sumChargeTaxes(charges: ChargeComputationResult): {
  cgst: Prisma.Decimal
  sgst: Prisma.Decimal
  igst: Prisma.Decimal
} {
  return {
    cgst: add(charges.freightCgstAmount, charges.otherChargesCgstAmount),
    sgst: add(charges.freightSgstAmount, charges.otherChargesSgstAmount),
    igst: add(charges.freightIgstAmount, charges.otherChargesIgstAmount),
  }
}

export function sumChargeTaxable(charges: ChargeComputationResult): Prisma.Decimal {
  return sumDecimals([charges.freightTaxableAmount, charges.otherChargesTaxableAmount])
}
