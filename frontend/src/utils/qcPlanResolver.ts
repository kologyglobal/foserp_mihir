import type { QcInspectionCategory } from '../types/quality'
import type { DynamicInspectionPlan, QcParameterSnapshot } from '../types/qcParameters'
import { getActiveInspectionPlans, lookupQcParameter } from './qcMasterAccess'

export interface PlanResolveInput {
  category: QcInspectionCategory
  productId?: string | null
  itemId?: string | null
  itemCategoryId?: string | null
  operationName?: string | null
  workCenterId?: string | null
  asOfDate?: string
}

function isActivePlan(plan: DynamicInspectionPlan, asOf: string): boolean {
  if (plan.status !== 'active' || plan.effectiveFrom > asOf) return false
  if (plan.effectiveTo && plan.effectiveTo < asOf) return false
  return true
}

function planSpecificityScore(plan: DynamicInspectionPlan, input: PlanResolveInput): number {
  if (plan.category !== input.category) return -1
  let score = 0
  if (plan.productId) {
    if (plan.productId !== input.productId) return -1
    score += 100
  }
  if (plan.operationName) {
    if (plan.operationName !== input.operationName) return -1
    score += 50
  }
  if (plan.workCenterId) {
    if (plan.workCenterId !== input.workCenterId) return -1
    score += 25
  }
  if (plan.itemId) {
    if (plan.itemId !== input.itemId) return -1
    score += 80
  }
  if (plan.itemCategoryId) {
    if (plan.itemCategoryId !== input.itemCategoryId) return -1
    score += 40
  }
  const isDefault =
    !plan.productId && !plan.itemId && !plan.itemCategoryId && !plan.operationName && !plan.workCenterId
  if (isDefault) score = 1
  return score
}

/**
 * Matching priority:
 * 1. Product + Operation + Work Center
 * 2. Product + Operation
 * 3. Item + QC Stage
 * 4. Category + QC Stage
 * 5. Default QC Stage Plan
 */
export function resolveDynamicInspectionPlan(input: PlanResolveInput): DynamicInspectionPlan | undefined {
  const asOf = input.asOfDate ?? new Date().toISOString().slice(0, 10)
  const plans = getActiveInspectionPlans()
  const candidates = plans
    .filter((p) => isActivePlan(p, asOf))
    .map((p) => ({ plan: p, score: planSpecificityScore(p, input) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)
  return candidates[0]?.plan
}

export function buildParameterSnapshot(plan: DynamicInspectionPlan): QcParameterSnapshot[] {
  return [...plan.lines]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .flatMap((line) => {
      const param = lookupQcParameter(line.parameterId)
      if (!param || param.active === false) return []
      return [
        {
          parameterId: param.id,
          parameterCode: param.parameterCode,
          parameterName: param.parameterName,
          parameterType: param.parameterType,
          uomCode: param.uomCode,
          minValue: line.minValueOverride ?? param.minValue,
          maxValue: line.maxValueOverride ?? param.maxValue,
          targetValue: line.targetValueOverride ?? param.targetValue,
          mandatory: line.mandatoryOverride ?? param.mandatory,
          severity: line.severityOverride ?? param.severity,
          passFailRule: param.passFailRule,
          dropdownOptions: param.dropdownOptions,
          sortOrder: line.sortOrder,
        },
      ]
    })
}

export function buildEmptyParameterResults(snapshot: QcParameterSnapshot[]): import('../types/qcParameters').QcParameterResult[] {
  return snapshot.map((s) => ({
    parameterId: s.parameterId,
    parameterCode: s.parameterCode,
    parameterName: s.parameterName,
    parameterType: s.parameterType,
    mandatory: s.mandatory,
    severity: s.severity,
    passFailRule: s.passFailRule,
    uomCode: s.uomCode,
    minValue: s.minValue,
    maxValue: s.maxValue,
    targetValue: s.targetValue,
    dropdownOptions: s.dropdownOptions,
    actualValue: null,
    passed: null,
    remarks: '',
    attachmentRef: null,
    inspector: null,
    recordedAt: null,
  }))
}

export function getAllDynamicInspectionPlans(): DynamicInspectionPlan[] {
  return getActiveInspectionPlans()
}

export function getDynamicInspectionPlan(id: string): DynamicInspectionPlan | undefined {
  return getActiveInspectionPlans().find((p) => p.id === id)
}
