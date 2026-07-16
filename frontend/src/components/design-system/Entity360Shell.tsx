import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Pencil } from 'lucide-react'
import { OperationalPageShell } from './OperationalPageShell'
import { DocumentLayout, FactBoxPanel, FastTabs } from './FactBox'
import { WorkspaceSection } from './WorkspaceLayout'
import { ActivityFeed } from './Timeline'
import { Button } from '../ui/Button'
import type { PageInsight } from './PageInsightsStrip'
import type { LiveAlert } from '../live-erp/types'
import { ErpValidationSummary } from '../erp/ErpValidationSummary'

export interface Entity360Tab {
  id: string
  label: string
  count?: number
}

interface Entity360ShellProps {
  title: string
  subtitle: string
  description?: string
  badge?: string
  backTo: string
  backLabel?: string
  editTo?: string
  editLabel?: string
  lockedReason?: string
  favoritePath?: string
  liveAlerts?: LiveAlert[]
  insights: PageInsight[]
  commandBar?: ReactNode
  tabs: Entity360Tab[]
  activeTab: string
  onTabChange: (id: string) => void
  children: ReactNode
  factBoxes?: ReactNode
  activity?: { id: string; title: string; meta: string; time: string }[]
  quickActions?: ReactNode
}

export function Entity360Shell({
  title,
  subtitle,
  description,
  badge = '360 View',
  backTo,
  backLabel = 'Back to register',
  editTo,
  editLabel = 'Edit',
  lockedReason,
  favoritePath,
  liveAlerts,
  insights,
  commandBar,
  tabs,
  activeTab,
  onTabChange,
  children,
  factBoxes,
  activity = [],
  quickActions,
}: Entity360ShellProps) {
  return (
    <OperationalPageShell
      title={title}
      description={description ?? subtitle}
      badge={badge}
      favoritePath={favoritePath}
      liveAlerts={liveAlerts}
      insights={insights}
      commandBar={commandBar}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to={backTo}>
            <Button variant="secondary" size="sm">
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Button>
          </Link>
          {editTo && !lockedReason && (
            <Link to={editTo}>
              <Button variant="secondary" size="sm">
                <Pencil className="h-4 w-4" />
                {editLabel}
              </Button>
            </Link>
          )}
        </div>
      }
    >
      <p className="-mt-2 mb-4 font-mono text-[13px] text-erp-muted">{subtitle}</p>

      {lockedReason ? (
        <div className="mb-4">
          <ErpValidationSummary lockedReason={lockedReason} />
        </div>
      ) : null}

      {quickActions && (
        <WorkspaceSection title="Quick Actions" className="mb-4">
          {quickActions}
        </WorkspaceSection>
      )}

      <DocumentLayout
        main={
          <div className="space-y-4">
            <FastTabs tabs={tabs} active={activeTab} onChange={onTabChange} />
            {children}
          </div>
        }
        factBoxes={
          <div className="space-y-3">
            {factBoxes}
            <aside className="erp-factbox">
              <div className="erp-factbox-header">
                <span className="text-[13px] font-semibold text-erp-text">Activity Feed</span>
              </div>
              <div className="erp-factbox-body px-2 pb-3">
                <ActivityFeed items={activity} emptyMessage="No recent activity for this entity" />
              </div>
            </aside>
          </div>
        }
      />
    </OperationalPageShell>
  )
}

export function Entity360Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-erp border border-erp-border bg-erp-surface shadow-erp">
      <table className="erp-table">{children}</table>
    </div>
  )
}

export function Entity360Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <WorkspaceSection title={title} subtitle={subtitle} noPadding>
      {children}
    </WorkspaceSection>
  )
}

export function Entity360FactRail({ children }: { children: ReactNode }) {
  return <FactBoxPanel>{children}</FactBoxPanel>
}
