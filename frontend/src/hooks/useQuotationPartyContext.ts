import { useEffect, useMemo } from 'react'
import type { CrmContact, QuotationDocument } from '../types/crm'
import type { Quotation } from '../types/sales'
import type { Customer } from '../types/master'
import { isApiMode } from '../config/apiConfig'
import { useCrmStore } from '../store/crmStore'
import { useMasterStore } from '../store/masterStore'
import * as crmApi from '../services/api/crmApi'

/** Resolve customer + contact for quotation preview/print; hydrates from API when store is missing rows. */
export function useQuotationPartyContext(
  quotation: Quotation | undefined,
  doc: QuotationDocument | undefined,
): {
  customer: Customer | undefined
  contact: CrmContact | null
  contactName: string | undefined
} {
  const customers = useMasterStore((s) => s.customers)
  const contacts = useCrmStore((s) => s.contacts)

  const customer = useMemo(
    () => (quotation?.customerId ? customers.find((c) => c.id === quotation.customerId) : undefined),
    [customers, quotation?.customerId],
  )

  const contact = useMemo(() => {
    const contactId = doc?.contactId
    if (!contactId) return null
    return contacts.find((c) => c.id === contactId) ?? null
  }, [contacts, doc?.contactId])

  useEffect(() => {
    if (!isApiMode() || !quotation?.customerId) return

    let cancelled = false

    void (async () => {
      try {
        const hasCustomer = useMasterStore.getState().customers.some((c) => c.id === quotation.customerId)
        if (!hasCustomer) {
          const res = await crmApi.fetchCompany(quotation.customerId)
          if (!cancelled && res.data) {
            useMasterStore.setState((s) => ({
              customers: [res.data, ...s.customers.filter((c) => c.id !== res.data.id)],
            }))
          }
        }

        const contactId = doc?.contactId
        if (contactId) {
          const hasContact = useCrmStore.getState().contacts.some((c) => c.id === contactId)
          if (!hasContact) {
            const res = await crmApi.fetchContact(contactId)
            if (!cancelled && res.data) {
              useCrmStore.setState((s) => ({
                contacts: [res.data, ...s.contacts.filter((c) => c.id !== res.data.id)],
              }))
            }
          }
        }
      } catch {
        /* Preview still renders; merge map falls back to — */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [quotation?.customerId, doc?.contactId])

  const contactName = contact?.name ?? customer?.contactPerson

  return { customer, contact, contactName }
}
