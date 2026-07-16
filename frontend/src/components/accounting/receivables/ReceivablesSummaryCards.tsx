import type { ReactNode } from 'react'
import { EnterpriseKpiStrip } from '@/design-system/enterprise/EnterpriseKpiStrip'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'

export function ReceivablesSummaryCards({
  items,
  activeId,
}: {
  items: EnterpriseKpiItem[]
  activeId?: string | null
}) {
  const withActive = items.map((item) => ({
    ...item,
    active: activeId ? item.id === activeId : item.active,
  }))
  return <EnterpriseKpiStrip items={withActive} />
}

export function ReceivableEmptyState({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <p className="text-[15px] font-semibold text-erp-text">{title}</p>
      {description ? <p className="max-w-md text-[13px] text-erp-muted">{description}</p> : null}
      {actions ? <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function CreditUtilizationBar({
  used,
  limit,
}: {
  used: number
  limit: number
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const tone = pct >= 100 ? 'bg-rose-500' : pct >= 85 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="min-w-[120px]" title={`${pct}% utilized`}>
      <div className="mb-0.5 flex justify-between gap-2 text-[10px] text-erp-muted">
        <span>{pct}%</span>
        <span className="tabular-nums">
          {limit > 0 ? `${pct}% of limit` : 'No limit'}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Credit utilization">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
