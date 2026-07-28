/**
 * Tenant packaging (SERVICES vs MANUFACTURING) — display terminology + helpers.
 * Never branch on tenantSlug; use businessType from /auth/me or modules API.
 */
import { create } from 'zustand'
import { isApiMode } from '../config/apiConfig'
import { apiRequest } from '../services/api/client'
import { fetchAdminModulesApi } from '../services/api/adminApi'
import { useTenantModulesStore } from './tenantModulesStore'

export type TenantBusinessType = 'MANUFACTURING' | 'SERVICES'

/** Mirrors backend `CompanyProfile` (see `auth.service.ts#getCompanyProfile`) — letterhead / print data. */
export interface TenantCompanyProfile {
  legalName: string
  tradeName: string | null
  gstin: string | null
  pan: string | null
  address: string | null
  email: string | null
  phone: string | null
  website: string | null
  bank: {
    accountName: string | null
    bankName: string
    accountNumber: string | null
    ifscCode: string | null
    branch: string | null
  } | null
}

interface TenantProfileState {
  hydrated: boolean
  businessType: TenantBusinessType
  displayTerminology: Record<string, string>
  /** Data-driven letterhead / print profile from the tenant's default Legal Entity (null in demo mode). */
  companyProfile: TenantCompanyProfile | null
  hydrate: () => Promise<void>
  setProfile: (p: {
    businessType?: TenantBusinessType
    displayTerminology?: Record<string, string>
    companyProfile?: TenantCompanyProfile | null
  }) => void
  isServices: () => boolean
  term: (key: string, fallback: string) => string
}

const DEFAULT_SERVICES_TERMS: Record<string, string> = {
  product: 'Service',
  products: 'Services',
  productLine: 'Service Line',
  productDescription: 'Service Description',
  item: 'Service',
  items: 'Services',
  deliveryDate: 'Service Start / Delivery Date',
}

export const useTenantProfileStore = create<TenantProfileState>()((set, get) => ({
  hydrated: !isApiMode(),
  businessType: 'MANUFACTURING',
  displayTerminology: {},
  companyProfile: null,
  setProfile: (p) =>
    set((s) => ({
      businessType: p.businessType ?? s.businessType,
      displayTerminology: p.displayTerminology ?? s.displayTerminology,
      companyProfile: p.companyProfile !== undefined ? p.companyProfile : s.companyProfile,
      hydrated: true,
    })),
  hydrate: async () => {
    if (!isApiMode()) {
      set({ hydrated: true, businessType: 'MANUFACTURING', displayTerminology: {}, companyProfile: null })
      return
    }
    try {
      const me = await apiRequest<{
        tenant?: {
          businessType?: TenantBusinessType
          displayTerminology?: Record<string, string>
          companyProfile?: TenantCompanyProfile | null
        }
      }>('/auth/me')
      const businessType = me.data.tenant?.businessType ?? 'MANUFACTURING'
      const displayTerminology =
        me.data.tenant?.displayTerminology && Object.keys(me.data.tenant.displayTerminology).length > 0
          ? me.data.tenant.displayTerminology
          : businessType === 'SERVICES'
            ? DEFAULT_SERVICES_TERMS
            : {}
      const companyProfile = me.data.tenant?.companyProfile ?? null
      set({ businessType, displayTerminology, companyProfile, hydrated: true })
      try {
        const mods = await fetchAdminModulesApi()
        useTenantModulesStore.getState().setEnabledKeys(mods.data.enabledKeys)
        if (mods.data.businessType === 'SERVICES' || mods.data.businessType === 'MANUFACTURING') {
          set({ businessType: mods.data.businessType })
        }
      } catch {
        /* module.view may be missing — flags stay fail-open */
      }
    } catch {
      set({ hydrated: true })
    }
  },
  isServices: () => get().businessType === 'SERVICES',
  term: (key, fallback) => get().displayTerminology[key] ?? fallback,
}))

/** Path prefixes that require a catalog module key to be enabled. */
export const ROUTE_MODULE_GATES: Array<{ prefix: string; moduleKey: string }> = [
  { prefix: '/purchase', moduleKey: 'purchase' },
  { prefix: '/manufacturing', moduleKey: 'manufacturing' },
  { prefix: '/production', moduleKey: 'manufacturing' },
  { prefix: '/quality', moduleKey: 'quality' },
  { prefix: '/dispatch', moduleKey: 'dispatch' },
  { prefix: '/logistics', moduleKey: 'logistics' },
  { prefix: '/inventory', moduleKey: 'inventory' },
  { prefix: '/gate', moduleKey: 'gate' },
  { prefix: '/sales/invoices', moduleKey: '__hide_crm_tax_invoice_for_services__' },
  { prefix: '/sales/payment-allocation', moduleKey: '__hide_crm_tax_invoice_for_services__' },
]

export function isRouteAllowedByModules(pathname: string): boolean {
  const profile = useTenantProfileStore.getState()
  const modules = useTenantModulesStore.getState()

  for (const gate of ROUTE_MODULE_GATES) {
    if (pathname === gate.prefix || pathname.startsWith(`${gate.prefix}/`)) {
      if (gate.moduleKey === '__hide_crm_tax_invoice_for_services__') {
        if (profile.isServices()) return false
        continue
      }
      if (!modules.isModuleEnabled(gate.moduleKey)) return false
    }
  }
  return true
}
