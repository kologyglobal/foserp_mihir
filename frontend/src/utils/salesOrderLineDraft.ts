import type { SalesOrder, SalesOrderLine } from '../types/mrp'

export const SO_GST_RATE_OPTIONS = [0, 5, 12, 18, 28] as const

export interface SoLineDraft {
  key: string
  itemId: string
  qty: number
  unitPrice: number
  discountPct: number
  taxPct: number
}

export function roundSoLine2(n: number) {
  return Math.round(n * 100) / 100
}

export function computeSoLineTotals(line: SoLineDraft) {
  const taxableValue = roundSoLine2(line.qty * line.unitPrice * (1 - line.discountPct / 100))
  const gstAmount = roundSoLine2(taxableValue * (line.taxPct / 100))
  return { taxableValue, gstAmount, lineTotal: roundSoLine2(taxableValue + gstAmount) }
}

export function newSoLineDraft(itemId = '', unitPrice = 0): SoLineDraft {
  return {
    key: crypto.randomUUID(),
    itemId,
    qty: 1,
    unitPrice,
    discountPct: 0,
    taxPct: 18,
  }
}

export function soLineDraftsFromOrder(order: SalesOrder): SoLineDraft[] {
  if (order.lines?.length) {
    return order.lines.map((line) => ({
      key: line.id,
      itemId: line.itemId ?? order.itemId ?? order.productId ?? '',
      qty: line.qty,
      unitPrice: line.unitPrice,
      discountPct: line.discountPct,
      taxPct: line.taxPct,
    }))
  }
  const headerItemId = order.itemId ?? order.productId ?? ''
  if (headerItemId) {
    return [{
      ...newSoLineDraft(headerItemId, order.unitPrice ?? 0),
      qty: order.qty,
    }]
  }
  return [newSoLineDraft()]
}

export function resolveSalesOrderDisplayLines(order: SalesOrder): SalesOrderLine[] {
  if (order.lines?.length) return order.lines
  const headerItemId = order.itemId ?? order.productId
  if (!headerItemId) return []
  const unitPrice = order.unitPrice ?? 0
  const discountPct = order.discountPct ?? 0
  const taxPct = 18
  const totals = computeSoLineTotals({
    key: 'header',
    itemId: headerItemId,
    qty: order.qty,
    unitPrice,
    discountPct,
    taxPct,
  })
  return [{
    id: `${order.id}-line-1`,
    lineNo: 1,
    productOrItem: headerItemId,
    description: '',
    productId: order.productId,
    itemId: headerItemId,
    qty: order.qty,
    uom: 'NOS',
    unitPrice,
    discountPct,
    taxPct,
    taxableValue: totals.taxableValue,
    gstAmount: totals.gstAmount,
    lineTotal: totals.lineTotal,
  }]
}

export function soLineDraftsToApiPayload(
  lines: SoLineDraft[],
  getItemName: (itemId: string) => string | undefined,
) {
  return lines.map((l) => {
    const name = getItemName(l.itemId)
    return {
      productOrItem: name ?? l.itemId,
      description: name ?? '',
      itemId: l.itemId,
      qty: l.qty,
      uom: 'NOS',
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      taxPct: l.taxPct,
    }
  })
}
