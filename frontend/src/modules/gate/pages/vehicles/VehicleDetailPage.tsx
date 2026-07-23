import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { LogIn, LogOut, MapPin, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { appPromptNote } from '@/store/confirmDialogStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../../api/gateService'
import type { GateVehicle } from '../../types/gate.types'
import {
  GateDataStates,
  GateStatusBadge,
  InsideDuration,
  VehicleStatusTracker,
} from '../../components'
import { VehicleExitModal } from '../../components/VehicleExitModal'
import type { GateLoadState } from '../../components'
import { GATE_BREADCRUMB } from '../../gateUi'

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-[12px] text-erp-muted">{label}</dt>
      <dd className="text-[13px] font-medium text-erp-text">{value ?? '—'}</dd>
    </div>
  )
}

export function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const perms = useGatePermissions()
  const [vehicle, setVehicle] = useState<GateVehicle | null>(null)
  const [state, setState] = useState<GateLoadState>('loading')
  const [error, setError] = useState('')
  const [exitOpen, setExitOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setState('loading')
    setError('')
    try {
      setVehicle(await gateService.getVehicleById(id))
      setState('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load vehicle')
      setState('error')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (label: string, action: () => Promise<GateVehicle>) => {
    if (busy) return
    setBusy(true)
    try {
      setVehicle(await action())
      notify.success(label)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const markArrived = () => run('Vehicle marked as arrived at gate.', () => gateService.markVehicleArrived(vehicle!.id))
  const allowInside = () => run('Vehicle allowed inside.', () => gateService.allowVehicleInside(vehicle!.id))
  const markReady = () => run('Vehicle ready for exit.', () => gateService.markVehicleReadyForExit(vehicle!.id))
  const updateLocation = async () => {
    const location = await appPromptNote({
      title: 'Update vehicle location',
      description: 'Enter the current plant location (e.g. Unloading Bay 1, FG Yard).',
      confirmLabel: 'Update',
      note: { required: true, label: 'Location', rows: 1 },
    })
    if (location == null) return
    const status =
      vehicle?.status === 'allowed_inside'
        ? undefined
        : vehicle?.status === 'loading' || vehicle?.status === 'unloading'
          ? vehicle.status
          : undefined
    await run('Location updated.', () => gateService.updateVehicleLocation(vehicle!.id, location, status))
  }

  const status = vehicle?.status
  const isReadOnly = status ? ['exited', 'cancelled', 'rejected'].includes(status) : false

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title={vehicle ? `${vehicle.vehicleNumber}` : 'Vehicle'}
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Vehicles', to: '/gate/vehicles' }, { label: vehicle?.vehicleNumber ?? '…' }]}
      backLink={{ to: '/gate/vehicles', label: 'Back to Vehicles' }}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canVehicleExit && status && ['allowed_inside', 'loading', 'unloading', 'ready_exit'].includes(status)
              ? { id: 'exit', label: 'Confirm Exit', icon: LogOut, variant: 'primary', onClick: () => setExitOpen(true) }
              : perms.canVehicleEntry && status && ['arrived', 'waiting'].includes(status)
                ? { id: 'inside', label: 'Allow Inside', icon: LogIn, variant: 'primary', disabled: busy, onClick: () => void allowInside() }
                : perms.canVehicleEntry && status === 'expected'
                  ? { id: 'arrived', label: 'Mark Arrived', icon: LogIn, variant: 'primary', disabled: busy, onClick: () => void markArrived() }
                  : undefined
          }
          secondaryActions={[
            {
              id: 'ready',
              label: 'Ready for Exit',
              hidden: !perms.canEditVehicle || !status || !['allowed_inside', 'loading', 'unloading'].includes(status),
              disabled: busy,
              onClick: () => void markReady(),
            },
            {
              id: 'location',
              label: 'Update Location',
              icon: MapPin,
              hidden: !perms.canEditVehicle || isReadOnly,
              disabled: busy,
              onClick: () => void updateLocation(),
            },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <div className="space-y-3 p-4">
        {!perms.canViewVehicle ? (
          <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view vehicle records." />
        ) : (
          <GateDataStates state={state} error={error} onRetry={() => void load()} loadingVariant="form">
            {vehicle ? (
              <>
                <section className="rounded-md border border-erp-border bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-erp-text">{vehicle.entryNumber}</h3>
                    <GateStatusBadge status={vehicle.status} />
                    {isReadOnly ? <span className="text-[11.5px] font-medium text-erp-muted">Read-only</span> : null}
                  </div>
                  <VehicleStatusTracker status={vehicle.status} />
                </section>

                <div className="grid gap-3 xl:grid-cols-3">
                  <section className="rounded-md border border-erp-border bg-white p-4 xl:col-span-2">
                    <h3 className="mb-3 text-[14px] font-semibold text-erp-text">Vehicle summary</h3>
                    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                      <Field label="Vehicle number" value={vehicle.vehicleNumber} />
                      <Field label="Vehicle type" value={vehicle.vehicleType} />
                      <Field label="Purpose" value={vehicle.purpose} />
                      <Field label="Company" value={vehicle.companyName} />
                      <Field label="Transporter" value={vehicle.transporter} />
                      <Field label="Related document" value={vehicle.relatedDocument} />
                      <Field label="Driver" value={vehicle.driverName} />
                      <Field label="Driver mobile" value={vehicle.driverMobile} />
                      <Field label="Licence" value={vehicle.licenceVerified.replace(/_/g, ' ')} />
                      <Field label="Gate" value={vehicle.gate} />
                      <Field label="Current location" value={vehicle.currentLocation} />
                      <Field label="Seal" value={vehicle.sealNumber} />
                      <Field label="Entry time" value={vehicle.entryTime ? formatDateTime(vehicle.entryTime) : 'Not entered'} />
                      <Field label="Exit time" value={vehicle.exitTime ? formatDateTime(vehicle.exitTime) : 'Not exited'} />
                      <div>
                        <dt className="text-[12px] text-erp-muted">Duration</dt>
                        <dd className="text-[13px] font-medium">
                          <InsideDuration from={vehicle.entryTime} to={vehicle.exitTime} warnAfterMinutes={30} />
                        </dd>
                      </div>
                      <Field label="Exit remarks" value={vehicle.exitRemarks} />
                      <Field label="Remarks" value={vehicle.remarks} />
                    </dl>
                  </section>

                  <section className="rounded-md border border-erp-border bg-white p-4">
                    <h3 className="mb-3 text-[14px] font-semibold text-erp-text">Timeline</h3>
                    {vehicle.timeline.length === 0 ? (
                      <p className="text-[13px] text-erp-muted">No timeline events yet.</p>
                    ) : (
                      <ol className="space-y-2">
                        {vehicle.timeline.map((event, i) => (
                          <li key={i} className="flex items-start gap-2 text-[13px]">
                            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-erp-primary" aria-hidden />
                            <span>
                              <GateStatusBadge status={event.status} />
                              <span className="mt-0.5 block text-erp-muted">
                                {event.by} · {formatDateTime(event.at)}
                                {event.note ? ` · ${event.note}` : ''}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                </div>
              </>
            ) : null}
          </GateDataStates>
        )}
      </div>

      <VehicleExitModal
        vehicle={exitOpen ? vehicle : null}
        onClose={() => setExitOpen(false)}
        onDone={(updated) => setVehicle(updated)}
      />
    </OperationalPageShell>
  )
}
