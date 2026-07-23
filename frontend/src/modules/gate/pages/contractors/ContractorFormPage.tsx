import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { HardHat, ShieldOff, X } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErpButton } from '@/components/erp/ErpButton'
import { FormField } from '@/components/forms/FormField'
import { Checkbox, Input, MobileInput, Select, Textarea } from '@/components/forms/Inputs'
import { notify } from '@/store/toastStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../../api/gateService'
import type { GateLocation } from '../../types/gate.types'
import { contractorEntrySchema, type ContractorEntryFormValues } from '../../schemas/gateSchemas'
import { todayIsoDate } from '../../utils/gateStatus'
import { GATE_BREADCRUMB, GATE_DEPARTMENTS, GATE_HOSTS } from '../../gateUi'

const DEFAULTS: ContractorEntryFormValues = {
  workerName: '',
  mobile: '',
  contractorCompany: '',
  workReference: '',
  department: '',
  supervisor: '',
  workLocation: '',
  validFrom: todayIsoDate(),
  validUntil: todayIsoDate(),
  safetyInductionDone: false,
  ppeIssued: false,
  toolsCarried: '',
  purpose: '',
  remarks: '',
  gate: '',
}

export function ContractorFormPage() {
  const navigate = useNavigate()
  const perms = useGatePermissions()
  const [locations, setLocations] = useState<GateLocation[]>([])
  const [busy, setBusy] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContractorEntryFormValues>({
    resolver: zodResolver(contractorEntrySchema) as Resolver<ContractorEntryFormValues>,
    defaultValues: DEFAULTS,
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const locs = await gateService.getGateLocations()
        if (cancelled) return
        setLocations(locs.filter((l) => l.entryTypesAllowed.includes('contractor')))
        setValue('gate', locs.find((l) => l.name.includes('Main'))?.name ?? locs[0]?.name ?? '')
      } catch (e) {
        if (!cancelled) notify.error(e instanceof Error ? e.message : 'Failed to load gate locations')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setValue])

  const submit = async (values: ContractorEntryFormValues) => {
    setBusy(true)
    try {
      const record = await gateService.createContractorEntry({
        ...values,
        workReference: values.workReference || undefined,
        toolsCarried: values.toolsCarried || undefined,
        remarks: values.remarks || undefined,
      })
      notify.success(`Contractor ${record.workerName} registered (${record.entryNumber}).`)
      navigate(`/gate/contractors/${record.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not register contractor')
    } finally {
      setBusy(false)
    }
  }

  const err = Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v?.message as string | undefined]))
  const supervisors = GATE_HOSTS.map((h) => h.name)

  if (!perms.canCreateContractor) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="New Contractor Entry" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to create contractor entries." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title="New Contractor Entry"
      description="Register contract workers with validity dates and safety checks — no payroll or attendance linkage."
      showDescription
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Contractors', to: '/gate/contractors' }, { label: 'New' }]}
      backLink={{ to: '/gate/contractors', label: 'Back to Contractors' }}
    >
      <form className="mx-auto w-full max-w-3xl space-y-4 p-4" onSubmit={(e) => e.preventDefault()}>
        <section className="rounded-lg border border-erp-border bg-white p-4">
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Worker</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Worker name" required error={err.workerName}>
              <Input {...register('workerName')} error={Boolean(err.workerName)} autoFocus />
            </FormField>
            <FormField label="Mobile" required error={err.mobile}>
              <MobileInput
                maxDigits={10}
                value={watch('mobile')}
                onChange={(e) => setValue('mobile', e.target.value, { shouldValidate: true })}
                error={Boolean(err.mobile)}
              />
            </FormField>
            <FormField label="Contractor company" required error={err.contractorCompany}>
              <Input {...register('contractorCompany')} error={Boolean(err.contractorCompany)} />
            </FormField>
            <FormField label="Work / service reference">
              <Input {...register('workReference')} placeholder="e.g. WO-ELEC-2026-08" />
            </FormField>
            <FormField label="Photo">
              <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-erp-border bg-erp-surface-alt/40 text-[12px] text-erp-muted">
                Photo capture placeholder — not connected
              </div>
            </FormField>
          </div>
        </section>

        <section className="rounded-lg border border-erp-border bg-white p-4">
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Work assignment</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Department" required error={err.department}>
              <Select value={watch('department')} onChange={(e) => setValue('department', e.target.value, { shouldValidate: true })} error={Boolean(err.department)}>
                <option value="">— Select —</option>
                {GATE_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Supervisor" required error={err.supervisor}>
              <Select value={watch('supervisor')} onChange={(e) => setValue('supervisor', e.target.value, { shouldValidate: true })} error={Boolean(err.supervisor)}>
                <option value="">— Select —</option>
                {supervisors.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Work location" required error={err.workLocation} className="sm:col-span-2">
              <Input {...register('workLocation')} error={Boolean(err.workLocation)} placeholder="e.g. Paint shop MCC panel" />
            </FormField>
            <FormField label="Purpose" required error={err.purpose} className="sm:col-span-2">
              <Input {...register('purpose')} error={Boolean(err.purpose)} />
            </FormField>
            <FormField label="Valid from" required error={err.validFrom}>
              <Input type="date" {...register('validFrom')} error={Boolean(err.validFrom)} />
            </FormField>
            <FormField label="Valid until" required error={err.validUntil}>
              <Input type="date" {...register('validUntil')} error={Boolean(err.validUntil)} />
            </FormField>
            <FormField label="Tools carried" className="sm:col-span-2">
              <Input {...register('toolsCarried')} placeholder="e.g. Crimping tools, multimeter" />
            </FormField>
          </div>
        </section>

        <section className="rounded-lg border border-erp-border bg-white p-4">
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Safety & gate</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Gate" required error={err.gate}>
              <Select value={watch('gate')} onChange={(e) => setValue('gate', e.target.value, { shouldValidate: true })} error={Boolean(err.gate)}>
                <option value="">— Select —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.name}>{l.name}</option>
                ))}
              </Select>
            </FormField>
            <div className="sm:col-span-2 flex flex-col gap-2">
              <Checkbox label="Safety induction completed" checked={watch('safetyInductionDone')} onChange={(e) => setValue('safetyInductionDone', e.target.checked)} />
              <Checkbox label="PPE issued" checked={watch('ppeIssued')} onChange={(e) => setValue('ppeIssued', e.target.checked)} />
            </div>
            <FormField label="Remarks" className="sm:col-span-2">
              <Textarea rows={2} {...register('remarks')} />
            </FormField>
          </div>
        </section>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-erp-border bg-white px-4 py-3">
          <ErpButton icon={HardHat} onClick={handleSubmit((v) => void submit(v))} loading={busy} disabled={busy}>
            Register Contractor
          </ErpButton>
          <ErpButton variant="ghost" icon={X} onClick={() => navigate('/gate/contractors')} disabled={busy}>
            Cancel
          </ErpButton>
        </div>
      </form>
    </OperationalPageShell>
  )
}
