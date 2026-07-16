import { useMemo } from 'react'
import { ErpSmartSelect, type ErpSmartSelectOption } from '../erp/ErpSmartSelect'
import { useActiveVendors } from '../../hooks/useMasterLists'

export function VendorMasterSelect({
  value,
  onChange,
  disabled,
  allowEmpty,
}: {
  value: string
  onChange: (vendorId: string) => void
  disabled?: boolean
  allowEmpty?: boolean
}) {
  const vendors = useActiveVendors()

  const options: ErpSmartSelectOption<string>[] = useMemo(
    () =>
      vendors.map((v) => ({
        value: v.id,
        label: `${v.vendorCode} — ${v.vendorName}`,
        searchText: `${v.vendorCode} ${v.vendorName} ${v.searchName ?? ''}`.toLowerCase(),
      })),
    [vendors],
  )

  return (
    <ErpSmartSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Select vendor…"
      disabled={disabled}
      allowEmpty={allowEmpty}
    />
  )
}
