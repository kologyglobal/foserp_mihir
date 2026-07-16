import type { Product } from '../types/master'
import type { SalesOrder, SalesOrderLine } from '../types/mrp'
import type { ProformaInvoiceLine } from '../types/proformaInvoice'

const DEFAULT_TAX_PCT = 18

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function genLineId(prefix = 'pil'): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function mapSoLineToPiLine(line: SalesOrderLine, products: Product[]): ProformaInvoiceLine {
  const product = line.productId ? products.find((p) => p.id === line.productId) : undefined
  return {
    id: genLineId(),
    lineNo: line.lineNo,
    productId: line.productId ?? product?.id ?? '',
    itemCode: product?.productCode ?? '',
    description: line.description || line.productOrItem || product?.productName || '',
    hsnCode: product?.hsnCode ?? '',
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

export function buildProformaLinesFromSalesOrder(so: SalesOrder, products: Product[]): ProformaInvoiceLine[] {
  if (so.lines && so.lines.length > 0) {
    return so.lines.map((line) => mapSoLineToPiLine(line, products))
  }

  const product = products.find((p) => p.id === so.productId)
  const unitPrice = so.unitPrice ?? product?.standardPrice ?? 0
  const discountPct = so.discountPct ?? 0
  const taxable = round2(so.qty * unitPrice * (1 - discountPct / 100))
  const taxPct = DEFAULT_TAX_PCT
  const gstAmount = round2(taxable * (taxPct / 100))

  return [{
    id: genLineId(),
    lineNo: 1,
    productId: so.productId,
    itemCode: product?.productCode ?? '',
    description: product?.productName ?? 'Sales order line',
    hsnCode: product?.hsnCode ?? '',
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
