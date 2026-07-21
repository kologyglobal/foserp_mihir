/**
 * Accounts Receivable — Accounting workspace submenu tree.
 * Shown as DynamicsTabs group "Receivables".
 */

export type ReceivablesNavItem = {
  id: string
  label: string
  path: string
  /** Exact path match only (Overview) */
  end?: boolean
}

/** Canonical order under Accounting › Receivables */
export const RECEIVABLES_NAV: ReceivablesNavItem[] = [
  { id: 'overview', label: 'Overview', path: '/accounting/receivables', end: true },
  { id: 'outstanding', label: 'Customer Outstanding', path: '/accounting/receivables/outstanding' },
  { id: 'invoices', label: 'Receivable Invoices', path: '/accounting/receivables/invoices' },
  { id: 'ageing', label: 'Ageing', path: '/accounting/receivables/ageing' },
  { id: 'collections', label: 'Collection Worklist', path: '/accounting/receivables/collections' },
  { id: 'receipts', label: 'Customer Receipts', path: '/accounting/receivables/receipts' },
  { id: 'allocations', label: 'Receipt Allocations', path: '/accounting/receivables/allocations' },
  { id: 'credit-notes', label: 'Credit Notes', path: '/accounting/receivables/credit-notes' },
  { id: 'disputes', label: 'Disputes', path: '/accounting/receivables/disputes' },
  { id: 'reminders', label: 'Payment Reminders', path: '/accounting/receivables/reminders' },
]

export const RECEIVABLES_NAV_GROUP = 'Receivables'
