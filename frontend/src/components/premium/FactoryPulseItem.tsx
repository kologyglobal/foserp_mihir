import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn'

export function FactoryPulseItem({
  label,
  detail,
  time,
  tone = 'neutral',
  href,
}: {
  label: string
  detail?: string
  time?: string
  tone?: 'live' | 'warning' | 'critical' | 'neutral'
  href?: string
}) {
  const dot =
    tone === 'live'
      ? 'bg-[var(--erp-accent)] erp-live-pulse'
      : tone === 'warning'
        ? 'bg-erp-warning-solid'
        : tone === 'critical'
          ? 'bg-erp-danger-solid'
          : 'bg-erp-muted'

  const content = (
    <>
      <span className={cn('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', dot)} />
      <div className="min-w-0 flex-1">
        <p className="erp-type-caption-strong line-clamp-2">{label}</p>
        {detail && <p className="erp-type-micro mt-0.5">{detail}</p>}
      </div>
      {time && <span className="erp-type-micro shrink-0 tabular-nums">{time}</span>}
    </>
  )

  if (href) {
    return (
      <Link to={href} className="erp-factory-pulse-row group flex items-start gap-2.5 px-3 py-2">
        {content}
      </Link>
    )
  }

  return <div className="erp-factory-pulse-row flex items-start gap-2.5 px-3 py-2">{content}</div>
}
