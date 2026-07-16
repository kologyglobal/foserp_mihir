import type { QcInspectionCategory } from '../types/quality'
import type { QcParameterResult } from '../types/qcParameters'
import {
  buildEmptyParameterResults,
  buildParameterSnapshot,
  resolveDynamicInspectionPlan,
} from './qcPlanResolver'

export function loadDynamicQcParameters(input: {
  category: QcInspectionCategory
  productId?: string | null
  itemId?: string | null
  itemCategoryId?: string | null
  operationName?: string | null
  workCenterId?: string | null
}) {
  const plan = resolveDynamicInspectionPlan(input)
  if (!plan) {
    return { plan: null, parameterSnapshot: [], parameterResults: [] as QcParameterResult[] }
  }
  const parameterSnapshot = buildParameterSnapshot(plan)
  const parameterResults = buildEmptyParameterResults(parameterSnapshot)
  return { plan, parameterSnapshot, parameterResults }
}

export function stampParameterResults(
  results: QcParameterResult[],
  inspector: string,
): QcParameterResult[] {
  const now = new Date().toISOString()
  return results.map((r) => ({ ...r, inspector, recordedAt: now }))
}
