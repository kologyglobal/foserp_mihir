import type { ReactNode } from 'react'
import { Badge, formatStatus, statusColor } from '../ui/Badge'
import { Timeline, type TimelineEvent } from './Timeline'
import { ActivityFeed } from './Timeline'
import { cn } from '../../utils/cn'

interface DocumentHeaderProps {
  docNo: string
  docType: string
  status: string
  owner?: string
  createdDate?: string
  approvalStatus?: string
  meta?: { label: string; value: ReactNode }[]
  actions?: ReactNode
}

export function DocumentHeader({
  docNo,
  docType,
  status,
  owner,
  createdDate,
  approvalStatus,
  meta = [],
  actions,
}: DocumentHeaderProps) {
  return (
    <div className="erp-page-hero overflow-hidden">
      <div className="erp-page-hero-band">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-erp-muted">{docType}</p>
            <h1 className="erp-page-title mt-1">{docNo}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge color={statusColor(status)} dot>{formatStatus(status)}</Badge>
              {approvalStatus && (
                <Badge color={statusColor(approvalStatus)}>{formatStatus(approvalStatus)}</Badge>
              )}
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
      {(owner || createdDate || meta.length > 0) && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-4">
          {owner && (
            <>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-erp-muted">Owner</dt>
              <dd className="text-[13px] font-semibold text-erp-text">{owner}</dd>
            </>
          )}
          {createdDate && (
            <>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-erp-muted">Created</dt>
              <dd className="text-[13px] font-semibold text-erp-text">{createdDate}</dd>
            </>
          )}
          {meta.map((m) => (
            <div key={m.label} className="contents">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-erp-muted">{m.label}</dt>
              <dd className="text-[13px] font-semibold text-erp-text">{m.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

export function DocumentTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="erp-page-panel">
      <h3 className="erp-section-title mb-4">Document Timeline</h3>
      <Timeline events={events} />
    </div>
  )
}

export function DocumentActivityFeed({
  items,
}: {
  items: { id: string; title: string; meta: string; time: string }[]
}) {
  return (
    <div className="erp-page-panel">
      <h3 className="erp-section-title mb-2">Activity</h3>
      <ActivityFeed items={items} />
    </div>
  )
}

export function DocumentSection({
  title,
  subtitle,
  actions,
  children,
  noPadding,
  className,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  noPadding?: boolean
  className?: string
}) {
  return (
    <section className={cn('overflow-hidden rounded-erp border border-erp-border bg-erp-surface shadow-erp', className)}>
      <div className="flex items-start justify-between gap-3 border-b border-erp-border bg-gradient-to-r from-erp-surface-alt/80 to-erp-surface px-4 py-3">
        <div>
          <h3 className="erp-section-title">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[12px] text-erp-muted">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <div className={cn(!noPadding && 'p-4')}>{children}</div>
    </section>
  )
}
