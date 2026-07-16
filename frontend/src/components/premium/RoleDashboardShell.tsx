import type { ReactNode } from 'react'
import { CommandCenterHeader, type CommandCenterMetric } from './CommandCenterHeader'
import { NextActionPanel } from './NextActionPanel'

export function RoleDashboardShell({
  title,
  subtitle,
  healthScore,
  metrics,
  actions,
  children,
  showNextActions = true,
}: {
  title: string
  subtitle?: string
  healthScore?: number
  metrics: CommandCenterMetric[]
  actions?: ReactNode
  children?: ReactNode
  showNextActions?: boolean
}) {
  return (
    <div className="space-y-6">
      <CommandCenterHeader title={title} subtitle={subtitle} healthScore={healthScore} metrics={metrics} actions={actions} />
      {showNextActions && <NextActionPanel />}
      {children}
    </div>
  )
}
