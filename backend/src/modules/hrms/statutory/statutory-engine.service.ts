import type { HrStatutoryRuleType } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { calculateEsic } from './esic.service.js'
import { calculateLwf } from './lwf.service.js'
import { calculatePf } from './pf.service.js'
import { calculatePt } from './pt.service.js'
import { getEffectiveStatutoryRule, type EffectiveStatutoryRule } from './statutory-rule.service.js'
import { calculateTds } from './tds.service.js'
import { decStatutory, resolveWageBasis } from './wage-basis.service.js'

export interface StatutoryEngineInput {
  tenantId: string
  employeeId: string
  legalEntityId: string
  branchId: string
  /** Payroll period end date — used to resolve the effective rule as-of this date. */
  payrollDate: Date
  payrollMonth: number
  payrollYear: number
  /** FIXED/PERCENTAGE/OT earning amounts already resolved by the payroll calc, keyed by component code. */
  earningsByCode: Record<string, number>
  grossEarnings: number
}

export type StatutoryComponentType = 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION'

export interface StatutoryLineResult {
  code: string
  type: StatutoryComponentType
  amount: number
  statutoryType: HrStatutoryRuleType
  ruleId: string | null
  ruleCode: string | null
  calculationBasis: string | null
  notes: string | null
}

export interface StatutoryExceptionResult {
  code: string
  severity: 'BLOCKER' | 'WARNING'
  message: string
}

export interface StatutoryEngineResult {
  lines: StatutoryLineResult[]
  exceptions: StatutoryExceptionResult[]
  evidence: Record<string, unknown>
}

function resolveApplicable(
  overrideValue: boolean | null | undefined,
  defaultValue: boolean,
): { applicable: boolean; overridden: boolean } {
  if (typeof overrideValue === 'boolean') return { applicable: overrideValue, overridden: true }
  return { applicable: defaultValue, overridden: false }
}

function blocker(code: string, message: string): StatutoryExceptionResult {
  return { code, severity: 'BLOCKER', message }
}

function warn(code: string, message: string): StatutoryExceptionResult {
  return { code, severity: 'WARNING', message }
}

function makeLine(
  code: string,
  type: StatutoryComponentType,
  amount: number,
  statutoryType: HrStatutoryRuleType,
  rule: EffectiveStatutoryRule | null,
  calculationBasis: string | null,
  notes: string | null,
): StatutoryLineResult {
  return { code, type, amount, statutoryType, ruleId: rule?.id ?? null, ruleCode: rule?.code ?? null, calculationBasis, notes }
}

/**
 * Orchestrates PF / ESIC / PT / TDS / LWF for one employee's payroll context.
 *
 * Applicability resolution: an explicit true/false on `HrEmployeeStatutoryDetail`
 * always wins. When unset, defaults are:
 *  - PF: true when the employee has a UAN on file, OR the employee is ACTIVE
 *        (new joiners without a UAN yet are still enrolled by default).
 *  - ESIC: when an active ESIC rule exists, true only if the wage is at/under
 *        the rule's eligibility ceiling; when no rule exists yet, default true
 *        so the missing-configuration exception surfaces instead of a silent skip.
 *  - PT / TDS / LWF: true (branch/PAN/rule gaps are surfaced as their own
 *        data-quality exceptions rather than suppressing the component).
 *
 * BONUS / GRATUITY are intentionally out of scope — hooks only, never calculated here.
 */
export async function calculateStatutoryForEmployee(input: StatutoryEngineInput): Promise<StatutoryEngineResult> {
  const lines: StatutoryLineResult[] = []
  const exceptions: StatutoryExceptionResult[] = []
  const evidence: Record<string, unknown> = {}

  const [employee, statutoryDetail, branch] = await Promise.all([
    prisma.hrEmployee.findFirst({
      where: { id: input.employeeId, tenantId: input.tenantId, deletedAt: null },
      select: { id: true, status: true },
    }),
    prisma.hrEmployeeStatutoryDetail.findFirst({ where: { tenantId: input.tenantId, employeeId: input.employeeId } }),
    prisma.branch.findFirst({ where: { id: input.branchId, tenantId: input.tenantId }, select: { id: true, stateCode: true } }),
  ])

  const stateCode = branch?.stateCode ?? null
  const ctx = { legalEntityId: input.legalEntityId, stateCode }

  // ── PF ──────────────────────────────────────────────────────────────────
  const pfRule = await getEffectiveStatutoryRule(input.tenantId, 'PF', ctx, input.payrollDate)
  const pfDefault = Boolean(statutoryDetail?.uan) || employee?.status === 'ACTIVE'
  const pf = resolveApplicable(statutoryDetail?.pfApplicable, pfDefault)

  if (!pf.applicable) {
    evidence.pf = { applicable: false, overridden: pf.overridden }
  } else if (!pfRule) {
    exceptions.push(blocker('STATUTORY_RULE_NOT_CONFIGURED', 'No active PF rule configured for this legal entity/date'))
    evidence.pf = { applicable: true, overridden: pf.overridden, ruleFound: false }
  } else {
    if (!statutoryDetail?.uan) {
      exceptions.push(warn('UAN_MISSING', 'Employee UAN is not on file; PF is still contributed pending UAN linkage'))
    }
    const result = calculatePf(pfRule, input.earningsByCode)
    lines.push(makeLine('PF_EMPLOYEE', 'DEDUCTION', result.employeeAmount, 'PF', pfRule, result.calculationBasis, result.notes))
    lines.push(makeLine('PF_EMPLOYER', 'EMPLOYER_CONTRIBUTION', result.employerAmount, 'PF', pfRule, result.calculationBasis, result.notes))
    evidence.pf = { applicable: true, overridden: pf.overridden, ruleId: pfRule.id, ruleCode: pfRule.code, ...result }
  }

  // ── ESIC ────────────────────────────────────────────────────────────────
  const esicRule = await getEffectiveStatutoryRule(input.tenantId, 'ESIC', ctx, input.payrollDate)
  let esicDefault = true
  if (esicRule) {
    const preview = resolveWageBasis(esicRule, input.earningsByCode, { fallbackWage: input.grossEarnings })
    const ceiling = decStatutory(esicRule.eligibilityWageCeiling)
    esicDefault = ceiling == null || preview.wage <= ceiling
  }
  const esic = resolveApplicable(statutoryDetail?.esicApplicable, esicDefault)

  if (!esic.applicable) {
    evidence.esic = { applicable: false, overridden: esic.overridden }
  } else if (!esicRule) {
    exceptions.push(blocker('STATUTORY_RULE_NOT_CONFIGURED', 'No active ESIC rule configured for this legal entity/date'))
    evidence.esic = { applicable: true, overridden: esic.overridden, ruleFound: false }
  } else {
    if (!statutoryDetail?.esicNumber) {
      exceptions.push(warn('ESIC_NUMBER_MISSING', 'Employee ESIC number is not on file'))
    }
    const forceEligible = esic.overridden && statutoryDetail?.esicApplicable === true
    const result = calculateEsic(esicRule, input.earningsByCode, input.grossEarnings, forceEligible)
    if (result.eligible) {
      lines.push(makeLine('ESIC_EMPLOYEE', 'DEDUCTION', result.employeeAmount, 'ESIC', esicRule, result.calculationBasis, result.notes))
      lines.push(makeLine('ESIC_EMPLOYER', 'EMPLOYER_CONTRIBUTION', result.employerAmount, 'ESIC', esicRule, result.calculationBasis, result.notes))
    }
    evidence.esic = { applicable: true, overridden: esic.overridden, ruleId: esicRule.id, ruleCode: esicRule.code, ...result }
  }

  // ── Professional Tax ────────────────────────────────────────────────────
  const ptRule = await getEffectiveStatutoryRule(input.tenantId, 'PROFESSIONAL_TAX', ctx, input.payrollDate)
  const pt = resolveApplicable(statutoryDetail?.ptApplicable, true)

  if (!stateCode && pt.applicable) {
    exceptions.push(warn('PT_STATE_MISSING', 'Employee branch has no stateCode configured; PT cannot be resolved reliably'))
  }

  if (!pt.applicable) {
    evidence.pt = { applicable: false, overridden: pt.overridden }
  } else if (!ptRule) {
    exceptions.push(blocker('STATUTORY_RULE_NOT_CONFIGURED', 'No active Professional Tax rule configured for this state/date'))
    evidence.pt = { applicable: true, overridden: pt.overridden, ruleFound: false }
  } else {
    const result = calculatePt(ptRule, input.earningsByCode, input.grossEarnings, input.payrollMonth)
    lines.push(makeLine('PT', 'DEDUCTION', result.amount, 'PROFESSIONAL_TAX', ptRule, result.calculationBasis, result.notes))
    evidence.pt = { applicable: true, overridden: pt.overridden, ruleId: ptRule.id, ruleCode: ptRule.code, ...result }
  }

  // ── TDS ─────────────────────────────────────────────────────────────────
  const tdsRule = await getEffectiveStatutoryRule(input.tenantId, 'TDS', ctx, input.payrollDate)
  const tds = resolveApplicable(statutoryDetail?.tdsApplicable, true)

  if (!tds.applicable) {
    evidence.tds = { applicable: false, overridden: tds.overridden }
  } else {
    if (!tdsRule) {
      exceptions.push(warn('STATUTORY_RULE_NOT_CONFIGURED', 'No active TDS rule configured — foundation calculation still applies'))
    }
    if (!statutoryDetail?.pan) {
      exceptions.push(warn('PAN_MISSING', 'Employee PAN is not on file'))
    }
    const result = calculateTds(statutoryDetail)
    lines.push(makeLine('TDS', 'DEDUCTION', result.amount, 'TDS', tdsRule, result.source, result.notes))
    if (result.reviewRequired) {
      exceptions.push(warn('TDS_CALCULATION_REVIEW_REQUIRED', result.notes ?? 'TDS requires manual review'))
    }
    evidence.tds = { applicable: true, overridden: tds.overridden, ruleId: tdsRule?.id ?? null, ...result }
  }

  // ── LWF ─────────────────────────────────────────────────────────────────
  const lwfRule = await getEffectiveStatutoryRule(input.tenantId, 'LWF', ctx, input.payrollDate)
  const lwf = resolveApplicable(statutoryDetail?.lwfApplicable, true)

  if (!lwf.applicable) {
    evidence.lwf = { applicable: false, overridden: lwf.overridden }
  } else if (!lwfRule) {
    exceptions.push(warn('STATUTORY_RULE_NOT_CONFIGURED', 'No active LWF rule configured for this legal entity/state'))
    evidence.lwf = { applicable: true, overridden: lwf.overridden, ruleFound: false }
  } else {
    const result = calculateLwf(lwfRule, input.payrollMonth)
    if (result.due) {
      lines.push(makeLine('LWF_EMPLOYEE', 'DEDUCTION', result.employeeAmount, 'LWF', lwfRule, result.calculationBasis, result.notes))
      lines.push(makeLine('LWF_EMPLOYER', 'EMPLOYER_CONTRIBUTION', result.employerAmount, 'LWF', lwfRule, result.calculationBasis, result.notes))
    }
    evidence.lwf = { applicable: true, overridden: lwf.overridden, ruleId: lwfRule.id, ruleCode: lwfRule.code, ...result }
  }

  return { lines, exceptions, evidence }
}
