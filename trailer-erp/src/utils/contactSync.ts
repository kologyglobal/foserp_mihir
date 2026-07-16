import type { CrmContact } from '../types/crm'
import { useMasterStore } from '../store/masterStore'
import { sanitizePhoneDigits } from './phoneValidation'

export function applyPrimaryContactFlags(
  contacts: CrmContact[],
  customerId: string,
  contactId: string,
  isPrimary: boolean,
): CrmContact[] {
  if (!isPrimary) return contacts
  return contacts.map((c) => (
    c.customerId === customerId
      ? { ...c, isPrimary: c.id === contactId }
      : c
  ))
}

export function syncCrmContactToMaster(contact: CrmContact): string {
  const master = useMasterStore.getState()
  const payload = {
    customerId: contact.customerId,
    contactName: contact.name,
    designation: contact.designation,
    mobile: contact.phone,
    email: contact.email,
    department: contact.department ?? '',
    isActive: contact.isActive ?? true,
  }
  if (contact.masterContactId) {
    master.updateCustomerContact(contact.masterContactId, payload)
    return contact.masterContactId
  }
  return master.addCustomerContact(payload)
}

export function syncPrimaryToCustomer(contact: CrmContact) {
  if (!contact.isPrimary) return
  const cust = useMasterStore.getState().getCustomer(contact.customerId)
  if (!cust) return
  const phone = sanitizePhoneDigits(contact.phone ?? '')
  const email = contact.email ?? ''
  if (
    cust.contactPerson === contact.name
    && sanitizePhoneDigits(cust.contactPhone ?? '') === phone
    && (cust.contactEmail ?? '') === email
  ) {
    return
  }
  useMasterStore.getState().updateCustomer(contact.customerId, {
    contactPerson: contact.name,
    contactPhone: phone,
    contactEmail: email,
  })
}

type CompanyContactFields = {
  contactPerson?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
}

/**
 * Demo mode: company form Contact Person / Phone / Email → CRM primary contact.
 * No-ops when name is empty or values already match (avoids update loops).
 */
export function syncCustomerFieldsToPrimaryContact(
  customerId: string,
  fields: CompanyContactFields,
): void {
  const name = fields.contactPerson?.trim() ?? ''
  if (!name) return

  const phone = sanitizePhoneDigits(fields.contactPhone ?? '')
  const email = fields.contactEmail?.trim() ?? ''

  // Lazy import avoids circular init with crmStore → contactSync
  void import('../store/crmStore').then(({ useCrmStore }) => {
    void import('../services/codeSeriesService').then(({ reserveCode, confirmCode }) => {
      const crm = useCrmStore.getState()
      const primary =
        crm.contacts.find((c) => c.customerId === customerId && c.isPrimary)
        ?? crm.contacts.find((c) => c.customerId === customerId)

      if (primary) {
        if (
          primary.name === name
          && sanitizePhoneDigits(primary.phone ?? '') === phone
          && (primary.email ?? '') === email
          && primary.isPrimary
        ) {
          return
        }
        void crm.updateContact(primary.id, {
          name,
          phone,
          email,
          isPrimary: true,
          isActive: true,
        })
        return
      }

      let contactCode = ''
      try {
        contactCode = reserveCode('contact')
      } catch {
        contactCode = `CONT-AUTO-${Date.now().toString(36).toUpperCase()}`
      }
      const result = crm.createContact({
        contactCode,
        customerId,
        name,
        designation: 'Primary Contact',
        department: '',
        email,
        phone,
        isPrimary: true,
        isActive: true,
      })
      if (result && typeof result === 'object' && 'ok' in result && result.ok) {
        try {
          confirmCode('contact', contactCode)
        } catch {
          /* code series optional for auto-sync */
        }
      }
    })
  })
}
