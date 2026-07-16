import type { ReactNode } from 'react'
import { SaaSPageShell } from '../saas/SaaSPageShell'
import { CommandBar, CommandBarButton, CommandBarGroup } from '../ui/CommandBar'
import { StatCard } from '../ui/StatCard'
import type { LucideIcon } from 'lucide-react'

export interface CrmKpiTile {
  title: string
  value: string | number
  icon: LucideIcon
  accent?: 'blue' | 'green' | 'amber' | 'indigo' | 'red'
  onClick?: () => void
}

interface CrmPageShellProps {
  title: string
  subtitle?: string
  commandBar?: ReactNode
  filters?: ReactNode
  kpis?: CrmKpiTile[]
  children: ReactNode
}

export function CrmCommandBar({ children }: { children: React.ReactNode }) {
  return (
    <CommandBar>
      <CommandBarGroup label="Actions">{children}</CommandBarGroup>
    </CommandBar>
  )
}

export function CrmPageShell({ title, subtitle, commandBar, filters, kpis, children }: CrmPageShellProps) {
  return (
    <SaaSPageShell>
      <div className="erp-page space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p> : null}
          </div>
          {commandBar ? <div className="shrink-0">{commandBar}</div> : null}
        </div>
        {filters ? <div className="flex flex-wrap gap-2 items-center">{filters}</div> : null}
        {kpis && kpis.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {kpis.map((k) => (
              <StatCard
                key={k.title}
                title={k.title}
                value={k.value}
                icon={k.icon}
                accent={k.accent ?? 'blue'}
                onClick={k.onClick}
              />
            ))}
          </div>
        ) : null}
        {children}
      </div>
    </SaaSPageShell>
  )
}

export { CommandBar, CommandBarButton, CommandBarGroup }
