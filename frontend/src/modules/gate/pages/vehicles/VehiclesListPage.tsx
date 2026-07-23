import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, Plus, RefreshCw, ShieldOff, Truck } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { TableLink } from '@/components/ui/AppLink'
import { formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../../api/gateService'
import type { GateVehicle, GateVehicleStatus } from '../../types/gate.types'
import { todayIsoDate } from '../../utils/gateStatus'
import { exportGateCsv } from '../../utils/gateExport'
import { GateDataStates, GateStatusBadge, GateTabsStrip, InsideDuration } from '../../components'
import { VehicleExitModal } from '../../components/VehicleExitModal'
import type { GateLoadState } from '../../components'
import { GATE_BREADCRUMB } from '../../gateUi'

const TABS: Array<{ id: string; label: string; statuses?: GateVehicleStatus[] }> = [
  { id: 'all', label: 'All Vehicles' },
  { id: 'expected', label: 'Expected', statuses: ['expected'] },
  { id: 'at_gate', label: 'At Gate', statuses: ['arrived', 'waiting'] },
  { id: 'inside', label: 'Inside', statuses: ['allowed_inside', 'loading', 'unloading', 'ready_exit'] },
  { id: 'loading', label: 'Loading', statuses: ['loading'] },
  { id: 'unloading', label: 'Unloading', statuses: ['unloading'] },
  { id: 'ready_exit', label: 'Ready for Exit', statuses: ['ready_exit'] },
  { id: 'exited', label: 'Exited', statuses: ['exited'] },
]

export function VehiclesListPage({ initialTab }: { initialTab?: string }) {
  const navigate = useNavigate()
  const perms = useGatePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? initialTab ?? 'all'
  const search = searchParams.get('q') ?? ''

  const setParam = useCallback(
    (key: string, value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value) next.set(key, value)
          else next.delete(key)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const [rows, setRows] = useState<GateVehicle[]>([])
  const [state, setState] = useState<GateLoadState>('loading')
  const [error, setError] = useState('')
  const [exitVehicle, setExitVehicle] = useState<GateVehicle | null>(null)

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    try {
      const all = await gateService.getVehicles({ search: search || undefined })
      const activeTab = TABS.find((t) => t.id === tab)
      const filtered = activeTab?.statuses ? all.filter((v) => activeTab.statuses!.includes(v.status)) : all
      setRows(filtered)
      setState(filtered.length === 0 ? 'empty' : 'ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load vehicles')
      setState('error')
    }
  }, [tab, search])

  useEffect(() => {
    void load()
  }, [load])

  const exportCsv = () => {
    exportGateCsv(
      `gate-vehicles-${todayIsoDate()}.csv`,
      ['Vehicle No.', 'Type', 'Purpose', 'Company', 'Driver', 'Entry Time', 'Current Location', 'Status'],
      rows.map((v) => [
        v.vehicleNumber, v.vehicleType, v.purpose, v.companyName ?? '', v.driverName,
        v.entryTime ? formatDateTime(v.entryTime) : '', v.currentLocation ?? '', v.status,
      ]),
    )
    notify.success('Vehicle register exported.')
  }

  if (!perms.canViewVehicle) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="Vehicles" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view vehicle records." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title="Vehicle Management"
      description="Every vehicle from gate arrival to verified exit."
      showDescription
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Vehicles' }]}
      favoritePath="/gate/vehicles"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateVehicle
              ? { id: 'new', label: 'New Vehicle Entry', icon: Plus, variant: 'primary', onClick: () => navigate('/gate/vehicles/new') }
              : undefined
          }
          secondaryActions={[
            { id: 'export', label: 'Export CSV', icon: Download, onClick: exportCsv, disabled: rows.length === 0 },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <GateTabsStrip tabs={TABS.map((t) => ({ id: t.id, label: t.label }))} active={tab} onChange={(id) => setParam('tab', id === 'all' ? '' : id)} />
      <div className="flex flex-wrap items-center gap-2 border-b border-erp-border bg-white px-3 py-2">
        <SearchInput value={search} onChange={(v) => setParam('q', v)} placeholder="Search vehicle no., driver, company, document…" className="w-72" aria-label="Search vehicles" />
      </div>

      <div className="p-3">
        <GateDataStates
          state={state}
          error={error}
          onRetry={() => void load()}
          emptyIcon={Truck}
          emptyTitle="No vehicles for this filter"
          emptyDescription="Vehicles appear here as they are registered at the gate."
          emptyAction={
            perms.canCreateVehicle ? (
              <ErpButton size="sm" onClick={() => navigate('/gate/vehicles/new')}>
                New Vehicle Entry
              </ErpButton>
            ) : undefined
          }
        >
          <EnterpriseRegisterTableShell>
            <table className="erp-table w-full text-[12.5px]">
              <thead>
                <tr>
                  <th>Vehicle No.</th>
                  <th>Vehicle Type</th>
                  <th>Purpose</th>
                  <th>Vendor / Customer</th>
                  <th>Driver</th>
                  <th>Entry Time</th>
                  <th>Current Location</th>
                  <th>Waiting Time</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id}>
                    <td className="font-medium tabular-nums">
                      <TableLink to={`/gate/vehicles/${v.id}`}>{v.vehicleNumber}</TableLink>
                    </td>
                    <td>{v.vehicleType}</td>
                    <td className="max-w-[180px] truncate">{v.purpose}</td>
                    <td className="max-w-[160px] truncate">{v.companyName ?? '—'}</td>
                    <td>{v.driverName}</td>
                    <td className="whitespace-nowrap">{v.entryTime ? formatDateTime(v.entryTime) : '—'}</td>
                    <td>{v.currentLocation ?? '—'}</td>
                    <td>
                      {v.status === 'exited' ? (
                        <InsideDuration from={v.entryTime} to={v.exitTime} />
                      ) : (
                        <InsideDuration from={v.entryTime ?? (v.status === 'expected' ? null : v.createdAt)} warnAfterMinutes={30} />
                      )}
                    </td>
                    <td>
                      <GateStatusBadge status={v.status} />
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <ErpButton size="sm" variant="ghost" onClick={() => navigate(`/gate/vehicles/${v.id}`)}>
                          View
                        </ErpButton>
                        {perms.canVehicleExit && ['allowed_inside', 'loading', 'unloading', 'ready_exit'].includes(v.status) ? (
                          <ErpButton size="sm" variant="outline" onClick={() => setExitVehicle(v)}>
                            Exit
                          </ErpButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </EnterpriseRegisterTableShell>
        </GateDataStates>
      </div>

      <VehicleExitModal vehicle={exitVehicle} onClose={() => setExitVehicle(null)} onDone={() => void load()} />
    </OperationalPageShell>
  )
}
