import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFieldArray, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, ShieldOff, Trash2, X } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErpButton } from '@/components/erp/ErpButton'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { notify } from '@/store/toastStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../../api/gateService'
import type { GateLocation, GateSettings } from '../../types/gate.types'
import { gatePassSchema, type GatePassFormValues } from '../../schemas/gateSchemas'
import { GATE_BREADCRUMB, GATE_DEPARTMENTS, GATE_HOSTS } from '../../gateUi'

const DEFAULTS: GatePassFormValues = {
  passKind: 'returnable',
  movementType: '',
  department: '',
  responsibleEmployee: '',
  carriedBy: '',
  partyName: '',
  purpose: '',
  expectedReturnDate: '',
  approverName: '',
  gate: '',
  items: [{ itemDescription: '', serialNumber: '', quantity: 1, uom: 'No', conditionOut: '', remarks: '' }],
}

export function GatePassFormPage() {
  const navigate = useNavigate()
  const perms = useGatePermissions()
  const [locations, setLocations] = useState<GateLocation[]>([])
  const [settings, setSettings] = useState<GateSettings | null>(null)
  const [busy, setBusy] = useState<'draft' | 'submit' | ''>('')

  const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm<GatePassFormValues>({
    resolver: zodResolver(gatePassSchema) as Resolver<GatePassFormValues>,
    defaultValues: DEFAULTS,
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const passKind = watch('passKind')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [locs, cfg] = await Promise.all([gateService.getGateLocations(), gateService.getGateSettings()])
        if (cancelled) return
        setLocations(locs)
        setSettings(cfg)
        setValue('gate', locs[0]?.name ?? '')
      } catch (e) {
        if (!cancelled) notify.error(e instanceof Error ? e.message : 'Failed to load configuration')
      }
    })()
    return () => { cancelled = true }
  }, [setValue])

  const persist = async (values: GatePassFormValues, submitForApproval: boolean) => {
    setBusy(submitForApproval ? 'submit' : 'draft')
    try {
      const pass = await gateService.createGatePass({
        ...values,
        carriedBy: values.carriedBy || values.responsibleEmployee,
        partyName: values.partyName || undefined,
        expectedReturnDate: values.passKind === 'returnable' ? values.expectedReturnDate || null : null,
        approverName: values.approverName || undefined,
        items: values.items.map(({ itemDescription, serialNumber, quantity, uom, conditionOut, remarks }) => ({
          itemDescription, serialNumber: serialNumber || undefined, quantity, uom, conditionOut: conditionOut || undefined, remarks: remarks || undefined,
        })),
        submitForApproval,
      })
      notify.success(submitForApproval ? `Pass ${pass.entryNumber} submitted.` : `Draft ${pass.entryNumber} saved.`)
      navigate(`/gate/passes/${pass.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not save gate pass')
    } finally {
      setBusy('')
    }
  }

  const err = Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, (v as { message?: string })?.message]))

  if (!perms.canCreatePass) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="New Gate Pass" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to create gate passes." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics" layout="enterprise" badge="Gate & Security" title="New Gate Pass"
      description="Track physical item movement. Returnable passes require an expected return date."
      showDescription autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Gate Passes', to: '/gate/passes' }, { label: 'New' }]}
      backLink={{ to: '/gate/passes', label: 'Back to Gate Passes' }}
    >
      <form className="mx-auto w-full max-w-4xl space-y-4 p-4" onSubmit={(e) => e.preventDefault()}>
        <section className="rounded-lg border border-erp-border bg-white p-4">
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Header</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Pass kind" required>
              <Select value={passKind} onChange={(e) => setValue('passKind', e.target.value as 'returnable' | 'non_returnable', { shouldValidate: true })}>
                <option value="returnable">Returnable</option>
                <option value="non_returnable">Non-returnable</option>
              </Select>
            </FormField>
            <FormField label="Movement type" required error={err.movementType}>
              <Select value={watch('movementType')} onChange={(e) => setValue('movementType', e.target.value, { shouldValidate: true })} error={Boolean(err.movementType)}>
                <option value="">— Select —</option>
                {(settings?.masters.materialMovementTypes ?? ['Repair', 'Job Work', 'Sample', 'Calibration', 'Exhibition']).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Department" required error={err.department}>
              <Select value={watch('department')} onChange={(e) => setValue('department', e.target.value, { shouldValidate: true })} error={Boolean(err.department)}>
                <option value="">— Select —</option>
                {GATE_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>
            </FormField>
            <FormField label="Responsible employee" required error={err.responsibleEmployee}>
              <Select value={watch('responsibleEmployee')} onChange={(e) => setValue('responsibleEmployee', e.target.value, { shouldValidate: true })} error={Boolean(err.responsibleEmployee)}>
                <option value="">— Select —</option>
                {GATE_HOSTS.map((h) => <option key={h.name} value={h.name}>{h.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Carried by"><Input {...register('carriedBy')} placeholder="Defaults to responsible employee" /></FormField>
            <FormField label="Vendor / customer / person"><Input {...register('partyName')} /></FormField>
            <FormField label="Purpose" required error={err.purpose} className="sm:col-span-2">
              <Input {...register('purpose')} error={Boolean(err.purpose)} />
            </FormField>
            {passKind === 'returnable' ? (
              <FormField label="Expected return date" required error={err.expectedReturnDate}>
                <Input type="date" {...register('expectedReturnDate')} error={Boolean(err.expectedReturnDate)} />
              </FormField>
            ) : null}
            <FormField label="Approver"><Input {...register('approverName')} /></FormField>
            <FormField label="Gate" required error={err.gate}>
              <Select value={watch('gate')} onChange={(e) => setValue('gate', e.target.value, { shouldValidate: true })} error={Boolean(err.gate)}>
                <option value="">— Select —</option>
                {locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
              </Select>
            </FormField>
          </div>
        </section>

        <section className="rounded-lg border border-erp-border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Items</h3>
            <ErpButton size="sm" variant="secondary" icon={Plus} onClick={() => append({ itemDescription: '', serialNumber: '', quantity: 1, uom: 'No', conditionOut: '', remarks: '' })}>
              Add Row
            </ErpButton>
          </div>
          {typeof errors.items?.message === 'string' ? <p className="mb-2 text-[12px] text-rose-600">{errors.items.message}</p> : null}
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-2 rounded-md border border-erp-border p-3 sm:grid-cols-6">
                <FormField label="Item description" required className="sm:col-span-2" error={errors.items?.[index]?.itemDescription?.message}>
                  <Input {...register(`items.${index}.itemDescription`)} error={Boolean(errors.items?.[index]?.itemDescription)} />
                </FormField>
                <FormField label="Serial"><Input {...register(`items.${index}.serialNumber`)} /></FormField>
                <FormField label="Qty" required error={errors.items?.[index]?.quantity?.message}>
                  <Input type="number" min={0.001} step="any" {...register(`items.${index}.quantity`)} error={Boolean(errors.items?.[index]?.quantity)} />
                </FormField>
                <FormField label="UOM" required><Input {...register(`items.${index}.uom`)} /></FormField>
                <div className="flex items-end gap-2">
                  <FormField label="Condition out" className="flex-1"><Input {...register(`items.${index}.conditionOut`)} /></FormField>
                  {fields.length > 1 ? (
                    <ErpButton size="sm" variant="ghost" icon={Trash2} aria-label="Remove row" onClick={() => remove(index)} />
                  ) : null}
                </div>
                <FormField label="Remarks" className="sm:col-span-6"><Textarea rows={1} {...register(`items.${index}.remarks`)} /></FormField>
              </div>
            ))}
          </div>
        </section>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-erp-border bg-white px-4 py-3">
          <ErpButton onClick={handleSubmit((v) => void persist(v, true))} loading={busy === 'submit'} disabled={busy !== ''}>Submit for Approval</ErpButton>
          <ErpButton variant="secondary" onClick={handleSubmit((v) => void persist(v, false))} loading={busy === 'draft'} disabled={busy !== ''}>Save Draft</ErpButton>
          <ErpButton variant="ghost" icon={X} onClick={() => navigate('/gate/passes')} disabled={busy !== ''}>Cancel</ErpButton>
        </div>
      </form>
    </OperationalPageShell>
  )
}
