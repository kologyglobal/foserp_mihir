import { Link } from 'react-router-dom'
import { Select } from '../forms/Inputs'
import type { PurchaseCommercialTermKind } from '../../types/purchaseMasters'
import { usePurchaseCommercialTermOptions } from '../../hooks/usePurchaseMasters'

const MASTER_LINKS: Record<PurchaseCommercialTermKind, string> = {
  'payment-terms': '/masters/payment-terms',
  'delivery-terms': '/crm/masters/delivery-terms',
  'freight-terms': '/purchase/masters/freight-terms',
}

interface PurchaseCommercialTermFieldProps {
  kind: PurchaseCommercialTermKind
  label: string
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
}

export function PurchaseCommercialTermField({
  kind,
  label,
  value,
  onChange,
  readOnly,
}: PurchaseCommercialTermFieldProps) {
  const options = usePurchaseCommercialTermOptions(kind)
  const selected = options.find((o) => o.text === value || o.label === value || o.value === value)

  if (readOnly) {
    return <span className="text-[13px] text-erp-text">{value || '—'}</span>
  }

  return (
    <div className="space-y-1">
      <Select value={selected?.value ?? ''} onChange={(e) => {
        const opt = options.find((o) => o.value === e.target.value)
        onChange(opt?.text ?? opt?.label ?? '')
      }}>
        <option value="">Custom / vendor default</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </Select>
      <Link to={MASTER_LINKS[kind]} className="text-[11px] font-medium text-erp-primary hover:underline">
        Manage {label} master
      </Link>
    </div>
  )
}
