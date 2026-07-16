import { useMemo } from 'react'
import { ErpSmartSelect, type ErpSmartSelectOption } from '../erp/ErpSmartSelect'
import { useMasterStore } from '../../store/masterStore'

/** BC Bank Name lookup — subscribe to slice, filter in useMemo */
export function BankMasterSelect({
  value,
  onChange,
  disabled,
  allowEmpty,
}: {
  value: string
  onChange: (bankId: string) => void
  disabled?: boolean
  allowEmpty?: boolean
}) {
  const banks = useMasterStore((s) => s.banks)

  const options: ErpSmartSelectOption<string>[] = useMemo(
    () =>
      banks
        .filter((b) => b.isActive)
        .map((b) => ({
          value: b.id,
          label: `${b.code} — ${b.name}`,
          searchText: `${b.code} ${b.name}`.toLowerCase(),
        })),
    [banks],
  )

  return (
    <ErpSmartSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Select bank…"
      disabled={disabled}
      allowEmpty={allowEmpty}
    />
  )
}
