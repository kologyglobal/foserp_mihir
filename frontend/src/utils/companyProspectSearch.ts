import type { Customer, CustomerContact } from '../types/master'

export interface CompanyProspectMatch {
  customerId: string
  customerName: string
  city: string
  industry: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  customerType: string
  salesTerritory: string
  sourceLabel: string
  statusLabel: string
  matchScore: number
}

function norm(s: string): string {
  return s.toLowerCase().trim()
}

function customerToProspectMatch(
  c: Customer,
  contacts: CustomerContact[],
): CompanyProspectMatch {
  const custContacts = contacts.filter((cc) => cc.customerId === c.id && cc.isActive)
  const primary = custContacts[0]
  return {
    customerId: c.id,
    customerName: c.customerName,
    city: c.city,
    industry: c.industry ?? '—',
    contactPerson: primary?.contactName ?? c.contactPerson,
    contactPhone: primary?.mobile ?? c.contactPhone,
    contactEmail: primary?.email ?? c.contactEmail,
    customerType: c.customerType,
    salesTerritory: c.salesTerritory,
    sourceLabel: c.isCustomer ? 'Customer' : 'Prospect',
    statusLabel: c.isActive ? 'Active' : 'Inactive',
    matchScore: 0,
  }
}

export function searchCompanyProspects(
  customers: Customer[],
  contacts: CustomerContact[],
  query: string,
  limit = 12,
): CompanyProspectMatch[] {
  const q = norm(query)
  if (!q) {
    return customers
      .filter((c) => c.isActive)
      .sort((a, b) => a.customerName.localeCompare(b.customerName))
      .slice(0, limit)
      .map((c) => customerToProspectMatch(c, contacts))
  }

  const results: CompanyProspectMatch[] = []

  for (const c of customers) {
    if (!c.isActive) continue
    const custContacts = contacts.filter((cc) => cc.customerId === c.id && cc.isActive)
    const primary = custContacts[0]
    const haystack = [
      c.customerName,
      c.customerCode,
      c.city,
      c.contactPerson,
      c.contactPhone,
      c.contactEmail,
      c.industry ?? '',
      ...custContacts.flatMap((cc) => [cc.contactName, cc.mobile, cc.email]),
    ]
      .join(' ')
      .toLowerCase()

    if (!haystack.includes(q) && !norm(c.customerName).startsWith(q)) continue

    let score = 0
    if (norm(c.customerName) === q) score += 100
    else if (norm(c.customerName).startsWith(q)) score += 80
    else if (norm(c.customerName).includes(q)) score += 60
    if (norm(c.city).includes(q)) score += 20
    if (norm(c.contactPerson).includes(q)) score += 15
    if (c.contactPhone.includes(q)) score += 25

    results.push({
      customerId: c.id,
      customerName: c.customerName,
      city: c.city,
      industry: c.industry ?? '—',
      contactPerson: primary?.contactName ?? c.contactPerson,
      contactPhone: primary?.mobile ?? c.contactPhone,
      contactEmail: primary?.email ?? c.contactEmail,
      customerType: c.customerType,
      salesTerritory: c.salesTerritory,
      sourceLabel: c.isCustomer ? 'Customer' : 'Prospect',
      statusLabel: c.isActive ? 'Active' : 'Inactive',
      matchScore: score,
    })
  }

  return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, limit)
}

export function findSimilarCompanies(customers: Customer[], name: string): Customer[] {
  const q = norm(name)
  if (q.length < 3) return []
  return customers.filter(
    (c) => c.isActive && (norm(c.customerName).includes(q) || q.includes(norm(c.customerName).slice(0, 4))),
  )
}

/** Exact company-name match (case-insensitive). Used to persist customerId when the user typed a known name without picking from the list. */
export function findExactCompanyByName(
  customers: Customer[],
  name: string | null | undefined,
): Customer | undefined {
  const q = norm(name ?? '')
  if (!q) return undefined
  return customers.find((c) => c.isActive && norm(c.customerName) === q)
}
