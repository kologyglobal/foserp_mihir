import type { Opportunity, OpportunityLine, QuotationPriceLine } from '../types/crm'
import type { Item, Product } from '../types/master'
import type { TaxCategory } from '../types/productMaster'
import { PRODUCT_FAMILY_LABELS } from '../types/productMaster'
import { useMasterStore } from '../store/masterStore'
import { canUseItemInSales } from './opportunityItemOptions'
import { assertProductSellableForSales } from './productMaster'
import {
  isEncodedLeadRequirementPayload,
  opportunityRequirementDisplay,
  sanitizeOpportunityLines,
} from './leadRequirementLines'
import {
  calcOrderDocumentTotals,
  type AdjustmentCalcType,
  type OrderDocumentTotals,
} from './orderAdjustmentsCalc'
import {
  formatCodeNameLabel,
  isLikelyUuid,
  resolveCatalogProductLabel,
} from './catalogProductLabel'
import {
  resolveLineTaxFromLocalMasters,
  type ResolveLineTaxInput,
} from './commercialLineTax'

/** Optional seller/party/POS for line tax scheme (IGST vs CGST+SGST). */
export type OpportunityLineTaxSupply = Pick<
  ResolveLineTaxInput,
  | 'companyState'
  | 'companyStateCode'
  | 'companyGstin'
  | 'partyState'
  | 'partyGstin'
  | 'placeOfSupply'
>

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

/** True when a catalog product/item is bound (not a blank draft row). */
export function opportunityLineHasCatalogItem(
  line: Pick<OpportunityLine, 'itemId' | 'productId'>,
): boolean {
  const itemId = typeof line.itemId === 'string' ? line.itemId.trim() : line.itemId
  const productId = typeof line.productId === 'string' ? line.productId.trim() : line.productId
  return Boolean(itemId || productId)
}

/**
 * Drop empty draft rows before persist (same rule as Sales Order payload lines).
 * Blank "Add product line" rows must never hit the API / demo store as real lines.
 */
export function filterCatalogOpportunityLines(lines: OpportunityLine[] | null | undefined): OpportunityLine[] {
  return syncOpportunityLines(lines).filter((l) => opportunityLineHasCatalogItem(l) && Boolean(l.itemId?.trim()))
}

/** Collect item ids for sellable-item option retain (SO-style item master pickers). */
export function retainOpportunityItemIds(
  lines: Array<Pick<OpportunityLine, 'itemId' | 'productId'> | null | undefined> | null | undefined,
  extraIds?: Array<string | null | undefined>,
): Array<string | null | undefined> {
  const fromLines = (lines ?? []).flatMap((l) => (l ? [l.itemId, l.productId] : []))
  return [...fromLines, ...(extraIds ?? [])]
}

/**
 * Red “Tax unresolved” only after a catalog item is selected and tax masters failed.
 * Blank Create Lead / empty draft rows must never warn — even if flags were left unclean.
 */
export function shouldShowTaxUnresolvedWarning(
  line: Pick<OpportunityLine, 'taxUnresolved' | 'itemId' | 'productId'>,
): boolean {
  if (!opportunityLineHasCatalogItem(line)) return false
  return line.taxUnresolved === true
}

export function syncOpportunityLines(lines: OpportunityLine[] | null | undefined): OpportunityLine[] {
  if (!Array.isArray(lines)) return []
  return lines.map((line, idx) => {
    const derived = calcOpportunityLineDerived(line)
    const hasCatalog = opportunityLineHasCatalogItem(line)
    return {
      ...line,
      lineNo: idx + 1,
      discountAmount: derived.discountAmount,
      taxableValue: derived.taxableValue,
      gstAmount: derived.gstAmount,
      lineTotal: derived.lineTotal,
      // Never carry a false-positive unresolved flag on empty draft rows (e.g. rehydrated encodes).
      taxUnresolved: hasCatalog ? Boolean(line.taxUnresolved) : false,
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

export type OrderDiscountMode = 'flat' | 'percent'

export type ChargeAdjustmentInput = {
  calculationType?: AdjustmentCalcType | OrderDiscountMode
  /** Flat amount or percentage (0–100). */
  value?: number
  isTaxable?: boolean
  taxRate?: number
}

export interface ProductPricingAdjustments {
  /** @deprecated Prefer freight.value + freight.calculationType */
  freightAmount?: number
  orderDiscountMode?: OrderDiscountMode
  orderDiscountInput?: number
  /** @deprecated Prefer installation.value */
  installationAmount?: number
  /** @deprecated Prefer otherCharges / customCharges input */
  customCharges?: number
  freight?: ChargeAdjustmentInput
  installation?: ChargeAdjustmentInput
  otherCharges?: ChargeAdjustmentInput
}

export interface ProductPricingSummary extends OpportunityLinesSummary {
  /** Taxable before overall (order/header) discount — same as line sum after line discounts. */
  taxableBeforeOverallDiscount: number
  /** Taxable after overall discount (base for GST). */
  taxableAfterOverallDiscount: number
  subtotal: number
  totalLineDiscount: number
  gstByRate: Map<number, number>
  totalGst: number
  freightAmount: number
  orderDiscountAmount: number
  installationAmount: number
  customCharges: number
  orderTotals: OrderDocumentTotals
}

function modeToCalcType(mode: OrderDiscountMode | AdjustmentCalcType | undefined): AdjustmentCalcType {
  if (!mode) return 'FLAT'
  if (mode === 'percent' || mode === 'PERCENTAGE') return 'PERCENTAGE'
  return 'FLAT'
}

function chargeSpec(
  partial: ChargeAdjustmentInput | undefined,
  legacyAmount: number | undefined,
): { calculationType: AdjustmentCalcType; value: number; isTaxable: boolean; taxRate?: number } {
  const calculationType = modeToCalcType(partial?.calculationType)
  const value =
    partial?.value != null && Number.isFinite(partial.value)
      ? partial.value
      : legacyAmount ?? 0
  return {
    calculationType,
    value,
    isTaxable: Boolean(partial?.isTaxable),
    taxRate: partial?.taxRate,
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

/**
 * Document / order / overall discount — applied **only** to taxable amount (pre-tax).
 * Never on grand total or tax-inclusive totals.
 *
 * Grand total = (taxable − overall discount) + GST(on revised taxable) + non-tax charges.
 */
export function computeOverallDiscountAmount(
  taxableBeforeOverall: number,
  mode: OrderDiscountMode,
  discountInput: number,
): number {
  const taxable = Math.max(0, round2(taxableBeforeOverall))
  const input = Math.max(0, discountInput)
  if (taxable <= 0 || input <= 0) return 0
  if (mode === 'percent') {
    return round2(taxable * (Math.min(100, input) / 100))
  }
  return round2(Math.min(input, taxable))
}

/**
 * Recompute GST by rate after reducing taxable proportionally (multi-rate safe).
 * Remainder of overall discount is applied on the last positive-taxable line so totals stay exact.
 */
export function applyOverallDiscountToLines(
  lines: OpportunityLine[],
  orderDiscountAmount: number,
): {
  taxableAfter: number
  gstAmount: number
  gstByRate: Map<number, number>
  discountedLines: Array<OpportunityLine & { overallDiscountShare: number }>
} {
  const synced = syncOpportunityLines(lines)
  const taxableBefore = round2(synced.reduce((s, l) => s + l.taxableValue, 0))
  const disc = round2(Math.min(Math.max(0, orderDiscountAmount), taxableBefore))

  if (disc <= 0 || taxableBefore <= 0) {
    const gstByRate = new Map<number, number>()
    for (const line of synced) {
      gstByRate.set(line.taxPct, round2((gstByRate.get(line.taxPct) ?? 0) + line.gstAmount))
    }
    return {
      taxableAfter: taxableBefore,
      gstAmount: round2(synced.reduce((s, l) => s + l.gstAmount, 0)),
      gstByRate,
      discountedLines: synced.map((l) => ({ ...l, overallDiscountShare: 0 })),
    }
  }

  const eligible = synced.filter((l) => l.taxableValue > 0)
  const last = eligible[eligible.length - 1]
  let allocated = 0
  const shares = new Map<string, number>()

  for (const line of synced) {
    if (!last || line.id === last.id || line.taxableValue <= 0) {
      shares.set(line.id, 0)
      continue
    }
    const share = round2(disc * (line.taxableValue / taxableBefore))
    shares.set(line.id, share)
    allocated = round2(allocated + share)
  }
  if (last) {
    shares.set(last.id, round2(disc - allocated))
  }

  const gstByRate = new Map<number, number>()
  let taxableAfter = 0
  let gstAmount = 0
  const discountedLines = synced.map((line) => {
    const overallDiscountShare = shares.get(line.id) ?? 0
    const taxableValue = round2(Math.max(0, line.taxableValue - overallDiscountShare))
    const gstLine = round2(taxableValue * (line.taxPct / 100))
    const lineTotal = round2(taxableValue + gstLine)
    taxableAfter = round2(taxableAfter + taxableValue)
    gstAmount = round2(gstAmount + gstLine)
    gstByRate.set(line.taxPct, round2((gstByRate.get(line.taxPct) ?? 0) + gstLine))
    return {
      ...line,
      overallDiscountShare,
      taxableValue,
      gstAmount: gstLine,
      lineTotal,
    }
  })

  // Keep summed taxable exact to (before − disc)
  const expectedTaxable = round2(taxableBefore - disc)
  if (Math.abs(taxableAfter - expectedTaxable) >= 0.01 && discountedLines.length) {
    const dust = round2(expectedTaxable - taxableAfter)
    const target = discountedLines[discountedLines.length - 1]!
    target.taxableValue = round2(target.taxableValue + dust)
    target.gstAmount = round2(target.taxableValue * (target.taxPct / 100))
    target.lineTotal = round2(target.taxableValue + target.gstAmount)
    taxableAfter = expectedTaxable
    gstAmount = round2(discountedLines.reduce((s, l) => s + l.gstAmount, 0))
    gstByRate.clear()
    for (const line of discountedLines) {
      gstByRate.set(line.taxPct, round2((gstByRate.get(line.taxPct) ?? 0) + line.gstAmount))
    }
  }

  return { taxableAfter, gstAmount, gstByRate, discountedLines }
}

/** Line totals + freight / overall discount / charge adjustments (shared orderAdjustmentsCalc). */
export function calcProductPricingSummary(
  lines: OpportunityLine[],
  adjustments: ProductPricingAdjustments = {},
): ProductPricingSummary {
  const base = calcOpportunityLinesSummary(lines)
  const mode = adjustments.orderDiscountMode ?? 'flat'
  const discountInput = Math.max(0, adjustments.orderDiscountInput ?? 0)
  const freight = chargeSpec(adjustments.freight, adjustments.freightAmount)
  const installation = chargeSpec(adjustments.installation, adjustments.installationAmount)
  const otherCharges = chargeSpec(adjustments.otherCharges, adjustments.customCharges)

  const orderTotals = calcOrderDocumentTotals(
    lines.map((l) => ({
      qty: l.qty,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      taxPct: l.taxPct,
    })),
    {
      orderDiscount: {
        calculationType: modeToCalcType(mode),
        value: discountInput,
      },
      freight,
      installation,
      otherCharges,
    },
  )

  const gstByRate = new Map<number, number>()
  for (const row of orderTotals.gstByRate) {
    gstByRate.set(row.rate, row.amount)
  }

  return {
    ...base,
    taxableAmount: orderTotals.discountedTaxableAmount,
    gstAmount: orderTotals.gstAmount,
    grandTotal: orderTotals.grandTotal,
    taxableBeforeOverallDiscount: orderTotals.taxableAmount,
    taxableAfterOverallDiscount: orderTotals.discountedTaxableAmount,
    subtotal: orderTotals.taxableAmount,
    totalLineDiscount: orderTotals.itemDiscountAmount,
    gstByRate,
    totalGst: orderTotals.gstAmount,
    freightAmount: orderTotals.freightAmount,
    orderDiscountAmount: orderTotals.orderDiscount.calculatedAmount,
    installationAmount: orderTotals.installationAmount,
    customCharges: orderTotals.customCharges,
    orderTotals,
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
    taxPct: 0,
    gstAmount: 0,
    lineTotal: 0,
    expectedDeliveryDate: null,
    remarks: '',
    hsnCode: '',
    // Empty draft lines are not tax errors — unresolved only after an item is chosen.
    taxSource: 'UNRESOLVED',
    taxUnresolved: false,
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

/** Primary CRM path — build opportunity line from MasterItem (salesAllowed). */
export function buildOpportunityLineFromItem(
  item: Item,
  uomName: string,
  lineNo: number,
  taxSupply?: OpportunityLineTaxSupply | null,
): OpportunityLine {
  const ms = useMasterStore.getState()
  const snap = resolveLineTaxFromLocalMasters({
    direction: 'SALES',
    item,
    companyState: taxSupply?.companyState,
    companyStateCode: taxSupply?.companyStateCode,
    companyGstin: taxSupply?.companyGstin,
    partyState: taxSupply?.partyState,
    partyGstin: taxSupply?.partyGstin,
    placeOfSupply: taxSupply?.placeOfSupply,
    hsnById: (id) => ms.getHsn(id),
    hsnByCode: (code) => ms.getHsnByCode(code),
    gstRates: ms.gstRates,
  })
  return createEmptyOpportunityLine(lineNo, {
    productId: null,
    itemId: item.id,
    itemCode: item.itemCode,
    productOrItem: item.itemName,
    description: (item.salesDescription ?? item.itemDescription ?? '').trim(),
    productFamily: item.productType ?? item.itemType,
    itemType: item.itemType,
    uom: uomName,
    unitPrice: item.defaultSalesRate ?? item.standardRate ?? 0,
    taxPct: snap.taxPct,
    qty: 1,
    hsnCode: snap.hsnSacCode || item.hsnCode || '',
    taxScheme: snap.taxScheme,
    taxSource: snap.source,
    taxUnresolved: !snap.resolved,
    cgstRate: snap.cgstRate,
    sgstRate: snap.sgstRate,
    igstRate: snap.igstRate,
  })
}

export interface OpportunityLineValidation {
  errors: string[]
  rowErrors: Record<string, string[]>
}

/** Canonical field-level copy for missing line unit price (FE + toast). */
export const UNIT_PRICE_REQUIRED_MESSAGE = 'Unit Price is required'

/** Stable DOM / focus key for a line’s unit price control (`data-field`). */
export function opportunityLineUnitPriceFieldKey(lineId: string): string {
  return `unitPrice-${lineId}`
}

/** DOM id for a line unit price input. */
export function opportunityLineUnitPriceDomId(lineId: string): string {
  return `opp-line-${lineId}-unitPrice`
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

  if (!header.customerId) errors.push('Customer is required.')
  if (!header.ownerId) errors.push('Opportunity owner is required.')
  if (!header.stage) errors.push('Stage is required.')

  // Minimum-first: early pipeline stages may save without product lines.
  const earlyStages = new Set(['new_lead', 'qualified', 'requirement_discussion'])
  const requireCommercialLines = Boolean(header.stage && !earlyStages.has(header.stage))

  const meaningfulLines = lines.filter(
    (l) => l.itemId || l.productId || l.productOrItem.trim() || (l.unitPrice != null && l.unitPrice > 0),
  )

  if (requireCommercialLines && meaningfulLines.length === 0) {
    errors.push('At least one item line is required.')
  }

  const getProduct = useMasterStore.getState().getProduct
  for (const line of meaningfulLines.length ? meaningfulLines : requireCommercialLines ? lines : []) {
    const row: string[] = []
    if (!line.itemId && !line.productId && !line.productOrItem.trim()) row.push('Item is required.')
    if (line.itemId) {
      const sellable = canUseItemInSales(line.itemId)
      if (!sellable.ok) row.push(sellable.error ?? 'Item is not allowed for sales.')
    } else if (line.productId) {
      // Legacy dual-read: productId still accepted until Phase 9.
      const sellable = assertProductSellableForSales(getProduct(line.productId))
      if (!sellable.ok) row.push(sellable.error)
    }
    if (!line.qty || line.qty <= 0) row.push('Quantity must be greater than zero.')
    if (line.unitPrice == null || Number.isNaN(line.unitPrice) || line.unitPrice <= 0) {
      row.push(UNIT_PRICE_REQUIRED_MESSAGE)
    }
    if (line.taxPct == null || Number.isNaN(line.taxPct)) row.push('GST % is required.')
    if (line.discountPct > 100) row.push('Discount cannot exceed 100%.')
    if (row.length) rowErrors[line.id] = row
  }

  if (Object.keys(rowErrors).length > 0 && !errors.some((e) => /line|unit price/i.test(e))) {
    const allMsgs = Object.values(rowErrors).flat()
    const onlyUnitPrice = allMsgs.length > 0 && allMsgs.every((m) => /unit price/i.test(m))
    errors.push(onlyUnitPrice ? UNIT_PRICE_REQUIRED_MESSAGE : 'Fix validation errors in product / item lines.')
  }

  return { errors, rowErrors }
}

/** Resolve lines for legacy opportunities without stored lines */
export function resolveOpportunityLines(opportunity: Opportunity, product?: Product): OpportunityLine[] {
  if (opportunity.lines?.length) {
    const cleaned = sanitizeOpportunityLines(opportunity.lines, opportunity.productRequirement)
    if (cleaned.length) return cleaned
  }

  if (isEncodedLeadRequirementPayload(opportunity.productRequirement)) {
    const hydrated = sanitizeOpportunityLines([], opportunity.productRequirement)
    if (hydrated.length) return hydrated
  }

  if (!opportunity.productId && !opportunity.value) return []
  const displayReq =
    opportunityRequirementDisplay(opportunity.productRequirement) || opportunity.opportunityName
  return syncOpportunityLines([
    createEmptyOpportunityLine(1, {
      productId: opportunity.productId,
      productOrItem: product?.productName ?? displayReq,
      itemCode: product?.productCode ?? '',
      description: displayReq,
      productFamily: product ? (PRODUCT_FAMILY_LABELS[product.productFamily] ?? product.productFamily) : '',
      qty: 1,
      unitPrice: opportunity.value > 0 ? Math.round(opportunity.value / 1.18) : 0,
      taxPct: 18,
    }),
  ])
}

export function getPrimaryItemLabel(opportunity: Opportunity, product?: Product): string {
  const lines = resolveOpportunityLines(opportunity, product)
  if (!lines.length) {
    const headerLabel = resolveCatalogProductLabel(
      { productId: opportunity.productId, itemId: opportunity.productId },
      {
        getItem: (id) => useMasterStore.getState().getItem(id),
        getProduct: (id) => useMasterStore.getState().getProduct(id),
      },
    )
    if (headerLabel !== '-') return headerLabel
    return opportunityRequirementDisplay(opportunity.productRequirement) || '-'
  }
  const line = lines[0]!
  if (line.itemCode?.trim()) {
    const name = line.productOrItem?.trim()
    if (name && !isLikelyUuid(name) && name !== line.itemCode.trim()) {
      return formatCodeNameLabel(line.itemCode, name) ?? line.itemCode.trim()
    }
    return line.itemCode.trim()
  }
  const fromMaster = resolveCatalogProductLabel(
    {
      itemId: line.itemId,
      productId: line.productId ?? opportunity.productId,
      productOrItem: line.productOrItem,
    },
    {
      getItem: (id) => useMasterStore.getState().getItem(id),
      getProduct: (id) => useMasterStore.getState().getProduct(id),
    },
  )
  if (fromMaster !== '-') return fromMaster
  const free = line.productOrItem?.trim() || line.description?.trim() || ''
  if (free && !isLikelyUuid(free)) return free
  return opportunityRequirementDisplay(opportunity.productRequirement) || '-'
}

export function getOpportunityItemSummary(opportunity: Opportunity, product?: Product): string {
  const lines = resolveOpportunityLines(opportunity, product)
  const primary = getPrimaryItemLabel(opportunity, product)
  if (!lines.length) return primary
  if (lines.length === 1) return primary
  return `${primary} + ${lines.length - 1} more`
}

export function opportunityLinesToQuotationPriceLines(lines: OpportunityLine[]) {
  return sanitizeOpportunityLines(lines).map((l) => ({
    id: `pl-${l.id}`,
    productOrItem: l.productOrItem,
    description: l.description,
    productId: null,
    itemId: l.itemId,
    itemCodeSnapshot: l.itemCode || null,
    itemNameSnapshot: l.productOrItem || null,
    qty: l.qty,
    uom: l.uom,
    unitPrice: l.unitPrice,
    discountPct: l.discountPct,
    taxPct: l.taxPct,
    lineTotal: l.lineTotal,
    isOptional: false,
    hsnCode: l.hsnCode ?? null,
    taxScheme: l.taxScheme ?? null,
    cgstRate: l.cgstRate ?? null,
    sgstRate: l.sgstRate ?? null,
    igstRate: l.igstRate ?? null,
    cgstPct: l.cgstRate ?? null,
    sgstPct: l.sgstRate ?? null,
    igstPct: l.igstRate ?? null,
  }))
}

/** Map quotation price lines back to opportunity line shape for ErpLineItemsGrid editing. */
export function quotationPriceLinesToOpportunityLines(priceLines: QuotationPriceLine[]): OpportunityLine[] {
  return sanitizeOpportunityLines(
    priceLines.map((l, idx) => ({
      id: l.id.startsWith('pl-') ? l.id.slice(3) : `qpl-${l.id}`,
      lineNo: idx + 1,
      productId: null,
      itemId: l.itemId ?? null,
      itemCode: l.itemCodeSnapshot ?? '',
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
      hsnCode: l.hsnCode ?? undefined,
      taxScheme: (l.taxScheme as OpportunityLine['taxScheme']) ?? undefined,
      cgstRate: l.cgstRate ?? l.cgstPct ?? undefined,
      sgstRate: l.sgstRate ?? l.sgstPct ?? undefined,
      igstRate: l.igstRate ?? l.igstPct ?? undefined,
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
