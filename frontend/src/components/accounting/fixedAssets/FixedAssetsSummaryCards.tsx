import type { ReactNode } from 'react'
import { Info, Wifi } from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'
import { EnterpriseKpiStrip } from '@/design-system/enterprise/EnterpriseKpiStrip'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'

export function FixedAssetsSummaryCards({
  items,
  activeId,
  columns,
}: {
  items: EnterpriseKpiItem[]
  activeId?: string | null
  columns?: number
}) {
  const withActive = items.map((item) => ({
    ...item,
    active: activeId ? item.id === activeId : item.active,
  }))
  return <EnterpriseKpiStrip items={withActive} columns={columns} />
}

export function FixedAssetsEmptyState({
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

export function FixedAssetsDemoBanner({
  message,
  variant = 'auto',
}: {
  message?: string
  /** auto: live when API mode on live surfaces, else demo */
  variant?: 'auto' | 'demo' | 'live' | 'partial'
}) {
  const resolved =
    variant === 'auto'
      ? isApiMode()
        ? 'live'
        : 'demo'
      : variant === 'live' && !isApiMode()
        ? 'demo'
        : variant

  if (resolved === 'live') {
    return (
      <div className="mb-3 flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-950">
        <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-700" aria-hidden />
        <span>
          {message ?? (
            <>
              <span className="font-semibold">Connected to live Fixed Assets API.</span> Overview, register,
              categories, depreciation, and capitalization on asset detail use backend data.
            </>
          )}
        </span>
      </div>
    )
  }

  if (resolved === 'partial') {
    return (
      <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          {message ?? (
            <>
              <span className="font-semibold">Still demo on this screen.</span> Phase 1 live surfaces are
              overview, register, categories, depreciation, and capitalize on asset detail.
            </>
          )}
        </span>
      </div>
    )
  }

  return (
    <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        {message ??
          'Balances and depreciation shown are frontend demo data. Fixed asset postings are not connected to the live ledger.'}
      </span>
    </div>
  )
}
