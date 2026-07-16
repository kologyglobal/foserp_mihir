import { Select } from '../forms/Inputs'
import { withCurrentTermOption } from '../../data/purchase/purchaseCommercialTerms'

interface PurchaseTermSelectProps {
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  disabled?: boolean
  /** Shown as the empty / unset option. Pass null to omit empty option. */
  emptyLabel?: string | null
  id?: string
}

/** Compact select for purchase commercial terms; preserves current value if not in the list. */
export function PurchaseTermSelect({
  value,
  options,
  onChange,
  disabled,
  emptyLabel = 'Select…',
  id,
}: PurchaseTermSelectProps) {
  const opts = withCurrentTermOption(options, value)

  return (
    <Select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {emptyLabel != null ? <option value="">{emptyLabel}</option> : null}
      {opts.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </Select>
  )
}
