import { Prisma } from '@prisma/client'
import type {
  InputTaxCreditEligibility,
  VendorAdjustmentLineType,
  VendorAdjustmentSourceLinkType,
  VendorInvoiceTaxTreatment,
} from '@prisma/client'
import {
  compare,
  divide,
  isNegative,
  isPositive,
  isZero,
  multiply,
  roundPercentage,
  roundQuantity,
  roundTax,
  subtract,
  toDecimal,
} from '../../../shared/finance-decimal.js'
import { validateHsnSac } from '../../../receivables/validation/hsn-sac.validator.js'
import type {
  VendorAdjustmentCalculationLineInput,
  VendorAdjustmentLineDiscountType,
  VendorAdjustmentValidationIssue,
} from './vendor-adjustment-calculation.types.js'
import { calcError, calcWarning, VENDOR_ADJUSTMENT_CALC_CODES } from './vendor-adjustment-calculation.errors.js'

/** Line amounts after gross/discount math but before tax — tax split needs the header supply type. */
export interface RawVendorAdjustmentLineAmounts {
  lineNumber: number
  lineType: VendorAdjustmentLineType
  quantity: Prisma.Decimal
  unitPrice: Prisma.Decimal
  grossAmount: Prisma.Decimal
  discountPercent: Prisma.Decimal
  lineDiscountAmount: Prisma.Decimal
  netBeforeHeaderDiscount: Prisma.Decimal
  /** Combined rate — used only when no explicit component rate is present. */
  gstRate: Prisma.Decimal | null
  cgstRateOverride: Prisma.Decimal | null
  sgstRateOverride: Prisma.Decimal | null
  igstRateOverride: Prisma.Decimal | null
  hasExplicitRates: boolean
  cessRate: Prisma.Decimal
  isTaxInclusive: boolean
  description: string
  itemId: string | null
  itemCodeSnapshot: string | null
  itemNameSnapshot: string | null
  hsnSacCode: string | null
  uomId: string | null
  uomCodeSnapshot: string | null
  offsetAccountId: string | null
  costCentreId: string | null
  projectReference: string | null
  departmentReference: string | null
  purchaseTaxTreatment: VendorInvoiceTaxTreatment | null
  itcEligibility: InputTaxCreditEligibility | null
  itcEligiblePercent: Prisma.Decimal | null
  sourceLinkType: VendorAdjustmentSourceLinkType | null
  sourceDocumentId: string | null
  sourceDocumentNumber: string | null
  sourceDocumentLineId: string | null
}

function applyLineDiscount(
  gross: Prisma.Decimal,
  discountType: VendorAdjustmentLineDiscountType | undefined,
  discountValue: string | undefined,
  lineNumber: number,
  errors: VendorAdjustmentValidationIssue[],
): Prisma.Decimal {
  if (!discountType || !discountValue || isZero(discountValue)) {
    return new Prisma.Decimal(0)
  }
  const value = toDecimal(discountValue)
  if (isNegative(value)) {
    errors.push(
      calcError(VENDOR_ADJUSTMENT_CALC_CODES.LINE_DISCOUNT_INVALID, 'Line discount cannot be negative', `lines[${lineNumber}].lineDiscountValue`),
    )
    return new Prisma.Decimal(0)
  }
  if (discountType === 'PERCENTAGE') {
    if (compare(value, 100) > 0) {
      errors.push(
        calcError(
          VENDOR_ADJUSTMENT_CALC_CODES.LINE_DISCOUNT_INVALID,
          'Line discount percentage cannot exceed 100',
          `lines[${lineNumber}].lineDiscountValue`,
        ),
      )
      return gross
    }
    return roundTax(multiply(gross, divide(value, 100)))
  }
  if (compare(value, gross) > 0) {
    errors.push(
      calcError(
        VENDOR_ADJUSTMENT_CALC_CODES.LINE_DISCOUNT_INVALID,
        'Line discount amount cannot exceed line gross',
        `lines[${lineNumber}].lineDiscountValue`,
      ),
    )
    return gross
  }
  return roundTax(value)
}

function validateRate(
  rate: Prisma.Decimal,
  field: string,
  errors: VendorAdjustmentValidationIssue[],
  code: string = VENDOR_ADJUSTMENT_CALC_CODES.TAX_RATE_INVALID,
): void {
  if (compare(rate, 0) < 0 || compare(rate, 100) > 0) {
    errors.push(calcError(code, 'Tax rate must be between 0 and 100', field))
  }
}

/** Parses gross/discount/rate fields for every line — tax split/derivation happens in the tax calculator. */
export function computeRawLineAmounts(
  lines: VendorAdjustmentCalculationLineInput[],
  errors: VendorAdjustmentValidationIssue[],
  warnings: VendorAdjustmentValidationIssue[],
): RawVendorAdjustmentLineAmounts[] {
  const result: RawVendorAdjustmentLineAmounts[] = []

  for (const line of lines) {
    const qty = roundQuantity(line.quantity)
    const unitPrice = roundTax(line.unitPrice)

    if (!isPositive(qty)) {
      errors.push(calcError(VENDOR_ADJUSTMENT_CALC_CODES.QUANTITY_INVALID, 'Quantity must be greater than zero', `lines[${line.lineNumber}].quantity`))
    }
    if (isNegative(unitPrice)) {
      errors.push(calcError(VENDOR_ADJUSTMENT_CALC_CODES.UNIT_PRICE_INVALID, 'Unit price cannot be negative', `lines[${line.lineNumber}].unitPrice`))
    }

    const grossAmount = roundTax(multiply(qty, unitPrice))
    const lineDiscountAmount = applyLineDiscount(grossAmount, line.lineDiscountType, line.lineDiscountValue, line.lineNumber, errors)
    const discountPercent = isZero(grossAmount) ? new Prisma.Decimal(0) : roundPercentage(multiply(divide(lineDiscountAmount, grossAmount), 100))
    const netBeforeHeaderDiscount = roundTax(subtract(grossAmount, lineDiscountAmount))

    const hasExplicitRates = line.cgstRate != null || line.sgstRate != null || line.igstRate != null
    let gstRate: Prisma.Decimal | null = null
    let cgstRateOverride: Prisma.Decimal | null = null
    let sgstRateOverride: Prisma.Decimal | null = null
    let igstRateOverride: Prisma.Decimal | null = null

    if (hasExplicitRates) {
      cgstRateOverride = roundPercentage(line.cgstRate ?? '0')
      sgstRateOverride = roundPercentage(line.sgstRate ?? '0')
      igstRateOverride = roundPercentage(line.igstRate ?? '0')
      validateRate(cgstRateOverride, `lines[${line.lineNumber}].cgstRate`, errors)
      validateRate(sgstRateOverride, `lines[${line.lineNumber}].sgstRate`, errors)
      validateRate(igstRateOverride, `lines[${line.lineNumber}].igstRate`, errors)
      if (!isZero(cgstRateOverride) && !isZero(igstRateOverride)) {
        warnings.push(
          calcWarning(
            VENDOR_ADJUSTMENT_CALC_CODES.EXPLICIT_RATE_SUPPLY_MISMATCH,
            `Line ${line.lineNumber} has both CGST/SGST and IGST rates set — this is unusual for a single supply`,
            `lines[${line.lineNumber}].igstRate`,
          ),
        )
      }
    } else {
      gstRate = roundPercentage(line.gstRate ?? '0')
      validateRate(gstRate, `lines[${line.lineNumber}].gstRate`, errors)
    }

    const cessRate = roundPercentage(line.cessRate ?? '0')
    validateRate(cessRate, `lines[${line.lineNumber}].cessRate`, errors, VENDOR_ADJUSTMENT_CALC_CODES.CESS_RATE_INVALID)

    const hsnCheck = validateHsnSac(line.hsnSacCode)
    if (!hsnCheck.valid) {
      errors.push(calcError(VENDOR_ADJUSTMENT_CALC_CODES.HSN_SAC_INVALID, hsnCheck.message ?? 'Invalid HSN/SAC', `lines[${line.lineNumber}].hsnSacCode`))
    } else if (hsnCheck.severity === 'warning') {
      warnings.push(
        calcWarning(
          VENDOR_ADJUSTMENT_CALC_CODES.HSN_SAC_LENGTH_WARNING,
          hsnCheck.message ?? 'HSN/SAC length warning',
          `lines[${line.lineNumber}].hsnSacCode`,
        ),
      )
    }

    let itcEligiblePercent: Prisma.Decimal | null = null
    if (line.itcEligiblePercent != null) {
      itcEligiblePercent = toDecimal(line.itcEligiblePercent)
    }

    result.push({
      lineNumber: line.lineNumber,
      lineType: line.lineType,
      quantity: qty,
      unitPrice,
      grossAmount,
      discountPercent,
      lineDiscountAmount,
      netBeforeHeaderDiscount,
      gstRate,
      cgstRateOverride,
      sgstRateOverride,
      igstRateOverride,
      hasExplicitRates,
      cessRate,
      isTaxInclusive: line.isTaxInclusive ?? false,
      description: line.description,
      itemId: line.itemId ?? null,
      itemCodeSnapshot: line.itemCodeSnapshot ?? null,
      itemNameSnapshot: line.itemNameSnapshot ?? null,
      hsnSacCode: line.hsnSacCode ?? null,
      uomId: line.uomId ?? null,
      uomCodeSnapshot: line.uomCodeSnapshot ?? null,
      offsetAccountId: line.offsetAccountId ?? null,
      costCentreId: line.costCentreId ?? null,
      projectReference: line.projectReference ?? null,
      departmentReference: line.departmentReference ?? null,
      purchaseTaxTreatment: line.purchaseTaxTreatment ?? null,
      itcEligibility: line.itcEligibility ?? null,
      itcEligiblePercent,
      sourceLinkType: line.sourceLinkType ?? null,
      sourceDocumentId: line.sourceDocumentId ?? null,
      sourceDocumentNumber: line.sourceDocumentNumber ?? null,
      sourceDocumentLineId: line.sourceDocumentLineId ?? null,
    })
  }

  return result
}
