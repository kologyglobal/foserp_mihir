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

  const options: ErpSmartSelectOption<string>[] = useMemo(() => {
    const active = banks
      .filter((b) => b.isActive)
      .map((b) => ({
        value: b.id,
        label: `${b.code} — ${b.name}`,
        searchText: `${b.code} ${b.name}`.toLowerCase(),
      }))
    if (value && !active.some((o) => o.value === value)) {
      const current = banks.find((b) => b.id === value)
      if (current) {
        return [
          {
            value: current.id,
            label: `${current.code} — ${current.name}`,
            searchText: `${current.code} ${current.name}`.toLowerCase(),
            meta: !current.isActive ? (
              <span className="text-xs text-[#605e5c]">Inactive</span>
            ) : undefined,
          },
          ...active,
        ]
      }
    }
    return active
  }, [banks, value])

  return (
    <ErpSmartSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Select bank…"
      disabled={disabled}
      allowEmpty={allowEmpty}
      resolveOrphanLabel={(id) => {
        const current = banks.find((b) => b.id === id)
        return current ? `${current.code} — ${current.name}` : undefined
      }}
    />
  )
}
