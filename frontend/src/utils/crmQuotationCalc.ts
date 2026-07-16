import type { QuotationPriceLine } from '../types/crm'

export function calcLineTotal(line: Pick<QuotationPriceLine, 'qty' | 'unitPrice' | 'discountPct' | 'taxPct'>): number {
  const base = line.qty * line.unitPrice * (1 - line.discountPct / 100)
  const tax = base * (line.taxPct / 100)
  return Math.round((base + tax) * 100) / 100
}

export function calcPriceSummary(
  lines: QuotationPriceLine[],
  freightAmount: number,
  installationAmount: number,
  customCharges: number,
) {
  const basicAmount = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
  const discountAmount = lines.reduce((s, l) => s + l.qty * l.unitPrice * (l.discountPct / 100), 0)
  const taxableValue = basicAmount - discountAmount
  const gstAmount = lines.reduce((s, l) => {
    const base = l.qty * l.unitPrice * (1 - l.discountPct / 100)
    return s + base * (l.taxPct / 100)
  }, 0)
  const grandTotal = Math.round((taxableValue + gstAmount + freightAmount + installationAmount + customCharges) * 100) / 100
  return {
    basicAmount: Math.round(basicAmount * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    taxableValue: Math.round(taxableValue * 100) / 100,
    gstAmount: Math.round(gstAmount * 100) / 100,
    freightAmount,
    installationAmount,
    customCharges,
    grandTotal,
  }
}

export function syncLineTotals(lines: QuotationPriceLine[]): QuotationPriceLine[] {
  return lines.map((l) => ({ ...l, lineTotal: calcLineTotal(l) }))
}
