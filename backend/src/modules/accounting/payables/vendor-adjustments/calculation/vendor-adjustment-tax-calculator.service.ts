import { Prisma } from '@prisma/client'
import type { InputTaxCreditEligibility, VendorInvoiceTaxTreatment } from '@prisma/client'
import {
  add,
  compare,
  divide,
  isNegative,
  isZero,
  multiply,
  roundPercentage,
  roundTax,
  subtract,
  toDecimal,
} from '../../../shared/finance-decimal.js'
import { normalizeStateCode } from '../../../receivables/validation/state-code.validator.js'
import type { RawVendorAdjustmentLineAmounts } from './vendor-adjustment-line-calculator.service.js'
import type {
  VendorAdjustmentPurchaseSupplyType,
  VendorAdjustmentValidationIssue,
} from './vendor-adjustment-calculation.types.js'
import { calcError, calcWarning, VENDOR_ADJUSTMENT_CALC_CODES } from './vendor-adjustment-calculation.errors.js'

const ZERO = new Prisma.Decimal(0)
const INCLUSIVE_TOLERANCE = toDecimal('0.01')

/** Zero-rated treatments — no GST computed regardless of rates supplied. */
export function isZeroTaxTreatment(taxTreatment: VendorInvoiceTaxTreatment): boolean {
  return taxTreatment === 'NON_GST' || taxTreatment === 'EXEMPT' || taxTreatment === 'NIL_RATED'
}

/** Reverse charge — tax is self-assessed by the buyer, never part of what is owed to the vendor. */
export function isReverseChargeTreatment(taxTreatment: VendorInvoiceTaxTreatment): boolean {
  return taxTreatment === 'REVERSE_CHARGE'
}

export interface PurchaseSupplyDetermination {
  derivedSupplyType: VendorAdjustmentPurchaseSupplyType
  supplyType: VendorAdjustmentPurchaseSupplyType
}

/**
 * AP supply type derives from company state vs place-of-supply (falling back to vendor state).
 * Unlike AR, there is no EXPORT/SEZ/NON_GST supply-type member — those are handled via taxTreatment.
 */
export function determinePurchaseSupplyType(
  companyStateCode: string | null | undefined,
  placeOfSupply: string | null | undefined,
  vendorStateCode: string | null | undefined,
  manualSupplyType: VendorAdjustmentPurchaseSupplyType | undefined,
  errors: VendorAdjustmentValidationIssue[],
  /** Zero-tax treatments (NON_GST/EXEMPT/NIL_RATED) don't need state codes to compute tax — suppress the required-field error. */
  skipRequiredValidation = false,
): PurchaseSupplyDetermination {
  const company = normalizeStateCode(companyStateCode)
  const reference = normalizeStateCode(placeOfSupply) ?? normalizeStateCode(vendorStateCode)

  let derived: VendorAdjustmentPurchaseSupplyType
  if (company && reference) {
    derived = company === reference ? 'INTRA_STATE' : 'INTER_STATE'
  } else {
    derived = manualSupplyType ?? 'INTRA_STATE'
    if (!skipRequiredValidation) {
      errors.push(
        calcError(
          VENDOR_ADJUSTMENT_CALC_CODES.PLACE_OF_SUPPLY_REQUIRED,
          'Company state code and place of supply (or vendor state code) are required to determine purchase supply type',
          'placeOfSupply',
        ),
      )
    }
  }

  const supplyType = manualSupplyType ?? derived
  if (manualSupplyType && manualSupplyType !== derived) {
    errors.push(
      calcError(
        VENDOR_ADJUSTMENT_CALC_CODES.SUPPLY_TYPE_MISMATCH,
        `Manual supply type ${manualSupplyType} conflicts with derived supply type ${derived}`,
        'supplyType',
      ),
    )
  }

  return { derivedSupplyType: derived, supplyType }
}

/** Split combined GST rate into CGST/SGST (intra-state) or IGST (inter-state). Duplicated locally to avoid AR coupling. */
export function splitGstRateLocal(
  gstRate: Prisma.Decimal,
  supplyType: VendorAdjustmentPurchaseSupplyType,
): { cgstRate: Prisma.Decimal; sgstRate: Prisma.Decimal; igstRate: Prisma.Decimal } {
  if (isZero(gstRate)) {
    return { cgstRate: ZERO, sgstRate: ZERO, igstRate: ZERO }
  }
  if (supplyType === 'INTRA_STATE') {
    const half = roundPercentage(divide(gstRate, 2))
    const other = roundPercentage(subtract(gstRate, half))
    return { cgstRate: half, sgstRate: other, igstRate: ZERO }
  }
  return { cgstRate: ZERO, sgstRate: ZERO, igstRate: gstRate }
}

/** Compute GST + cess amounts from a taxable base and split rates. Duplicated locally to avoid AR coupling. */
export function computeTaxFromTaxableLocal(
  taxable: Prisma.Decimal,
  cgstRate: Prisma.Decimal,
  sgstRate: Prisma.Decimal,
  igstRate: Prisma.Decimal,
  cessRate: Prisma.Decimal,
): { cgstAmount: Prisma.Decimal; sgstAmount: Prisma.Decimal; igstAmount: Prisma.Decimal; cessAmount: Prisma.Decimal } {
  return {
    cgstAmount: roundTax(multiply(taxable, divide(cgstRate, 100))),
    sgstAmount: roundTax(multiply(taxable, divide(sgstRate, 100))),
    igstAmount: roundTax(multiply(taxable, divide(igstRate, 100))),
    cessAmount: roundTax(multiply(taxable, divide(cessRate, 100))),
  }
}

interface RateSet {
  cgstRate: Prisma.Decimal
  sgstRate: Prisma.Decimal
  igstRate: Prisma.Decimal
}

function resolveLineRates(line: RawVendorAdjustmentLineAmounts, supplyType: VendorAdjustmentPurchaseSupplyType): RateSet {
  if (line.hasExplicitRates) {
    return {
      cgstRate: line.cgstRateOverride ?? ZERO,
      sgstRate: line.sgstRateOverride ?? ZERO,
      igstRate: line.igstRateOverride ?? ZERO,
    }
  }
  return splitGstRateLocal(line.gstRate ?? ZERO, supplyType)
}

/** Tax-inclusive derivation — taxable = inclusive ÷ (1 + GST÷100); cess applied on that base afterward. */
function deriveTaxableFromInclusiveLocal(
  inclusiveValue: Prisma.Decimal,
  rates: RateSet,
  cessRate: Prisma.Decimal,
  lineNumber: number,
  errors: VendorAdjustmentValidationIssue[],
  warnings: VendorAdjustmentValidationIssue[],
): { taxable: Prisma.Decimal; taxes: ReturnType<typeof computeTaxFromTaxableLocal>; lineTotal: Prisma.Decimal } {
  const effectiveGstRate = add(add(rates.cgstRate, rates.sgstRate), rates.igstRate)
  const divisor = add(1, divide(effectiveGstRate, 100))
  const taxable = roundTax(divide(inclusiveValue, divisor))
  const taxes = computeTaxFromTaxableLocal(taxable, rates.cgstRate, rates.sgstRate, rates.igstRate, cessRate)
  const lineTotal = roundTax(add(taxable, add(taxes.cgstAmount, add(taxes.sgstAmount, add(taxes.igstAmount, taxes.cessAmount)))))

  if (isZero(cessRate)) {
    const diff = subtract(inclusiveValue, lineTotal).abs()
    if (compare(diff, INCLUSIVE_TOLERANCE) > 0) {
      errors.push(
        calcError(
          VENDOR_ADJUSTMENT_CALC_CODES.INCLUSIVE_TAX_MISMATCH,
          `Tax-inclusive line ${lineNumber} components do not reconcile within tolerance (${diff.toFixed(4)})`,
          `lines[${lineNumber}]`,
        ),
      )
    }
    return { taxable, taxes, lineTotal: inclusiveValue }
  }

  const diff = subtract(lineTotal, inclusiveValue).abs()
  if (compare(diff, INCLUSIVE_TOLERANCE) > 0) {
    warnings.push(
      calcWarning(
        VENDOR_ADJUSTMENT_CALC_CODES.CESS_ON_INCLUSIVE_EXCEEDS_PRICE,
        `Tax-inclusive line ${lineNumber} with cess exceeds inclusive price by ${diff.toFixed(4)}`,
        `lines[${lineNumber}]`,
      ),
    )
  }
  return { taxable, taxes, lineTotal }
}

/**
 * ITC eligibility split of a tax amount into recoverable (input tax credit) vs non-recoverable (folded into cost).
 * - ELIGIBLE: fully recoverable
 * - INELIGIBLE: fully non-recoverable
 * - PARTIALLY_ELIGIBLE: split by itcEligiblePercent
 * - PENDING_REVIEW: treated as fully recoverable, flagged for later review
 */
export function splitItcRecoverable(
  totalTax: Prisma.Decimal,
  itcEligibility: InputTaxCreditEligibility,
  itcEligiblePercent: Prisma.Decimal | null,
  lineNumber: number,
  errors: VendorAdjustmentValidationIssue[],
  warnings: VendorAdjustmentValidationIssue[],
): { recoverable: Prisma.Decimal; nonRecoverable: Prisma.Decimal } {
  switch (itcEligibility) {
    case 'ELIGIBLE':
      return { recoverable: totalTax, nonRecoverable: ZERO }
    case 'INELIGIBLE':
      return { recoverable: ZERO, nonRecoverable: totalTax }
    case 'PARTIALLY_ELIGIBLE': {
      const percent = itcEligiblePercent ?? null
      if (percent == null || isNegative(percent) || compare(percent, 100) > 0) {
        errors.push(
          calcError(
            VENDOR_ADJUSTMENT_CALC_CODES.ITC_ELIGIBLE_PERCENT_INVALID,
            `Line ${lineNumber} itcEligiblePercent must be between 0 and 100 when ITC eligibility is PARTIALLY_ELIGIBLE`,
            `lines[${lineNumber}].itcEligiblePercent`,
          ),
        )
        return { recoverable: totalTax, nonRecoverable: ZERO }
      }
      const recoverable = roundTax(multiply(totalTax, divide(percent, 100)))
      const nonRecoverable = roundTax(subtract(totalTax, recoverable))
      return { recoverable, nonRecoverable }
    }
    case 'PENDING_REVIEW':
    default:
      warnings.push(
        calcWarning(
          VENDOR_ADJUSTMENT_CALC_CODES.ITC_PENDING_REVIEW,
          `Line ${lineNumber} ITC eligibility is pending review — treated as recoverable until confirmed`,
          `lines[${lineNumber}].itcEligibility`,
        ),
      )
      return { recoverable: totalTax, nonRecoverable: ZERO }
  }
}

export interface VendorAdjustmentLineTaxResult {
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
  totalTaxAmount: Prisma.Decimal
  recoverableTaxAmount: Prisma.Decimal
  nonRecoverableTaxAmount: Prisma.Decimal
  lineTotal: Prisma.Decimal
  isReverseCharge: boolean
  effectiveTaxTreatment: VendorInvoiceTaxTreatment
  effectiveItcEligibility: InputTaxCreditEligibility
  effectiveItcEligiblePercent: Prisma.Decimal
}

/** Computes tax for a single line, honouring line-level taxTreatment/ITC overrides and RCM self-assessment. */
export function computeLineTax(
  line: RawVendorAdjustmentLineAmounts,
  allocatedHeaderDiscount: Prisma.Decimal,
  supplyType: VendorAdjustmentPurchaseSupplyType,
  headerTaxTreatment: VendorInvoiceTaxTreatment,
  headerItcEligibility: InputTaxCreditEligibility,
  headerItcEligiblePercent: Prisma.Decimal | null,
  errors: VendorAdjustmentValidationIssue[],
  warnings: VendorAdjustmentValidationIssue[],
): VendorAdjustmentLineTaxResult {
  const preTaxBase = roundTax(subtract(line.netBeforeHeaderDiscount, allocatedHeaderDiscount))
  const effectiveTaxTreatment = line.purchaseTaxTreatment ?? headerTaxTreatment
  const effectiveItcEligibility = line.itcEligibility ?? headerItcEligibility
  const effectiveItcEligiblePercent = line.itcEligiblePercent ?? headerItcEligiblePercent ?? ZERO

  if (isZeroTaxTreatment(effectiveTaxTreatment)) {
    return {
      lineNumber: line.lineNumber,
      taxableAmount: preTaxBase,
      cgstRate: ZERO,
      cgstAmount: ZERO,
      sgstRate: ZERO,
      sgstAmount: ZERO,
      igstRate: ZERO,
      igstAmount: ZERO,
      cessRate: ZERO,
      cessAmount: ZERO,
      totalTaxAmount: ZERO,
      recoverableTaxAmount: ZERO,
      nonRecoverableTaxAmount: ZERO,
      lineTotal: preTaxBase,
      isReverseCharge: false,
      effectiveTaxTreatment,
      effectiveItcEligibility,
      effectiveItcEligiblePercent,
    }
  }

  const isReverseCharge = isReverseChargeTreatment(effectiveTaxTreatment)
  const rates = resolveLineRates(line, supplyType)

  let taxableAmount: Prisma.Decimal
  let taxes: ReturnType<typeof computeTaxFromTaxableLocal>

  const hasAnyRate = !isZero(rates.cgstRate) || !isZero(rates.sgstRate) || !isZero(rates.igstRate)
  if (line.isTaxInclusive && hasAnyRate) {
    const derived = deriveTaxableFromInclusiveLocal(preTaxBase, rates, line.cessRate, line.lineNumber, errors, warnings)
    taxableAmount = derived.taxable
    taxes = derived.taxes
  } else {
    taxableAmount = preTaxBase
    taxes = computeTaxFromTaxableLocal(taxableAmount, rates.cgstRate, rates.sgstRate, rates.igstRate, line.cessRate)
  }

  const totalTaxAmount = add(add(taxes.cgstAmount, taxes.sgstAmount), add(taxes.igstAmount, taxes.cessAmount))
  const lineTotal = isReverseCharge ? taxableAmount : roundTax(add(taxableAmount, totalTaxAmount))

  const { recoverable, nonRecoverable } = splitItcRecoverable(
    totalTaxAmount,
    effectiveItcEligibility,
    line.itcEligiblePercent ?? headerItcEligiblePercent,
    line.lineNumber,
    errors,
    warnings,
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
    totalTaxAmount,
    recoverableTaxAmount: recoverable,
    nonRecoverableTaxAmount: nonRecoverable,
    lineTotal,
    isReverseCharge,
    effectiveTaxTreatment,
    effectiveItcEligibility,
    effectiveItcEligiblePercent,
  }
}

export interface ChargeTaxResult {
  taxableAmount: Prisma.Decimal
  cgstRate: Prisma.Decimal
  cgstAmount: Prisma.Decimal
  sgstRate: Prisma.Decimal
  sgstAmount: Prisma.Decimal
  igstRate: Prisma.Decimal
  igstAmount: Prisma.Decimal
  totalTaxAmount: Prisma.Decimal
}

/** Simple header-level charge (freight/other charge) tax — single combined GST rate, no cess. */
export function computeChargeTax(
  amount: Prisma.Decimal,
  gstRate: string | null | undefined,
  supplyType: VendorAdjustmentPurchaseSupplyType,
  zeroTax: boolean,
  field: string,
  errors: VendorAdjustmentValidationIssue[],
): ChargeTaxResult {
  if (isZero(amount) || zeroTax || gstRate == null || isZero(gstRate)) {
    return { taxableAmount: ZERO, cgstRate: ZERO, cgstAmount: ZERO, sgstRate: ZERO, sgstAmount: ZERO, igstRate: ZERO, igstAmount: ZERO, totalTaxAmount: ZERO }
  }
  const rate = roundPercentage(gstRate)
  validateChargeRate(rate, field, errors)
  const rates = splitGstRateLocal(rate, supplyType)
  const taxes = computeTaxFromTaxableLocal(amount, rates.cgstRate, rates.sgstRate, rates.igstRate, ZERO)
  return {
    taxableAmount: amount,
    cgstRate: rates.cgstRate,
    cgstAmount: taxes.cgstAmount,
    sgstRate: rates.sgstRate,
    sgstAmount: taxes.sgstAmount,
    igstRate: rates.igstRate,
    igstAmount: taxes.igstAmount,
    totalTaxAmount: add(add(taxes.cgstAmount, taxes.sgstAmount), taxes.igstAmount),
  }
}

function validateChargeRate(rate: Prisma.Decimal, field: string, errors: VendorAdjustmentValidationIssue[]): void {
  if (compare(rate, 0) < 0 || compare(rate, 100) > 0) {
    errors.push(calcError(VENDOR_ADJUSTMENT_CALC_CODES.TAX_RATE_INVALID, 'Tax rate must be between 0 and 100', field))
  }
}
