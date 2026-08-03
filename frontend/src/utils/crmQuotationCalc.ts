import type { QuotationPriceLine } from '../types/crm'
import {
  adjustmentsFromDocumentFields,
  calcOrderDocumentTotals,
  type OrderDocumentTotals,
} from './orderAdjustmentsCalc'

export type QuotationChargeDocFields = {
  freightAmount?: number | null
  installationAmount?: number | null
  customCharges?: number | null
  orderDiscountCalcType?: string | null
  orderDiscountValue?: number | null
  freightCalcType?: string | null
  freightValue?: number | null
  freightIsTaxable?: boolean | null
  freightTaxRate?: number | null
  installationCalcType?: string | null
  installationValue?: number | null
  installationIsTaxable?: boolean | null
  installationTaxRate?: number | null
  customChargesCalcType?: string | null
  customChargesValue?: number | null
  customChargesIsTaxable?: boolean | null
  customChargesTaxRate?: number | null
}

export function calcLineTotal(line: Pick<QuotationPriceLine, 'qty' | 'unitPrice' | 'discountPct' | 'taxPct'>): number {
  const base = line.qty * line.unitPrice * (1 - line.discountPct / 100)
  const tax = base * (line.taxPct / 100)
  return Math.round((base + tax) * 100) / 100
}

/**
 * Document price summary — shared order-adjustment rules (flat/%, taxable charges).
 * Prefer passing full document charge fields; amount-only args remain for legacy call sites.
 */
export function calcPriceSummary(
  lines: QuotationPriceLine[],
  freightAmount: number | QuotationChargeDocFields = 0,
  installationAmount = 0,
  customCharges = 0,
  moreFields?: QuotationChargeDocFields,
): ReturnType<typeof toLegacySummary> {
  const fields: QuotationChargeDocFields =
    typeof freightAmount === 'object' && freightAmount !== null
      ? freightAmount
      : {
          freightAmount,
          installationAmount,
          customCharges,
          ...moreFields,
        }

  const totals = calcOrderDocumentTotals(
    (lines ?? []).map((l) => ({
      qty: l.qty,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      taxPct: l.taxPct,
    })),
    adjustmentsFromDocumentFields(fields),
  )
  return toLegacySummary(totals)
}

function toLegacySummary(totals: OrderDocumentTotals) {
  return {
    basicAmount: totals.basicAmount,
    discountAmount: totals.itemDiscountAmount,
    taxableValue: totals.taxableAmount,
    gstAmount: totals.gstAmount,
    freightAmount: totals.freightAmount,
    installationAmount: totals.installationAmount,
    customCharges: totals.customCharges,
    grandTotal: totals.grandTotal,
    orderDiscountAmount: totals.orderDiscount.calculatedAmount,
    discountedTaxableAmount: totals.discountedTaxableAmount,
    totals,
  }
}

export function calcPriceSummaryFromDocument(
  lines: QuotationPriceLine[],
  doc: QuotationChargeDocFields,
) {
  return calcPriceSummary(lines, doc)
}

export function syncLineTotals(lines: QuotationPriceLine[]): QuotationPriceLine[] {
  return lines.map((l) => ({ ...l, lineTotal: calcLineTotal(l) }))
}
