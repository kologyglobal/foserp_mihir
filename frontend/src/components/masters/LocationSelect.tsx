import { useMemo } from 'react'
import { ErpSmartSelect, type ErpSmartSelectOption } from '../erp/ErpSmartSelect'
import { useActiveLocations } from '../../hooks/useMasterLists'
import { filterLocationsByUsage, locationDisplayLabel, type LocationUsageFilter } from '../../utils/locationUtils'
import { useMasterStore } from '../../store/masterStore'
import type { Location } from '../../types/master'

type LocationSelectProps = {
  value: string
  onChange: (locationId: string) => void
  usage?: LocationUsageFilter
  compact?: boolean
  disabled?: boolean
  allowEmpty?: boolean
  placeholder?: string
  className?: string
}

function toOption(
  loc: Location,
  getWarehouseName: (id: string) => string,
  metaSuffix?: string,
): ErpSmartSelectOption<string> {
  return {
    value: loc.id,
    label: locationDisplayLabel(loc),
    searchText: `${loc.locationCode} ${loc.locationName} ${loc.city}`.toLowerCase(),
    meta: metaSuffix ? (
      <span className="text-xs text-[#605e5c]">{metaSuffix}</span>
    ) : loc.warehouseId ? (
      <span className="text-xs text-[#605e5c]">{getWarehouseName(loc.warehouseId)}</span>
    ) : loc.useAsInTransit ? (
      <span className="text-xs text-[#605e5c]">In-Transit</span>
    ) : undefined,
  }
}

export function LocationSelect({
  value,
  onChange,
  usage = 'all',
  compact,
  disabled,
  allowEmpty,
  placeholder = 'Select location…',
  className,
}: LocationSelectProps) {
  const locations = useActiveLocations()
  const allLocations = useMasterStore((s) => s.locations)
  const getWarehouseName = useMasterStore((s) => s.getWarehouseName)
  const getLocationName = useMasterStore((s) => s.getLocationName)

  const options: ErpSmartSelectOption<string>[] = useMemo(() => {
    const filtered = filterLocationsByUsage(locations, usage)
    const opts = filtered.map((loc) => toOption(loc, getWarehouseName))
    if (value && !opts.some((o) => o.value === value)) {
      const current = allLocations.find((l) => l.id === value)
      if (current) {
        const note = !current.isActive
          ? 'Inactive'
          : usage !== 'all'
            ? 'Current (restricted)'
            : undefined
        opts.unshift(toOption(current, getWarehouseName, note))
      }
    }
    return opts
  }, [locations, allLocations, usage, getWarehouseName, value])

  return (
    <ErpSmartSelect
      compact={compact}
      className={className}
      options={options}
      value={value}
      onChange={(v) => onChange(v || '')}
      disabled={disabled}
      allowEmpty={allowEmpty}
      placeholder={placeholder}
      resolveOrphanLabel={(id) => {
        const name = getLocationName(id)
        return name !== '—' ? name : undefined
      }}
    />
  )
}
