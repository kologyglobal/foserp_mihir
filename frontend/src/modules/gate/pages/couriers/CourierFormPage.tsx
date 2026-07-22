import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Package, ShieldOff, X } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErpButton } from '@/components/erp/ErpButton'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { notify } from '@/store/toastStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../../api/gateService'
import type { GateLocation, GateSettings } from '../../types/gate.types'
import { courierEntrySchema, type CourierEntryFormValues } from '../../schemas/gateSchemas'
import { GATE_BREADCRUMB, GATE_DEPARTMENTS, GATE_HOSTS } from '../../gateUi'

const DEFAULTS: CourierEntryFormValues = {
  direction: 'incoming',
  courierCompany: '',
  trackingNumber: '',
  senderName: '',
  recipientEmployee: '',
  department: '',
  parcelType: '',
  parcelDescription: '',
  charges: undefined,
  remarks: '',
  gate: '',
}

export function CourierFormPage() {
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
  } = useForm<CourierEntryFormValues>({
    resolver: zodResolver(courierEntrySchema) as Resolver<CourierEntryFormValues>,
    defaultValues: DEFAULTS,
  })

  const direction = watch('direction')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [locs, cfg] = await Promise.all([gateService.getGateLocations(), gateService.getGateSettings()])
        if (cancelled) return
        setLocations(locs.filter((l) => l.entryTypesAllowed.includes('courier')))
        setSettings(cfg)
        setValue('gate', locs.find((l) => l.name.includes('Main'))?.name ?? locs[0]?.name ?? '')
      } catch (e) {
        if (!cancelled) notify.error(e instanceof Error ? e.message : 'Failed to load gate configuration')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setValue])

  const submit = async (values: CourierEntryFormValues) => {
    setBusy(true)
    try {
      const record = await gateService.createCourierEntry({
        ...values,
        trackingNumber: values.trackingNumber || undefined,
        senderName: values.senderName || undefined,
        recipientEmployee: values.recipientEmployee || undefined,
        department: values.department || undefined,
        parcelType: values.parcelType || undefined,
        parcelDescription: values.parcelDescription || undefined,
        charges: values.charges != null && !Number.isNaN(values.charges) ? values.charges : undefined,
        remarks: values.remarks || undefined,
      })
      notify.success(`Courier entry ${record.entryNumber} registered.`)
      navigate(`/gate/couriers/${record.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not register courier entry')
    } finally {
      setBusy(false)
    }
  }

  const err = Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v?.message as string | undefined]))
  const courierCompanies = settings?.masters.courierCompanies ?? ['Blue Dart', 'DTDC', 'Delhivery', 'Professional Couriers', 'India Post', 'FedEx']
  const employees = GATE_HOSTS.map((h) => h.name)

  if (!perms.canCreateCourier) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="New Courier Entry" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to create courier entries." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title="New Courier Entry"
      description="Register incoming parcels for handover or outgoing dispatches from the gate."
      showDescription
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Couriers', to: '/gate/couriers' }, { label: 'New' }]}
      backLink={{ to: '/gate/couriers', label: 'Back to Couriers' }}
    >
      <form className="mx-auto w-full max-w-3xl space-y-4 p-4" onSubmit={(e) => e.preventDefault()}>
        <section className="rounded-lg border border-erp-border bg-white p-4">
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Direction</h3>
          <FormField label="Parcel direction" required error={err.direction}>
            <Select
              value={direction}
              onChange={(e) => setValue('direction', e.target.value as CourierEntryFormValues['direction'], { shouldValidate: true })}
              error={Boolean(err.direction)}
            >
              <option value="">— Select —</option>
              <option value="incoming">Incoming — received at gate</option>
              <option value="outgoing">Outgoing — dispatched from gate</option>
            </Select>
          </FormField>
        </section>

        <section className="rounded-lg border border-erp-border bg-white p-4">
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Courier details</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Courier company" required error={err.courierCompany}>
              <Select
                value={watch('courierCompany')}
                onChange={(e) => setValue('courierCompany', e.target.value, { shouldValidate: true })}
                error={Boolean(err.courierCompany)}
              >
                <option value="">— Select —</option>
                {courierCompanies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Tracking number">
              <Input {...register('trackingNumber')} placeholder="Optional" />
            </FormField>
            <FormField label="Gate" required error={err.gate}>
              <Select value={watch('gate')} onChange={(e) => setValue('gate', e.target.value, { shouldValidate: true })} error={Boolean(err.gate)}>
                <option value="">— Select —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.name}>{l.name}</option>
                ))}
              </Select>
            </FormField>
          </div>
        </section>

        {direction === 'incoming' ? (
          <section className="rounded-lg border border-erp-border bg-white p-4">
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Incoming parcel</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Sender / from company">
                <Input {...register('senderName')} placeholder="e.g. WABCO India" />
              </FormField>
              <FormField label="Recipient employee" required error={err.recipientEmployee}>
                <Select
                  value={watch('recipientEmployee') ?? ''}
                  onChange={(e) => {
                    setValue('recipientEmployee', e.target.value, { shouldValidate: true })
                    const host = GATE_HOSTS.find((h) => h.name === e.target.value)
                    if (host) setValue('department', host.department)
                  }}
                  error={Boolean(err.recipientEmployee)}
                >
                  <option value="">— Select —</option>
                  {employees.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Department">
                <Select value={watch('department') ?? ''} onChange={(e) => setValue('department', e.target.value)}>
                  <option value="">— Select —</option>
                  {GATE_DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Parcel type">
                <Input {...register('parcelType')} placeholder="e.g. Documents, Sample" />
              </FormField>
            </div>
          </section>
        ) : (
          <section className="rounded-lg border border-erp-border bg-white p-4">
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Outgoing parcel</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Sender employee" required error={err.senderName}>
                <Select
                  value={watch('senderName') ?? ''}
                  onChange={(e) => {
                    setValue('senderName', e.target.value, { shouldValidate: true })
                    const host = GATE_HOSTS.find((h) => h.name === e.target.value)
                    if (host) setValue('department', host.department)
                  }}
                  error={Boolean(err.senderName)}
                >
                  <option value="">— Select —</option>
                  {employees.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Department">
                <Select value={watch('department') ?? ''} onChange={(e) => setValue('department', e.target.value)}>
                  <option value="">— Select —</option>
                  {GATE_DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Parcel description" required error={err.parcelDescription} className="sm:col-span-2">
                <Input {...register('parcelDescription')} error={Boolean(err.parcelDescription)} placeholder="What is being sent?" />
              </FormField>
              <FormField label="Charges (₹)">
                <Input type="number" min={0} step="any" {...register('charges')} />
              </FormField>
            </div>
          </section>
        )}

        <section className="rounded-lg border border-erp-border bg-white p-4">
          <FormField label="Remarks">
            <Textarea rows={2} {...register('remarks')} />
          </FormField>
        </section>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-erp-border bg-white px-4 py-3">
          <ErpButton icon={Package} onClick={handleSubmit((v) => void submit(v))} loading={busy} disabled={busy}>
            Register Courier Entry
          </ErpButton>
          <ErpButton variant="ghost" icon={X} onClick={() => navigate('/gate/couriers')} disabled={busy}>
            Cancel
          </ErpButton>
        </div>
      </form>
    </OperationalPageShell>
  )
}
