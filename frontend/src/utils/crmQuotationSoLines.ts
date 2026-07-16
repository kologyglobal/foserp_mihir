import type { Opportunity, OpportunityLine, QuotationDocument, QuotationPriceLine } from '../types/crm'
import type { Product } from '../types/master'
import type { SalesOrderLine } from '../types/mrp'
import type { Quotation } from '../types/sales'
import { calcPriceSummary, syncLineTotals } from './crmQuotationCalc'
import { sectionContent } from './crmIntegration'
import { resolveOpportunityLines, syncOpportunityLines } from './opportunityLineCalc'

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

export function quotationPriceLinesForSo(document: QuotationDocument): QuotationPriceLine[] {
  return syncLineTotals(document.priceLines).filter((l) => !l.isOptional)
}

export function buildSalesOrderLinesFromQuotationDocument(input: {
  document: QuotationDocument
  opportunity?: Opportunity | null
  salesQuotation?: Quotation | null
  products: Product[]
  defaultProduct?: Product | null
}): SalesOrderLine[] {
  const { document, opportunity, salesQuotation, products, defaultProduct } = input
  const lines = quotationPriceLinesForSo(document)
  const multiLine = lines.length > 1
  const oppLines = opportunity ? syncOpportunityLines(resolveOpportunityLines(opportunity)) : []
  const technicalScope = sectionContent(document, 'technical') || document.technicalNotes

  return lines.map((l, idx) => {
    const base = l.qty * l.unitPrice * (1 - l.discountPct / 100)
    const gst = base * (l.taxPct / 100)
    const lineProductId = resolveQuotationPriceLineProductId(
      l,
      idx,
      oppLines,
      products,
      salesQuotation?.productId ?? defaultProduct?.id ?? null,
      multiLine,
    )
    const matchedProduct = lineProductId ? products.find((p) => p.id === lineProductId) : undefined

    return {
      id: `sol-${document.id}-${idx + 1}`,
      lineNo: idx + 1,
      productOrItem: l.productOrItem || matchedProduct?.productName || defaultProduct?.productName || 'Item',
      description: l.description || matchedProduct?.productName || '',
      productId: lineProductId,
      qty: l.qty,
      uom: l.uom || 'Nos',
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      taxPct: l.taxPct,
      taxableValue: Math.round(base * 100) / 100,
      gstAmount: Math.round(gst * 100) / 100,
      lineTotal: l.lineTotal,
      technicalScopeRef: technicalScope,
    }
  })
}

export function summarizeQuotationLinesForSo(document: QuotationDocument) {
  const lines = quotationPriceLinesForSo(document)
  const summary = calcPriceSummary(lines, document.freightAmount, document.installationAmount, document.customCharges)
  return {
    lineCount: lines.length,
    totalQty: lines.reduce((s, l) => s + l.qty, 0),
    summary,
    lines,
  }
}

export function quotationLineItemsSummary(document: QuotationDocument): string {
  const lines = quotationPriceLinesForSo(document)
  if (lines.length === 0) return '—'
  if (lines.length === 1) return lines[0]!.productOrItem
  return `${lines[0]!.productOrItem} + ${lines.length - 1} more`
}
