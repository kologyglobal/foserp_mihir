import type { Opportunity, OpportunityLine, QuotationDocument, QuotationPriceLine } from '../types/crm'
import type { Item, Product } from '../types/master'
import type { SalesOrderLine } from '../types/mrp'
import type { Quotation } from '../types/sales'
import { calcPriceSummary, syncLineTotals } from './crmQuotationCalc'
import { sectionContent } from './crmIntegration'
import { resolveOpportunityLines, syncOpportunityLines } from './opportunityLineCalc'
import { isItemSellable } from './opportunityItemOptions'

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase()
}

/** Resolve a released product from quotation line label (name or code). */
export function lookupProductIdByLabel(label: string, products: Product[]): string | null {
  const norm = normalizeLabel(label)
  if (!norm) return null

  const released = products.filter((p) => p.isActive && p.status === 'released')
  const exact = released.find(
    (p) => normalizeLabel(p.productName) === norm || normalizeLabel(p.productCode) === norm,
  )
  if (exact) return exact.id

  const partial = released.find((p) => {
    const name = normalizeLabel(p.productName)
    return norm.includes(name) || name.includes(norm)
  })
  return partial?.id ?? null
}

/** Resolve a sellable item from quotation line label (name or code). */
export function lookupItemIdByLabel(label: string, items: Item[]): string | null {
  const norm = normalizeLabel(label)
  if (!norm) return null

  const sellable = items.filter(isItemSellable)
  const exact = sellable.find(
    (i) => normalizeLabel(i.itemName) === norm || normalizeLabel(i.itemCode) === norm,
  )
  if (exact) return exact.id

  const partial = sellable.find((i) => {
    const name = normalizeLabel(i.itemName)
    return norm.includes(name) || name.includes(norm)
  })
  return partial?.id ?? null
}

function itemIdFromProductId(productId: string | null | undefined, products: Product[]): string | null {
  if (!productId) return null
  return products.find((p) => p.id === productId)?.fgItemId ?? null
}

/** @deprecated Prefer resolveQuotationPriceLineItemId — kept for dual-read / legacy tests */
export function resolveQuotationPriceLineProductId(
  priceLine: Pick<QuotationPriceLine, 'id' | 'productOrItem' | 'productId' | 'description'>,
  idx: number,
  oppLines: OpportunityLine[],
  products: Product[],
  fallbackProductId: string | null,
  multiLine: boolean,
): string | null {
  if (priceLine.productId) return priceLine.productId

  const linkedOppLineId = priceLine.id.startsWith('pl-') ? priceLine.id.slice(3) : null
  const oppLine =
    (linkedOppLineId ? oppLines.find((l) => l.id === linkedOppLineId) : undefined) ??
    oppLines[idx] ??
    oppLines.find((l) => l.productOrItem === priceLine.productOrItem)
  if (oppLine?.productId) return oppLine.productId

  const fromLabel = lookupProductIdByLabel(priceLine.productOrItem, products)
  if (fromLabel) return fromLabel

  if (priceLine.description) {
    const fromDescription = lookupProductIdByLabel(priceLine.description, products)
    if (fromDescription) return fromDescription
  }

  return multiLine ? null : fallbackProductId
}

export function resolveQuotationPriceLineItemId(
  priceLine: Pick<QuotationPriceLine, 'id' | 'productOrItem' | 'productId' | 'itemId' | 'description'>,
  idx: number,
  oppLines: OpportunityLine[],
  items: Item[],
  products: Product[],
  fallbackItemId: string | null,
  multiLine: boolean,
): string | null {
  if (priceLine.itemId) return priceLine.itemId

  const fromProduct = itemIdFromProductId(priceLine.productId, products)
  if (fromProduct) return fromProduct

  const linkedOppLineId = priceLine.id.startsWith('pl-') ? priceLine.id.slice(3) : null
  const oppLine =
    (linkedOppLineId ? oppLines.find((l) => l.id === linkedOppLineId) : undefined) ??
    oppLines[idx] ??
    oppLines.find((l) => l.productOrItem === priceLine.productOrItem)
  if (oppLine?.itemId) return oppLine.itemId
  const fromOppProduct = itemIdFromProductId(oppLine?.productId, products)
  if (fromOppProduct) return fromOppProduct

  const fromLabel = lookupItemIdByLabel(priceLine.productOrItem, items)
  if (fromLabel) return fromLabel

  if (priceLine.description) {
    const fromDescription = lookupItemIdByLabel(priceLine.description, items)
    if (fromDescription) return fromDescription
  }

  return multiLine ? null : fallbackItemId
}

export function quotationPriceLinesForSo(document: QuotationDocument): QuotationPriceLine[] {
  return syncLineTotals(document.priceLines).filter((l) => !l.isOptional)
}

export function buildSalesOrderLinesFromQuotationDocument(input: {
  document: QuotationDocument
  opportunity?: Opportunity | null
  salesQuotation?: Quotation | null
  products: Product[]
  items?: Item[]
  defaultProduct?: Product | null
  defaultItem?: Item | null
}): SalesOrderLine[] {
  const { document, opportunity, salesQuotation, products, defaultProduct, defaultItem } = input
  const items = input.items ?? []
  const lines = quotationPriceLinesForSo(document)
  const multiLine = lines.length > 1
  const oppLines = opportunity ? syncOpportunityLines(resolveOpportunityLines(opportunity)) : []
  const technicalScope = sectionContent(document, 'technical') || document.technicalNotes
  const fallbackItemId =
    defaultItem?.id
    ?? salesQuotation?.itemId
    ?? itemIdFromProductId(salesQuotation?.productId, products)
    ?? itemIdFromProductId(defaultProduct?.id, products)
    ?? defaultProduct?.fgItemId
    ?? null

  return lines.map((l, idx) => {
    const base = l.qty * l.unitPrice * (1 - l.discountPct / 100)
    const gst = base * (l.taxPct / 100)
    const lineItemId = resolveQuotationPriceLineItemId(
      l,
      idx,
      oppLines,
      items,
      products,
      fallbackItemId,
      multiLine,
    )
    const matchedItem = lineItemId ? items.find((i) => i.id === lineItemId) : undefined
    const legacyProductId = resolveQuotationPriceLineProductId(
      l,
      idx,
      oppLines,
      products,
      salesQuotation?.productId ?? defaultProduct?.id ?? null,
      multiLine,
    )
    const matchedProduct = legacyProductId ? products.find((p) => p.id === legacyProductId) : undefined

    return {
      id: `sol-${document.id}-${idx + 1}`,
      lineNo: idx + 1,
      productOrItem:
        l.productOrItem
        || matchedItem?.itemName
        || matchedProduct?.productName
        || defaultItem?.itemName
        || defaultProduct?.productName
        || 'Item',
      description: l.description || matchedItem?.itemName || matchedProduct?.productName || '',
      productId: null,
      itemId: lineItemId,
      itemCodeSnapshot: matchedItem?.itemCode ?? null,
      itemNameSnapshot: matchedItem?.itemName ?? null,
      qty: l.qty,
      uom: l.uom || 'Nos',
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      taxPct: l.taxPct,
      taxableValue: Math.round(base * 100) / 100,
      gstAmount: Math.round(gst * 100) / 100,
      lineTotal: l.lineTotal,
      technicalScopeRef: technicalScope,
      // Prefer quotation line tax snapshot; do not re-resolve item master tax here.
      hsnCode: l.hsnCode ?? l.sacCode ?? matchedItem?.hsnCode ?? null,
      hsnId: l.hsnId ?? null,
      taxScheme: l.taxScheme ?? null,
      cgstRate: l.cgstRate ?? l.cgstPct ?? null,
      sgstRate: l.sgstRate ?? l.sgstPct ?? null,
      utgstRate: l.utgstRate ?? l.utgstPct ?? null,
      igstRate: l.igstRate ?? l.igstPct ?? null,
      cgstAmount: l.cgstAmount ?? null,
      sgstAmount: l.sgstAmount ?? null,
      utgstAmount: l.utgstAmount ?? null,
      igstAmount: l.igstAmount ?? null,
    }
  })
}

export function summarizeQuotationLinesForSo(document: QuotationDocument) {
  const lines = quotationPriceLinesForSo(document)
  const summary = calcPriceSummary(lines, document)
  return {
    lineCount: lines.length,
    totalQty: lines.reduce((s, l) => s + l.qty, 0),
    summary,
    lines,
  }
}

export function quotationLineItemsSummary(document: QuotationDocument): string {
  const lines = quotationPriceLinesForSo(document)
  if (lines.length === 0) return '-'
  if (lines.length === 1) return lines[0]!.productOrItem
  return `${lines[0]!.productOrItem} + ${lines.length - 1} more`
}
