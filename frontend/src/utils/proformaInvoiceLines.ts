import type { Item } from '../types/master'
import type { SalesOrder, SalesOrderLine } from '../types/mrp'
import type { ProformaInvoiceLine } from '../types/proformaInvoice'

const DEFAULT_TAX_PCT = 18

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function genLineId(prefix = 'pil'): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function mapSoLineToPiLine(line: SalesOrderLine, items: Item[]): ProformaInvoiceLine {
  const item = line.itemId ? items.find((i) => i.id === line.itemId) : undefined
  const lineExtra = line as SalesOrderLine & {
    itemCodeSnapshot?: string | null
    itemNameSnapshot?: string | null
  }
  return {
    id: genLineId(),
    lineNo: line.lineNo,
    itemId: line.itemId ?? item?.id ?? '',
    itemCode: item?.itemCode ?? lineExtra.itemCodeSnapshot ?? '',
    description:
      line.description ||
      line.productOrItem ||
      lineExtra.itemNameSnapshot ||
      item?.itemName ||
      '',
    hsnCode: item?.hsnCode ?? '',
    qty: line.qty,
    uom: line.uom || 'Nos',
    unitPrice: line.unitPrice,
    discountPct: line.discountPct,
    taxPct: line.taxPct,
    taxableValue: line.taxableValue,
    gstAmount: line.gstAmount,
    lineTotal: line.lineTotal,
  }
}

export function buildProformaLinesFromSalesOrder(so: SalesOrder, items: Item[]): ProformaInvoiceLine[] {
  if (so.lines && so.lines.length > 0) {
    return so.lines.map((line) => mapSoLineToPiLine(line, items))
  }

  const item = so.itemId ? items.find((i) => i.id === so.itemId) : undefined
  const unitPrice = so.unitPrice ?? item?.defaultSalesRate ?? item?.standardRate ?? 0
  const discountPct = so.discountPct ?? 0
  const taxable = round2(so.qty * unitPrice * (1 - discountPct / 100))
  const taxPct = DEFAULT_TAX_PCT
  const gstAmount = round2(taxable * (taxPct / 100))

  return [{
    id: genLineId(),
    lineNo: 1,
    itemId: so.itemId ?? item?.id ?? '',
    itemCode: item?.itemCode ?? '',
    description: item?.itemName ?? 'Sales order line',
    hsnCode: item?.hsnCode ?? '',
    qty: so.qty,
    uom: 'Nos',
    unitPrice,
    discountPct,
    taxPct,
    taxableValue: taxable,
    gstAmount,
    lineTotal: round2(taxable + gstAmount),
  }]
}

export function computeProformaLineTotals(line: Pick<ProformaInvoiceLine, 'qty' | 'unitPrice' | 'discountPct' | 'taxPct'>): Pick<ProformaInvoiceLine, 'taxableValue' | 'gstAmount' | 'lineTotal'> {
  const taxableValue = round2(line.qty * line.unitPrice * (1 - line.discountPct / 100))
  const gstAmount = round2(taxableValue * (line.taxPct / 100))
  return {
    taxableValue,
    gstAmount,
    lineTotal: round2(taxableValue + gstAmount),
  }
}

export function sumProformaTaxable(lines: ProformaInvoiceLine[]): number {
  return round2(lines.reduce((s, l) => s + l.taxableValue, 0))
}
