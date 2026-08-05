import { isApiMode } from '@/config/apiConfig'
import { listInspectionPlans } from '@/services/api/qualityApi'
import { QUALITY_TEST_GROUP_OPTIONS } from '@/types/taxMaster'

export type QualityTestGroupOption = { code: string; label: string }

function seedOptions(): QualityTestGroupOption[] {
  return QUALITY_TEST_GROUP_OPTIONS.map((o) => ({ code: o.code, label: o.label }))
}

/** Active inspection plans from API; demo/seed fallback when API unavailable. */
export async function loadQualityTestGroupOptions(): Promise<QualityTestGroupOption[]> {
  if (!isApiMode()) return seedOptions()
  try {
    const res = await listInspectionPlans({ limit: 200, status: 'ACTIVE' })
    const plans = res.data ?? []
    if (!plans.length) return seedOptions()
    return plans
      .map((p) => ({
        code: p.planCode,
        label: p.planName?.trim() ? `${p.planCode} — ${p.planName.trim()}` : p.planCode,
      }))
      .sort((a, b) => a.code.localeCompare(b.code))
  } catch {
    return seedOptions()
  }
}
