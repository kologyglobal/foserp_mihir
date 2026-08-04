import type { Prisma, SalesInvoice, SalesInvoiceLine } from '@prisma/client'
import { add, isZero, toDecimal } from '../../shared/finance-decimal.js'
import type { SalesInvoiceCalculationInput } from '../calculation/sales-invoice-calculation.types.js'
import type { CreateSalesInvoiceInput, SalesInvoiceLineRequest, UpdateSalesInvoiceInput } from './sales-invoice.schemas.js'
import type {
  SalesInvoiceCalculationContext,
  SalesInvoiceLineRequestContext,
  SalesInvoiceWithLines,
} from './sales-invoice.types.js'

export function buildCalculationContextFromRequest(
  input: CreateSalesInvoiceInput | UpdateSalesInvoiceInput,
): SalesInvoiceCalculationContext {
  const body =
    'updatedAt' in input
      ? (({ updatedAt: _updatedAt, ...rest }) => rest)(input)
      : input
  return {
    taxPricingMode: body.taxPricingMode,
    invoiceDiscountType: body.invoiceDiscountType,
    invoiceDiscountValue: body.invoiceDiscountValue,
    freightMode: body.freightMode,
    freightTaxRate: body.freightTaxRate ?? null,
    freightRevenueAccountId: body.freightRevenueAccountId ?? null,
    otherCharges: body.otherCharges,
    roundingMode: body.roundingMode,
    manualRoundOff: body.manualRoundOff,
    roundingTolerance: body.roundingTolerance,
    lines: body.lines.map((line: SalesInvoiceLineRequestContextLike) => ({
      lineNumber: line.lineNumber,
      sourceLineId: line.sourceLineId ?? null,
      itemId: line.itemId ?? null,
      itemCode: line.itemCode ?? null,
      itemName: line.itemName ?? null,
      description: line.description,
      hsnCode: line.hsnCode ?? null,
      uom: line.uom ?? null,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineDiscountType: line.lineDiscountType,
      lineDiscountValue: line.lineDiscountValue,
      gstRate: line.gstRate,
      cessRate: line.cessRate,
      isTaxInclusive: line.isTaxInclusive,
      revenueAccountId: line.revenueAccountId ?? null,
      costCentreId: line.costCentreId ?? null,
    })),
  }
}

function mapLineToCalcInput(line: SalesInvoiceLineRequestContextLike): SalesInvoiceCalculationInput['lines'][number] {
  return {
    lineNumber: line.lineNumber,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineDiscountType: line.lineDiscountType,
    lineDiscountValue: line.lineDiscountValue,
    gstRate: line.gstRate,
    cessRate: line.cessRate,
    hsnCode: line.hsnCode ?? null,
    isTaxInclusive: line.isTaxInclusive,
    description: line.description ?? null,
    itemId: line.itemId ?? null,
    itemCodeSnapshot: line.itemCode ?? null,
    itemNameSnapshot: line.itemName ?? null,
    uomSnapshot: line.uom ?? null,
    revenueAccountId: line.revenueAccountId ?? null,
    costCentreId: line.costCentreId ?? null,
  }
}

interface SalesInvoiceLineRequestContextLike {
  lineNumber: number
  sourceLineId?: string | null
  quantity: string
  unitPrice: string
  lineDiscountType?: 'PERCENTAGE' | 'AMOUNT'
  lineDiscountValue?: string
  gstRate?: string
  cessRate?: string
  hsnCode?: string | null
  isTaxInclusive?: boolean
  description?: string | null
  itemId?: string | null
  itemCode?: string | null
  itemName?: string | null
  uom?: string | null
  revenueAccountId?: string | null
  costCentreId?: string | null
}

export function buildCalculationInput(
  header: Pick<
    SalesInvoice,
    | 'legalEntityId'
    | 'customerId'
    | 'placeOfSupply'
    | 'supplyType'
    | 'taxTreatment'
    | 'currencyCode'
    | 'exchangeRate'
    | 'invoiceDate'
    | 'postingDate'
    | 'freightAmount'
    | 'otherChargesAmount'
  >,
  context: SalesInvoiceCalculationContext,
  legalEntityStateCode?: string | null,
): SalesInvoiceCalculationInput {
  return {
    legalEntityId: header.legalEntityId,
    legalEntityStateCode: legalEntityStateCode ?? null,
    customerId: header.customerId,
    placeOfSupply: header.placeOfSupply,
    supplyType: header.supplyType,
    taxTreatment: header.taxTreatment,
    currencyCode: header.currencyCode,
    exchangeRate: header.exchangeRate.toString(),
    taxPricingMode: context.taxPricingMode ?? 'EXCLUSIVE',
    invoiceDiscountType: context.invoiceDiscountType,
    invoiceDiscountValue: context.invoiceDiscountValue,
    freightMode: context.freightMode ?? 'NON_TAXABLE',
    freightAmount: header.freightAmount.toString(),
    freightTaxRate: context.freightTaxRate ?? null,
    freightRevenueAccountId: context.freightRevenueAccountId ?? null,
    otherChargesAmount: header.otherChargesAmount.toString(),
    otherCharges: context.otherCharges,
    roundingMode: context.roundingMode ?? 'NONE',
    manualRoundOff: context.manualRoundOff,
    roundingTolerance: context.roundingTolerance,
    invoiceDate: header.invoiceDate.toISOString().slice(0, 10),
    postingDate: header.postingDate?.toISOString().slice(0, 10) ?? header.invoiceDate.toISOString().slice(0, 10),
    lines: context.lines.map(mapLineToCalcInput),
  }
}

export function buildCalculationInputFromRequest(
  input: CreateSalesInvoiceInput | UpdateSalesInvoiceInput,
  legalEntityStateCode?: string | null,
): SalesInvoiceCalculationInput {
  const legalEntityId = 'legalEntityId' in input ? input.legalEntityId : undefined
  return {
    legalEntityId: legalEntityId ?? '',
    legalEntityStateCode: legalEntityStateCode ?? null,
    customerId: input.customerId,
    placeOfSupply: input.placeOfSupply ?? null,
    supplyType: input.supplyType,
    taxTreatment: input.taxTreatment,
    currencyCode: input.currencyCode,
    exchangeRate: input.exchangeRate,
    taxPricingMode: input.taxPricingMode,
    invoiceDiscountType: input.invoiceDiscountType,
    invoiceDiscountValue: input.invoiceDiscountValue,
    freightMode: input.freightMode,
    freightAmount: input.freightAmount,
    freightTaxRate: input.freightTaxRate ?? null,
    freightRevenueAccountId: input.freightRevenueAccountId ?? null,
    otherChargesAmount: input.otherChargesAmount,
    otherCharges: input.otherCharges,
    roundingMode: input.roundingMode,
    manualRoundOff: input.manualRoundOff,
    roundingTolerance: input.roundingTolerance,
    invoiceDate: input.invoiceDate,
    postingDate: input.postingDate,
    lines: input.lines.map((line: SalesInvoiceLineRequest) => ({
      lineNumber: line.lineNumber,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineDiscountType: line.lineDiscountType,
      lineDiscountValue: line.lineDiscountValue,
      gstRate: line.gstRate,
      cessRate: line.cessRate,
      hsnCode: line.hsnCode ?? null,
      isTaxInclusive: line.isTaxInclusive,
      description: line.description,
      itemId: line.itemId ?? null,
      itemCodeSnapshot: line.itemCode ?? null,
      itemNameSnapshot: line.itemName ?? null,
      uomSnapshot: line.uom ?? null,
      revenueAccountId: line.revenueAccountId ?? null,
      costCentreId: line.costCentreId ?? null,
    })),
  }
}

export function parseCalculationContext(value: unknown): SalesInvoiceCalculationContext | null {
  if (!value || typeof value !== 'object') return null
  const ctx = value as SalesInvoiceCalculationContext
  if (!Array.isArray(ctx.lines) || ctx.lines.length === 0) return null
  return ctx
}

function decString(value: Prisma.Decimal | string | number | null | undefined): string {
  if (value == null) return '0'
  return toDecimal(value).toString()
}

/** GST % for calc engine = IGST when present, else CGST + SGST (intra-state split). */
function deriveGstRateFromStoredLine(line: SalesInvoiceLine): string {
  const igst = toDecimal(line.igstRate)
  if (igst.gt(0)) return igst.toString()
  return add(line.cgstRate, line.sgstRate).toString()
}

/**
 * Rebuild commercial calc context from persisted header + lines when
 * `calculationContext` was never stored (e.g. CRM tax-invoice migration).
 * Uses document snapshots only — does not invent amounts.
 */
export function reconstructCalculationContextFromStoredInvoice(
  invoice: SalesInvoiceWithLines,
): SalesInvoiceCalculationContext | null {
  if (!invoice.lines?.length) return null

  const lines: SalesInvoiceLineRequestContext[] = invoice.lines.map((line) => {
    const discountPct = toDecimal(line.discountPercent)
    const discountAmt = toDecimal(line.discountAmount)
    const usePercent = discountPct.gt(0) || discountAmt.lte(0)
    return {
      lineNumber: line.lineNumber,
      sourceLineId: line.sourceLineId ?? null,
      itemId: line.itemId ?? null,
      itemCode: line.itemCodeSnapshot ?? null,
      itemName: line.itemNameSnapshot ?? null,
      description: line.description,
      hsnCode: line.hsnCodeSnapshot ?? null,
      uom: line.uomSnapshot ?? null,
      quantity: decString(line.quantity),
      unitPrice: decString(line.unitRate),
      lineDiscountType: usePercent ? 'PERCENTAGE' : 'AMOUNT',
      lineDiscountValue: usePercent ? decString(line.discountPercent) : decString(line.discountAmount),
      gstRate: deriveGstRateFromStoredLine(line),
      cessRate: decString(line.cessRate),
      isTaxInclusive: false,
      revenueAccountId: line.revenueAccountId ?? null,
      costCentreId: line.costCentreId ?? null,
    }
  })

  const hasRoundOff = !isZero(invoice.roundOffAmount)
  const hasOther = !isZero(invoice.otherChargesAmount)

  return {
    taxPricingMode: 'EXCLUSIVE',
    freightMode: 'NON_TAXABLE',
    freightTaxRate: null,
    freightRevenueAccountId: null,
    roundingMode: hasRoundOff ? 'MANUAL' : 'NONE',
    manualRoundOff: hasRoundOff ? decString(invoice.roundOffAmount) : undefined,
    otherCharges: hasOther
      ? [
          {
            code: 'OTHER',
            description: 'Other charges',
            amount: decString(invoice.otherChargesAmount),
            includeInTaxableValue: false,
          },
        ]
      : undefined,
    lines,
  }
}

/** Stored context when valid; otherwise rebuild from line/header snapshots. */
export function resolveCalculationContext(
  invoice: SalesInvoiceWithLines,
): SalesInvoiceCalculationContext | null {
  return parseCalculationContext(invoice.calculationContext) ?? reconstructCalculationContextFromStoredInvoice(invoice)
}

export function buildCalculationInputFromStoredInvoice(
  invoice: SalesInvoiceWithLines,
  legalEntityStateCode?: string | null,
): SalesInvoiceCalculationInput | null {
  const context = resolveCalculationContext(invoice)
  if (!context) return null
  return buildCalculationInput(invoice, context, legalEntityStateCode)
}

export function mapRequestLinesToContext(lines: SalesInvoiceLineRequest[]): SalesInvoiceCalculationContext['lines'] {
  return lines.map((line) => ({
    lineNumber: line.lineNumber,
    sourceLineId: line.sourceLineId ?? null,
    itemId: line.itemId ?? null,
    itemCode: line.itemCode ?? null,
    itemName: line.itemName ?? null,
    description: line.description,
    hsnCode: line.hsnCode ?? null,
    uom: line.uom ?? null,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineDiscountType: line.lineDiscountType,
    lineDiscountValue: line.lineDiscountValue,
    gstRate: line.gstRate,
    cessRate: line.cessRate,
    isTaxInclusive: line.isTaxInclusive,
    revenueAccountId: line.revenueAccountId ?? null,
    costCentreId: line.costCentreId ?? null,
  }))
}

export function deriveDiscountPercent(
  line: SalesInvoiceLineRequestContextLike,
  grossAmount: string,
  lineDiscountAmount: string,
): string {
  if (line.lineDiscountType === 'PERCENTAGE' && line.lineDiscountValue) {
    return line.lineDiscountValue
  }
  const gross = Number(grossAmount)
  const disc = Number(lineDiscountAmount)
  if (gross > 0 && disc > 0) {
    return ((disc / gross) * 100).toFixed(4)
  }
  return '0.0000'
}

export function findLineContext(
  context: SalesInvoiceCalculationContext,
  lineNumber: number,
): SalesInvoiceLineRequestContextLike | undefined {
  return context.lines.find((l) => l.lineNumber === lineNumber)
}

export function storedLineMatchesCalc(line: SalesInvoiceLine, calcLine: { lineTotal: string }): boolean {
  return line.lineTotal.toFixed(4) === Number(calcLine.lineTotal).toFixed(4)
}
