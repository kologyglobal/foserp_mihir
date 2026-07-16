import { syncAllCrmFromApi } from '../services/bridges/crmApiBridge'
import { syncCoreMastersFromApi } from '../services/bridges/masterApiBridge'
import { syncBatchMastersFromApi } from '../services/bridges/masterBatchApiBridge'
import { syncAdminFromApi } from '../services/bridges/adminApiBridge'

/** Hydrate CRM Zustand slices from the backend (API mode only). */
export async function hydrateCrmFromApi(): Promise<void> {
  await syncAllCrmFromApi()
}

/** Hydrate core master geography/UOM/warehouse slices (API mode only). */
export async function hydrateCoreMastersFromApi(): Promise<void> {
  await syncCoreMastersFromApi()
}

/** Hydrate batch masters: categories, HSN, GST, items, vendors (API mode only). */
export async function hydrateBatchMastersFromApi(): Promise<void> {
  await syncBatchMastersFromApi()
}

/** Hydrate user/role/tenant administration slices (API mode only; permission-safe no-ops for non-admins). */
export async function hydrateAdminFromApi(): Promise<void> {
  await syncAdminFromApi()
}

/** Full API hydration used by AppShell on login. */
export async function hydrateAllFromApi(): Promise<void> {
  await Promise.all([hydrateCrmFromApi(), hydrateCoreMastersFromApi(), hydrateAdminFromApi()])
  await hydrateBatchMastersFromApi()
}

export { syncAllCrmFromApi, syncCoreMastersFromApi, syncBatchMastersFromApi, syncAdminFromApi }
