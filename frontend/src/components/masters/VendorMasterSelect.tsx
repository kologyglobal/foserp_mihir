import { useMemo } from 'react'
import { ErpSmartSelect, type ErpSmartSelectOption } from '../erp/ErpSmartSelect'
import { useActiveVendors } from '../../hooks/useMasterLists'
import { useAccountingVendorLookups } from '../../hooks/useAccountingLookups'
import { useMasterStore } from '../../store/masterStore'

/**
 * Vendor picker over MasterVendor.
 *
 * Default source is the hydrated master store (`/masters/vendors` in API mode).
 * Accounting document forms pass `source="accounting"` to load options from
 * `/accounting/lookups/vendors` (finance-permission scoped, active + unblocked);
 * on lookup failure the store-hydrated list is used — demo data is never
 * substituted in API mode.
 */
export function VendorMasterSelect({
  value,
  onChange,
  disabled,
  allowEmpty,
  source,
}: {
  value: string
  onChange: (vendorId: string) => void
  disabled?: boolean
  allowEmpty?: boolean
  /** "accounting" → prefer `/accounting/lookups/vendors` in API mode. */
  source?: 'store' | 'accounting'
}) {
  const vendors = useActiveVendors()
  const allVendors = useMasterStore((s) => s.vendors)
  const lookups = useAccountingVendorLookups(source === 'accounting')

  const options: ErpSmartSelectOption<string>[] = useMemo(() => {
    let opts: ErpSmartSelectOption<string>[]
    if (lookups && lookups.length > 0) {
      opts = lookups.map((v) => ({
        value: v.id,
        label: `${v.code} — ${v.name}`,
        subtitle: [v.city, v.gstin].filter(Boolean).join(' · ') || undefined,
        searchText: `${v.code} ${v.name} ${v.city ?? ''} ${v.gstin ?? ''}`.toLowerCase(),
      }))
    } else {
      opts = vendors.map((v) => ({
        value: v.id,
        label: `${v.vendorCode} — ${v.vendorName}`,
        searchText: `${v.vendorCode} ${v.vendorName} ${v.searchName ?? ''}`.toLowerCase(),
      }))
    }
    if (value && !opts.some((o) => o.value === value)) {
      const current = allVendors.find((v) => v.id === value)
      if (current) {
        opts = [
          {
            value: current.id,
            label: `${current.vendorCode} — ${current.vendorName}`,
            searchText: `${current.vendorCode} ${current.vendorName}`.toLowerCase(),
            meta: !current.isActive ? (
              <span className="text-xs text-[#605e5c]">Inactive</span>
            ) : undefined,
          },
          ...opts,
        ]
      }
    }
    return opts
  }, [lookups, vendors, allVendors, value])

  return (
    <ErpSmartSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Select vendor…"
      disabled={disabled}
      allowEmpty={allowEmpty}
      resolveOrphanLabel={(id) => {
        const current = allVendors.find((v) => v.id === id)
        return current ? `${current.vendorCode} — ${current.vendorName}` : undefined
      }}
    />
  )
}
