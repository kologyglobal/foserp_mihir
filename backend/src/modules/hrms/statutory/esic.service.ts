import type { EffectiveStatutoryRule } from './statutory-rule.service.js'
import { decStatutory, resolveWageBasis, roundStatutoryAmount } from './wage-basis.service.js'

export interface EsicCalculationResult {
  eligible: boolean
  applicableWage: number
  wageBasisIncluded: Array<{ code: string; amount: number }>
  employeeAmount: number
  employerAmount: number
  calculationBasis: string
  notes: string | null
}

/**
 * ESIC wage basis defaults to gross earnings when the rule has no configured lines.
 * Eligibility is wage-vs-ceiling unless `forceEligible` (explicit employee override) is set.
 */
export function calculateEsic(
  rule: EffectiveStatutoryRule,
  earningsByCode: Record<string, number> | Map<string, number>,
  grossEarnings: number,
  forceEligible: boolean,
): EsicCalculationResult {
  const basis = resolveWageBasis(rule, earningsByCode, { fallbackWage: grossEarnings })
  const ceiling = decStatutory(rule.eligibilityWageCeiling)
  const eligible = forceEligible || ceiling == null || basis.wage <= ceiling

  if (!eligible) {
    return {
      eligible: false,
      applicableWage: basis.wage,
      wageBasisIncluded: basis.included,
      employeeAmount: 0,
      employerAmount: 0,
      calculationBasis: `ESIC: wage ₹${basis.wage} exceeds eligibility ceiling ₹${ceiling}`,
      notes: 'Not eligible this period — wage exceeds ESIC ceiling',
    }
  }

  const empRate = decStatutory(rule.employeeRatePct) ?? 0
  const erRate = decStatutory(rule.employerRatePct) ?? 0
  const employeeAmount = roundStatutoryAmount((basis.wage * empRate) / 100, rule.roundingMode)
  const employerAmount = roundStatutoryAmount((basis.wage * erRate) / 100, rule.roundingMode)

  return {
    eligible: true,
    applicableWage: basis.wage,
    wageBasisIncluded: basis.included,
    employeeAmount,
    employerAmount,
    calculationBasis: `ESIC: wage ₹${basis.wage} × ${empRate}% employee / ${erRate}% employer`,
    notes: forceEligible && ceiling != null && basis.wage > ceiling ? 'Applicability override forced ESIC despite wage above ceiling' : null,
  }
}
