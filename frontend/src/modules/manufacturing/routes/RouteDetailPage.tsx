import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Power, PowerOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ManufacturingDemoBanner } from '@/components/manufacturing'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Route as RouteIcon } from 'lucide-react'
import {
  activateManufacturingRoute,
  deactivateManufacturingRoute,
  getManufacturingRouteById,
} from '@/services/manufacturing'
import type { ManufacturingRoute } from '@/types/manufacturingRoute'
import { QTY_BASIS_LABELS, ROUTE_STATUS_LABELS } from '@/types/manufacturingRoute'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'

export function RouteDetailPage() {
  const { routeId } = useParams()
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const [route, setRoute] = useState<ManufacturingRoute | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!routeId) return
    setLoading(true)
    const r = await getManufacturingRouteById(routeId)
    setRoute(r)
    setLoading(false)
  }, [routeId])

  useEffect(() => { void load() }, [load])

  if (!perms.canViewRoute) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Manufacturing" title="Route">
        <EmptyState icon={RouteIcon} title="Access denied" />
      </OperationalPageShell>
    )
  }

  if (loading || !route) return <LoadingState variant="card" />

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title={route.routeNo}
      description={`${route.routeName} · ${route.finishedItemCode}`}
      breadcrumbs={[
        { label: 'Manufacturing', to: '/manufacturing' },
        { label: 'Routes', to: '/manufacturing/routes' },
        { label: route.routeNo },
      ]}
      autoBreadcrumbs={false}
      favoritePath={`/manufacturing/routes/${route.id}`}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canEditRoute
              ? { id: 'edit', label: 'Edit', icon: Pencil, onClick: () => navigate(`/manufacturing/routes/${route.id}/edit`) }
              : undefined
          }
          secondaryActions={[
            ...(perms.canActivateRoute
              ? [{
                  id: 'toggle',
                  label: route.status === 'active' ? 'Deactivate' : 'Activate',
                  icon: route.status === 'active' ? PowerOff : Power,
                  onClick: () => void (async () => {
                    setBusy(true)
                    const r = route.status === 'active'
                      ? await deactivateManufacturingRoute(route.id)
                      : await activateManufacturingRoute(route.id)
                    setBusy(false)
                    if (!r.ok) notify.error(r.error ?? 'Failed')
                    else { notify.success('Updated'); void load() }
                  }),
                  disabled: busy,
                }]
              : []),
            { id: 'back', label: 'Back', onClick: () => navigate('/manufacturing/routes') },
          ]}
        />
      )}
    >
      <ManufacturingDemoBanner message="This is the reusable template. New Work Orders for this item snapshot these stages. Existing WOs keep their original copy if you edit this master later." />
      <div className="mb-4 grid gap-3 rounded-xl border border-erp-border bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-[11px] uppercase text-erp-muted">Status</div>
          <StatusDot tone={statusToneFromLabel(route.status)} label={ROUTE_STATUS_LABELS[route.status]} />
        </div>
        <div>
          <div className="text-[11px] uppercase text-erp-muted">Version</div>
          <div className="font-medium">{route.version}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-erp-muted">Default BOM</div>
          <div className="font-medium">{route.defaultBomNumber || '—'}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-erp-muted">Finished Item</div>
          <div className="font-medium">{route.finishedItemCode}</div>
        </div>
      </div>
      {route.remarks ? <p className="mb-3 text-[13px] text-erp-muted">{route.remarks}</p> : null}

      <h3 className="mb-2 text-sm font-semibold">Operations</h3>
      <ol className="space-y-2">
        {[...route.operations].sort((a, b) => a.sequenceNo - b.sequenceNo).map((op) => (
          <li key={op.id} className="rounded-xl border border-erp-border bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[15px] font-semibold text-erp-text">
                <span className="text-erp-muted">{op.sequenceNo}.</span> {op.operationName}
              </p>
              <p className="text-[12px] text-erp-muted">{op.workCenter} · {op.plannedTimeMinutes} min</p>
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
              {op.qcRequired ? <span className="rounded-full bg-violet-50 px-2 py-0.5 font-semibold text-violet-800 ring-1 ring-violet-200">QC</span> : null}
              {op.jobWorkRequired ? <span className="rounded-full bg-teal-50 px-2 py-0.5 font-semibold text-teal-800 ring-1 ring-teal-200">Job Work{op.defaultVendorName ? ` · ${op.defaultVendorName}` : ''}</span> : null}
              <span className="text-erp-muted">In {QTY_BASIS_LABELS[op.inputQtyBasis]} · Out {QTY_BASIS_LABELS[op.outputQtyBasis]}</span>
            </div>
          </li>
        ))}
      </ol>
    </OperationalPageShell>
  )
}
