import type { EffectiveStatutoryRule } from './statutory-rule.service.js'
import { decStatutory, roundStatutoryAmount } from './wage-basis.service.js'

export interface LwfCalculationResult {
  due: boolean
  employeeAmount: number
  employerAmount: number
  calculationBasis: string
  notes: string | null
}

function parseConfigMonths(configJson: string | null): number[] {
  if (!configJson) return []
  try {
    const parsed = JSON.parse(configJson) as { months?: unknown }
    return Array.isArray(parsed.months) ? parsed.months.filter((m): m is number => Number.isInteger(m)) : []
  } catch {
    return []
  }
}

/**
 * LWF is fixed-amount, not wage-linked. MONTHLY frequency is always due; HALF_YEARLY
 * is due only in the months listed in `rule.configJson.months` (e.g. [6, 12]); any
 * other/unspecified frequency is skipped with a note (no exception raised).
 */
export function calculateLwf(rule: EffectiveStatutoryRule, payrollMonth: number): LwfCalculationResult {
  const frequency = (rule.frequency ?? 'MONTHLY').toUpperCase()

  if (frequency === 'HALF_YEARLY') {
    const months = parseConfigMonths(rule.configJson)
    if (!months.includes(payrollMonth)) {
      return {
        due: false,
        employeeAmount: 0,
        employerAmount: 0,
        calculationBasis: `LWF: half-yearly, not due in month ${payrollMonth}`,
        notes: `LWF due only in months: ${months.length > 0 ? months.join(', ') : 'not configured'}`,
      }
    }
  } else if (frequency !== 'MONTHLY') {
    return {
      due: false,
      employeeAmount: 0,
      employerAmount: 0,
      calculationBasis: `LWF: frequency ${frequency} not due this period`,
      notes: 'LWF frequency is not MONTHLY/HALF_YEARLY',
    }
  }

  const employeeAmount = roundStatutoryAmount(decStatutory(rule.employeeFixedAmount) ?? 0, rule.roundingMode)
  const employerAmount = roundStatutoryAmount(decStatutory(rule.employerFixedAmount) ?? 0, rule.roundingMode)
  return {
    due: true,
    employeeAmount,
    employerAmount,
    calculationBasis: `LWF: ${frequency} fixed contribution`,
    notes: null,
  }
}
