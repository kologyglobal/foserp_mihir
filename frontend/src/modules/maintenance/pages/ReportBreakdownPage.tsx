import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Camera, CheckCircle2, Factory, Loader2, MapPin, Wrench, X } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { getStoredSession } from '@/services/api/client'
import { listAllMachines } from '@/services/api/manufacturingApi'
import {
  createMaintenanceTicket,
  MAX_MAINTENANCE_PHOTOS,
  type MaintenanceFailureCategory,
  type MaintenancePriority,
  type MaintenanceSourceType,
  uploadMaintenancePhoto,
} from '@/services/api/maintenanceApi'
import { notify } from '@/store/toastStore'
import { useMaintenancePermissions } from '@/utils/permissions/maintenance'
import { MAINTENANCE_BREADCRUMB } from '../maintenanceUi'
import type { Machine } from '@/types/manufacturingSetup'

const PRIORITIES: MaintenancePriority[] = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL']
const FAILURE_CATEGORIES: MaintenanceFailureCategory[] = [
  'MECHANICAL',
  'ELECTRICAL',
  'HYDRAULIC',
  'PNEUMATIC',
  'CONTROL',
  'SAFETY',
  'OTHER',
]

type GpsState = {
  status: 'idle' | 'pending' | 'ready' | 'denied' | 'unavailable'
  latitude?: number
  longitude?: number
  accuracyM?: number
}

/** Start Maintenance / report breakdown — mobile-friendly, client feedback flow. */
export function ReportBreakdownPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const perms = useMaintenancePermissions()
  const session = getStoredSession()
  const defaultOperator =
    [session?.user?.firstName, session?.user?.lastName].filter(Boolean).join(' ').trim() ||
    session?.user?.email ||
    ''

  const [machines, setMachines] = useState<Machine[]>([])
  const [machineId, setMachineId] = useState(params.get('machineId') ?? '')
  const [problem, setProblem] = useState('')
  const [priority, setPriority] = useState<MaintenancePriority>('NORMAL')
  const [failureCategory, setFailureCategory] = useState<MaintenanceFailureCategory | ''>('')
  const [remarks, setRemarks] = useState('')
  const [operatorName, setOperatorName] = useState(defaultOperator)
  const [photos, setPhotos] = useState<File[]>([])
  const [gps, setGps] = useState<GpsState>({ status: 'idle' })
  const [machinesLoading, setMachinesLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const prefill = useMemo(
    () => ({
      workOrderId: params.get('workOrderId') ?? undefined,
      jobCardId: params.get('jobCardId') ?? undefined,
      jobCardCode: params.get('jobCardCode') ?? undefined,
      operationId: params.get('operationId') ?? undefined,
      operationCode: params.get('operationCode') ?? undefined,
      operationName: params.get('operationName') ?? undefined,
      sourceType: (params.get('sourceType') as MaintenanceSourceType | null) ?? undefined,
    }),
    [params],
  )

  useEffect(() => {
    void (async () => {
      try {
        setMachines(await listAllMachines({ isActive: true }))
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Failed to load machines')
      } finally {
        setMachinesLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) {
      setGps({ status: 'unavailable' })
      return
    }
    setGps({ status: 'pending' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          status: 'ready',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        })
      },
      () => setGps({ status: 'denied' }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    )
  }, [])

  const selected = machines.find((m) => m.id === machineId)

  const addPhotos = (files: FileList | null) => {
    if (!files?.length) return
    const next = [...photos]
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      if (next.length >= MAX_MAINTENANCE_PHOTOS) break
      next.push(file)
    }
    setPhotos(next)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const submit = async () => {
    if (!perms.canCreate) {
      notify.error('You do not have permission to start maintenance')
      return
    }
    if (!machineId || problem.trim().length < 3) {
      notify.error('Machine and problem are required')
      return
    }
    if (!operatorName.trim()) {
      notify.error('Operator name is required')
      return
    }
    setBusy(true)
    try {
      const res = await createMaintenanceTicket({
        machineId,
        problem: problem.trim(),
        priority,
        failureCategory: failureCategory || undefined,
        remarks: remarks.trim() || undefined,
        operatorName: operatorName.trim(),
        reportedLatitude: gps.latitude,
        reportedLongitude: gps.longitude,
        reportedAccuracyM: gps.accuracyM,
        sourceType: prefill.sourceType ?? (prefill.workOrderId ? 'WORK_ORDER' : 'MANUAL'),
        workOrderId: prefill.workOrderId,
        jobCardId: prefill.jobCardId,
        jobCardCode: prefill.jobCardCode,
        operationId: prefill.operationId,
        operationCode: prefill.operationCode,
        operationName: prefill.operationName,
      })
      let photoFails = 0
      for (const file of photos) {
        try {
          await uploadMaintenancePhoto(res.data.id, file, 'BEFORE')
        } catch {
          photoFails += 1
        }
      }
      if (photoFails > 0) {
        notify.warning(`Ticket ${res.data.ticketNumber} created, but ${photoFails} photo(s) failed to upload`)
      } else {
        notify.success(`Ticket ${res.data.ticketNumber} created`)
      }
      navigate(`/maintenance/tickets/${res.data.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to start maintenance')
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submit()
  }

  const gpsLabel =
    gps.status === 'ready'
      ? `${gps.latitude?.toFixed(5)}, ${gps.longitude?.toFixed(5)} (±${Math.round(gps.accuracyM ?? 0)}m)`
      : gps.status === 'pending'
        ? 'Capturing GPS…'
        : gps.status === 'denied'
          ? 'GPS denied — plant/workstation will be used'
          : gps.status === 'unavailable'
            ? 'GPS unavailable — plant/workstation will be used'
            : 'Location pending'

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Maintenance"
      title="Start Maintenance"
      description="Attend the machine issue immediately and create the maintenance record."
      breadcrumbs={[MAINTENANCE_BREADCRUMB, { label: 'Tickets', to: '/maintenance/tickets' }, { label: 'Start' }]}
      autoBreadcrumbs={false}
      favoritePath="/maintenance/tickets/new"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'start',
            label: busy ? 'Starting…' : 'Start Maintenance',
            onClick: () => void submit(),
            disabled: busy || !perms.canCreate,
          }}
        />
      }
    >
      <form className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-5 sm:py-5" onSubmit={onSubmit}>
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-erp-border bg-white px-4 py-3 text-xs text-erp-muted">
          {[
            ['1', 'Machine & problem'],
            ['2', 'Photos (up to 4)'],
            ['3', 'Start maintenance'],
          ].map(([step, label]) => (
            <div key={step} className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-erp-primary/10 font-semibold text-erp-primary">
                {step}
              </span>
              <span className="font-medium text-erp-text">{label}</span>
            </div>
          ))}
        </div>

        {(prefill.workOrderId || prefill.jobCardCode || prefill.operationName) && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <Factory className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="font-semibold">Production context linked</p>
              <p className="mt-0.5 text-xs text-amber-800">
                {prefill.workOrderId ? 'Work order' : ''}
                {prefill.jobCardCode ? ` · ${prefill.jobCardCode}` : ''}
                {prefill.operationName ? ` · ${prefill.operationName}` : ''}
              </p>
            </div>
          </div>
        )}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="overflow-hidden rounded-lg border border-erp-border bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-erp-border bg-erp-page px-4 py-3 sm:px-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-erp-border bg-white text-erp-primary">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-erp-text">Machine issue</h2>
                <p className="text-xs text-erp-muted">Operator must attend immediately and log the breakdown.</p>
              </div>
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <FormField label="Machine" required className="sm:col-span-2">
                <Select
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                  className="min-h-11 text-sm"
                  disabled={machinesLoading}
                >
                  <option value="">{machinesLoading ? 'Loading machines…' : SELECT_PLACEHOLDER}</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} — {m.name}
                    </option>
                  ))}
                </Select>
              </FormField>

              {selected ? (
                <div className="sm:col-span-2 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-sky-100 bg-sky-50 px-3 py-2.5 text-xs">
                  <span className="flex items-center gap-2 font-semibold text-sky-950">
                    <Wrench className="h-4 w-4 text-sky-700" />
                    {selected.code} · {selected.name}
                  </span>
                  <span className="text-sky-800">Plant / workstation captured from work centre</span>
                  <span className="ml-auto rounded-full bg-white px-2 py-0.5 font-medium text-sky-800 shadow-sm">
                    {selected.status.replaceAll('_', ' ')}
                  </span>
                </div>
              ) : null}

              <FormField label="Operator Name" required hint="Who is attending the machine issue">
                <Input
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  className="min-h-11"
                  placeholder="Operator / reporter name"
                />
              </FormField>

              <FormField label="Priority" hint="Use Critical only for safety or full production stoppage">
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as MaintenancePriority)}
                  className="min-h-11"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p.charAt(0) + p.slice(1).toLowerCase()}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Failure Category" hint="Optional — classify the symptom area">
                <Select
                  value={failureCategory}
                  onChange={(e) => setFailureCategory(e.target.value as MaintenanceFailureCategory | '')}
                  className="min-h-11"
                >
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  {FAILURE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0) + c.slice(1).toLowerCase()}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField
                label="Problem"
                required
                className="sm:col-span-2"
                hint={`${problem.trim().length} characters · Describe what stopped or sounds unusual`}
              >
                <Textarea
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  rows={4}
                  className="min-h-[108px] resize-y text-sm"
                  placeholder="Example: Main spindle stopped during rolling and is making a grinding noise"
                  autoFocus
                />
              </FormField>

              <FormField label="Remarks" className="sm:col-span-2" hint="Optional handover or access instructions">
                <Input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional"
                  className="min-h-11"
                />
              </FormField>
            </div>
          </section>

          <aside className="grid gap-4">
            <section className="rounded-lg border border-erp-border bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Camera className="h-4 w-4 text-erp-primary" />
                <h2 className="text-sm font-semibold text-erp-text">Photos</h2>
                <span className="ml-auto text-[11px] text-erp-muted">
                  {photos.length}/{MAX_MAINTENANCE_PHOTOS}
                </span>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="sr-only"
                onChange={(event) => addPhotos(event.target.files)}
              />
              <div className="grid gap-2">
                {photos.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-md border border-erp-border bg-erp-page p-2.5">
                    <Camera className="h-4 w-4 shrink-0 text-erp-primary" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-erp-text">{file.name}</span>
                    <button
                      type="button"
                      className="rounded p-1 text-erp-muted hover:bg-white hover:text-erp-text"
                      onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="Remove photo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              {photos.length < MAX_MAINTENANCE_PHOTOS ? (
                <button
                  type="button"
                  className="mt-2 flex min-h-20 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-erp-border bg-erp-page px-3 text-xs font-medium text-erp-muted transition-colors hover:border-erp-primary hover:text-erp-primary"
                  onClick={() => photoInputRef.current?.click()}
                >
                  <Camera className="h-5 w-5" />
                  Add photo ({MAX_MAINTENANCE_PHOTOS - photos.length} remaining)
                </button>
              ) : null}
              <p className="mt-2 text-[11px] leading-4 text-erp-muted">
                Up to four photos. Required before ticket closure.
              </p>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-4 text-xs text-erp-muted shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-erp-text">
                <MapPin className="h-4 w-4 text-erp-primary" />
                Location
              </div>
              <p className="leading-5">{gpsLabel}</p>
              <p className="mt-2 leading-5">
                Plant / workstation is derived from the machine work centre when GPS is unavailable.
              </p>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-4 text-xs text-erp-muted shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-erp-text">Next steps</h2>
              <ul className="grid gap-2.5">
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-erp-success-fg" />
                  Assign technician / contractor
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-erp-success-fg" />
                  Record parts changed &amp; service
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-erp-success-fg" />
                  Enter invoice &amp; amount, then close
                </li>
              </ul>
            </section>
          </aside>
        </div>

        <div className="sticky bottom-0 z-10 mt-4 flex items-center justify-end gap-2 border-t border-erp-border bg-white/95 px-3 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.05)] backdrop-blur sm:rounded-b-lg sm:border-x sm:border-b">
          <button
            type="button"
            className="min-h-10 rounded-md px-4 text-sm font-medium text-erp-muted hover:bg-erp-page hover:text-erp-text"
            onClick={() => navigate('/maintenance/tickets')}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex min-h-10 items-center justify-center gap-2 rounded-md bg-erp-primary px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-erp-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || !perms.canCreate || machinesLoading}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            {busy ? 'Starting…' : 'Start Maintenance'}
          </button>
        </div>
      </form>
    </OperationalPageShell>
  )
}
