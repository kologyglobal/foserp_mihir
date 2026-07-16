import { useMemo } from 'react'
import { Select } from '../forms/Inputs'
import { parseLostReason, resolveLostReasonOptions } from '../../utils/opportunityUtils'

interface LostDealFieldsProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

/** Lost reason picker driven by Lost Reason Master. */
export function LostDealFields({ value, onChange, className }: LostDealFieldsProps) {
  const lostReasons = useMemo(() => resolveLostReasonOptions(), [])
  const parsed = parseLostReason(value)
  const reasonCode = lostReasons.some((r) => r.value === parsed.code) ? parsed.code : ''

  return (
    <div className={className}>
      <label className="block text-sm">
        <span className="font-medium text-erp-text">Lost reason</span>
        <Select
          wrapClassName="mt-1 w-full"
          value={reasonCode}
          onChange={(e) => onChange(e.target.value)}
          className="h-9"
        >
          <option value="">— Select lost reason —</option>
          {lostReasons.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Select>
      </label>
      {!reasonCode && value && !value.includes('|') ? (
        <p className="mt-2 text-[12px] text-erp-muted">Legacy reason: {value}</p>
      ) : null}
      {parsed.competitorCode ? (
        <p className="mt-2 text-[12px] text-erp-muted">
          Legacy competitor reference: {parsed.competitorCode}
        </p>
      ) : null}
    </div>
  )
}
