/**
 * Accounting customer resolver — thin wrap over customer-party (CrmCompany).
 * No FinanceCustomer table; soft-link only.
 */
import type { CustomerParty, FindCustomerPartiesQuery } from '../../receivables/customer-party/customer-party.types.js'
import {
  findCustomerParties,
  findCustomerParty,
  mapCompanyToCustomerParty,
  requireActiveCustomerParty,
} from '../../receivables/customer-party/customer-party.service.js'
import * as customerPartyRepo from '../../receivables/customer-party/customer-party.repository.js'

export type AccountingCustomerParty = CustomerParty

export interface AccountingCustomerLookupItem {
  id: string
  code: string | null
  name: string
  gstin: string | null
  pan: string | null
  stateCode: string | null
  city: string | null
  email: string | null
  phone: string | null
  contactPerson: string | null
  creditDays: number | null
  isActive: boolean
}

export async function resolveCustomerParty(
  tenantId: string,
  customerId: string,
): Promise<AccountingCustomerParty | null> {
  return findCustomerParty(tenantId, customerId)
}

export async function requireActiveAccountingCustomer(
  tenantId: string,
  customerId: string,
): Promise<AccountingCustomerParty> {
  return requireActiveCustomerParty(tenantId, customerId)
}

export async function listAccountingCustomers(
  tenantId: string,
  query: FindCustomerPartiesQuery,
): Promise<{ items: AccountingCustomerLookupItem[]; total: number; page: number; limit: number }> {
  const result = await customerPartyRepo.findCrmCompanies(tenantId, query)
  return {
    ...result,
    items: result.items.map((company) => {
      const party = mapCompanyToCustomerParty(company)
      return {
        id: party.id,
        code: party.code,
        name: party.name,
        gstin: party.gstin,
        pan: party.pan,
        stateCode: party.stateCode,
        city: company.city,
        email: company.email,
        phone: company.phone,
        contactPerson: company.contactPerson,
        creditDays: party.creditDays,
        isActive: party.isActive,
      }
    }),
  }
}

export async function getAccountingCustomerLookup(
  tenantId: string,
  customerId: string,
): Promise<AccountingCustomerLookupItem | null> {
  const company = await customerPartyRepo.findCrmCompanyById(tenantId, customerId)
  if (!company) return null
  const party = mapCompanyToCustomerParty(company)
  return {
    id: party.id,
    code: party.code,
    name: party.name,
    gstin: party.gstin,
    pan: party.pan,
    stateCode: party.stateCode,
    city: company.city,
    email: company.email,
    phone: company.phone,
    contactPerson: company.contactPerson,
    creditDays: party.creditDays,
    isActive: party.isActive,
  }
}

export { findCustomerParties }
