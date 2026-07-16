import { memo } from 'react'
import { SemanticStatus } from '../../components/design-system/SemanticStatus'
import { resolveStatus } from '../constants/status'

export interface StatusBadgeProps {
  status: string
  className?: string
}

/** Canonical status badge — maps ERP statuses to semantic tones */
export const StatusBadge = memo(function StatusBadge({ status, className }: StatusBadgeProps) {
  const def = resolveStatus(status)
  const toneMap: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
    draft: 'info',
    open: 'info',
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    completed: 'success',
    cancelled: 'info',
    in_progress: 'info',
    overdue: 'danger',
    blocked: 'danger',
    closed: 'info',
    info: 'info',
    success: 'success',
    warning: 'warning',
    danger: 'danger',
  }
  const semanticTone = toneMap[def.tone] ?? 'info'
  return (
    <SemanticStatus tone={semanticTone === 'neutral' ? 'info' : semanticTone} className={className}>
      {def.label}
    </SemanticStatus>
  )
})
