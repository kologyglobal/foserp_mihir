import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Search, ShieldOff, X } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErpButton } from '@/components/erp/ErpButton'
import { FormField } from '@/components/forms/FormField'
import { Input, MobileInput, Select, Textarea } from '@/components/forms/Inputs'
import { notify } from '@/store/toastStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../../api/gateService'
import type { GateLocation, GateSettings, MaterialInwardType } from '../../types/gate.types'
import { buildMaterialInwardSchema, type MaterialInwardFormValues } from '../../schemas/gateSchemas'
import { GateBoundaryBanner } from '../../components'
import { GATE_BREADCRUMB } from '../../gateUi'

const INWARD_TYPES = [
  ['purchase_order', 'Purchase Order'],
  ['without_po', 'Without PO'],
  ['customer_return', 'Customer Return'],
  ['job_work_return', 'Job Work Return'],
  ['subcontract_return', 'Subcontract Return'],
  ['repair_return', 'Repair Return'],
  ['sample_received', 'Sample Received'],
  ['asset_received', 'Asset Received'],
  ['courier_material', 'Courier Material'],
  ['other', 'Other'],
] as const

const DEMO_PO_SUGGESTIONS = [
  { po: 'PO-2026-0470', vendor: 'Tata Steel BSL', material: 'E250 plates 10mm × 20 nos', warehouse: 'RM Store' },
  { po: 'PO-2026-0471', vendor: 'Sundaram Fasteners', material: 'HT bolts M12 assortment', warehouse: 'Fastener Store' },
  { po: 'PO-2026-0472', vendor: 'Apollo Tyres Ltd', material: 'Trailer tyres 295/80R22.5 — 16 nos', warehouse: 'RM Store' },
]

const DEFAULTS: MaterialInwardFormValues = {
  inwardType: 'purchase_order',
  vendorName: '',
  poNumber: '',
  challanNumber: '',
  invoiceNumber: '',
  lrNumber: '',
  vehicleNumber: '',
  vehicleType: '',
  transporter: '',
  driverName: '',
  driverMobile: '',
  sealNumber: '',
  materialSummary: '',
  packages: 1,
  approxQty: undefined,
  uom: '',
  grossWeight: '',
  warehouse: '',
  unloadingLocation: '',
  remarks: '',
  gate: '',
}

export function MaterialInwardFormPage() {
  const navigate = useNavigate()
  const perms = useGatePermissions()
  const [locations, setLocations] = useState<GateLocation[]>([])
  const [settings, setSettings] = useState<GateSettings | null>(null)
  const [lookup, setLookup] = useState('')
  const [busy, setBusy] = useState<'arrival' | 'draft' | ''>('')

  const schema = useMemo(
    () => buildMaterialInwardSchema({ vehicleNumberRequired: settings?.material.vehicleNumberRequired ?? true }),
    [settings],
  )

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<MaterialInwardFormValues>({
    resolver: zodResolver(schema) as Resolver<MaterialInwardFormValues>,
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
        if (!cancelled) notify.error(e instanceof Error ? e.message : 'Failed to load configuration')
      }
    })()
    return () => { cancelled = true }
  }, [setValue])

  const applySuggestion = (s: (typeof DEMO_PO_SUGGESTIONS)[number]) => {
    setValue('inwardType', 'purchase_order')
    setValue('poNumber', s.po, { shouldValidate: true })
    setValue('vendorName', s.vendor, { shouldValidate: true })
    setValue('materialSummary', s.material, { shouldValidate: true })
    setValue('warehouse', s.warehouse)
  }

  const persist = async (values: MaterialInwardFormValues, saveAsDraft: boolean) => {
    setBusy(saveAsDraft ? 'draft' : 'arrival')
    try {
      const entry = await gateService.createMaterialInward({
        ...values,
        inwardType: values.inwardType as MaterialInwardType,
        vendorName: values.vendorName || undefined,
        poNumber: values.poNumber || undefined,
        challanNumber: values.challanNumber || undefined,
        invoiceNumber: values.invoiceNumber || undefined,
        lrNumber: values.lrNumber || undefined,
        vehicleNumber: values.vehicleNumber || undefined,
        vehicleType: values.vehicleType || undefined,
        transporter: values.transporter || undefined,
        driverName: values.driverName || undefined,
        driverMobile: values.driverMobile || undefined,
        sealNumber: values.sealNumber || undefined,
        approxQty: values.approxQty,
        uom: values.uom || undefined,
        grossWeight: values.grossWeight || undefined,
        warehouse: values.warehouse || undefined,
        unloadingLocation: values.unloadingLocation || undefined,
        remarks: values.remarks || undefined,
        saveAsDraft,
      })
      notify.success(saveAsDraft ? `Draft ${entry.entryNumber} saved.` : `Arrival registered — ${entry.entryNumber}.`)
      navigate(`/gate/material-inward/${entry.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not save inward entry')
    } finally {
      setBusy('')
    }
  }

  const err = Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v?.message as string | undefined]))
  const suggestions = DEMO_PO_SUGGESTIONS.filter((s) => {
    const t = lookup.trim().toLowerCase()
    if (!t) return false
    return [s.po, s.vendor, s.material].some((v) => v.toLowerCase().includes(t))
  })

  if (!perms.canCreateInward) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="New Material Inward" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to create material inward entries." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics" layout="enterprise" badge="Gate & Security" title="New Material Inward"
      description="Search a PO, vendor, challan or vehicle — then register physical arrival only."
      showDescription autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Material Inward', to: '/gate/material-inward' }, { label: 'New' }]}
      backLink={{ to: '/gate/material-inward', label: 'Back to Material Inward' }}
    >
      <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
        <GateBoundaryBanner message="Gate entry records physical material arrival only. Inventory will be updated after Store completes the GRN." />

        <section className="rounded-lg border border-erp-border bg-white p-4">
          <h3 className="mb-1 text-[14px] font-semibold text-erp-text">Search PO, vendor, invoice, challan or vehicle number</h3>
          <p className="mb-3 text-[12.5px] text-erp-muted">Selecting a PO prefills vendor, expected material and warehouse.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="e.g. PO-2026-0470 or Tata Steel" className="h-11 w-80" />
            <ErpButton icon={Search} variant="secondary" onClick={() => { if (!lookup.trim()) notify.warning('Enter a search term first.') }}>Search</ErpButton>
          </div>
          {suggestions.length > 0 ? (
            <ul className="mt-3 divide-y divide-erp-border rounded-md border border-erp-border">
              {suggestions.map((s) => (
                <li key={s.po}>
                  <button type="button" className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-erp-primary-soft/40" onClick={() => applySuggestion(s)}>
                    <span className="text-[13px] font-semibold text-erp-text">{s.po} · {s.vendor}</span>
                    <span className="text-[12px] text-erp-muted">{s.material} → {s.warehouse}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <section className="rounded-lg border border-erp-border bg-white p-4">
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Source</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Inward type" required error={err.inwardType}>
                <Select value={watch('inwardType')} onChange={(e) => setValue('inwardType', e.target.value, { shouldValidate: true })} error={Boolean(err.inwardType)}>
                  <option value="">— Select —</option>
                  {INWARD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </FormField>
              <FormField label="Vendor" required error={err.vendorName}>
                <Input {...register('vendorName')} error={Boolean(err.vendorName)} />
              </FormField>
              <FormField label="Purchase Order" error={err.poNumber}>
                <Input {...register('poNumber')} error={Boolean(err.poNumber)} />
              </FormField>
              <FormField label="Delivery challan"><Input {...register('challanNumber')} /></FormField>
              <FormField label="Invoice"><Input {...register('invoiceNumber')} /></FormField>
              <FormField label="LR number"><Input {...register('lrNumber')} /></FormField>
            </div>
          </section>

          <section className="rounded-lg border border-erp-border bg-white p-4">
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Vehicle</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Vehicle number" required={settings?.material.vehicleNumberRequired} error={err.vehicleNumber}>
                <Input {...register('vehicleNumber')} error={Boolean(err.vehicleNumber)} />
              </FormField>
              <FormField label="Vehicle type">
                <Select value={watch('vehicleType') ?? ''} onChange={(e) => setValue('vehicleType', e.target.value)}>
                  <option value="">— Select —</option>
                  {(settings?.masters.vehicleTypes ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </FormField>
              <FormField label="Transporter"><Input {...register('transporter')} /></FormField>
              <FormField label="Driver"><Input {...register('driverName')} /></FormField>
              <FormField label="Driver mobile">
                <MobileInput maxDigits={10} value={watch('driverMobile') ?? ''} onChange={(e) => setValue('driverMobile', e.target.value)} />
              </FormField>
              <FormField label="Seal number"><Input {...register('sealNumber')} /></FormField>
            </div>
          </section>

          <section className="rounded-lg border border-erp-border bg-white p-4">
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Material</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Material summary" required error={err.materialSummary} className="sm:col-span-2">
                <Input {...register('materialSummary')} error={Boolean(err.materialSummary)} />
              </FormField>
              <FormField label="Packages" error={err.packages}>
                <Input type="number" min={0} {...register('packages')} error={Boolean(err.packages)} />
              </FormField>
              <FormField label="Approx quantity"><Input type="number" min={0} {...register('approxQty')} /></FormField>
              <FormField label="UOM"><Input {...register('uom')} /></FormField>
              <FormField label="Gross weight"><Input {...register('grossWeight')} placeholder="e.g. 13.2 MT" /></FormField>
              <FormField label="Warehouse"><Input {...register('warehouse')} /></FormField>
              <FormField label="Unloading location"><Input {...register('unloadingLocation')} /></FormField>
              <FormField label="Gate" required error={err.gate}>
                <Select value={watch('gate')} onChange={(e) => setValue('gate', e.target.value, { shouldValidate: true })} error={Boolean(err.gate)}>
                  <option value="">— Select —</option>
                  {locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
                </Select>
              </FormField>
            </div>
          </section>

          <section className="rounded-lg border border-erp-border bg-white p-4">
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Evidence</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-erp-border text-[12.5px] text-erp-muted">Document-photo placeholder</div>
              <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-erp-border text-[12.5px] text-erp-muted">Material-photo placeholder</div>
              <FormField label="Remarks" className="sm:col-span-2"><Textarea rows={2} {...register('remarks')} /></FormField>
            </div>
          </section>

          <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-erp-border bg-white px-4 py-3">
            <ErpButton onClick={handleSubmit((v) => void persist(v, false))} loading={busy === 'arrival'} disabled={busy !== ''}>Register Arrival</ErpButton>
            <ErpButton variant="secondary" onClick={handleSubmit((v) => void persist(v, true))} loading={busy === 'draft'} disabled={busy !== ''}>Save Draft</ErpButton>
            <ErpButton variant="ghost" icon={X} onClick={() => navigate('/gate/material-inward')} disabled={busy !== ''}>Cancel</ErpButton>
          </div>
        </form>
      </div>
    </OperationalPageShell>
  )
}
