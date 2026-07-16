import { LocationSelect } from './LocationSelect'
import { FormField } from '../forms/FormField'
import { useMasterStore } from '../../store/masterStore'
import { resolveLocationWarehouseId, type LocationUsageFilter } from '../../utils/locationUtils'

type LocationEntryFieldProps = {
  value: string
  onChange: (locationId: string, warehouseId: string) => void
  usage?: LocationUsageFilter
  label?: string
  required?: boolean
  error?: string
  compact?: boolean
  disabled?: boolean
  hint?: string
  className?: string
}

/** Standard location picker for business entry forms — resolves warehouse for posting. */
export function LocationEntryField({
  value,
  onChange,
  usage = 'all',
  label = 'Location Code',
  required,
  error,
  compact,
  disabled,
  hint,
  className,
}: LocationEntryFieldProps) {
  const locations = useMasterStore((s) => s.locations)

  return (
    <FormField label={label} required={required} error={error} hint={hint} className={className}>
      <LocationSelect
        compact={compact}
        usage={usage}
        value={value}
        disabled={disabled}
        placeholder="Search location code…"
        onChange={(locationId) => {
          const warehouseId = resolveLocationWarehouseId(locationId, locations) ?? ''
          onChange(locationId, warehouseId)
        }}
      />
    </FormField>
  )
}
