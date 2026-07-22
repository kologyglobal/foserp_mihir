import type { ManufacturingRuntimeChangeRule } from '@prisma/client'
import * as repo from './runtime-change.repository.js'
import type { RuntimeChangeContext } from './runtime-change-impact.service.js'
import type { RuntimeChangeRisk } from './runtime-change.enums.js'

export interface RuntimeChangeRiskResult {
  riskLevel: RuntimeChangeRisk
  approvalRequired: boolean
  approvalRuleId: string | null
  ruleSource: 'TENANT_RULE' | 'DEFAULT'
}

function numberFromConfig(config: unknown, key: string, fallback: number): number {
  if (!config || typeof config !== 'object') return fallback
  const value = (config as Record<string, unknown>)[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function fromRule(rule: ManufacturingRuntimeChangeRule): RuntimeChangeRiskResult {
  return {
    riskLevel: rule.riskLevel,
    approvalRequired: rule.approvalRequired,
    approvalRuleId: rule.id,
    ruleSource: 'TENANT_RULE',
  }
}

function defaultResult(riskLevel: RuntimeChangeRisk, approvalRequired: boolean): RuntimeChangeRiskResult {
  return { riskLevel, approvalRequired, approvalRuleId: null, ruleSource: 'DEFAULT' }
}

/**
 * Determines risk level + approval requirement for a runtime change. A tenant-configured
 * `ManufacturingRuntimeChangeRule` (Phase 5A) always wins over the hard-coded defaults below;
 * defaults implement the Phase 5A approval matrix documented in
 * docs/manufacturing/RUNTIME_CHANGE_APPROVAL_MATRIX.md.
 */
export async function determineRuntimeChangeRisk(
  tenantId: string,
  context: RuntimeChangeContext,
): Promise<RuntimeChangeRiskResult> {
  // Tenant rules are opt-in overrides only (see runtime-change-rules.seed.ts for an optional
  // one-time bootstrap helper); we deliberately do NOT auto-seed here so the dynamic
  // percentage/day-threshold defaults below stay live until a tenant explicitly configures a rule.
  const rule = await repo.findActiveRule(tenantId, context.changeType)
  const ruleConfig: unknown = rule?.configJson

  switch (context.changeType) {
    case 'QUANTITY_CHANGE': {
      if (context.overDemand) return defaultResult('HIGH', true)
      if (rule) return fromRule(rule)
      const tolerancePct = numberFromConfig(ruleConfig, 'qtyTolerancePct', 10)
      const overTolerance = (context.qtyChangePct ?? 0) > tolerancePct
      return defaultResult(overTolerance ? 'MEDIUM' : 'LOW', overTolerance)
    }
    case 'DUE_DATE_CHANGE': {
      if (rule) return fromRule(rule)
      const maxDelayDays = numberFromConfig(ruleConfig, 'dueDateDelayDays', 7)
      const overThreshold = (context.delayDays ?? 0) > maxDelayDays
      return defaultResult(overThreshold ? 'MEDIUM' : 'LOW', overThreshold)
    }
    case 'SKIP_OPERATION': {
      if (rule) return fromRule(rule)
      return defaultResult(context.mandatorySkip ? 'HIGH' : 'LOW', context.mandatorySkip)
    }
    case 'CONVERT_TO_JOB_WORK':
      return rule ? fromRule(rule) : defaultResult('HIGH', true)
    case 'MACHINE_CHANGE':
    case 'WORK_CENTRE_CHANGE':
    case 'ADD_OPERATION':
    case 'REPEAT_OPERATION':
      return rule ? fromRule(rule) : defaultResult('MEDIUM', false)
    case 'PRIORITY_CHANGE':
    case 'SUPERVISOR_CHANGE':
    case 'OPERATOR_CHANGE':
    case 'WORK_ORDER_HOLD':
    case 'WORK_ORDER_RESUME':
    case 'STAGE_HOLD':
    case 'STAGE_RESUME':
    default:
      return rule ? fromRule(rule) : defaultResult('LOW', false)
  }
}
