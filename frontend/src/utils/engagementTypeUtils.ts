import type { CrmMasterEntry } from '../types/crmMasters'
import { useCrmMasterStore } from '../store/crmMasterStore'
import { filterActiveMasters } from './crmMasterUtils'

export interface EngagementTypeOption {
  value: string
  label: string
  defaultDuration?: number
  defaultReminder?: number
}

function attrBool(entry: CrmMasterEntry, key: string, fallback: boolean): boolean {
  const value = entry.attributes[key]
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  return fallback
}

/** Manual activity log types (excludes system-generated timeline events). */
export function isManualEngagementActivity(entry: CrmMasterEntry): boolean {
  if ((entry.kind as string) === 'follow-up-types') return false
  if (entry.kind !== 'activity-types') return false
  if (attrBool(entry, 'systemGenerated', false)) return false
  return attrBool(entry, 'useInActivity', true)
}

/** Types available when scheduling a follow-up task. */
export function isEngagementFollowUpType(entry: CrmMasterEntry): boolean {
  if ((entry.kind as string) === 'follow-up-types') return true
  if (entry.kind !== 'activity-types') return false
  return attrBool(entry, 'useInFollowUp', false)
}

function activeEngagementEntries(): CrmMasterEntry[] {
  return filterActiveMasters(useCrmMasterStore.getState().entries, false)
}

export function resolveManualActivityTypeOptions(): EngagementTypeOption[] {
  return activeEngagementEntries()
    .filter(isManualEngagementActivity)
    .map((e) => ({ value: e.code, label: e.name }))
}

export function resolveFollowUpTypeOptions(): EngagementTypeOption[] {
  return activeEngagementEntries()
    .filter(isEngagementFollowUpType)
    .map((e) => ({
      value: e.code,
      label: e.name,
      defaultDuration: typeof e.attributes.defaultDuration === 'number' ? e.attributes.defaultDuration : undefined,
      defaultReminder: typeof e.attributes.defaultReminder === 'number' ? e.attributes.defaultReminder : undefined,
    }))
}

export function engagementTypeLabel(code: string): string {
  const entry = useCrmMasterStore.getState().entries.find((e) => e.code === code)
  return entry?.name ?? code.replace(/_/g, ' ')
}
