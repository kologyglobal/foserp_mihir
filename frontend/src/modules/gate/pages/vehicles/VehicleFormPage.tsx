import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ShieldOff, Truck, X } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErpButton } from '@/components/erp/ErpButton'
import { FormField } from '@/components/forms/FormField'
import { Checkbox, Input, MobileInput, Select, Textarea } from '@/components/forms/Inputs'
import { notify } from '@/store/toastStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../../api/gateService'
import type { GateLocation, GateSettings } from '../../types/gate.types'
import { vehicleEntrySchema, type VehicleEntryFormValues } from '../../schemas/gateSchemas'
import { GATE_BREADCRUMB } from '../../gateUi'

const DEFAULTS: VehicleEntryFormValues = {
  vehicleNumber: '',
  vehicleType: 'Truck',
  purpose: '',
  companyName: '',
  transporter: '',
  driverName: '',
  driverMobile: '',
  licenceVerified: 'not_checked',
  relatedDocument: '',
  gate: '',
  plannedLocation: '',
  sealNumber: '',
  remarks: '',
  markArrived: true,
}

export function VehicleFormPage() {
  const navigate = useNavigate()
  const perms = useGatePermissions()
  const [locations, setLocations] = useState<GateLocation[]>([])
  const [settings, setSettings] = useState<GateSettings | null>(null)
  const [busy, setBusy] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VehicleEntryFormValues>({
    resolver: zodResolver(vehicleEntrySchema) as Resolver<VehicleEntryFormValues>,
    defaultValues: DEFAULTS,
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [locs, cfg] = await Promise.all([gateService.getGateLocations(), gateService.getGateSettings()])
        if (cancelled) return
        setLocations(locs)
        setSettings(cfg)
        setValue('gate', locs.find((l) => l.name.includes('Material'))?.name ?? locs[0]?.name ?? '')
      } catch (e) {
        if (!cancelled) notify.error(e instanceof Error ? e.message : 'Failed to load gate configuration')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setValue])

  const submit = async (values: VehicleEntryFormValues) => {
    setBusy(true)
    try {
      const vehicle = await gateService.createVehicleEntry({
        ...values,
        companyName: values.companyName || undefined,
        transporter: values.transporter || undefined,
        driverMobile: values.driverMobile || undefined,
        relatedDocument: values.relatedDocument || undefined,
        plannedLocation: values.plannedLocation || undefined,
        sealNumber: values.sealNumber || undefined,
        remarks: values.remarks || undefined,
      })
      notify.success(`Vehicle ${vehicle.vehicleNumber} registered (${vehicle.entryNumber}).`)
      navigate(`/gate/vehicles/${vehicle.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not register vehicle')
    } finally {
      setBusy(false)
    }
  }

  const err = Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v?.message as string | undefined]))

  if (!perms.canCreateVehicle) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="New Vehicle Entry" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to create vehicle entries." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title="New Vehicle Entry"
      description="Minimum fields: vehicle number, purpose and driver. Everything else is optional."
      showDescription
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Vehicles', to: '/gate/vehicles' }, { label: 'New' }]}
      backLink={{ to: '/gate/vehicles', label: 'Back to Vehicles' }}
    >
      <form className="mx-auto w-full max-w-3xl space-y-4 p-4" onSubmit={(e) => e.preventDefault()}>
        <section className="rounded-lg border border-erp-border bg-white p-4">
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Vehicle</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Vehicle number" required error={err.vehicleNumber}>
              <Input {...register('vehicleNumber')} error={Boolean(err.vehicleNumber)} placeholder="e.g. TN 39 BX 4521" className="text-[15px]" autoFocus />
            </FormField>
            <FormField label="Vehicle type" required error={err.vehicleType}>
              <Select value={watch('vehicleType')} onChange={(e) => setValue('vehicleType', e.target.value, { shouldValidate: true })} error={Boolean(err.vehicleType)}>
                <option value="">— Select —</option>
                {(settings?.masters.vehicleTypes ?? ['Truck', 'Trailer', 'LCV', 'Tempo', 'Car']).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Purpose" required error={err.purpose} className="sm:col-span-2">
              <Input {...register('purpose')} error={Boolean(err.purpose)} placeholder="e.g. Steel plate delivery, FG trailer dispatch…" />
            </FormField>
            <FormField label="Vendor / customer / company">
              <Input {...register('companyName')} />
            </FormField>
            <FormField label="Transporter">
              <Input {...register('transporter')} />
            </FormField>
            <FormField label="Related PO / SO / challan">
              <Input {...register('relatedDocument')} placeholder="e.g. PO-2026-0412" />
            </FormField>
            <FormField label="Seal number">
              <Input {...register('sealNumber')} />
            </FormField>
          </div>
        </section>

        <section className="rounded-lg border border-erp-border bg-white p-4">
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Driver & gate</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Driver name" required error={err.driverName}>
              <Input {...register('driverName')} error={Boolean(err.driverName)} />
            </FormField>
            <FormField label="Driver mobile" error={err.driverMobile}>
              <MobileInput maxDigits={10} value={watch('driverMobile') ?? ''} onChange={(e) => setValue('driverMobile', e.target.value, { shouldValidate: true })} error={Boolean(err.driverMobile)} />
            </FormField>
            <FormField label="Driving-licence verification">
              <Select value={watch('licenceVerified')} onChange={(e) => setValue('licenceVerified', e.target.value as VehicleEntryFormValues['licenceVerified'])}>
                <option value="not_checked">Not checked</option>
                <option value="verified">Verified</option>
                <option value="failed">Failed</option>
              </Select>
            </FormField>
            <FormField label="Gate" required error={err.gate}>
              <Select value={watch('gate')} onChange={(e) => setValue('gate', e.target.value, { shouldValidate: true })} error={Boolean(err.gate)}>
                <option value="">— Select —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.name}>{l.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Planned location">
              <Input {...register('plannedLocation')} placeholder="e.g. Unloading Bay 1, FG Yard" />
            </FormField>
            <FormField label="Remarks" className="sm:col-span-2">
              <Textarea rows={2} {...register('remarks')} />
            </FormField>
            <div className="sm:col-span-2">
              <Checkbox label="Vehicle is already at the gate (mark as arrived)" checked={watch('markArrived')} onChange={(e) => setValue('markArrived', e.target.checked)} />
            </div>
          </div>
        </section>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-erp-border bg-white px-4 py-3">
          <ErpButton icon={Truck} onClick={handleSubmit((v) => void submit(v))} loading={busy} disabled={busy}>
            Register Vehicle
          </ErpButton>
          <ErpButton variant="ghost" icon={X} onClick={() => navigate('/gate/vehicles')} disabled={busy}>
            Cancel
          </ErpButton>
        </div>
      </form>
    </OperationalPageShell>
  )
}
