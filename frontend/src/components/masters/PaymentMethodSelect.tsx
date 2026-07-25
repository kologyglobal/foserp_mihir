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

  const options: ErpSmartSelectOption<string>[] = useMemo(() => {
    const active = paymentMethods
      .filter((p) => p.isActive)
      .map((p) => ({
        value: p.code,
        label: `${p.code} — ${p.description}`,
        searchText: `${p.code} ${p.description}`.toLowerCase(),
      }))
    if (value && !active.some((o) => o.value === value)) {
      const current = paymentMethods.find((p) => p.code === value)
      if (current) {
        return [
          {
            value: current.code,
            label: `${current.code} — ${current.description}`,
            searchText: `${current.code} ${current.description}`.toLowerCase(),
            meta: !current.isActive ? (
              <span className="text-xs text-[#605e5c]">Inactive</span>
            ) : undefined,
          },
          ...active,
        ]
      }
    }
    return active
  }, [paymentMethods, value])

  return (
    <ErpSmartSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Select payment method…"
      disabled={disabled}
      allowEmpty={allowEmpty}
      resolveOrphanLabel={(code) => {
        const current = paymentMethods.find((p) => p.code === code)
        return current ? `${current.code} — ${current.description}` : undefined
      }}
    />
  )
}
