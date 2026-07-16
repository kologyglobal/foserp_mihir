import type { ReactNode } from 'react'
import { DynamicsStatusChip } from '../../dynamics/DynamicsStatusChip'
import type { ErpCardFormStatusItem } from './types'
import { cn } from '../../../utils/cn'

interface ErpFormStatusStripProps {
  items: ErpCardFormStatusItem[]
  extra?: ReactNode
  className?: string
}

const TONE_MAP = {
  neutral: 'neutral',
  info: 'info',
  success: 'success',
  warning: 'warning',
  critical: 'critical',
} as const

/** Status strip below header — Draft · Owner · Missing fields */
export function ErpFormStatusStrip({ items, extra, className }: ErpFormStatusStripProps) {
  if (items.length === 0 && !extra) return null

  return (
    <div className={cn('erp-form-status-strip', className)}>
      <div className="erp-form-status-strip__items">
        {items.map((item, idx) => (
          <span key={`${item.label}-${idx}`} className="erp-form-status-strip__item">
            {idx > 0 ? <span className="erp-form-status-strip__sep" aria-hidden>·</span> : null}
            <DynamicsStatusChip
              label={`${item.label}: ${item.value}`}
              tone={TONE_MAP[item.tone ?? 'neutral']}
            />
          </span>
        ))}
      </div>
      {extra ? <div className="erp-form-status-strip__extra">{extra}</div> : null}
    </div>
  )
}
