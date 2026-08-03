import type { EffectiveStatutoryRule } from './statutory-rule.service.js'
import { decStatutory, resolveWageBasis, roundStatutoryAmount } from './wage-basis.service.js'

export interface PtCalculationResult {
  amount: number
  applicableWage: number
  slabId: string | null
  calculationBasis: string
  notes: string | null
}

/**
 * PT wage basis defaults to gross earnings. `specialMonth` slabs (e.g. a higher
 * February deduction in some states) take priority over generic slabs when the
 * payroll month matches; otherwise only slabs without a specialMonth are considered.
 */
export function calculatePt(
  rule: EffectiveStatutoryRule,
  earningsByCode: Record<string, number> | Map<string, number>,
  grossEarnings: number,
  payrollMonth: number,
): PtCalculationResult {
  const basis = resolveWageBasis(rule, earningsByCode, { fallbackWage: grossEarnings })
  const slabs = rule.ptSlabs ?? []

  if (slabs.length === 0) {
    return {
      amount: 0,
      applicableWage: basis.wage,
      slabId: null,
      calculationBasis: 'PT: no slabs configured on the active rule',
      notes: 'No PT slabs configured',
    }
  }

  const monthSlabs = slabs.filter((s) => s.specialMonth === payrollMonth)
  const candidateSlabs = monthSlabs.length > 0 ? monthSlabs : slabs.filter((s) => s.specialMonth == null)

  const matched = candidateSlabs.find((s) => {
    const from = decStatutory(s.fromAmount) ?? 0
    const to = s.toAmount != null ? decStatutory(s.toAmount) : null
    return basis.wage >= from && (to == null || basis.wage <= to)
  })

  if (!matched) {
    return {
      amount: 0,
      applicableWage: basis.wage,
      slabId: null,
      calculationBasis: `PT: no slab matched wage ₹${basis.wage}`,
      notes: 'No matching PT slab for this wage',
    }
  }

  const amount = roundStatutoryAmount(decStatutory(matched.taxAmount) ?? 0, rule.roundingMode)
  const to = matched.toAmount != null ? decStatutory(matched.toAmount) : null
  return {
    amount,
    applicableWage: basis.wage,
    slabId: matched.id,
    calculationBasis: `PT: wage ₹${basis.wage} → slab ₹${decStatutory(matched.fromAmount)}–${to ?? '∞'}${
      monthSlabs.length > 0 ? ` (special month ${payrollMonth})` : ''
    }`,
    notes: null,
  }
}
