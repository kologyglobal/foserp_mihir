import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarPlus, LogIn, Search, Send, ShieldOff, UserRound, X } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErpButton } from '@/components/erp/ErpButton'
import { FormField } from '@/components/forms/FormField'
import { Checkbox, Input, MobileInput, Select, Textarea } from '@/components/forms/Inputs'
import { notify } from '@/store/toastStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../../api/gateService'
import type { GateLocation, GateSettings, Visitor, VisitorVisit } from '../../types/gate.types'
import { VISITOR_TYPE_LABELS, todayIsoDate } from '../../utils/gateStatus'
import { visitorEntrySchema, type VisitorEntryFormValues } from '../../schemas/gateSchemas'
import { VisitorHistoryCard } from '../../components'
import { GATE_BREADCRUMB, GATE_DEPARTMENTS, GATE_HOSTS } from '../../gateUi'

const ID_TYPES = ['Company ID', 'DL', 'Voter ID', 'PAN', 'Passport', 'Other']

const DEFAULTS: VisitorEntryFormValues = {
  visitorName: '',
  mobile: '',
  company: '',
  email: '',
  visitorType: '',
  visitorCount: 1,
  idType: '',
  idReferenceMasked: '',
  hostName: '',
  department: '',
  purpose: '',
  expectedDurationMinutes: undefined,
  meetingLocation: '',
  remarks: '',
  vehicleNumber: '',
  vehicleType: '',
  laptopCarried: false,
  equipmentCarried: false,
  bagCount: 0,
  belongingsDescription: '',
  safetyDeclarationAccepted: false,
  ppeRequired: false,
  ndaRequired: false,
  hostApprovalRequired: true,
  gate: '',
}

/**
 * Search-first visitor entry (`/gate/visitors/new`) and visitor edit (`/gate/visitors/:id/edit`).
 * Starts with a mobile lookup for repeat visitors, then a compact 4-section form.
 */
export function VisitorFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const perms = useGatePermissions()
  const isEdit = Boolean(id)

  const [stage, setStage] = useState<'search' | 'form'>(isEdit ? 'form' : 'search')
  const [searchMobile, setSearchMobile] = useState('')
  const [searching, setSearching] = useState(false)
  const [foundVisitor, setFoundVisitor] = useState<Visitor | null>(null)
  const [searched, setSearched] = useState(false)
  const [locations, setLocations] = useState<GateLocation[]>([])
  const [settings, setSettings] = useState<GateSettings | null>(null)
  const [busyAction, setBusyAction] = useState<'' | 'approval' | 'entry' | 'expected' | 'save'>('')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VisitorEntryFormValues>({
    resolver: zodResolver(visitorEntrySchema) as Resolver<VisitorEntryFormValues>,
    defaultValues: DEFAULTS,
  })

  const hostApprovalRequired = watch('hostApprovalRequired')
  const safetyAccepted = watch('safetyDeclarationAccepted')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [locs, cfg] = await Promise.all([gateService.getGateLocations(), gateService.getGateSettings()])
        if (cancelled) return
        setLocations(locs)
        setSettings(cfg)
        if (!isEdit) {
          setValue('gate', locs[0]?.name ?? '')
          setValue('hostApprovalRequired', cfg.visitor.hostApprovalRequired)
          setValue('expectedDurationMinutes', cfg.visitor.defaultVisitDurationMinutes)
        }
      } catch (e) {
        if (!cancelled) notify.error(e instanceof Error ? e.message : 'Failed to load gate configuration')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isEdit, setValue])

  // Arriving expected visitor — prefill from the pre-registration
  const expectedId = searchParams.get('expectedId')
  useEffect(() => {
    if (!expectedId || isEdit) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await gateService.getExpectedVisitors()
        const match = rows.find((r) => r.id === expectedId)
        if (!match || cancelled) return
        reset({
          ...DEFAULTS,
          visitorName: match.visitorName,
          mobile: match.mobile,
          company: match.company ?? '',
          hostName: match.hostName,
          department: match.department,
          purpose: match.purpose,
          vehicleNumber: match.vehicleNumber ?? '',
          gate: match.gate,
          hostApprovalRequired: settings?.visitor.hostApprovalRequired ?? true,
          expectedDurationMinutes: settings?.visitor.defaultVisitDurationMinutes,
        })
        setStage('form')
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Failed to load expected visitor')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [expectedId, isEdit, reset, settings])

  // Edit mode — load existing visit
  useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      try {
        const visit = await gateService.getVisitorById(id)
        if (cancelled) return
        if (['exited', 'cancelled', 'rejected'].includes(visit.status)) {
          notify.warning('This visit is read-only — redirecting to the detail view.')
          navigate(`/gate/visitors/${id}`, { replace: true })
          return
        }
        reset({
          ...DEFAULTS,
          visitorName: visit.visitorName,
          mobile: visit.mobile,
          company: visit.company ?? '',
          email: visit.email ?? '',
          visitorType: visit.visitorType,
          visitorCount: visit.visitorCount,
          idType: visit.idType ?? '',
          idReferenceMasked: visit.idReferenceMasked ?? '',
          hostName: visit.hostName,
          department: visit.department,
          purpose: visit.purpose,
          expectedDurationMinutes: visit.expectedDurationMinutes,
          meetingLocation: visit.meetingLocation ?? '',
          remarks: visit.remarks ?? '',
          vehicleNumber: visit.vehicleNumber ?? '',
          vehicleType: visit.vehicleType ?? '',
          laptopCarried: visit.laptopCarried,
          equipmentCarried: visit.equipmentCarried,
          bagCount: visit.bagCount,
          belongingsDescription: visit.belongingsDescription ?? '',
          safetyDeclarationAccepted: visit.safetyDeclarationAccepted,
          ppeRequired: visit.ppeRequired,
          ndaRequired: visit.ndaRequired,
          hostApprovalRequired: visit.hostApprovalRequired,
          gate: visit.gate,
        })
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Failed to load visitor record')
        navigate('/gate/visitors', { replace: true })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate, reset])

  const runSearch = useCallback(async () => {
    const digits = searchMobile.replace(/\D/g, '')
    if (digits.length !== 10) {
      notify.warning('Enter a 10-digit mobile number to search.')
      return
    }
    setSearching(true)
    try {
      const visitor = await gateService.searchVisitorByMobile(digits)
      setFoundVisitor(visitor)
      setSearched(true)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Visitor search failed')
    } finally {
      setSearching(false)
    }
  }, [searchMobile])

  const usePreviousDetails = () => {
    if (!foundVisitor) return
    reset({
      ...DEFAULTS,
      visitorName: foundVisitor.name,
      mobile: foundVisitor.mobile,
      company: foundVisitor.company ?? '',
      email: foundVisitor.email ?? '',
      idType: foundVisitor.idType ?? '',
      idReferenceMasked: foundVisitor.idReferenceMasked ?? '',
      hostName: foundVisitor.lastHost ?? '',
      vehicleNumber: foundVisitor.lastVehicleNumber ?? '',
      gate: locations[0]?.name ?? '',
      hostApprovalRequired: settings?.visitor.hostApprovalRequired ?? true,
      expectedDurationMinutes: settings?.visitor.defaultVisitDurationMinutes,
    })
    setStage('form')
  }

  const startNewEntry = () => {
    reset({
      ...DEFAULTS,
      mobile: searchMobile.replace(/\D/g, ''),
      gate: locations[0]?.name ?? '',
      hostApprovalRequired: settings?.visitor.hostApprovalRequired ?? true,
      expectedDurationMinutes: settings?.visitor.defaultVisitDurationMinutes,
    })
    setStage('form')
  }

  const persist = async (values: VisitorEntryFormValues, action: 'approval' | 'entry' | 'expected' | 'save') => {
    if (!values.safetyDeclarationAccepted && action !== 'expected') {
      notify.warning('Safety declaration must be accepted before entry can proceed.')
      return
    }
    setBusyAction(action)
    try {
      if (isEdit && id) {
        await gateService.updateVisitorEntry(id, {
          ...values,
          visitorType: values.visitorType as VisitorVisit['visitorType'],
        })
        notify.success('Visitor entry updated.')
        navigate(`/gate/visitors/${id}`)
        return
      }
      if (action === 'expected') {
        const expected = await gateService.createExpectedVisitor({
          visitorName: values.visitorName,
          mobile: values.mobile,
          company: values.company || undefined,
          visitDate: todayIsoDate(),
          expectedArrival: new Date().toTimeString().slice(0, 5),
          hostName: values.hostName,
          department: values.department,
          purpose: values.purpose,
          gate: values.gate,
          vehicleNumber: values.vehicleNumber || undefined,
          instructions: values.remarks || undefined,
        })
        notify.success(`Saved as expected visitor (${expected.reference}).`)
        navigate('/gate/visitors/expected')
        return
      }
      const visit = await gateService.createVisitorEntry({
        ...values,
        visitorType: values.visitorType as VisitorVisit['visitorType'],
        company: values.company || undefined,
        email: values.email || undefined,
        mode: 'walk_in',
        expectedVisitorId: searchParams.get('expectedId') ?? undefined,
      })
      if (action === 'entry') {
        if (visit.hostApprovalRequired && visit.approvalStatus !== 'approved') {
          notify.warning('Host approval is required — entry saved and sent for approval instead.')
        } else {
          await gateService.recordVisitorEntry(visit.id)
          notify.success(`${visit.visitorName} allowed inside.`)
        }
      } else {
        notify.success(`Visitor entry ${visit.entryNumber} created${visit.hostApprovalRequired ? ' — approval requested' : ''}.`)
      }
      navigate(`/gate/visitors/${visit.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not save visitor entry')
    } finally {
      setBusyAction('')
    }
  }

  const err = useMemo(
    () => Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v?.message as string | undefined])),
    [errors],
  )

  if (!perms.canCreateVisitor && !isEdit) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="New Visitor Entry" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to create visitor entries." />
      </OperationalPageShell>
    )
  }
  if (isEdit && !perms.canEditVisitor) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="Edit Visitor Entry" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to edit visitor entries." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title={isEdit ? 'Edit Visitor Entry' : 'New Visitor Entry'}
      description="Search first — repeat visitors take seconds, not minutes."
      showDescription
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Visitors', to: '/gate/visitors' }, { label: isEdit ? 'Edit' : 'New' }]}
      backLink={{ to: '/gate/visitors', label: 'Back to Visitors' }}
    >
      <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
        {stage === 'search' ? (
          <>
            <section className="rounded-lg border border-erp-border bg-white p-5">
              <h3 className="mb-1 text-[14px] font-semibold text-erp-text">Search visitor by mobile number</h3>
              <p className="mb-3 text-[12.5px] text-erp-muted">
                Repeat visitors are pre-filled from their last visit. New visitors continue to a fresh form.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <MobileInput
                  value={searchMobile}
                  onChange={(e) => setSearchMobile(e.target.value)}
                  maxDigits={10}
                  placeholder="10-digit mobile number"
                  className="h-11 w-64 text-[15px]"
                  aria-label="Visitor mobile number"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void runSearch()
                  }}
                  autoFocus
                />
                <ErpButton icon={Search} onClick={() => void runSearch()} loading={searching} disabled={searching}>
                  Search
                </ErpButton>
                <ErpButton variant="ghost" onClick={startNewEntry}>
                  Skip — Start New Entry
                </ErpButton>
              </div>
            </section>
            {searched && foundVisitor ? (
              <VisitorHistoryCard visitor={foundVisitor} onUsePrevious={usePreviousDetails} onStartNew={startNewEntry} />
            ) : null}
            {searched && !foundVisitor ? (
              <section className="rounded-lg border border-erp-border bg-white p-5 text-center">
                <UserRound className="mx-auto mb-2 h-8 w-8 text-erp-muted" aria-hidden />
                <p className="text-[13.5px] font-medium text-erp-text">No previous visits for {searchMobile}</p>
                <p className="mb-3 text-[12.5px] text-erp-muted">This is a first-time visitor — continue to the entry form.</p>
                <ErpButton onClick={startNewEntry}>Start New Entry</ErpButton>
              </section>
            ) : null}
          </>
        ) : (
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            {/* Visitor details */}
            <section className="rounded-lg border border-erp-border bg-white p-4">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Visitor details</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Visitor name" required error={err.visitorName}>
                  <Input {...register('visitorName')} error={Boolean(err.visitorName)} placeholder="Full name" />
                </FormField>
                <FormField label="Mobile number" required error={err.mobile}>
                  <MobileInput
                    maxDigits={10}
                    value={watch('mobile')}
                    onChange={(e) => setValue('mobile', e.target.value, { shouldValidate: true })}
                    error={Boolean(err.mobile)}
                  />
                </FormField>
                <FormField label="Visitor type" required error={err.visitorType}>
                  <Select value={watch('visitorType')} onChange={(e) => setValue('visitorType', e.target.value, { shouldValidate: true })} error={Boolean(err.visitorType)}>
                    <option value="">— Select —</option>
                    {Object.entries(VISITOR_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Company">
                  <Input {...register('company')} placeholder="Company / organisation" />
                </FormField>
                <FormField label="Email" error={err.email}>
                  <Input type="email" {...register('email')} error={Boolean(err.email)} />
                </FormField>
                <FormField label="Visitor count" error={err.visitorCount}>
                  <Input type="number" min={1} {...register('visitorCount')} error={Boolean(err.visitorCount)} />
                </FormField>
                <FormField label="Photo" hint="Camera capture is a placeholder until hardware integration.">
                  <div className="flex h-[38px] items-center gap-2 rounded-md border border-dashed border-erp-border px-3 text-[12.5px] text-erp-muted">
                    <UserRound className="h-4 w-4" aria-hidden /> Photo placeholder
                  </div>
                </FormField>
                <FormField label="ID type">
                  <Select value={watch('idType') ?? ''} onChange={(e) => setValue('idType', e.target.value)}>
                    <option value="">— Select —</option>
                    {ID_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Masked ID reference" hint="Never record a complete Aadhaar or ID number.">
                  <Input {...register('idReferenceMasked')} placeholder="e.g. DL ****4471" />
                </FormField>
              </div>
            </section>

            {/* Visit details */}
            <section className="rounded-lg border border-erp-border bg-white p-4">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Visit details</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Person to meet (host)" required error={err.hostName}>
                  <Select
                    value={watch('hostName')}
                    onChange={(e) => {
                      setValue('hostName', e.target.value, { shouldValidate: true })
                      const host = GATE_HOSTS.find((h) => h.name === e.target.value)
                      if (host && !watch('department')) setValue('department', host.department, { shouldValidate: true })
                    }}
                    error={Boolean(err.hostName)}
                  >
                    <option value="">— Select —</option>
                    {GATE_HOSTS.map((h) => (
                      <option key={h.name} value={h.name}>
                        {h.name} ({h.department})
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Department" required error={err.department}>
                  <Select value={watch('department')} onChange={(e) => setValue('department', e.target.value, { shouldValidate: true })} error={Boolean(err.department)}>
                    <option value="">— Select —</option>
                    {GATE_DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Gate" required error={err.gate}>
                  <Select value={watch('gate')} onChange={(e) => setValue('gate', e.target.value, { shouldValidate: true })} error={Boolean(err.gate)}>
                    <option value="">— Select —</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.name}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Purpose" required error={err.purpose} className="sm:col-span-2">
                  <Input {...register('purpose')} error={Boolean(err.purpose)} placeholder="e.g. Machine service, quality audit…" />
                </FormField>
                <FormField label="Expected duration (min)">
                  <Input type="number" min={0} {...register('expectedDurationMinutes')} />
                </FormField>
                <FormField label="Meeting location">
                  <Input {...register('meetingLocation')} placeholder="e.g. Conference room, shop floor" />
                </FormField>
                <FormField label="Remarks" className="sm:col-span-2">
                  <Textarea rows={2} {...register('remarks')} />
                </FormField>
              </div>
            </section>

            {/* Vehicle & belongings */}
            <section className="rounded-lg border border-erp-border bg-white p-4">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Vehicle & belongings</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Vehicle number">
                  <Input {...register('vehicleNumber')} placeholder="e.g. TN 01 AB 1234" />
                </FormField>
                <FormField label="Vehicle type">
                  <Select value={watch('vehicleType') ?? ''} onChange={(e) => setValue('vehicleType', e.target.value)}>
                    <option value="">— Select —</option>
                    {(settings?.masters.vehicleTypes ?? []).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Bag count">
                  <Input type="number" min={0} {...register('bagCount')} />
                </FormField>
                <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                  <Checkbox label="Laptop carried" checked={watch('laptopCarried')} onChange={(e) => setValue('laptopCarried', e.target.checked)} />
                  <Checkbox label="Equipment carried" checked={watch('equipmentCarried')} onChange={(e) => setValue('equipmentCarried', e.target.checked)} />
                </div>
                <FormField label="Belongings description" className="sm:col-span-3">
                  <Input {...register('belongingsDescription')} placeholder="e.g. Tool kit, sample box…" />
                </FormField>
              </div>
            </section>

            {/* Safety & approval */}
            <section className="rounded-lg border border-erp-border bg-white p-4">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Safety & approval</h3>
              <div className="space-y-2.5">
                <Checkbox
                  label="Visitor has read and accepted the plant safety declaration"
                  checked={safetyAccepted}
                  onChange={(e) => setValue('safetyDeclarationAccepted', e.target.checked)}
                />
                <div className="flex flex-wrap items-center gap-4">
                  <Checkbox label="PPE required" checked={watch('ppeRequired')} onChange={(e) => setValue('ppeRequired', e.target.checked)} />
                  <Checkbox label="NDA required" checked={watch('ndaRequired')} onChange={(e) => setValue('ndaRequired', e.target.checked)} />
                  <Checkbox
                    label="Host approval required"
                    checked={hostApprovalRequired}
                    onChange={(e) => setValue('hostApprovalRequired', e.target.checked)}
                    disabled={settings?.visitor.hostApprovalRequired}
                  />
                </div>
                {settings?.visitor.hostApprovalRequired ? (
                  <p className="text-[12px] text-erp-muted">Host approval is enforced by gate settings for all walk-in visitors.</p>
                ) : null}
              </div>
            </section>

            {/* Actions — sticky footer for tablet use */}
            <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-erp-border bg-white px-4 py-3">
              {isEdit ? (
                <ErpButton onClick={handleSubmit((v) => void persist(v, 'save'))} loading={busyAction === 'save'} disabled={busyAction !== ''}>
                  Save Changes
                </ErpButton>
              ) : (
                <>
                  {hostApprovalRequired ? (
                    <ErpButton icon={Send} onClick={handleSubmit((v) => void persist(v, 'approval'))} loading={busyAction === 'approval'} disabled={busyAction !== ''}>
                      Request Approval
                    </ErpButton>
                  ) : (
                    <ErpButton icon={LogIn} onClick={handleSubmit((v) => void persist(v, 'entry'))} loading={busyAction === 'entry'} disabled={busyAction !== '' || !perms.canVisitorEntry}>
                      Allow Entry
                    </ErpButton>
                  )}
                  <ErpButton
                    variant="secondary"
                    icon={CalendarPlus}
                    onClick={handleSubmit((v) => void persist(v, 'expected'))}
                    loading={busyAction === 'expected'}
                    disabled={busyAction !== ''}
                  >
                    Save as Expected Visitor
                  </ErpButton>
                </>
              )}
              <ErpButton variant="ghost" icon={X} onClick={() => navigate(isEdit && id ? `/gate/visitors/${id}` : '/gate/visitors')} disabled={busyAction !== ''}>
                Cancel
              </ErpButton>
            </div>
          </form>
        )}
      </div>
    </OperationalPageShell>
  )
}
