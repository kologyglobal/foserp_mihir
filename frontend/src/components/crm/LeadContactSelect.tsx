import { useMemo, useState } from 'react'
import { Plus, UserRound } from 'lucide-react'
import { useCrmContactsForCustomer } from '../../hooks/useStableStoreData'
import { useQuickCreate } from '../../hooks/useQuickCreate'
import { useCrmStore } from '../../store/crmStore'
import type { CrmContact } from '../../types/crm'
import { ErpSmartSelect, type ErpSmartSelectOption } from '../erp/ErpSmartSelect'
import { ErpButton } from '../erp/ErpButton'
import { NewContactDrawer } from './CrmQuickCreateDrawers'
import { cn } from '../../utils/cn'

export interface LeadContactSelectProps {
  customerId: string | null
  contactId: string | null
  onContactSelected: (contact: CrmContact | null) => void
  disabled?: boolean
  className?: string
}

export function LeadContactSelect({
  customerId,
  contactId,
  onContactSelected,
  disabled,
  className,
}: LeadContactSelectProps) {
  const contacts = useCrmContactsForCustomer(customerId ?? undefined)
  const getContact = useCrmStore((s) => s.getContact)
  const { canCreate } = useQuickCreate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const options = useMemo<ErpSmartSelectOption[]>(
    () =>
      contacts.map((c) => ({
        value: c.id,
        label: c.name,
        searchText: [c.name, c.designation, c.phone, c.email].filter(Boolean).join(' ').toLowerCase(),
        meta: (
          <span className="erp-dropdown-option__meta">
            {[c.designation, c.phone, c.email].filter(Boolean).join(' · ') || 'No contact details'}
          </span>
        ),
      })),
    [contacts],
  )

  const canAdd = Boolean(customerId) && canCreate('contact') && !disabled

  function handleChange(nextId: string | '') {
    if (!nextId) {
      onContactSelected(null)
      return
    }
    const contact = contacts.find((c) => c.id === nextId) ?? getContact(nextId)
    onContactSelected(contact ?? null)
  }

  function handleCreated(newContactId: string) {
    const contact = useCrmStore.getState().getContact(newContactId)
    if (contact) onContactSelected(contact)
  }

  return (
    <div className={cn('crm-company-prospect', className)}>
      <div className="crm-company-prospect__search-row">
        <div className="min-w-0 flex-1">
          <ErpSmartSelect
            options={options}
            value={contactId ?? ''}
            onChange={handleChange}
            placeholder={customerId ? 'Search contact person…' : 'Select a company first'}
            disabled={disabled || !customerId}
            allowEmpty
            appearance="combo"
            emptyMessage={customerId ? 'No contacts for this company' : 'Link a company to pick contacts'}
          />
        </div>
        <ErpButton
          type="button"
          variant="secondary"
          size="sm"
          icon={Plus}
          disabled={!canAdd}
          title={!customerId ? 'Select a company first' : undefined}
          onClick={() => setDrawerOpen(true)}
        >
          Add New Contact
        </ErpButton>
      </div>

      {contactId ? (
        <p className="crm-company-prospect__linked inline-flex items-center gap-1.5">
          <UserRound className="h-3.5 w-3.5" aria-hidden />
          Linked to Contact Master
        </p>
      ) : customerId ? (
        <p className="crm-company-prospect__hint text-[12px] text-erp-muted mt-1.5">
          Select an existing contact or add a new one for this company.
        </p>
      ) : null}

      <NewContactDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        defaultCustomerId={customerId}
        onCreated={handleCreated}
      />
    </div>
  )
}
