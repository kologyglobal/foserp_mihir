import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClipboardList, Factory, PackageCheck, Wrench } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { DynamicsDashboardGrid, DynamicsDashboardPanel } from '@/components/dynamics'
import { getManufacturingDashboard } from '@/services/manufacturing'
import type { ManufacturingDashboard } from '@/types/manufacturing'
import { formatDate } from '@/utils/dates/format'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'

type LoadState = 'loading' | 'ready' | 'error'

function SectionList({
  title,
  rows,
}: {
  title: string
  rows: ManufacturingDashboard['attentionWorkOrders']
}) {
  return (
    <DynamicsDashboardPanel title={title}>
      {rows.length === 0 ? (
        <p className="text-[13px] text-erp-muted">No items.</p>
      ) : (
        <ul className="divide-y divide-erp-border">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                to={row.href}
                className="flex items-start justify-between gap-3 py-2.5 text-left hover:bg-erp-surface-hover/60"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-erp-text">{row.title}</div>
                  <div className="text-[12px] text-erp-muted">{row.subtitle}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[11px] font-medium text-erp-text">{row.status}</div>
                  {row.dueDate ? (
                    <div className="text-[11px] text-erp-muted">{formatDate(row.dueDate)}</div>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DynamicsDashboardPanel>
  )
}

export function ManufacturingDashboardPage() {
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [data, setData] = useState<ManufacturingDashboard | null>(null)

  useEffect(() => {
    let cancelled = false
    getManufacturingDashboard()
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setLoadState('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const accentMap = {
    primary: 'blue',
    success: 'green',
    warning: 'amber',
    danger: 'red',
    neutral: 'slate',
  } as const

  const kpiItems =
    data?.kpis.map((k) => ({
      id: k.id,
      label: k.label,
      value: k.value,
      accent: accentMap[k.tone] ?? 'slate',
      onClick: () => navigate(k.href),
    })) ?? []

  if (!perms.canViewDashboard) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" title="Manufacturing & Production">
        <p className="text-sm text-erp-muted">You do not have permission to view the manufacturing dashboard.</p>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title="Manufacturing & Production"
      description="Plan production, monitor work orders and complete manufacturing with minimum data entry."
      breadcrumbs={[{ label: 'Manufacturing & Production', to: '/manufacturing' }]}
      autoBreadcrumbs={false}
      favoritePath="/manufacturing"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'plan',
            label: 'Production Plan',
            onClick: () => navigate('/manufacturing/production-plan'),
          }}
          secondaryActions={[
            { id: 'bom', label: 'BOM', onClick: () => navigate('/manufacturing/bom') },
            { id: 'wo', label: 'Work Orders', onClick: () => navigate('/manufacturing/work-orders') },
          ]}
        />
      )}
      kpiStrip={loadState === 'ready' && data ? kpiItems : undefined}
    >
      {loadState === 'loading' ? <LoadingState variant="dashboard" /> : null}
      {loadState === 'error' ? (
        <p className="text-sm text-red-600">Unable to load manufacturing dashboard.</p>
      ) : null}

      {loadState === 'ready' && data ? (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {[
              { label: 'New Work Order', icon: Wrench, href: '/manufacturing/work-orders/new' },
              { label: 'Production Plan', icon: ClipboardList, href: '/manufacturing/production-plan' },
              { label: 'Complete Production', icon: PackageCheck, href: '/manufacturing/work-orders' },
              { label: 'New Job Work', icon: Factory, href: '/manufacturing/job-work' },
            ].map((action) => (
              <button
                key={action.label}
                type="button"
                className="erp-btn erp-btn-secondary inline-flex h-9 items-center gap-2 px-3 text-[13px]"
                onClick={() => navigate(action.href)}
              >
                <action.icon className="h-4 w-4" aria-hidden />
                {action.label}
              </button>
            ))}
          </div>

          <DynamicsDashboardGrid>
            <SectionList title="Work Orders Requiring Attention" rows={data.attentionWorkOrders} />
            <SectionList title="Material Shortages" rows={data.materialShortages} />
            <SectionList title="Recent Production" rows={data.recentProduction} />
            <SectionList title="Production Due Today" rows={data.dueToday} />
            <SectionList title="Job Work Due" rows={data.jobWorkDue} />
            <SectionList title="Delayed Orders" rows={data.delayedOrders} />
          </DynamicsDashboardGrid>
        </>
      ) : null}
    </OperationalPageShell>
  )
}
