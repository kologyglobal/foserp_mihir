import { useCallback, useMemo, useState } from 'react'
import type { FilterChip } from '../components/design-system/SmartFilterBar'
import type { CrmFilterField, CrmFilterValues } from '../types/crmListFilters'
import {
  buildCrmFilterChips,
  clearCrmFilterChip,
  countActiveCrmFilters,
  resetCrmFilterValues,
} from '../utils/crmFilterUtils'

export interface UseCrmFilterDrawerOptions<T extends CrmFilterValues> {
  values: T
  onChange: (next: T) => void
  fields: CrmFilterField[]
  defaults: T
  excludeFromCount?: string[]
  chipLabelResolver?: (key: string, value: string) => string | undefined
}

export function useCrmFilterDrawer<T extends CrmFilterValues>({
  values,
  onChange,
  fields,
  defaults,
  excludeFromCount = ['search', 'sortBy', 'sort'],
  chipLabelResolver,
}: UseCrmFilterDrawerOptions<T>) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<T>(values)

  const activeCount = useMemo(
    () => countActiveCrmFilters(values, excludeFromCount),
    [values, excludeFromCount],
  )

  const chips = useMemo(
    () => buildCrmFilterChips(values, fields, chipLabelResolver),
    [values, fields, chipLabelResolver],
  )

  const openDrawer = useCallback(() => {
    setDraft({ ...values })
    setOpen(true)
  }, [values])

  const closeDrawer = useCallback(() => setOpen(false), [])

  const applyFilters = useCallback(() => {
    onChange(draft)
    setOpen(false)
  }, [draft, onChange])

  const resetDraft = useCallback(() => {
    setDraft(resetCrmFilterValues(defaults, fields) as T)
  }, [defaults, fields])

  const clearAll = useCallback(() => {
    const next = { ...defaults } as T
    onChange(next)
    // Keep drawer dropdowns in sync when chips / Clear all change applied filters
    setDraft(next)
  }, [defaults, onChange])

  const removeChip = useCallback(
    (chipId: string) => {
      const next = clearCrmFilterChip(values, chipId, fields) as T
      onChange(next)
      // Chip removal updates applied values; draft must match or Filters dropdowns stay stale
      setDraft(next)
    },
    [values, fields, onChange],
  )

  const patchDraft = useCallback((patch: Partial<T>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }, [])

  return {
    open,
    openDrawer,
    closeDrawer,
    draft,
    setDraft,
    patchDraft,
    applyFilters,
    resetDraft,
    activeCount,
    chips: chips as FilterChip[],
    clearAll,
    removeChip,
  }
}
