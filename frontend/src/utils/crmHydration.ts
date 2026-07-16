/**
 * Auto-hydrate CRM ecosystem when persisted stores are empty.
 * Ensures connected sample data without requiring manual demo reset.
 */
import { CRM_EXTENSION_CUSTOMERS } from '../data/crm/crmSampleSeed'
import { buildDemoSalesPipeline } from '../data/demo/salesPipelineSeed'
import { useCrmStore } from '../store/crmStore'
import { useMasterStore } from '../store/masterStore'
import { useSalesStore } from '../store/salesStore'
import { migrateInquiriesToOpportunities } from './inquiryOpportunityMigration'

let leadsHydrationDone = false
let crmDataHydrationDone = false
let inquiryFoldDone = false

/** Full CRM sample bundle threshold — partial inquiry-fold opps must not block loadSampleData */
const CRM_SAMPLE_READY_OPP_COUNT = 40

export function runInquiryFoldMigration(): boolean {
  if (inquiryFoldDone) return false
  const sales = useSalesStore.getState()
  const crm = useCrmStore.getState()
  const needsFold = sales.inquiries.length > 0 || sales.quotations.some((q) => !q.opportunityId && q.inquiryId)
  if (!needsFold) {
    inquiryFoldDone = true
    return false
  }
  const masters = useMasterStore.getState()
  const { opportunities, quotations } = migrateInquiriesToOpportunities(
    sales.inquiries,
    crm.opportunities,
    sales.quotations,
    (id) => masters.products.find((p) => p.id === id),
    (leadId) => {
      const lead = sales.getLead(leadId)
      return lead ? { ownerId: lead.leadOwnerId, ownerName: lead.leadOwnerName } : undefined
    },
  )
  useCrmStore.setState({ opportunities })
  useSalesStore.setState({ inquiries: [], quotations })
  inquiryFoldDone = true
  return true
}

export function ensureCrmCustomersInMaster(): number {
  const master = useMasterStore.getState()
  const existing = new Set(master.customers.map((c) => c.id))
  const toAdd = CRM_EXTENSION_CUSTOMERS.filter((c) => !existing.has(c.id))
  if (toAdd.length) {
    useMasterStore.setState({ customers: [...master.customers, ...toAdd] })
  }
  return toAdd.length
}

export function ensureSalesLeadsLoaded(): boolean {
  if (leadsHydrationDone) return false
  const sales = useSalesStore.getState()
  if (sales.leads.length >= 30) {
    leadsHydrationDone = true
    return false
  }
  const pipeline = buildDemoSalesPipeline()
  useSalesStore.setState({
    leads: pipeline.leads,
    inquiries: [],
    quotations: sales.quotations.length < 5 ? pipeline.quotations : sales.quotations,
  })
  leadsHydrationDone = true
  return true
}

export function ensureCrmDataLoaded(): boolean {
  const crm = useCrmStore.getState()
  crm.syncBuiltinQuotationTemplates()
  crm.ensureIsoTankShowcase()
  if (crmDataHydrationDone) return false
  if (crm.opportunities.length >= CRM_SAMPLE_READY_OPP_COUNT) {
    crmDataHydrationDone = true
    return false
  }
  ensureCrmCustomersInMaster()
  const customerIds = useMasterStore.getState().customers.map((c) => c.id)
  if (!customerIds.length) return false
  crm.loadSampleData(customerIds)
  crmDataHydrationDone = true
  return true
}

/** Load CRM + sales pipeline when stores are empty. Safe to call on app mount. */
export function ensureCrmEcosystemLoaded(): { crm: boolean; leads: boolean; customers: number; inquiryFold: boolean } {
  const inquiryFold = runInquiryFoldMigration()
  const customers = ensureCrmCustomersInMaster()
  const crm = ensureCrmDataLoaded()
  const leads = ensureSalesLeadsLoaded()
  runInquiryFoldMigration()
  return { crm, leads, customers, inquiryFold }
}

/** Reset hydration guard — for tests only */
export function resetCrmHydrationGuard(): void {
  leadsHydrationDone = false
  crmDataHydrationDone = false
  inquiryFoldDone = false
}
