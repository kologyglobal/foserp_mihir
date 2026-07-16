/**
 * Single guarded CRM ecosystem bootstrap.
 * Prevents duplicate hydration from AppShell + crmStore onRehydrateStorage.
 */
import { ensureCrmCustomersInMaster, ensureCrmDataLoaded, ensureSalesLeadsLoaded, runInquiryFoldMigration } from '../../utils/crmHydration'
import { isApiMode } from '../../config/apiConfig'
import { useCrmStore } from '../../store/crmStore'

let bootstrapStarted = false
let bootstrapDone = false

export interface CrmBootstrapResult {
  crm: boolean
  leads: boolean
  customers: number
  skipped: boolean
}

/** Template sync + showcase — showcase is demo-only (never inject into API mode) */
export function syncCrmStoreArtifacts(): void {
  const crm = useCrmStore.getState()
  crm.syncBuiltinQuotationTemplates()
  if (isApiMode()) return
  crm.ensureIsoTankShowcase()
}

/** Idempotent CRM bootstrap — safe from AppShell mount */
export function bootstrapCrmEcosystemOnce(): CrmBootstrapResult {
  syncCrmStoreArtifacts()

  if (bootstrapDone) {
    return { crm: false, leads: false, customers: 0, skipped: true }
  }
  if (bootstrapStarted) {
    return { crm: false, leads: false, customers: 0, skipped: true }
  }
  bootstrapStarted = true

  runInquiryFoldMigration()
  const customers = ensureCrmCustomersInMaster()
  const crmLoaded = ensureCrmDataLoaded()
  const leads = ensureSalesLeadsLoaded()
  runInquiryFoldMigration()

  bootstrapDone = true
  return { crm: crmLoaded, leads, customers, skipped: false }
}

/** Back-compat alias for legacy callers */
export function ensureCrmEcosystemLoaded(): { crm: boolean; leads: boolean; customers: number } {
  const result = bootstrapCrmEcosystemOnce()
  return { crm: result.crm, leads: result.leads, customers: result.customers }
}

/** Reset bootstrap guard — tests only */
export function resetCrmBootstrapGuard(): void {
  bootstrapStarted = false
  bootstrapDone = false
}
