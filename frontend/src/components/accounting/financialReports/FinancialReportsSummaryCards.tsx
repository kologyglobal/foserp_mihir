import type { ReactNode } from 'react'
import { EnterpriseKpiStrip } from '@/design-system/enterprise/EnterpriseKpiStrip'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'

export function FinancialReportsSummaryCards({
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

export function FinancialReportEmptyState({
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
