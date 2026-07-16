/** Canonical Entity 360 route builders — used by pages, navigation, and tests */

export const SALES_CUSTOMER_360_HUB = '/sales/customers'

export type Company360Context = 'crm' | 'sales' | 'masters'

/** CRM / universal company 360 — primary link from CRM Companies */
export function entity360CustomerPath(customerId: string) {
  return `/entity360/customers/${customerId}`
}

export function bom360Path(bomId: string) {
  return `/engineering/boms/${bomId}/360`
}

/** Masters company 360 */
export function customer360Path(customerId: string) {
  return `/masters/companies/${customerId}/360`
}

export function salesCustomer360Path(customerId: string) {
  return `/sales/customers/${customerId}/360`
}

/**
 * Pick company 360 destination from location context.
 * - CRM: `/crm`, `/entity360`, `/m/crm` → `/entity360/customers/:id`
 * - Sales: `/sales` → `/sales/customers/:id/360`
 * - Masters: `/masters` → `/masters/companies/:id/360`
 * Unknown / missing pathname defaults to CRM entity360.
 */
export function resolveCompany360Context(pathname?: string | null): Company360Context {
  if (!pathname) return 'crm'
  if (pathname.startsWith('/sales')) return 'sales'
  if (pathname.startsWith('/masters')) return 'masters'
  if (
    pathname.startsWith('/crm') ||
    pathname.startsWith('/entity360') ||
    pathname.startsWith('/m/crm')
  ) {
    return 'crm'
  }
  return 'crm'
}

/** Single policy entry for all company / customer 360 deep links. */
export function resolveCompany360Path(customerId: string, pathname?: string | null): string {
  switch (resolveCompany360Context(pathname)) {
    case 'sales':
      return salesCustomer360Path(customerId)
    case 'masters':
      return customer360Path(customerId)
    default:
      return entity360CustomerPath(customerId)
  }
}

export function customer360HubPath(pathname: string): string {
  const ctx = resolveCompany360Context(pathname)
  if (ctx === 'crm') return '/crm/customers'
  if (ctx === 'sales') return SALES_CUSTOMER_360_HUB
  return '/masters/companies'
}

/** @deprecated Prefer resolveCompany360Path(customerId, pathname) — kept for favorites / existing call sites. */
export function resolveCustomer360Path(pathname: string, customerId: string): string {
  return resolveCompany360Path(customerId, pathname)
}

export const ENTITY_360_ROUTES = {
  entity360Customer: '/entity360/customers/:id',
  bom360: '/engineering/boms/:id/360',
  customer360: '/masters/companies/:id/360',
  salesCustomer360: '/sales/customers/:id/360',
} as const
