import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface HrMoneySummaryItem {
  label: string
  /** Pre-formatted amount string (e.g. "₹45,000") — callers own currency formatting. */
  value: string
  tone?: 'default' | 'positive' | 'negative' | 'muted'
  hint?: ReactNode
}

interface HrMoneySummaryProps {
  items: HrMoneySummaryItem[]
  /** Final highlighted item — e.g. Net Pay / Net Settlement / Outstanding. */
  total?: HrMoneySummaryItem
  className?: string
}

const toneClass: Record<NonNullable<HrMoneySummaryItem['tone']>, string> = {
  default: '',
  positive: 'hr-money-summary__value--positive',
  negative: 'hr-money-summary__value--negative',
  muted: 'hr-money-summary__value--muted',
}

/**
 * Readable money breakdown strip — Original/Recovered/Outstanding, Gross/Deductions/Net,
 * Earnings/Deductions/Net Settlement, etc. Final `total` item is visually emphasised.
 */
export function HrMoneySummary({ items, total, className }: HrMoneySummaryProps) {
  return (
    <div className={cn('hr-money-summary', className)}>
      <div className="hr-money-summary__row">
        {items.map((item, idx) => (
          <div key={`${item.label}-${idx}`} className="hr-money-summary__item">
            <div className="hr-money-summary__label">{item.label}</div>
            <div className={cn('hr-money-summary__value', item.tone ? toneClass[item.tone] : undefined)}>
              {item.value}
            </div>
            {item.hint ? <div className="hr-money-summary__hint">{item.hint}</div> : null}
          </div>
        ))}
      </div>
      {total ? (
        <div className="hr-money-summary__total">
          <span className="hr-money-summary__total-label">{total.label}</span>
          <span
            className={cn(
              'hr-money-summary__total-value',
              total.tone ? toneClass[total.tone] : undefined,
            )}
          >
            {total.value}
          </span>
        </div>
      ) : null}
    </div>
  )
}
