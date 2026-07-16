import { ErpFieldRow } from '../erp/card-form'
import { LocationSelect } from './LocationSelect'
import { useMasterStore } from '../../store/masterStore'
import { resolveLocationWarehouseId, type LocationUsageFilter } from '../../utils/locationUtils'

type LocationFieldRowProps = {
  value: string
  onChange: (locationId: string, warehouseId: string) => void
  usage?: LocationUsageFilter
  label?: string
  required?: boolean
  readOnly?: boolean
  colSpan?: 1 | 2
  hint?: string
}

/** Standard Location Code row for enterprise card forms (Lead → Opportunity → Quotation → SO). */
export function LocationFieldRow({
  value,
  onChange,
  usage = 'sales',
  label = 'Location Code',
  required,
  readOnly,
  colSpan,
  hint = 'Inventory location for fulfilment and stock posting',
}: LocationFieldRowProps) {
  const locations = useMasterStore((s) => s.locations)
  const getLocationName = useMasterStore((s) => s.getLocationName)

  return (
    <ErpFieldRow label={label} required={required} readOnly={readOnly} colSpan={colSpan} hint={hint}>
      {readOnly ? (
        <span className="text-sm text-erp-text">{value ? getLocationName(value) : '—'}</span>
      ) : (
        <LocationSelect
          compact
          usage={usage}
          value={value}
          placeholder="Search location code…"
          onChange={(locationId) => {
            onChange(locationId, resolveLocationWarehouseId(locationId, locations) ?? '')
          }}
        />
      )}
    </ErpFieldRow>
  )
}
