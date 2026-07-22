import type { CrmCompany } from '@prisma/client'
import { resolveGstStateCode } from '../validation/state-code.validator.js'
import type { CustomerParty, CustomerPartyAddress, FindCustomerPartiesQuery } from './customer-party.types.js'
import { CustomerPartyNotFoundError, InactiveCustomerPartyError } from './customer-party.errors.js'
import * as repo from './customer-party.repository.js'

function mapCountryCode(country: string | null | undefined): string | null {
  if (!country) return 'IN'
  const normalized = country.trim().toUpperCase()
  if (normalized === 'INDIA' || normalized === 'IN') return 'IN'
  return normalized.length === 2 ? normalized : null
}

/**
 * Prefer GSTIN prefix (official 2-digit GST state) when present;
 * else resolve CrmCompany.state from a 2-digit code or Indian state name.
 * CrmCompany has no dedicated stateCode column today.
 */
export function resolveCustomerStateCode(company: Pick<CrmCompany, 'gstin' | 'state'>): string | null {
  return resolveGstStateCode(company.gstin) ?? resolveGstStateCode(company.state)
}

function mapAddress(company: CrmCompany): CustomerPartyAddress {
  return {
    line1: company.addressLine1,
    line2: company.addressLine2,
    city: company.city,
    state: company.state,
    pincode: company.pincode,
    country: company.country,
  }
}

/** Map CrmCompany row to AR customer party DTO — never expose raw Prisma model from public service methods. */
export function mapCompanyToCustomerParty(company: CrmCompany): CustomerParty {
  const address = mapAddress(company)
  return {
    id: company.id,
    tenantId: company.tenantId,
    code: company.companyCode ?? null,
    name: company.name,
    gstin: company.gstin,
    pan: company.pan,
    billingAddress: address,
    shippingAddress: address,
    stateCode: resolveCustomerStateCode(company),
    countryCode: mapCountryCode(company.country),
    creditDays: company.creditDays,
    currencyCode: 'INR',
    receivableAccountId: null,
    isActive: company.status === 'active' && company.isActive && company.deletedAt == null,
  }
}

export async function findCustomerParty(tenantId: string, customerId: string): Promise<CustomerParty | null> {
  const company = await repo.findCrmCompanyById(tenantId, customerId)
  return company ? mapCompanyToCustomerParty(company) : null
}

export async function requireActiveCustomerParty(tenantId: string, customerId: string): Promise<CustomerParty> {
  const company = await repo.findCrmCompanyById(tenantId, customerId)
  if (!company) throw new CustomerPartyNotFoundError(customerId)
  const party = mapCompanyToCustomerParty(company)
  if (!party.isActive) throw new InactiveCustomerPartyError(customerId)
  return party
}

export async function findCustomerParties(
  tenantId: string,
  query: FindCustomerPartiesQuery,
): Promise<{ items: CustomerParty[]; total: number; page: number; limit: number }> {
  const result = await repo.findCrmCompanies(tenantId, query)
  return {
    ...result,
    items: result.items.map(mapCompanyToCustomerParty),
  }
}
