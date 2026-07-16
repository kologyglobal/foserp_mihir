import type { DynamicInspectionPlan, QcParameterMaster } from '../types/qcParameters'
import { seedQcParameters } from '../data/quality/qcParameterMaster'
import { seedDynamicInspectionPlans } from '../data/quality/dynamicInspectionPlans'
import { useQualityStore } from '../store/qualityStore'

let cachedParameters: QcParameterMaster[] | null = null
let cachedPlans: DynamicInspectionPlan[] | null = null

/** Read QC masters from store when available, else seed fallback */
export function getActiveQcParameters(): QcParameterMaster[] {
  try {
    const fromStore = useQualityStore.getState().qcParameters
    if (fromStore?.length) return fromStore.filter((p) => p.active !== false)
  } catch {
    /* not ready */
  }
  return cachedParameters ?? seedQcParameters
}

export function getActiveInspectionPlans(): DynamicInspectionPlan[] {
  try {
    const fromStore = useQualityStore.getState().dynamicInspectionPlans
    if (fromStore?.length) return fromStore
  } catch {
    /* not ready */
  }
  return cachedPlans ?? seedDynamicInspectionPlans
}

export function setQcMasterCacheForTests(params: QcParameterMaster[], plans: DynamicInspectionPlan[]) {
  cachedParameters = params
  cachedPlans = plans
}

export function clearQcMasterCacheForTests() {
  cachedParameters = null
  cachedPlans = null
}

export function lookupQcParameter(id: string): QcParameterMaster | undefined {
  return getActiveQcParameters().find((p) => p.id === id)
}

export function lookupQcParameterByCode(code: string): QcParameterMaster | undefined {
  return getActiveQcParameters().find((p) => p.parameterCode === code)
}
