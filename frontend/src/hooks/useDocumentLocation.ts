import { useEffect, useMemo, useState } from 'react'
import { useActiveLocations } from './useMasterLists'
import {
  getDefaultLocationId,
  resolveInheritedLocationId,
  resolveLocationWarehouseId,
  type LocationUsageFilter,
} from '../utils/locationUtils'

/** Document header location — defaults and inherits from parent records (Lead → Opp → Quotation → SO). */
export function useDocumentLocation(
  usage: LocationUsageFilter = 'sales',
  ...inheritFrom: (string | null | undefined)[]
) {
  const locations = useActiveLocations()
  const initialId = useMemo(
    () => resolveInheritedLocationId(locations, usage, ...inheritFrom),
    [locations, usage, ...inheritFrom],
  )
  const [locationId, setLocationId] = useState(initialId)

  // Masters often hydrate after mount in API mode; apply default once state is still empty/stale.
  useEffect(() => {
    if (!initialId) return
    setLocationId((prev) => {
      if (!prev) return initialId
      if (locations.length > 0 && !locations.some((l) => l.id === prev && l.isActive)) return initialId
      return prev
    })
  }, [initialId, locations])

  const warehouseId = useMemo(
    () => resolveLocationWarehouseId(locationId, locations) ?? '',
    [locationId, locations],
  )

  return {
    locationId,
    setLocationId,
    warehouseId,
    defaultLocationId: getDefaultLocationId(locations, usage),
    locations,
  }
}
