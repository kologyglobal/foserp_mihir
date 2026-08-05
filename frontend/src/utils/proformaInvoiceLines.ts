import type { Item } from '../types/master'
import type { SalesOrder, SalesOrderLine } from '../types/mrp'
import type { ProformaInvoiceLine } from '../types/proformaInvoice'
import { breakupAmounts } from './commercialLineSnapshot'

const DEFAULT_TAX_PCT = 0

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
  // Prefer saved SO HSN snapshot; item master only for legacy lines without snapshot.
  const hsn =
    (line.hsnCode ?? '').trim() ||
    (item?.hsnCode ?? '').trim() ||
    ''
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
    hsnCode: hsn,
    qty: line.qty,
    uom: line.uom || 'Nos',
    unitPrice: line.unitPrice,
    discountPct: line.discountPct,
    taxPct: line.taxPct,
    taxableValue: line.taxableValue,
    gstAmount: line.gstAmount,
    lineTotal: line.lineTotal,
    taxScheme: line.taxScheme ?? null,
    cgstRate: line.cgstRate ?? null,
    sgstRate: line.sgstRate ?? null,
    utgstRate: line.utgstRate ?? null,
    igstRate: line.igstRate ?? null,
    cgstAmount: line.cgstAmount ?? null,
    sgstAmount: line.sgstAmount ?? null,
    utgstAmount: line.utgstAmount ?? null,
    igstAmount: line.igstAmount ?? null,
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
  // Header-only SO has no line taxPct — leave 0 until user/master resolve (no silent 18).
  const resolvedTax = DEFAULT_TAX_PCT
  const gstAmount = round2(taxable * (resolvedTax / 100))

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
    taxPct: resolvedTax,
    taxableValue: taxable,
    gstAmount,
    lineTotal: round2(taxable + gstAmount),
  }]
}

export function computeProformaLineTotals(
  line: Pick<ProformaInvoiceLine, 'qty' | 'unitPrice' | 'discountPct' | 'taxPct'> & {
    taxScheme?: string | null
    cgstRate?: number | null
    sgstRate?: number | null
    utgstRate?: number | null
    igstRate?: number | null
  },
): Pick<
  ProformaInvoiceLine,
  | 'taxableValue'
  | 'gstAmount'
  | 'lineTotal'
  | 'cgstAmount'
  | 'sgstAmount'
  | 'utgstAmount'
  | 'igstAmount'
> {
  const taxableValue = round2(line.qty * line.unitPrice * (1 - line.discountPct / 100))
  const scheme = (line.taxScheme ?? '').toLowerCase()
  if (scheme === 'igst' || scheme === 'utgst_pair' || scheme === 'cgst_utgst' || scheme === 'cgst_sgst') {
    const b = breakupAmounts(taxableValue, {
      taxScheme: line.taxScheme,
      cgstRate: line.cgstRate,
      sgstRate: line.sgstRate,
      utgstRate: line.utgstRate,
      igstRate: line.igstRate,
      taxPct: line.taxPct,
    })
    return {
      taxableValue,
      gstAmount: b.gstAmount,
      lineTotal: round2(taxableValue + b.gstAmount),
      cgstAmount: b.cgstAmount,
      sgstAmount: b.sgstAmount,
      utgstAmount: b.utgstAmount,
      igstAmount: b.igstAmount,
    }
  }
  const gstAmount = round2(taxableValue * (line.taxPct / 100))
  return {
    taxableValue,
    gstAmount,
    lineTotal: round2(taxableValue + gstAmount),
    cgstAmount: null,
    sgstAmount: null,
    utgstAmount: null,
    igstAmount: null,
  }
}

export function sumProformaTaxable(lines: ProformaInvoiceLine[]): number {
  return round2(lines.reduce((s, l) => s + l.taxableValue, 0))
}
