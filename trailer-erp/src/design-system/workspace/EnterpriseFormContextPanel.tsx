import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface EnterpriseQuickAction {
  id: string
  label: string
  icon: LucideIcon
  onClick?: () => void
  disabled?: boolean
  primary?: boolean
}

export function EnterpriseFormContextPanel({
  summaryTitle = 'Lead Summary',
  actionsTitle = 'Quick Actions',
  summary,
  actions = [],
  className,
}: {
  summaryTitle?: string
  actionsTitle?: string
  summary: { label: string; value: ReactNode; highlight?: boolean }[]
  actions?: EnterpriseQuickAction[]
  className?: string
}) {
  return (
    <div className={cn('ent-ws-context', className)}>
      <div className="ent-ws-context__block">
        <p className="ent-ws-context__title">{summaryTitle}</p>
        <dl className="ent-ws-context__summary">
          {summary.map((item) => (
            <div key={item.label} className="ent-ws-context__row">
              <dt>{item.label}</dt>
              <dd className={cn('ent-ws-context__value', item.highlight && 'ent-ws-context__value--highlight')}>
                {item.value || '—'}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {actions.length > 0 ? (
        <div className="ent-ws-context__block ent-ws-context__block--actions">
          <p className="ent-ws-context__title">{actionsTitle}</p>
          <div className="ent-ws-context__actions">
            {actions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.id}
                  type="button"
                  className={cn(
                    'ent-ws-context__action',
                    action.primary && 'ent-ws-context__action--primary',
                  )}
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  <span className="ent-ws-context__action-icon" aria-hidden>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="ent-ws-context__action-label">{action.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
