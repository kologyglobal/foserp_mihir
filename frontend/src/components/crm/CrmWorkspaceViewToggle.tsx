import type { LucideIcon } from 'lucide-react'

export type CrmWorkspaceViewTab<T extends string = string> = {
  id: T
  label: string
  icon: LucideIcon
}

/** Pill strip matching Opportunity Pipeline (List / Follow-ups / Activities, etc.). */
export function CrmWorkspaceViewToggle<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel = 'Workspace view',
}: {
  tabs: readonly CrmWorkspaceViewTab<T>[]
  value: T
  onChange: (next: T) => void
  ariaLabel?: string
}) {
  return (
    <div className="crm-opp-view-toggle" role="group" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={value === tab.id}
            title={tab.label}
            onClick={() => onChange(tab.id)}
          >
            <Icon className="crm-opp-view-toggle__icon" aria-hidden />
            <span className="crm-opp-view-toggle__label">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
