import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export type SemanticTone = 'success' | 'warning' | 'danger' | 'info'
export type SemanticVariant = 'soft' | 'solid'

const toneLabel: Record<SemanticTone, string> = {
  success: 'Success',
  warning: 'Warning',
  danger: 'Danger',
  info: 'Info',
}

const softClass: Record<SemanticTone, string> = {
  success: 'erp-status-soft-success',
  warning: 'erp-status-soft-warning',
  danger: 'erp-status-soft-danger',
  info: 'erp-status-soft-info',
}

const solidClass: Record<SemanticTone, string> = {
  success: 'erp-status-solid-success',
  warning: 'erp-status-solid-warning',
  danger: 'erp-status-solid-danger',
  info: 'erp-status-solid-info',
}

const labelClass: Record<SemanticTone, string> = {
  success: 'erp-status-label-success',
  warning: 'erp-status-label-warning',
  danger: 'erp-status-label-danger',
  info: 'erp-status-label-info',
}

interface SemanticStatusProps {
  tone: SemanticTone
  variant?: SemanticVariant
  children?: ReactNode
  className?: string
}

/** Semantic status chip — soft/fg (default) or solid */
export function SemanticStatus({ tone, variant = 'soft', children, className }: SemanticStatusProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-3 py-2 text-[13px] font-semibold',
        variant === 'solid' ? solidClass[tone] : softClass[tone],
        className,
      )}
    >
      {children ?? (variant === 'solid' ? 'solid' : 'soft / fg')}
    </span>
  )
}

interface SemanticStatusGridProps {
  className?: string
}

/** Design-spec preview: Success, Warning, Danger, Info × solid & soft/fg */
export function SemanticStatusGrid({ className }: SemanticStatusGridProps) {
  const tones: SemanticTone[] = ['success', 'warning', 'danger', 'info']

  return (
    <div className={cn('rounded-erp border border-erp-border bg-erp-surface p-5 shadow-erp', className)}>
      <div className="mb-4">
        <h3 className="text-[15px] font-semibold text-erp-text">Semantic — Status</h3>
        <p className="text-[13px] text-erp-muted">Success, warning, danger, info as soft / fg / solid.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tones.map((tone) => (
          <div key={tone} className="space-y-2">
            <p className={cn('text-[11px] font-bold uppercase tracking-wider', labelClass[tone])}>
              {toneLabel[tone]}
            </p>
            <SemanticStatus tone={tone} variant="solid" className="w-full justify-center py-2.5" />
            <SemanticStatus tone={tone} variant="soft" className="w-full justify-center py-2.5" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function semanticToneFromSeverity(severity: 'green' | 'amber' | 'red'): SemanticTone {
  if (severity === 'green') return 'success'
  if (severity === 'amber') return 'warning'
  return 'danger'
}
