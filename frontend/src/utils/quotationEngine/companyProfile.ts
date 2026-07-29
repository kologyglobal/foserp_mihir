import { useTenantProfileStore, type TenantBusinessType, type TenantCompanyProfile } from '../../store/tenantProfileStore'

export interface CompanyBankDetails {
  accountName: string
  bankName: string
  accountNumber: string
  ifscCode: string
  branch: string
}

/** Company master defaults for quotation/print/merge / letterhead. */
export interface CompanyProfile {
  legalName: string
  brandName: string
  tagline?: string
  address: string
  registeredOffice?: string
  phone: string
  email: string
  website?: string
  gstin: string
  authorizedPerson: string
  designation: string
  /** Structured bank details rendered via `CompanyBankDetailsBlock` (Kology / SERVICES). */
  bankDetails: CompanyBankDetails | null
  /** Legacy free-text remittance line (Manufacturing / Vasant demo — no real bank on file). */
  bankDetailsText?: string
  /** Public path used on letterhead / PDF print. */
  logoUrl: string
}

/** Manufacturing (Vasant Fabricators) letterhead — unchanged from the original demo profile. */
export const VASANT_COMPANY_PROFILE: CompanyProfile = {
  legalName: 'VASANT FABRICATORS PVT. LTD.',
  brandName: 'Vasant Fabricators',
  tagline: 'ISO Tank Containers · Special Purpose Vehicles',
  address: 'Works: Chhapi, Banaskantha, North Gujarat, India',
  registeredOffice: 'Registered Office: Vadodara, Gujarat, India',
  phone: '+91-XXXXXXXXXX',
  email: 'sales@vasantfabricators.com',
  website: 'www.vasantfabricators.com',
  gstin: '24XXXXXXXXXXZ',
  authorizedPerson: 'Authorized Signatory',
  designation: 'Sales & Marketing',
  bankDetails: null,
  bankDetailsText: 'Account: Vasant Fabricators Pvt. Ltd. | Bank: — | IFSC: —',
  logoUrl: '/brand/vasant-fabricators-logo.png',
}

/**
 * Kology (SERVICES) letterhead fallback — used in demo mode (`VITE_USE_API=false`) or until the
 * tenant's legal entity profile hydrates from the API. Prefer live `/auth/me` company profile
 * (`useTenantProfileStore.companyProfile`, sourced from the tenant's default Legal Entity) over
 * this static fallback whenever it is available.
 */
export const KOLOGY_COMPANY_PROFILE: CompanyProfile = {
  legalName: 'Kology Global Groupe Pvt. Ltd.',
  brandName: 'Kology',
  address: 'Sharan Circle Business Hub, 312, 313, 314\nChandkheda - Zundal Rd, Zundal\nAhmedabad Gujarat 382424\nIndia',
  phone: '+91 9876500000',
  email: 'office@kology.co',
  website: 'www.kology.co',
  gstin: '24AAACK1234A1Z5',
  authorizedPerson: 'Authorized Signatory',
  designation: 'Management',
  bankDetails: {
    accountName: 'Kology Global Groupe Pvt. Ltd.',
    bankName: 'IDFC FIRST Bank',
    accountNumber: '51423051116',
    ifscCode: 'IDFB0040308',
    branch: 'CHANDKHEDA',
  },
  logoUrl: '/brand/kology-logo.webp',
}

/** Default static (demo) profile per business type — never keyed by tenant slug. */
function defaultProfileFor(businessType: TenantBusinessType): CompanyProfile {
  return businessType === 'SERVICES' ? KOLOGY_COMPANY_PROFILE : VASANT_COMPANY_PROFILE
}

function mapApiProfile(api: TenantCompanyProfile, fallback: CompanyProfile): CompanyProfile {
  return {
    ...fallback,
    legalName: api.legalName || fallback.legalName,
    brandName: api.tradeName || fallback.brandName,
    tagline: undefined,
    address: api.address || fallback.address,
    registeredOffice: undefined,
    phone: api.phone || fallback.phone,
    email: api.email || fallback.email,
    website: api.website || fallback.website,
    gstin: api.gstin || fallback.gstin,
    logoUrl: fallback.logoUrl,
    bankDetails: api.bank
      ? {
          accountName: api.bank.accountName || api.legalName,
          bankName: api.bank.bankName,
          accountNumber: api.bank.accountNumber || '',
          ifscCode: api.bank.ifscCode || '',
          branch: api.bank.branch || '',
        }
      : fallback.bankDetails,
    bankDetailsText: api.bank ? undefined : fallback.bankDetailsText,
  }
}

/** Resolves the active letterhead profile — data-driven (API) with businessType-keyed fallback. */
export function resolveCompanyProfile(
  businessType: TenantBusinessType,
  apiProfile?: TenantCompanyProfile | null,
): CompanyProfile {
  const fallback = defaultProfileFor(businessType)
  return apiProfile ? mapApiProfile(apiProfile, fallback) : fallback
}

/** React hook — reactive to tenant hydration; prefer this in print components. */
export function useCompanyProfile(): CompanyProfile {
  const businessType = useTenantProfileStore((s) => s.businessType)
  const apiProfile = useTenantProfileStore((s) => s.companyProfile)
  return resolveCompanyProfile(businessType, apiProfile)
}

/** Non-reactive snapshot for use outside React render (e.g. merge-field builders). */
export function getActiveCompanyProfile(): CompanyProfile {
  const { businessType, companyProfile } = useTenantProfileStore.getState()
  return resolveCompanyProfile(businessType, companyProfile)
}

/**
 * @deprecated Prefer `useCompanyProfile()` / `getActiveCompanyProfile()` so SERVICES tenants
 * (e.g. Kology) get their own letterhead. Kept only for any lingering static imports.
 */
export const QUOTATION_COMPANY = VASANT_COMPANY_PROFILE
