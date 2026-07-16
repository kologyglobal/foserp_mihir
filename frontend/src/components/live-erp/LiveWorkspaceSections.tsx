import { useNavigate } from 'react-router-dom'
import { AlertCircle, Clock, Zap, ArrowRight } from 'lucide-react'
import type { LiveActivityEvent, LiveAlert, NextBestAction } from './types'
import { LiveActivityPanel } from './LiveActivityPanel'
import { NextBestActionPanel } from './NextBestActionPanel'

type Props = {
  needsAttention: LiveAlert[]
  recentlyUpdated: LiveActivityEvent[]
  nextActions: NextBestAction[]
  onAlertClick?: (alert: LiveAlert) => void
  onActivityClick?: (event: LiveActivityEvent) => void
}

export function LiveWorkspaceSections({
  needsAttention,
  recentlyUpdated,
  nextActions,
  onAlertClick,
  onActivityClick,
}: Props) {
  const navigate = useNavigate()
  const hasContent = needsAttention.length > 0 || recentlyUpdated.length > 0 || nextActions.length > 0
  if (!hasContent) return null

  const openAlert = (a: LiveAlert) => {
    if (onAlertClick) {
      onAlertClick(a)
      return
    }
    if (a.quickView && onAlertClick === undefined) {
      if (a.href) navigate(a.href)
      return
    }
    if (a.href) navigate(a.href)
  }

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-3">
      {needsAttention.length > 0 && (
        <section className="erp-bc-section lg:col-span-1">
          <div className="erp-bc-section-header flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-erp-danger" />
            <h3 className="text-sm font-semibold text-erp-text">Needs attention</h3>
            <span className="ml-auto rounded-sm bg-erp-danger-soft px-2 py-0.5 text-xs font-semibold text-erp-danger">
              {needsAttention.length}
            </span>
          </div>
          <ul className="divide-y divide-erp-border">
            {needsAttention.slice(0, 5).map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-erp-surface-alt/60"
                  onClick={() => openAlert(a)}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-erp-text">{a.message}</p>
                    {a.documentRef ? (
                      <p className="mt-0.5 text-xs text-erp-muted">{a.documentRef}</p>
                    ) : null}
                    {(a.href || a.quickView) && (
                      <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-erp-primary">
                        {a.actionLabel ?? 'View details'} <ArrowRight className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {recentlyUpdated.length > 0 && (
        <section className="erp-bc-section lg:col-span-1">
          <div className="erp-bc-section-header flex items-center gap-2">
            <Clock className="h-4 w-4 text-erp-muted" />
            <h3 className="text-sm font-semibold text-erp-text">Recently updated</h3>
          </div>
          <div className="p-2">
            <LiveActivityPanel events={recentlyUpdated} title="" maxItems={5} onItemClick={onActivityClick} />
          </div>
        </section>
      )}
      {nextActions.length > 0 && (
        <section className="erp-bc-section lg:col-span-1">
          <div className="erp-bc-section-header flex items-center gap-2">
            <Zap className="h-4 w-4 text-erp-primary" />
            <h3 className="text-sm font-semibold text-erp-text">Suggested next actions</h3>
          </div>
          <div className="p-2">
            <NextBestActionPanel actions={nextActions} compact />
          </div>
        </section>
      )}
    </div>
  )
}
