import type { LeadSource } from '../types/sales'

/** Canonical lead sources used by the app — always available even if CRM master is incomplete. */
export const CANONICAL_LEAD_SOURCES: ReadonlyArray<{ value: LeadSource; label: string }> = [
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'cold_call', label: 'Cold Calling' },
  { value: 'trade_show', label: 'Trade Show' },
  { value: 'existing_customer', label: 'Existing Customer' },
  { value: 'indiamart', label: 'IndiaMART' },
  { value: 'justdial', label: 'Justdial' },
  { value: 'field_visit', label: 'Field Visit' },
  { value: 'other_channel', label: 'Other Channel' },
  { value: 'other', label: 'Other' },
]

export function leadSourceLabel(code: string | null | undefined): string {
  if (!code) return ''
  const known = CANONICAL_LEAD_SOURCES.find((s) => s.value === code)
  if (known) return known.label
  return code
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Merge CRM master lead-sources with canonical codes.
 * Master labels win when the code exists; missing codes (e.g. existing_customer) are filled in
 * so the select never shows a blank "Select source…" for a set value.
 */
export function buildLeadSourceSelectOptions(
  masterOptions: ReadonlyArray<{ value: string; label: string }>,
  currentSource?: string | null,
): Array<{ value: LeadSource; label: string; searchText: string }> {
  const byCode = new Map<string, { value: LeadSource; label: string; searchText: string }>()

  for (const s of CANONICAL_LEAD_SOURCES) {
    byCode.set(s.value, {
      value: s.value,
      label: s.label,
      searchText: s.label.toLowerCase(),
    })
  }

  for (const m of masterOptions) {
    if (!m.value) continue
    byCode.set(m.value, {
      value: m.value as LeadSource,
      label: m.label || leadSourceLabel(m.value),
      searchText: (m.label || m.value).toLowerCase(),
    })
  }

  if (currentSource && !byCode.has(currentSource)) {
    const label = leadSourceLabel(currentSource)
    byCode.set(currentSource, {
      value: currentSource as LeadSource,
      label,
      searchText: label.toLowerCase(),
    })
  }

  const preferredOrder = CANONICAL_LEAD_SOURCES.map((s) => s.value)
  const ordered: Array<{ value: LeadSource; label: string; searchText: string }> = []
  const seen = new Set<string>()

  for (const code of preferredOrder) {
    const row = byCode.get(code)
    if (row) {
      ordered.push(row)
      seen.add(code)
    }
  }
  for (const [code, row] of byCode) {
    if (!seen.has(code)) ordered.push(row)
  }
  return ordered
}
