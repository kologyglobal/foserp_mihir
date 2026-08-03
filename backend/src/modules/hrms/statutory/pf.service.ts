import type { EffectiveStatutoryRule } from './statutory-rule.service.js'
import { decStatutory, resolveWageBasis, roundStatutoryAmount } from './wage-basis.service.js'

export interface PfCalculationResult {
  applicableWage: number
  wageBasisIncluded: Array<{ code: string; amount: number }>
  employeeAmount: number
  employerAmount: number
  calculationBasis: string
  notes: string | null
}

/** PF wage basis defaults to BASIC when the rule has no configured wage-basis lines. */
export function calculatePf(
  rule: EffectiveStatutoryRule,
  earningsByCode: Record<string, number> | Map<string, number>,
): PfCalculationResult {
  const basis = resolveWageBasis(rule, earningsByCode, { defaultComponentCodes: ['BASIC'] })
  const ceiling = decStatutory(rule.wageCeiling)
  const contributionWage = ceiling != null ? Math.min(basis.wage, ceiling) : basis.wage

  const empRate = decStatutory(rule.employeeRatePct)
  const erRate = decStatutory(rule.employerRatePct)
  const empFixed = decStatutory(rule.employeeFixedAmount)
  const erFixed = decStatutory(rule.employerFixedAmount)

  let employeeAmount = 0
  let employerAmount = 0
  let notes: string | null = null

  if (empRate != null) {
    employeeAmount = roundStatutoryAmount((contributionWage * empRate) / 100, rule.roundingMode)
  } else if (empFixed != null) {
    employeeAmount = roundStatutoryAmount(empFixed, rule.roundingMode)
  } else {
    notes = 'PF employee rate/fixed amount not configured on the active rule'
  }

  if (erRate != null) {
    employerAmount = roundStatutoryAmount((contributionWage * erRate) / 100, rule.roundingMode)
  } else if (erFixed != null) {
    employerAmount = roundStatutoryAmount(erFixed, rule.roundingMode)
  }

  const ceilingNote = ceiling != null ? ` (capped at ceiling ₹${ceiling})` : ''
  return {
    applicableWage: contributionWage,
    wageBasisIncluded: basis.included,
    employeeAmount,
    employerAmount,
    calculationBasis: `PF: wage ₹${contributionWage}${ceilingNote} × ${empRate ?? 'fixed'}% employee / ${erRate ?? 'fixed'}% employer`,
    notes,
  }
}
