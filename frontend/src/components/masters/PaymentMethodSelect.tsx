import { useMemo } from 'react'
import { ErpSmartSelect, type ErpSmartSelectOption } from '../erp/ErpSmartSelect'
import { useMasterStore } from '../../store/masterStore'

/** BC Payment Method lookup — subscribe to slice, filter in useMemo */
export function PaymentMethodSelect({
  value,
  onChange,
  disabled,
  allowEmpty,
}: {
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  allowEmpty?: boolean
}) {
  const paymentMethods = useMasterStore((s) => s.paymentMethods)

  const options: ErpSmartSelectOption<string>[] = useMemo(
    () =>
      paymentMethods
        .filter((p) => p.isActive)
        .map((p) => ({
          value: p.code,
          label: `${p.code} — ${p.description}`,
          searchText: `${p.code} ${p.description}`.toLowerCase(),
        })),
    [paymentMethods],
  )

  return (
    <ErpSmartSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Select payment method…"
      disabled={disabled}
      allowEmpty={allowEmpty}
    />
  )
}
