import { isApiMode } from '@/config/apiConfig'
import { listInspectionPlans } from '@/services/api/qualityApi'
import { QUALITY_TEST_GROUP_OPTIONS } from '@/types/taxMaster'

export type QualityTestGroupOption = { code: string; label: string }

function seedOptions(): QualityTestGroupOption[] {
  return QUALITY_TEST_GROUP_OPTIONS.map((o) => ({ code: o.code, label: o.label }))
}

/**
 * Single source of truth for "Quality Test Group" selection across Item Master and
 * Purchase Order: active INCOMING Inspection Plans. Demo mode / API errors fall back
 * to the legacy static seed list so the form never breaks.
 */
export async function loadQualityTestGroupOptions(): Promise<QualityTestGroupOption[]> {
  if (!isApiMode()) return seedOptions()
  try {
    const res = await listInspectionPlans({ limit: 200, status: 'ACTIVE', category: 'INCOMING' })
    const plans = res.data ?? []
    if (!plans.length) return seedOptions()
    return plans
      .map((p) => ({
        code: p.planCode,
        label: p.planCode,
      }))
      .sort((a, b) => a.code.localeCompare(b.code))
  } catch {
    return seedOptions()
  }
}
