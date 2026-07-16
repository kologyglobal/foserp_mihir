import { ErpSmartSelect, type ErpSmartSelectOption } from '../erp/ErpSmartSelect'
import { CURRENCY_CODE_OPTIONS } from '../../types/bankMaster'

const OPTIONS: ErpSmartSelectOption<string>[] = CURRENCY_CODE_OPTIONS.map((c) => ({
  value: c.code,
  label: c.label,
  searchText: `${c.code} ${c.label}`.toLowerCase(),
}))

export function CurrencyCodeSelect({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (code: string) => void
  disabled?: boolean
}) {
  return (
    <ErpSmartSelect
      options={OPTIONS}
      value={value}
      onChange={onChange}
      placeholder="Select currency…"
      disabled={disabled}
    />
  )
}
