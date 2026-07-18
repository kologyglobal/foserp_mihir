import type { SalesInvoice, SalesInvoiceLine } from '@prisma/client'
import type { SalesInvoiceCalculationInput } from '../calculation/sales-invoice-calculation.types.js'
import type { CreateSalesInvoiceInput, SalesInvoiceLineRequest, UpdateSalesInvoiceInput } from './sales-invoice.schemas.js'
import type { SalesInvoiceCalculationContext, SalesInvoiceWithLines } from './sales-invoice.types.js'

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
  return value as SalesInvoiceCalculationContext
}

export function buildCalculationInputFromStoredInvoice(
  invoice: SalesInvoiceWithLines,
  legalEntityStateCode?: string | null,
): SalesInvoiceCalculationInput | null {
  const context = parseCalculationContext(invoice.calculationContext)
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
