import { LiveAlertStrip } from './LiveAlertStrip'
import { NextBestActionPanel } from './NextBestActionPanel'
import { DocumentHealthBadge } from './DocumentHealthBadge'
import { LiveActivityPanel } from './LiveActivityPanel'
import { LiveStatusLabel } from './LiveStatusLabel'
import type { DocumentHealth, LiveAlert, LiveActivityEvent, NextBestAction } from './types'

type Props = {
  health?: DocumentHealth
  healthTitle?: string
  statusMessage?: string
  statusVariant?: 'neutral' | 'warning' | 'danger' | 'success'
  alerts?: LiveAlert[]
  nextActions?: NextBestAction[]
  activity?: LiveActivityEvent[]
}

/** Sidebar rail for document detail pages — health, alerts, next actions, activity */
export function DocumentLiveRail({
  health,
  healthTitle,
  statusMessage,
  statusVariant = 'neutral',
  alerts,
  nextActions,
  activity,
}: Props) {
  const hasContent =
    health ||
    statusMessage ||
    (alerts && alerts.length > 0) ||
    (nextActions && nextActions.length > 0) ||
    (activity && activity.length > 0)
  if (!hasContent) return null

  return (
    <div className="space-y-3">
      {health && <DocumentHealthBadge health={health} title={healthTitle} />}
      {statusMessage && <LiveStatusLabel message={statusMessage} variant={statusVariant} />}
      {alerts && alerts.length > 0 && <LiveAlertStrip alerts={alerts} />}
      {nextActions && nextActions.length > 0 && (
        <NextBestActionPanel actions={nextActions} title="Next Best Actions" compact />
      )}
      {activity && activity.length > 0 && (
        <LiveActivityPanel events={activity} title="Recent Activity" maxItems={6} />
      )}
    </div>
  )
}
