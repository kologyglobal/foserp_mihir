/**
 * AR customer party — operational view over CrmCompany.
 * LegalEntity is never a customer; there is no Prisma Customer model.
 * customerId on AR documents is application-validated via customer-party service (no DB FK to crm_companies).
 */

export interface CustomerPartyAddress {
  line1: string | null
  line2: string | null
  city: string | null
  state: string | null
  pincode: string | null
  country: string | null
}

/** @deprecated Use CustomerPartyAddress */
export type CustomerPartyBillingAddress = CustomerPartyAddress

export interface CustomerParty {
  id: string
  tenantId: string

  code: string | null
  name: string

  gstin: string | null
  pan: string | null

  billingAddress: CustomerPartyAddress | null
  /** CrmCompany currently stores one address; shipping mirrors billing until a dedicated ship-to exists. */
  shippingAddress: CustomerPartyAddress | null

  stateCode: string | null
  countryCode: string | null

  creditDays: number | null
  currencyCode: string | null

  receivableAccountId: string | null

  isActive: boolean
}

export interface FindCustomerPartiesQuery {
  search?: string
  isActive?: boolean
  page?: number
  limit?: number
}
