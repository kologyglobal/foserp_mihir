import type { ReactNode } from 'react'
import { OperationalPageShell } from '../design-system/OperationalPageShell'
import { CommandCenterHeader, type CommandCenterMetric } from './CommandCenterHeader'
import { LiveAlertStrip } from '../live-erp/LiveAlertStrip'
import { StickyCommandBar } from '../design-system/StickyCommandBar'
import { PageInsightsStrip, type PageInsight } from '../design-system/PageInsightsStrip'
import type { LiveAlert } from '../live-erp/types'

interface PremiumPageShellProps {
  title: string
  description?: string
  badge?: string
  favoritePath?: string
  commandHero?: {
    title: string
    subtitle?: string
    healthScore?: number
    metrics: CommandCenterMetric[]
    actions?: ReactNode
  }
  insights?: PageInsight[]
  liveAlerts?: LiveAlert[]
  commandBar?: ReactNode
  filterBar?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

/** Premium industrial page shell — command hero + upgraded operational layout */
export function PremiumPageShell({
  title,
  description,
  badge,
  favoritePath,
  commandHero,
  insights,
  liveAlerts,
  commandBar,
  filterBar,
  actions,
  children,
}: PremiumPageShellProps) {
  if (commandHero) {
    return (
      <div className="erp-page">
        <CommandCenterHeader
          title={commandHero.title}
          subtitle={commandHero.subtitle}
          healthScore={commandHero.healthScore}
          metrics={commandHero.metrics}
          actions={commandHero.actions}
        />
        {liveAlerts && liveAlerts.length > 0 && (
          <div className="mb-4">
            <LiveAlertStrip alerts={liveAlerts} />
          </div>
        )}
        {insights && insights.length > 0 && <PageInsightsStrip insights={insights} className="mb-4" />}
        {commandBar && <StickyCommandBar>{commandBar}</StickyCommandBar>}
        {filterBar && <div className="mb-4">{filterBar}</div>}
        {children}
      </div>
    )
  }

  return (
    <OperationalPageShell
      title={title}
      description={description}
      badge={badge}
      favoritePath={favoritePath}
      insights={insights}
      liveAlerts={liveAlerts}
      commandBar={commandBar}
      filterBar={filterBar}
      actions={actions}
    >
      {children}
    </OperationalPageShell>
  )
}
