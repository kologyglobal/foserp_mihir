import { useMemo } from 'react'
import { ErpSmartSelect, type ErpSmartSelectOption } from '../erp/ErpSmartSelect'
import { useActiveCustomers } from '../../hooks/useMasterLists'
import { useAccountingCustomerLookups } from '../../hooks/useAccountingLookups'
import { isApiMode } from '../../config/apiConfig'
import { useMasterStore } from '../../store/masterStore'

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
  const allCustomers = useMasterStore((s) => s.customers)
  const lookups = useAccountingCustomerLookups(source === 'accounting')

  const options: ErpSmartSelectOption<string>[] = useMemo(() => {
    let opts: ErpSmartSelectOption<string>[]
    if (lookups && lookups.length > 0) {
      opts = lookups.map((c) => ({
        value: c.id,
        label: c.code ? `${c.code} — ${c.name}` : c.name,
        subtitle: [c.city, c.gstin].filter(Boolean).join(' · ') || undefined,
        searchText: `${c.code ?? ''} ${c.name} ${c.city ?? ''} ${c.gstin ?? ''}`.toLowerCase(),
      }))
    } else {
      opts = customers.map((c) => ({
        value: c.id,
        label: `${c.customerCode} — ${c.customerName}`,
        subtitle: [c.city, c.gstin].filter(Boolean).join(' · ') || undefined,
        searchText: `${c.customerCode} ${c.customerName} ${c.city ?? ''} ${c.gstin ?? ''}`.toLowerCase(),
      }))
    }
    if (value && !opts.some((o) => o.value === value)) {
      const current = allCustomers.find((c) => c.id === value)
      if (current) {
        opts = [
          {
            value: current.id,
            label: `${current.customerCode} — ${current.customerName}`,
            subtitle: [current.city, current.gstin].filter(Boolean).join(' · ') || undefined,
            searchText: `${current.customerCode} ${current.customerName}`.toLowerCase(),
            meta: !current.isActive ? (
              <span className="text-xs text-[#605e5c]">Inactive</span>
            ) : undefined,
          },
          ...opts,
        ]
      }
    }
    return opts
  }, [lookups, customers, allCustomers, value])

  return (
    <div>
      <ErpSmartSelect
        options={options}
        value={value}
        onChange={onChange}
        placeholder="Select customer…"
        disabled={disabled}
        allowEmpty={allowEmpty}
        resolveOrphanLabel={(id) => {
          const current = allCustomers.find((c) => c.id === id)
          return current ? `${current.customerCode} — ${current.customerName}` : undefined
        }}
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
