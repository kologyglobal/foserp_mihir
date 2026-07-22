/**
 * Tax compliance dual-mode helpers — resolve LE + period dates for API extracts.
 */
import { listLegalEntities } from '@/services/bridges/financeApiBridge'
import type { LegalEntity } from '@/types/financeSetup'
import type { PeriodFilterState, TaxCompliancePeriod } from '@/types/taxCompliance'

export function periodKeyToDateRange(periodKey: string): { fromDate: string; toDate: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey)
  if (!match) {
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = String(now.getUTCMonth() + 1).padStart(2, '0')
    const last = new Date(Date.UTC(y, now.getUTCMonth() + 1, 0)).getUTCDate()
    return { fromDate: `${y}-${m}-01`, toDate: `${y}-${m}-${String(last).padStart(2, '0')}` }
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const mm = String(month).padStart(2, '0')
  return {
    fromDate: `${year}-${mm}-01`,
    toDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  }
}

/** Compute the period descriptor from the key — no seed lookup (8C Wave 1: API composer stays seed-free). */
export function resolvePeriod(periodKey: string): TaxCompliancePeriod {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey)
  if (!match) {
    const now = new Date()
    return resolvePeriod(`${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-IN', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const fyStart = month >= 4 ? year : year - 1
  return {
    periodKey,
    label,
    fyLabel: `FY ${fyStart}-${String(fyStart + 1).slice(-2)}`,
    month,
    year,
  }
}

export async function resolveDefaultLegalEntity(): Promise<LegalEntity> {
  const entities = await listLegalEntities()
  const active = entities.filter((e) => e.isActive)
  const preferred = active.find((e) => e.isDefault) ?? active[0] ?? entities[0]
  if (!preferred) {
    throw new Error('No legal entity available for GST extract. Configure Finance › Legal Entities first.')
  }
  return preferred
}

export function filterDatesFromPeriod(filter: PeriodFilterState) {
  return periodKeyToDateRange(filter.periodKey)
}
