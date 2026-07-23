import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarPlus, Copy, Printer, QrCode, RefreshCw, ShieldOff, X } from 'lucide-react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField } from '@/components/forms/FormField'
import { Input, MobileInput, Select, Textarea } from '@/components/forms/Inputs'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { appConfirm } from '@/store/confirmDialogStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../../api/gateService'
import type { ExpectedVisitor, GateLocation } from '../../types/gate.types'
import { todayIsoDate } from '../../utils/gateStatus'
import { expectedVisitorSchema, type ExpectedVisitorFormValues } from '../../schemas/gateSchemas'
import { GateDataStates, GateModal, GateStatusBadge } from '../../components'
import type { GateLoadState } from '../../components'
import { GATE_BREADCRUMB, GATE_DEPARTMENTS, GATE_HOSTS } from '../../gateUi'

const DEFAULTS: ExpectedVisitorFormValues = {
  visitorName: '',
  mobile: '',
  company: '',
  visitDate: todayIsoDate(),
  expectedArrival: '10:00',
  hostName: '',
  department: '',
  purpose: '',
  gate: '',
  vehicleNumber: '',
  instructions: '',
}

/** Pre-registration of expected visitors with invitation preview (`/gate/visitors/expected`). */
export function ExpectedVisitorsPage() {
  const navigate = useNavigate()
  const perms = useGatePermissions()
  const [rows, setRows] = useState<ExpectedVisitor[]>([])
  const [locations, setLocations] = useState<GateLocation[]>([])
  const [state, setState] = useState<GateLoadState>('loading')
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [invitation, setInvitation] = useState<ExpectedVisitor | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ExpectedVisitorFormValues>({
    resolver: zodResolver(expectedVisitorSchema) as Resolver<ExpectedVisitorFormValues>,
    defaultValues: DEFAULTS,
  })

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    try {
      const [data, locs] = await Promise.all([gateService.getExpectedVisitors(), gateService.getGateLocations()])
      setRows(data.filter((r) => r.status !== 'cancelled'))
      setLocations(locs)
      setState(data.length === 0 ? 'empty' : 'ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load expected visitors')
      setState('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async (values: ExpectedVisitorFormValues) => {
    setBusy(true)
    try {
      const record = await gateService.createExpectedVisitor({
        ...values,
        company: values.company || undefined,
        vehicleNumber: values.vehicleNumber || undefined,
        instructions: values.instructions || undefined,
      })
      notify.success(`Expected visitor saved — reference ${record.reference}.`)
      setFormOpen(false)
      reset({ ...DEFAULTS, gate: locations[0]?.name ?? '' })
      setInvitation(record)
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not save expected visitor')
    } finally {
      setBusy(false)
    }
  }

  const cancelVisit = async (row: ExpectedVisitor) => {
    const ok = await appConfirm({
      title: 'Cancel expected visit?',
      description: `${row.visitorName} (${row.reference}) will be removed from today's expected list.`,
      tone: 'danger',
      confirmLabel: 'Cancel Visit',
    })
    if (!ok) return
    try {
      await gateService.cancelExpectedVisitor(row.id)
      notify.success('Expected visit cancelled.')
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not cancel visit')
    }
  }

  const copyReference = async (reference: string) => {
    try {
      await navigator.clipboard.writeText(reference)
      notify.success(`Reference ${reference} copied.`)
    } catch {
      notify.error('Could not copy to clipboard.')
    }
  }

  const err = Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v?.message as string | undefined]))

  if (!perms.canViewVisitor) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="Expected Visitors" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view expected visitors." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title="Expected Visitors"
      description="Pre-register visitors so gate check-in takes seconds."
      showDescription
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Visitors', to: '/gate/visitors' }, { label: 'Expected' }]}
      favoritePath="/gate/visitors/expected"
      backLink={{ to: '/gate/visitors', label: 'Back to Visitors' }}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateVisitor
              ? { id: 'new', label: 'Pre-register Visitor', icon: CalendarPlus, variant: 'primary', onClick: () => setFormOpen(true) }
              : undefined
          }
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      )}
    >
      <div className="p-3">
        <GateDataStates
          state={state}
          error={error}
          onRetry={() => void load()}
          emptyIcon={CalendarPlus}
          emptyTitle="No expected visitors"
          emptyDescription="Pre-register a visitor to generate an invitation reference for fast gate check-in."
          emptyAction={
            perms.canCreateVisitor ? (
              <ErpButton size="sm" onClick={() => setFormOpen(true)}>
                Pre-register Visitor
              </ErpButton>
            ) : undefined
          }
        >
          <div className="overflow-x-auto rounded-md border border-erp-border bg-white">
            <table className="erp-table w-full text-[12.5px]">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Visitor</th>
                  <th>Mobile</th>
                  <th>Company</th>
                  <th>Date</th>
                  <th>Expected Arrival</th>
                  <th>Host</th>
                  <th>Gate</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="tabular-nums">
                      <button type="button" className="font-medium text-erp-primary hover:underline" onClick={() => setInvitation(row)}>
                        {row.reference}
                      </button>
                    </td>
                    <td className="font-medium">{row.visitorName}</td>
                    <td className="tabular-nums">{row.mobile}</td>
                    <td>{row.company ?? '—'}</td>
                    <td>{formatDate(row.visitDate)}</td>
                    <td>{row.expectedArrival}</td>
                    <td>{row.hostName}</td>
                    <td>{row.gate}</td>
                    <td>
                      <GateStatusBadge status={row.status} />
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {row.status === 'expected' && perms.canCreateVisitor ? (
                          <ErpButton size="sm" variant="outline" onClick={() => navigate(`/gate/visitors/new?expectedId=${row.id}`)}>
                            Mark Arrived
                          </ErpButton>
                        ) : null}
                        {row.status === 'expected' && perms.canEditVisitor ? (
                          <ErpButton size="sm" variant="ghost" onClick={() => void cancelVisit(row)}>
                            Cancel
                          </ErpButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GateDataStates>
      </div>

      {/* Pre-registration form */}
      <GateModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Pre-register Expected Visitor"
        widthClassName="max-w-2xl"
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="ghost" icon={X} onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </ErpButton>
            <ErpButton onClick={handleSubmit((v) => void submit(v))} loading={busy} disabled={busy}>
              Save Expected Visitor
            </ErpButton>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Visitor name" required error={err.visitorName}>
            <Input {...register('visitorName')} error={Boolean(err.visitorName)} />
          </FormField>
          <FormField label="Mobile" required error={err.mobile}>
            <MobileInput maxDigits={10} value={watch('mobile')} onChange={(e) => setValue('mobile', e.target.value, { shouldValidate: true })} error={Boolean(err.mobile)} />
          </FormField>
          <FormField label="Company">
            <Input {...register('company')} />
          </FormField>
          <FormField label="Visit date" required error={err.visitDate}>
            <Input type="date" {...register('visitDate')} error={Boolean(err.visitDate)} />
          </FormField>
          <FormField label="Expected arrival" required error={err.expectedArrival}>
            <Input type="time" {...register('expectedArrival')} error={Boolean(err.expectedArrival)} />
          </FormField>
          <FormField label="Host" required error={err.hostName}>
            <Select
              value={watch('hostName')}
              onChange={(e) => {
                setValue('hostName', e.target.value, { shouldValidate: true })
                const host = GATE_HOSTS.find((h) => h.name === e.target.value)
                if (host) setValue('department', host.department, { shouldValidate: true })
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
            <Input {...register('purpose')} error={Boolean(err.purpose)} />
          </FormField>
          <FormField label="Vehicle number">
            <Input {...register('vehicleNumber')} placeholder="Optional" />
          </FormField>
          <FormField label="Instructions" className="sm:col-span-2">
            <Textarea rows={2} {...register('instructions')} placeholder="e.g. Escort to admin block" />
          </FormField>
        </div>
      </GateModal>

      {/* Invitation preview */}
      <GateModal
        open={Boolean(invitation)}
        onClose={() => setInvitation(null)}
        title="Visitor Invitation"
        subtitle={invitation?.reference}
        footer={
          invitation ? (
            <div className="flex flex-wrap justify-end gap-2">
              <ErpButton variant="secondary" icon={Printer} onClick={() => window.print()}>
                Print Invitation
              </ErpButton>
              <ErpButton variant="secondary" icon={Copy} onClick={() => void copyReference(invitation.reference)}>
                Copy Reference
              </ErpButton>
              {invitation.status === 'expected' && perms.canCreateVisitor ? (
                <ErpButton onClick={() => navigate(`/gate/visitors/new?expectedId=${invitation.id}`)}>Mark Arrived</ErpButton>
              ) : null}
              {invitation.status === 'expected' && perms.canEditVisitor ? (
                <ErpButton
                  variant="danger"
                  onClick={() => {
                    setInvitation(null)
                    void cancelVisit(invitation)
                  }}
                >
                  Cancel Visit
                </ErpButton>
              ) : null}
            </div>
          ) : null
        }
      >
        {invitation ? (
          <div className="gate-pass-print rounded-lg border border-dashed border-erp-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">FOS Trailers — Visitor Invitation</p>
                <p className="text-[16px] font-bold tabular-nums text-erp-text">{invitation.reference}</p>
                <dl className="mt-2 space-y-1 text-[13px]">
                  <div className="flex gap-2">
                    <dt className="text-erp-muted">Visitor:</dt>
                    <dd className="font-semibold text-erp-text">{invitation.visitorName}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-erp-muted">Date & time:</dt>
                    <dd className="font-medium text-erp-text">
                      {formatDate(invitation.visitDate)} · {invitation.expectedArrival}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-erp-muted">Host:</dt>
                    <dd className="font-medium text-erp-text">
                      {invitation.hostName} ({invitation.department})
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-erp-muted">Gate:</dt>
                    <dd className="font-medium text-erp-text">{invitation.gate}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-erp-muted">Purpose:</dt>
                    <dd className="font-medium text-erp-text">{invitation.purpose}</dd>
                  </div>
                  {invitation.instructions ? (
                    <div className="flex gap-2">
                      <dt className="text-erp-muted">Instructions:</dt>
                      <dd className="font-medium text-erp-text">{invitation.instructions}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md border border-dashed border-erp-border" title="QR placeholder — scanner integration pending">
                <QrCode className="h-14 w-14 text-erp-muted" aria-label="QR placeholder" />
              </div>
            </div>
            <p className="mt-3 border-t border-dashed border-erp-border pt-2 text-center text-[11px] text-erp-muted">
              Show this reference at {invitation.gate} on arrival · Carry a valid photo ID
            </p>
          </div>
        ) : null}
      </GateModal>
    </OperationalPageShell>
  )
}
