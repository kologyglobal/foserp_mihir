import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { DrilldownPreviewDrawer } from '../premium/DrilldownPreviewDrawer'
import { DynamicsStatusChip } from '../dynamics/DynamicsStatusChip'
import { ErpButton } from '../erp/ErpButton'
import type { DashboardQuickView } from '../../types/dashboardInteraction'
import { cn } from '../../utils/cn'

const BADGE_TONE: Record<NonNullable<DashboardQuickView['badgeTone']>, 'success' | 'warning' | 'critical' | 'neutral'> = {
  success: 'success',
  warning: 'warning',
  critical: 'critical',
  neutral: 'neutral',
}

export function DashboardQuickViewDrawer({
  open,
  view,
  fallbackHref,
  onClose,
}: {
  open: boolean
  view: DashboardQuickView | null
  fallbackHref?: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  if (!view) return null

  const primaryHref = view.primaryAction?.href ?? fallbackHref

  const go = (href: string) => {
    onClose()
    navigate(href)
  }

  return (
    <DrilldownPreviewDrawer open={open} title={view.title} onClose={onClose} className="max-w-lg">
      <div className="dashboard-quick-view">
        {view.subtitle ? <p className="dashboard-qv-subtitle">{view.subtitle}</p> : null}
        {view.badge ? (
          <DynamicsStatusChip label={view.badge} tone={BADGE_TONE[view.badgeTone ?? 'neutral']} />
        ) : null}

        <dl className="dashboard-qv-fields">
          {view.fields.map((f) => (
            <div key={f.label} className="dashboard-qv-field">
              <dt>{f.label}</dt>
              <dd>
                {f.href ? (
                  <Link to={f.href} className="text-erp-primary hover:underline">
                    {f.value}
                  </Link>
                ) : (
                  f.value
                )}
              </dd>
            </div>
          ))}
        </dl>

        {view.related && view.related.length > 0 ? (
          <div className="dashboard-qv-related">
            <h3 className="dashboard-qv-related-title">Related</h3>
            <ul>
              {view.related.map((r) => (
                <li key={r.href}>
                  <Link to={r.href} className="dashboard-qv-related-link">
                    <span className="dashboard-qv-related-label">{r.label}</span>
                    <span className="dashboard-qv-related-value">{r.value}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-erp-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="dashboard-qv-actions">
          {primaryHref ? (
            <ErpButton type="button" onClick={() => go(primaryHref)}>
              {view.primaryAction?.label ?? 'Open full record'}
              <ExternalLink className="ml-1.5 h-3.5 w-3.5 inline" />
            </ErpButton>
          ) : null}
          {view.secondaryAction ? (
            <ErpButton type="button" variant="secondary" onClick={() => go(view.secondaryAction!.href)}>
              {view.secondaryAction.label}
            </ErpButton>
          ) : null}
        </div>
      </div>
    </DrilldownPreviewDrawer>
  )
}

export function DashboardClickableRow({
  onClick,
  href,
  className,
  children,
}: {
  onClick?: () => void
  href?: string
  className?: string
  children: ReactNode
}) {
  const cls = cn('dashboard-clickable-row', className)
  if (href && !onClick) {
    return (
      <Link to={href} className={cls}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {children}
    </button>
  )
}
