import type { Customer } from '../types/master'

/** User-facing labels for the company master (pre-invoice commercial entity). */
export const COMPANY_TERMINOLOGY = {
  masterTitle: 'Company Master',
  masterDescription: 'Commercial organisations — a company becomes a customer only after the first invoice is posted',
  singular: 'Company',
  plural: 'Companies',
  new: 'New Company',
  edit: 'Edit Company',
  name: 'Company Name',
  profile: 'Company Profile',
  register: 'Company Register',
  hub360: 'Company 360',
  code: 'Company Code',
  notFound: 'Company not found',
  crmTitle: 'CRM Companies',
  addQuick: 'Add New Company',
  backToMaster: 'Company Master',
  backTo360: 'Company 360',
} as const

export const CUSTOMER_STATUS_LABEL = 'Customer'

export function companyIsCustomer(company: Customer | undefined | null): boolean {
  return company?.isCustomer === true
}

/** Use "Customer" only after first posted invoice; otherwise "Company". */
export function companyPartyLabel(company: Customer | undefined | null): typeof CUSTOMER_STATUS_LABEL | 'Company' {
  return companyIsCustomer(company) ? CUSTOMER_STATUS_LABEL : 'Company'
}

export function migrateCustomerRecord(customer: Customer): Customer {
  return {
    ...customer,
    isCustomer: customer.isCustomer ?? false,
    firstInvoicedAt: customer.firstInvoicedAt ?? null,
  }
}

/** Backfill customer flags from posted invoices (e.g. after rehydrate from localStorage). */
export function syncCompanyCustomerStatusFromInvoices(
  invoices: Array<{ customerId: string; status: string; postedAt?: string | null }>,
  markAsCustomer: (id: string, invoicedAt: string) => void,
): void {
  for (const invoice of invoices) {
    if (invoice.status === 'posted') {
      markAsCustomer(invoice.customerId, invoice.postedAt ?? new Date().toISOString())
    }
  }
}
