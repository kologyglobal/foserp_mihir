import type { Opportunity, OpportunityLine, QuotationPriceLine } from '../types/crm'
import type { Item, Product } from '../types/master'
import type { TaxCategory } from '../types/productMaster'
import { PRODUCT_FAMILY_LABELS } from '../types/productMaster'

export function taxCategoryToPct(tax: TaxCategory | string | undefined): number {
  if (tax === 'gst_12') return 12
  if (tax === 'exempt') return 0
  return 18
}

export function calcOpportunityLineDerived(
  line: Pick<OpportunityLine, 'qty' | 'unitPrice' | 'discountPct' | 'taxPct'>,
) {
  const basicAmount = line.qty * line.unitPrice
  const discountAmount = Math.round(basicAmount * (line.discountPct / 100) * 100) / 100
  const taxableValue = Math.round((basicAmount - discountAmount) * 100) / 100
  const gstAmount = Math.round(taxableValue * (line.taxPct / 100) * 100) / 100
  const lineTotal = Math.round((taxableValue + gstAmount) * 100) / 100
  return { basicAmount, discountAmount, taxableValue, gstAmount, lineTotal }
}

export function syncOpportunityLines(lines: OpportunityLine[] | null | undefined): OpportunityLine[] {
  if (!Array.isArray(lines)) return []
  return lines.map((line, idx) => {
    const derived = calcOpportunityLineDerived(line)
    return {
      ...line,
      lineNo: idx + 1,
      discountAmount: derived.discountAmount,
      taxableValue: derived.taxableValue,
      gstAmount: derived.gstAmount,
      lineTotal: derived.lineTotal,
    }
  })
}

export interface OpportunityLinesSummary {
  totalQty: number
  basicAmount: number
  totalDiscount: number
  taxableAmount: number
  gstAmount: number
  grandTotal: number
}

export function calcOpportunityLinesSummary(lines: OpportunityLine[]): OpportunityLinesSummary {
  const synced = syncOpportunityLines(lines)
  const totalQty = synced.reduce((s, l) => s + l.qty, 0)
  const basicAmount = synced.reduce((s, l) => s + l.qty * l.unitPrice, 0)
  const totalDiscount = synced.reduce((s, l) => s + l.discountAmount, 0)
  const taxableAmount = synced.reduce((s, l) => s + l.taxableValue, 0)
  const gstAmount = synced.reduce((s, l) => s + l.gstAmount, 0)
  const grandTotal = synced.reduce((s, l) => s + l.lineTotal, 0)
  return {
    totalQty,
    basicAmount: Math.round(basicAmount * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    gstAmount: Math.round(gstAmount * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
  }
}

export function calcWeightedValue(grandTotal: number, probability: number) {
  return Math.round(grandTotal * (probability / 100) * 100) / 100
}

const VALUE_SYNC_TOLERANCE = 1 // ₹1

export interface OpportunityCommercialBreakdown {
  hasProductLines: boolean
  productSubtotal: number
  discount: number
  taxable: number
  tax: number
  otherCharges: number
  finalQuotedValue: number
  estimatedDealValue: number
  /** True when stored deal value differs from product line grand total. */
  dealValueIsManualEstimate: boolean
  dealValueLabel: 'Estimated Deal Value' | 'Deal Value'
  dealValueHint: string
  forecastBase: number
  forecastBaseLabel: 'Estimated Deal Value' | 'Final Quoted Value' | 'Deal Value'
  probability: number
  weightedForecast: number
  weightedHint: string
}

/** Explain deal value vs product totals for Opportunity commercial UI. */
export function buildOpportunityCommercialBreakdown(
  storedDealValue: number,
  probability: number,
  lines: OpportunityLine[],
): OpportunityCommercialBreakdown {
  const summary = calcOpportunityLinesSummary(lines)
  const hasProductLines = lines.some((l) => l.productOrItem?.trim() && l.lineTotal > 0)
  const finalQuotedValue = summary.grandTotal
  const estimatedDealValue = storedDealValue
  const dealValueIsManualEstimate =
    hasProductLines
    && Math.abs(estimatedDealValue - finalQuotedValue) > VALUE_SYNC_TOLERANCE

  const dealValueLabel = dealValueIsManualEstimate || !hasProductLines
    ? 'Estimated Deal Value'
    : 'Deal Value'

  const dealValueHint = dealValueIsManualEstimate
    ? 'Pipeline estimate entered on the opportunity. It differs from the product line total below.'
    : hasProductLines
      ? 'Synced from product lines (Final Quoted Value).'
      : 'Pipeline estimate used until product lines are priced.'

  const forecastBase = dealValueIsManualEstimate || !hasProductLines
    ? estimatedDealValue
    : finalQuotedValue
  const forecastBaseLabel = dealValueIsManualEstimate
    ? 'Estimated Deal Value'
    : hasProductLines
      ? 'Final Quoted Value'
      : 'Deal Value'

  const weightedForecast = calcWeightedValue(forecastBase, probability)

  return {
    hasProductLines,
    productSubtotal: summary.basicAmount,
    discount: summary.totalDiscount,
    taxable: summary.taxableAmount,
    tax: summary.gstAmount,
    otherCharges: 0,
    finalQuotedValue,
    estimatedDealValue,
    dealValueIsManualEstimate,
    dealValueLabel,
    dealValueHint,
    forecastBase,
    forecastBaseLabel,
    probability,
    weightedForecast,
    weightedHint: `${probability}% × ${forecastBaseLabel}`,
  }
}

export function createEmptyOpportunityLine(lineNo = 1, patch?: Partial<OpportunityLine>): OpportunityLine {
  const base: OpportunityLine = {
    id: `opp-line-${crypto.randomUUID().slice(0, 8)}`,
    lineNo,
    productId: null,
    itemId: null,
    itemCode: '',
    productOrItem: '',
    description: '',
    productFamily: '',
    itemType: '',
    qty: 1,
    uom: 'Nos',
    unitPrice: 0,
    discountPct: 0,
    discountAmount: 0,
    taxableValue: 0,
    taxPct: 18,
    gstAmount: 0,
    lineTotal: 0,
    expectedDeliveryDate: null,
    remarks: '',
    ...patch,
  }
  return syncOpportunityLines([base])[0]!
}

export function buildOpportunityLineFromProduct(
  product: Product,
  item: Item | undefined,
  uomName: string,
  lineNo: number,
): OpportunityLine {
  const family = PRODUCT_FAMILY_LABELS[product.productFamily] ?? product.productFamily
  return createEmptyOpportunityLine(lineNo, {
    productId: product.id,
    itemId: item?.id ?? product.fgItemId ?? null,
    itemCode: product.productCode,
    productOrItem: product.productName,
    description: product.specifications?.trim() || '',
    productFamily: family,
    itemType: item?.itemType ?? 'finished_good',
    uom: uomName,
    unitPrice: product.standardPrice,
    taxPct: taxCategoryToPct(product.sales.taxCategory),
    qty: 1,
  })
}

export interface OpportunityLineValidation {
  errors: string[]
  rowErrors: Record<string, string[]>
}

export function validateOpportunityLines(
  lines: OpportunityLine[],
  header: {
    customerId?: string
    ownerId?: string
    stage?: string
    probability?: number | string
  },
): OpportunityLineValidation {
  const errors: string[] = []
  const rowErrors: Record<string, string[]> = {}

  if (!header.customerId) errors.push('Company is required.')
  if (!header.ownerId) errors.push('Opportunity owner is required.')
  if (!header.stage) errors.push('Stage is required.')
  if (header.probability === '' || header.probability == null || Number.isNaN(Number(header.probability))) {
    errors.push('Probability is required.')
  }

  // Minimum-first: early pipeline stages may save without product lines.
  const earlyStages = new Set(['new_lead', 'qualified', 'requirement_discussion'])
  const requireCommercialLines = Boolean(header.stage && !earlyStages.has(header.stage))

  const meaningfulLines = lines.filter(
    (l) => l.productId || l.productOrItem.trim() || (l.unitPrice != null && l.unitPrice > 0),
  )

  if (requireCommercialLines && meaningfulLines.length === 0) {
    errors.push('At least one product / item line is required.')
  }

  for (const line of meaningfulLines.length ? meaningfulLines : requireCommercialLines ? lines : []) {
    const row: string[] = []
    if (!line.productId && !line.productOrItem.trim()) row.push('Product / item is required.')
    if (!line.qty || line.qty <= 0) row.push('Quantity must be greater than zero.')
    if (line.unitPrice == null || Number.isNaN(line.unitPrice) || line.unitPrice <= 0) {
      row.push('Unit price is required.')
    }
    if (line.taxPct == null || Number.isNaN(line.taxPct)) row.push('GST % is required.')
    if (line.discountPct > 100) row.push('Discount cannot exceed 100%.')
    if (row.length) rowErrors[line.id] = row
  }

  if (Object.keys(rowErrors).length > 0 && !errors.some((e) => e.includes('line'))) {
    errors.push('Fix validation errors in product / item lines.')
  }

  return { errors, rowErrors }
}

/** Resolve lines for legacy opportunities without stored lines */
export function resolveOpportunityLines(opportunity: Opportunity, product?: Product): OpportunityLine[] {
  if (opportunity.lines?.length) return syncOpportunityLines(opportunity.lines)
  if (!opportunity.productId && !opportunity.value) return []
  return syncOpportunityLines([
    createEmptyOpportunityLine(1, {
      productId: opportunity.productId,
      productOrItem: product?.productName ?? (opportunity.productRequirement || opportunity.opportunityName),
      itemCode: product?.productCode ?? '',
      description: opportunity.productRequirement || opportunity.opportunityName,
      productFamily: product ? (PRODUCT_FAMILY_LABELS[product.productFamily] ?? product.productFamily) : '',
      qty: 1,
      unitPrice: opportunity.value > 0 ? Math.round(opportunity.value / 1.18) : 0,
      taxPct: 18,
    }),
  ])
}

export function getPrimaryItemLabel(opportunity: Opportunity, product?: Product): string {
  const lines = resolveOpportunityLines(opportunity, product)
  if (!lines.length) return opportunity.productRequirement || '—'
  return lines[0]!.productOrItem || lines[0]!.description || '—'
}

export function getOpportunityItemSummary(opportunity: Opportunity, product?: Product): string {
  const lines = resolveOpportunityLines(opportunity, product)
  if (!lines.length) return '—'
  const primary = getPrimaryItemLabel(opportunity, product)
  if (lines.length === 1) return primary
  return `${primary} + ${lines.length - 1} more`
}

export function opportunityLinesToQuotationPriceLines(lines: OpportunityLine[]) {
  return syncOpportunityLines(lines).map((l) => ({
    id: `pl-${l.id}`,
    productOrItem: l.productOrItem,
    description: l.description,
    productId: l.productId,
    qty: l.qty,
    uom: l.uom,
    unitPrice: l.unitPrice,
    discountPct: l.discountPct,
    taxPct: l.taxPct,
    lineTotal: l.lineTotal,
    isOptional: false,
  }))
}

/** Map quotation price lines back to opportunity line shape for ErpLineItemsGrid editing. */
export function quotationPriceLinesToOpportunityLines(priceLines: QuotationPriceLine[]): OpportunityLine[] {
  return syncOpportunityLines(
    priceLines.map((l, idx) => ({
      id: l.id.startsWith('pl-') ? l.id.slice(3) : `qpl-${l.id}`,
      lineNo: idx + 1,
      productId: l.productId ?? null,
      itemId: null,
      itemCode: '',
      productOrItem: l.productOrItem,
      description: l.description,
      productFamily: '',
      itemType: '',
      qty: l.qty,
      uom: l.uom,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      discountAmount: 0,
      taxableValue: 0,
      taxPct: l.taxPct,
      gstAmount: 0,
      lineTotal: l.lineTotal,
      expectedDeliveryDate: null,
      remarks: '',
    })),
  )
}

/** @deprecated Use resolveQuotationPriceLineProductId from crmQuotationSoLines */
export function resolvePriceLineProductId(
  priceLine: Pick<QuotationPriceLine, 'id' | 'productOrItem' | 'productId'>,
  idx: number,
  oppLines: OpportunityLine[],
  fallbackProductId: string | null,
): string | null {
  const linkedOppLineId = priceLine.id.startsWith('pl-') ? priceLine.id.slice(3) : null
  const oppLine =
    (linkedOppLineId ? oppLines.find((l) => l.id === linkedOppLineId) : undefined) ??
    oppLines[idx] ??
    oppLines.find((l) => l.productOrItem === priceLine.productOrItem)
  return priceLine.productId ?? oppLine?.productId ?? fallbackProductId
}
