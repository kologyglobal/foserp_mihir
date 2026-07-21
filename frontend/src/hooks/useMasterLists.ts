import { useMemo } from 'react'
import { useMasterStore } from '../store/masterStore'
import { useCrmMasterStore } from '../store/crmMasterStore'
import { useWorkCenterStore } from '../store/workCenterStore'
import { enrichItemWithDefaults } from '../utils/itemMasterDefaults'
import { listCommercialTermsFromCrm } from '../utils/commercialTermsAdapter'

/** Items with engineering/tax defaults applied — never .map() inside a Zustand selector. */
export function useEnrichedItems() {
  const items = useMasterStore((s) => s.items)
  return useMemo(() => items.map(enrichItemWithDefaults), [items])
}

/** Active purchasable items for PR / PO forms. */
export function usePurchasableItems() {
  const items = useMasterStore((s) => s.items)
  return useMemo(() => items.filter((i) => i.isActive && i.isPurchasable), [items])
}

/** Stable stockable item list — never use .filter() directly in a Zustand selector. */
export function useStockableItems() {
  const items = useMasterStore((s) => s.items)
  return useMemo(() => items.filter((i) => i.isStockable && i.isActive), [items])
}

/** Stable active warehouse list. */
export function useActiveWarehouses() {
  const warehouses = useMasterStore((s) => s.warehouses)
  return useMemo(() => warehouses.filter((w) => w.isActive), [warehouses])
}

/** Stable active location list (BC-style inventory locations). */
export function useActiveLocations() {
  const locations = useMasterStore((s) => s.locations)
  return useMemo(() => locations.filter((l) => l.isActive), [locations])
}

/** Leaf categories (no children). */
export function useLeafCategories() {
  const categories = useMasterStore((s) => s.categories)
  return useMemo(
    () => categories.filter((c) => !categories.some((child) => child.parentId === c.id)),
    [categories],
  )
}

/** Finished-good items for product linking. */
export function useFgItems() {
  const items = useMasterStore((s) => s.items)
  return useMemo(() => items.filter((i) => i.itemType === 'finished_good'), [items])
}

/** Active customers for sales forms. */
export function useActiveCustomers() {
  const customers = useMasterStore((s) => s.customers)
  return useMemo(() => customers.filter((c) => c.isActive), [customers])
}

/** Active products for master forms. */
export function useActiveProducts() {
  const products = useMasterStore((s) => s.products)
  return useMemo(() => products.filter((p) => p.isActive), [products])
}

/** Released + active products only — for CRM / quotation / sales order pickers. */
export function useSellableProducts() {
  const products = useMasterStore((s) => s.products)
  return useMemo(
    () => products.filter((p) => p.isActive && p.status === 'released'),
    [products],
  )
}

/** Active vendors for purchase forms. */
export function useActiveVendors() {
  const vendors = useMasterStore((s) => s.vendors)
  return useMemo(() => vendors.filter((v) => v.isActive), [vendors])
}

/** Active banks for bank account forms. */
export function useActiveBanks() {
  const banks = useMasterStore((s) => s.banks)
  return useMemo(() => banks.filter((b) => b.isActive), [banks])
}

/** Active bank accounts for payment / treasury forms. */
export function useActiveBankAccounts() {
  const bankAccounts = useMasterStore((s) => s.bankAccounts)
  return useMemo(() => bankAccounts.filter((a) => a.isActive), [bankAccounts])
}

/** Active UOMs for master forms. */
export function useActiveUoms() {
  const uoms = useMasterStore((s) => s.uoms)
  return useMemo(() => uoms.filter((u) => u.isActive), [uoms])
}

/** Active work centers for routing / production forms. */
export function useActiveWorkCenters() {
  const workCenters = useWorkCenterStore((s) => s.workCenters)
  return useMemo(() => workCenters.filter((w) => w.isActive), [workCenters])
}

/** Active countries from geography master. */
export function useActiveCountries() {
  const geoCountries = useMasterStore((s) => s.geoCountries)
  return useMemo(
    () =>
      [...geoCountries]
        .filter((c) => c.isActive)
        .sort((a, b) => a.countryName.localeCompare(b.countryName)),
    [geoCountries],
  )
}

/** Active geography states from master. */
export function useActiveStates() {
  const geoStates = useMasterStore((s) => s.geoStates)
  return useMemo(
    () => [...geoStates].filter((s) => s.isActive).sort((a, b) => a.stateName.localeCompare(b.stateName)),
    [geoStates],
  )
}

/** Cities for a selected state name. */
export function useCitiesForState(stateName: string) {
  const geoStates = useMasterStore((s) => s.geoStates)
  const geoCities = useMasterStore((s) => s.geoCities)
  return useMemo(() => {
    if (!stateName) return []
    const st = geoStates.find((s) => s.stateName === stateName)
    if (!st) return []
    return geoCities
      .filter((c) => c.stateId === st.id && c.isActive)
      .sort((a, b) => a.cityName.localeCompare(b.cityName))
  }, [geoStates, geoCities, stateName])
}

/** All active cities (for list filters). */
export function useAllMasterCities() {
  const geoCities = useMasterStore((s) => s.geoCities)
  return useMemo(
    () => [...geoCities].filter((c) => c.isActive).sort((a, b) => a.cityName.localeCompare(b.cityName)),
    [geoCities],
  )
}

/** Active commercial terms by type — CRM payment/delivery masters (tax → empty; use GST). */
export function useCommercialTerms(termType: 'payment' | 'delivery' | 'tax') {
  const entries = useCrmMasterStore((s) => s.entries)
  return useMemo(
    () => listCommercialTermsFromCrm(termType, true),
    [entries, termType],
  )
}

/** Active transporters for dispatch forms. */
export function useActiveTransporters() {
  const transporters = useMasterStore((s) => s.transporters)
  return useMemo(
    () => transporters.filter((t) => t.isActive).sort((a, b) => a.transporterName.localeCompare(b.transporterName)),
    [transporters],
  )
}
