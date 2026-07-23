import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarClock,
  PackageX,
  Plus,
  RefreshCw,
  ScanLine,
  ShieldOff,
  Truck,
  Users,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableLink } from '@/components/ui/AppLink'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { formatDateTime } from '@/utils/dates/format'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService, isGateDemoFallbackActive } from '../api/gateService'
import type { GateActivity, GateDashboardSummary, GateVehicle, VisitorVisit } from '../types/gate.types'
import {
  GateActivityTimeline,
  GateBoundaryBanner,
  GateDataStates,
  GateModal,
  GatePulseCard,
  GateQuickEntryDrawer,
  GateStatusBadge,
  InsideDuration,
} from '../components'
import { VisitorExitModal } from '../components/VisitorExitModal'
import { VehicleExitModal } from '../components/VehicleExitModal'
import type { GateLoadState } from '../components'

export function GateDashboardPage() {
  const navigate = useNavigate()
  const perms = useGatePermissions()
  const [summary, setSummary] = useState<GateDashboardSummary | null>(null)
  const [activities, setActivities] = useState<GateActivity[]>([])
  const [visitorsInside, setVisitorsInside] = useState<VisitorVisit[]>([])
  const [vehicles, setVehicles] = useState<GateVehicle[]>([])
  const [state, setState] = useState<GateLoadState>('loading')
  const [error, setError] = useState('')
  const [entryDrawerOpen, setEntryDrawerOpen] = useState(false)
  const [scanDialogOpen, setScanDialogOpen] = useState(false)
  const [exitVisitor, setExitVisitor] = useState<VisitorVisit | null>(null)
  const [exitVehicle, setExitVehicle] = useState<GateVehicle | null>(null)

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    try {
      const [dash, acts, insideVisitors, allVehicles] = await Promise.all([
        gateService.getGateDashboard(),
        gateService.getGateActivities(20),
        gateService.getVisitors({ status: 'inside' }),
        gateService.getVehicles(),
      ])
      setSummary(dash)
      setActivities(acts)
      setVisitorsInside(insideVisitors)
      setVehicles(allVehicles)
      setState('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load gate dashboard')
      setState('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const vehiclesInside = vehicles.filter((v) =>
    ['allowed_inside', 'loading', 'unloading', 'ready_exit', 'arrived', 'waiting'].includes(v.status),
  )

  const kpis: EnterpriseKpiItem[] = summary
    ? [
        { id: 'visitors-inside', label: 'Visitors Inside', value: summary.visitorsInside, icon: Users, accent: 'green', onClick: () => navigate('/gate/visitors/inside') },
        { id: 'vehicles-inside', label: 'Vehicles Inside', value: summary.vehiclesInside, icon: Truck, accent: 'blue', onClick: () => navigate('/gate/vehicles/inside') },
        { id: 'expected-today', label: 'Expected Visitors Today', value: summary.expectedVisitorsToday, icon: CalendarClock, accent: 'slate', onClick: () => navigate('/gate/visitors/expected') },
        { id: 'inward-waiting', label: 'Material Inward Waiting', value: summary.materialInwardWaiting, icon: ArrowDownToLine, accent: 'amber', onClick: () => navigate('/gate/material-inward') },
        { id: 'outward-awaiting', label: 'Outward Awaiting Release', value: summary.outwardAwaitingRelease, icon: ArrowUpFromLine, accent: 'amber', onClick: () => navigate('/gate/material-outward') },
        { id: 'overdue-returnables', label: 'Overdue Returnables', value: summary.overdueReturnables, icon: PackageX, accent: summary.overdueReturnables > 0 ? 'red' : 'slate', onClick: () => navigate('/gate/passes/overdue') },
      ]
    : []

  if (!perms.canViewDashboard) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="Gate & Security" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view the gate dashboard." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title="Gate & Security"
      description="Track visitors, vehicles and material movement at the factory gate."
      showDescription
      autoBreadcrumbs={false}
      breadcrumbs={[{ label: 'Gate & Security' }]}
      favoritePath="/gate"
      kpiStrip={kpis}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{ id: 'new-entry', label: 'New Gate Entry', icon: Plus, variant: 'primary', onClick: () => setEntryDrawerOpen(true) }}
          secondaryActions={[
            { id: 'scan', label: 'Scan Pass', icon: ScanLine, onClick: () => setScanDialogOpen(true) },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <div className="space-y-3 p-4">
        {isGateDemoFallbackActive() ? (
          <GateBoundaryBanner message="Gate & Security is using the local demo store (API mode for other modules is unchanged). Gate data is not written to MySQL until the live /gate API is enabled on a backend that includes the Gate module." />
        ) : null}
        <GateDataStates state={state} error={error} onRetry={() => void load()} loadingVariant="dashboard">
          <div className="grid gap-3 xl:grid-cols-3">
            <GatePulseCard messages={summary?.pulse ?? []} />
            <section className="rounded-md border border-erp-border bg-white xl:col-span-2">
              <header className="flex items-center justify-between border-b border-erp-border px-4 py-2.5">
                <h3 className="text-[13px] font-semibold text-erp-text">Live Activity</h3>
                <TableLink to="/gate/register">Open Today's Register</TableLink>
              </header>
              <div className="max-h-[340px] overflow-y-auto">
                <GateActivityTimeline activities={activities} />
              </div>
            </section>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {/* Currently inside — visitors */}
            <section className="rounded-md border border-erp-border bg-white">
              <header className="flex items-center justify-between border-b border-erp-border px-4 py-2.5">
                <h3 className="text-[13px] font-semibold text-erp-text">Visitors Currently Inside</h3>
                <TableLink to="/gate/visitors/inside">View all</TableLink>
              </header>
              {visitorsInside.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-erp-muted">No visitors are inside right now.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="erp-table w-full text-[12.5px]">
                    <thead>
                      <tr>
                        <th>Pass No.</th>
                        <th>Visitor</th>
                        <th>Company</th>
                        <th>Host</th>
                        <th>Entry Time</th>
                        <th>Duration</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visitorsInside.slice(0, 8).map((v) => (
                        <tr key={v.id}>
                          <td className="tabular-nums">
                            <TableLink to={`/gate/visitors/${v.id}`}>{v.entryNumber}</TableLink>
                          </td>
                          <td className="font-medium">{v.visitorName}</td>
                          <td>{v.company ?? '—'}</td>
                          <td>{v.hostName}</td>
                          <td>{v.entryTime ? formatDateTime(v.entryTime) : '—'}</td>
                          <td>
                            <InsideDuration from={v.entryTime} warnAfterMinutes={240} />
                          </td>
                          <td>
                            <GateStatusBadge status={v.status} />
                          </td>
                          <td>
                            {perms.canVisitorExit ? (
                              <ErpButton size="sm" variant="outline" onClick={() => setExitVisitor(v)}>
                                Record Exit
                              </ErpButton>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Currently inside — vehicles */}
            <section className="rounded-md border border-erp-border bg-white">
              <header className="flex items-center justify-between border-b border-erp-border px-4 py-2.5">
                <h3 className="text-[13px] font-semibold text-erp-text">Vehicles At Gate / Inside</h3>
                <TableLink to="/gate/vehicles/inside">View all</TableLink>
              </header>
              {vehiclesInside.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-erp-muted">No vehicles at the gate or inside.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="erp-table w-full text-[12.5px]">
                    <thead>
                      <tr>
                        <th>Vehicle No.</th>
                        <th>Purpose</th>
                        <th>Company</th>
                        <th>Driver</th>
                        <th>Entry Time</th>
                        <th>Waiting</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehiclesInside.slice(0, 8).map((v) => (
                        <tr key={v.id}>
                          <td className="font-medium tabular-nums">
                            <TableLink to={`/gate/vehicles/${v.id}`}>{v.vehicleNumber}</TableLink>
                          </td>
                          <td>{v.purpose}</td>
                          <td>{v.companyName ?? '—'}</td>
                          <td>{v.driverName}</td>
                          <td>{v.entryTime ? formatDateTime(v.entryTime) : '—'}</td>
                          <td>
                            <InsideDuration from={v.entryTime ?? v.createdAt} warnAfterMinutes={30} />
                          </td>
                          <td>
                            <GateStatusBadge status={v.status} />
                          </td>
                          <td>
                            {perms.canVehicleExit && ['ready_exit', 'allowed_inside', 'loading', 'unloading'].includes(v.status) ? (
                              <ErpButton size="sm" variant="outline" onClick={() => setExitVehicle(v)}>
                                Exit
                              </ErpButton>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </GateDataStates>
      </div>

      <GateQuickEntryDrawer open={entryDrawerOpen} onClose={() => setEntryDrawerOpen(false)} />

      <GateModal
        open={scanDialogOpen}
        onClose={() => setScanDialogOpen(false)}
        title="Scan Pass"
        footer={
          <div className="flex justify-end">
            <ErpButton variant="secondary" onClick={() => setScanDialogOpen(false)}>
              Close
            </ErpButton>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <ScanLine className="h-10 w-10 text-erp-muted" aria-hidden />
          <p className="text-[13.5px] font-medium text-erp-text">Scanner integration is not yet connected.</p>
          <p className="max-w-sm text-[12.5px] text-erp-muted">
            QR / barcode scanning of visitor passes and gate passes will be enabled once the scanner hardware
            integration ships. Until then, search records from the register or the relevant list page.
          </p>
        </div>
      </GateModal>

      <VisitorExitModal
        visit={exitVisitor}
        onClose={() => setExitVisitor(null)}
        onDone={() => {
          void load()
        }}
      />
      <VehicleExitModal
        vehicle={exitVehicle}
        onClose={() => setExitVehicle(null)}
        onDone={() => {
          void load()
        }}
      />
    </OperationalPageShell>
  )
}
