import { useMemo } from 'react'
import { ErpSmartSelect, type ErpSmartSelectOption } from '../erp/ErpSmartSelect'
import { useActiveCustomers } from '../../hooks/useMasterLists'
import { useAccountingCustomerLookups } from '../../hooks/useAccountingLookups'
import { isApiMode } from '../../config/apiConfig'

/**
 * Customer picker over the CRM Company master.
 *
 * Default source is the hydrated master store (`/crm/companies` in API mode).
 * Accounting document forms pass `source="accounting"` to load options from
 * `/accounting/lookups/customers` (finance-permission scoped, active-only);
 * on lookup failure the store-hydrated list is used — demo data is never
 * substituted in API mode.
 */
export function CustomerMasterSelect({
  value,
  onChange,
  disabled,
  allowEmpty,
  source,
}: {
  value: string
  onChange: (customerId: string) => void
  disabled?: boolean
  allowEmpty?: boolean
  /** "accounting" → prefer `/accounting/lookups/customers` in API mode. */
  source?: 'store' | 'accounting'
}) {
  const customers = useActiveCustomers()
  const lookups = useAccountingCustomerLookups(source === 'accounting')

  const options: ErpSmartSelectOption<string>[] = useMemo(() => {
    if (lookups && lookups.length > 0) {
      return lookups.map((c) => ({
        value: c.id,
        label: c.code ? `${c.code} — ${c.name}` : c.name,
        subtitle: [c.city, c.gstin].filter(Boolean).join(' · ') || undefined,
        searchText: `${c.code ?? ''} ${c.name} ${c.city ?? ''} ${c.gstin ?? ''}`.toLowerCase(),
      }))
    }
    return customers.map((c) => ({
      value: c.id,
      label: `${c.customerCode} — ${c.customerName}`,
      subtitle: [c.city, c.gstin].filter(Boolean).join(' · ') || undefined,
      searchText: `${c.customerCode} ${c.customerName} ${c.city ?? ''} ${c.gstin ?? ''}`.toLowerCase(),
    }))
  }, [lookups, customers])

  return (
    <div>
      <ErpSmartSelect
        options={options}
        value={value}
        onChange={onChange}
        placeholder="Select customer…"
        disabled={disabled}
        allowEmpty={allowEmpty}
      />
      {isApiMode() && options.length === 0 && (
        <p className="mt-1 text-[11px] text-amber-700">
          Customer masters are unavailable — CRM companies have not loaded. Retry after sign-in completes; demo data is
          never substituted in API mode.
        </p>
      )}
    </div>
  )
}
