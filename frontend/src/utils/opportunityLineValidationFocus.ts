import type { FieldErrorMap } from './formValidation'
import {
  opportunityLineUnitPriceFieldKey,
  UNIT_PRICE_REQUIRED_MESSAGE,
} from './opportunityLineCalc'

/** Map per-line rowErrors → `unitPrice-${lineId}` (and sibling) field keys for focus. */
export function opportunityRowErrorsToFieldMap(
  rowErrors: Record<string, string[]>,
): FieldErrorMap {
  const map: FieldErrorMap = {}
  for (const [lineId, errs] of Object.entries(rowErrors)) {
    for (const err of errs) {
      const lower = err.toLowerCase()
      if (lower.includes('unit price')) {
        const key = opportunityLineUnitPriceFieldKey(lineId)
        if (!map[key]) map[key] = UNIT_PRICE_REQUIRED_MESSAGE
      } else if (lower.includes('quantity')) {
        const key = `qty-${lineId}`
        if (!map[key]) map[key] = err.replace(/\.$/, '')
      } else if (lower.includes('product')) {
        const key = `product-${lineId}`
        if (!map[key]) map[key] = err.replace(/\.$/, '')
      } else if (lower.includes('gst') || lower.includes('tax')) {
        const key = `taxPct-${lineId}`
        if (!map[key]) map[key] = err.replace(/\.$/, '')
      }
    }
  }
  return map
}
