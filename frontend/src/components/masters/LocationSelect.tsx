import { useMemo } from 'react'
import { ErpSmartSelect, type ErpSmartSelectOption } from '../erp/ErpSmartSelect'
import { useActiveLocations } from '../../hooks/useMasterLists'
import { filterLocationsByUsage, locationDisplayLabel, type LocationUsageFilter } from '../../utils/locationUtils'
import { useMasterStore } from '../../store/masterStore'

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
  const getWarehouseName = useMasterStore((s) => s.getWarehouseName)

  const options: ErpSmartSelectOption<string>[] = useMemo(
    () =>
      filterLocationsByUsage(locations, usage).map((loc) => ({
        value: loc.id,
        label: locationDisplayLabel(loc),
        searchText: `${loc.locationCode} ${loc.locationName} ${loc.city}`.toLowerCase(),
        meta: loc.warehouseId ? (
          <span className="text-xs text-[#605e5c]">{getWarehouseName(loc.warehouseId)}</span>
        ) : loc.useAsInTransit ? (
          <span className="text-xs text-[#605e5c]">In-Transit</span>
        ) : undefined,
      })),
    [locations, usage, getWarehouseName],
  )

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
    />
  )
}
