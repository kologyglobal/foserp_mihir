import type { Location } from '../types/master'

export type LocationUsageFilter = 'sales' | 'purchase' | 'production' | 'all'

export function filterLocationsByUsage(locations: Location[], usage: LocationUsageFilter = 'all'): Location[] {
  return locations.filter((loc) => {
    if (!loc.isActive) return false
    if (usage === 'sales') return loc.allowSales
    if (usage === 'purchase') return loc.allowPurchase
    if (usage === 'production') return loc.allowProduction
    return true
  })
}

export function getDefaultLocation(locations: Location[]): Location | undefined {
  return locations.find((l) => l.isActive && l.isDefault) ?? locations.find((l) => l.isActive)
}

export function resolveLocationWarehouseId(locationId: string, locations: Location[]): string | null {
  return locations.find((l) => l.id === locationId)?.warehouseId ?? null
}

export function locationDisplayLabel(loc: Location): string {
  return `${loc.locationCode} — ${loc.locationName}`
}

/** Resolve fulfilment / ship-to location for print and read-only views (never show raw UUIDs). */
export function resolveSalesOrderDeliveryLocationLabel(
  order: { locationId?: string | null; deliveryLocation?: string | null },
  locations: Location[],
): string | null {
  if (order.locationId) {
    const byStoredId = locations.find((l) => l.id === order.locationId)
    if (byStoredId) return locationDisplayLabel(byStoredId)
  }

  const raw = order.deliveryLocation?.trim()
  if (!raw) return null
  if (raw.includes(' — ')) return raw

  const byId = locations.find((l) => l.id === raw)
  if (byId) return locationDisplayLabel(byId)

  const byCode = locations.find((l) => l.locationCode === raw)
  if (byCode) return locationDisplayLabel(byCode)

  return raw
}

export function formatLocationAddress(loc: Pick<Location, 'address' | 'address2' | 'city' | 'state' | 'postCode' | 'country'>): string {
  const lines = [
    loc.address?.trim(),
    loc.address2?.trim(),
    [loc.city, loc.state, loc.postCode].filter(Boolean).join(', '),
    loc.country?.trim() && loc.country !== 'India' ? loc.country : '',
  ].filter(Boolean)
  return lines.join('\n')
}

export function findLocationForWarehouse(warehouseId: string, locations: Location[]): Location | undefined {
  return locations.find((l) => l.isActive && l.warehouseId === warehouseId)
}

export function resolveInheritedLocationId(
  locations: Location[],
  usage: LocationUsageFilter = 'sales',
  ...candidates: (string | null | undefined)[]
): string {
  const allowed = filterLocationsByUsage(locations, usage)
  for (const id of candidates) {
    if (id && allowed.some((l) => l.id === id)) return id
  }
  return getDefaultLocationId(locations, usage)
}

export function getDefaultLocationId(locations: Location[], usage: LocationUsageFilter = 'all'): string {
  return getDefaultLocation(filterLocationsByUsage(locations, usage))?.id ?? filterLocationsByUsage(locations, usage)[0]?.id ?? ''
}
