import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  ListPlus,
  Loader2,
  Trash2,
  Wrench,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { createPreventivePlan, type PmFrequencyType } from '@/services/api/maintenanceApi'
import { listAllMachines } from '@/services/api/manufacturingApi'
import { notify } from '@/store/toastStore'
import { useMaintenancePermissions } from '@/utils/permissions/maintenance'
import { MAINTENANCE_BREADCRUMB } from '../maintenanceUi'
import type { Machine } from '@/types/manufacturingSetup'

const DEFAULT_CHECKLIST = [
  'Clean machine',
  'Check lubrication',
  'Check bearing',
  'Check electrical connections',
  'Inspect safety guards',
]

const FREQUENCY_OPTIONS: Array<{ value: PmFrequencyType; label: string; unit: string }> = [
  { value: 'DAYS', label: 'Days', unit: 'day' },
  { value: 'WEEKS', label: 'Weeks', unit: 'week' },
  { value: 'MONTHS', label: 'Months', unit: 'month' },
]

function addFrequency(isoDate: string, type: PmFrequencyType, value: number): string {
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  const n = Math.max(1, value)
  if (type === 'DAYS') d.setDate(d.getDate() + n)
  else if (type === 'WEEKS') d.setDate(d.getDate() + n * 7)
  else d.setMonth(d.getMonth() + n)
  return d.toISOString().slice(0, 10)
}

function formatDisplayDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function frequencyLabel(type: PmFrequencyType, value: number): string {
  const opt = FREQUENCY_OPTIONS.find((o) => o.value === type)
  const unit = opt?.unit ?? 'period'
  return `Every ${value} ${unit}${value === 1 ? '' : 's'}`
}

export function PreventiveMaintenanceNewPage() {
  const navigate = useNavigate()
  const perms = useMaintenancePermissions()
  const [machines, setMachines] = useState<Machine[]>([])
  const [machinesLoading, setMachinesLoading] = useState(true)
  const [machineId, setMachineId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [frequencyType, setFrequencyType] = useState<PmFrequencyType>('MONTHS')
  const [frequencyValue, setFrequencyValue] = useState(1)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [nextDueDate, setNextDueDate] = useState(() =>
    addFrequency(new Date().toISOString().slice(0, 10), 'MONTHS', 1),
  )
  const [checklistItems, setChecklistItems] = useState<string[]>(DEFAULT_CHECKLIST)
  const [saving, setSaving] = useState(false)
  const [autoDue, setAutoDue] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        setMachines(await listAllMachines({ isActive: true }))
      } catch {
        setMachines([])
        notify.error('Failed to load machines')
      } finally {
        setMachinesLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!autoDue) return
    setNextDueDate(addFrequency(startDate, frequencyType, frequencyValue))
  }, [autoDue, startDate, frequencyType, frequencyValue])

  const selected = useMemo(
    () => machines.find((m) => m.id === machineId) ?? null,
    [machines, machineId],
  )

  const checklistCount = checklistItems.filter((t) => t.trim()).length
  const canSave =
    perms.canCreate && Boolean(machineId) && name.trim().length >= 2 && !saving && !machinesLoading

  const updateChecklistItem = (index: number, value: string) => {
    setChecklistItems((prev) => prev.map((item, i) => (i === index ? value : item)))
  }

  const removeChecklistItem = (index: number) => {
    setChecklistItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const addChecklistItem = () => {
    setChecklistItems((prev) => [...prev, ''])
  }

  const save = async () => {
    if (!perms.canCreate) {
      notify.error('Missing maintenance.create permission')
      return
    }
    if (!machineId || name.trim().length < 2) {
      notify.error('Machine and name are required')
      return
    }
    const checklist = checklistItems
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text, i) => ({ text, sequence: i + 1 }))
    if (checklist.length === 0) {
      notify.error('Add at least one checklist item')
      return
    }

    setSaving(true)
    try {
      const res = await createPreventivePlan({
        machineId,
        name: name.trim(),
        description: description.trim() || null,
        frequencyType,
        frequencyValue: Math.max(1, frequencyValue),
        startDate,
        nextDueDate,
        checklist,
      })
      notify.success(`Created ${res.data.planNumber}`)
      navigate(`/maintenance/preventive/${res.data.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to create plan')
    } finally {
      setSaving(false)
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void save()
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Maintenance"
      title="New PM Plan"
      description="Define the machine, service cadence, and checklist technicians will follow."
      breadcrumbs={[
        MAINTENANCE_BREADCRUMB,
        { label: 'Preventive Maintenance', to: '/maintenance/preventive' },
        { label: 'New' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/maintenance/preventive/new"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'save',
            label: saving ? 'Saving…' : 'Save Plan',
            onClick: () => void save(),
            disabled: !canSave,
          }}
          secondaryActions={[
            { id: 'cancel', label: 'Cancel', onClick: () => navigate('/maintenance/preventive') },
          ]}
        />
      }
    >
      <form className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-5 sm:py-5" onSubmit={onSubmit}>
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-erp-border bg-white px-4 py-3 text-xs text-erp-muted">
          {[
            ['1', 'Machine & plan'],
            ['2', 'Schedule'],
            ['3', 'Checklist'],
          ].map(([step, label]) => (
            <div key={step} className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-erp-primary/10 font-semibold text-erp-primary">
                {step}
              </span>
              <span className="font-medium text-erp-text">{label}</span>
            </div>
          ))}
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid gap-4">
            <section className="overflow-hidden rounded-lg border border-erp-border bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-erp-border bg-erp-page px-4 py-3 sm:px-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-erp-border bg-white text-erp-primary">
                  <Wrench className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-erp-text">Machine & plan</h2>
                  <p className="text-xs text-erp-muted">Which asset this preventive service covers.</p>
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
                    <span className="ml-auto rounded-full bg-white px-2 py-0.5 font-medium text-sky-800 shadow-sm">
                      {(selected.status ?? 'ACTIVE').replaceAll('_', ' ')}
                    </span>
                  </div>
                ) : null}

                <FormField label="Plan name" required className="sm:col-span-2">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="min-h-11"
                    placeholder="e.g. Shot Blasting — Monthly service"
                    autoFocus
                  />
                </FormField>

                <FormField
                  label="Description"
                  className="sm:col-span-2"
                  hint="Optional scope notes for technicians"
                >
                  <Textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="resize-y text-sm"
                    placeholder="What this PM covers, tools needed, or safety notes"
                  />
                </FormField>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-erp-border bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-erp-border bg-erp-page px-4 py-3 sm:px-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-erp-border bg-white text-erp-primary">
                  <CalendarClock className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-erp-text">Schedule</h2>
                  <p className="text-xs text-erp-muted">How often service repeats and when it is next due.</p>
                </div>
              </div>

              <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
                <FormField label="Frequency">
                  <Select
                    value={frequencyType}
                    onChange={(e) => setFrequencyType(e.target.value as PmFrequencyType)}
                    className="min-h-11"
                  >
                    {FREQUENCY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Every">
                  <Input
                    type="number"
                    min={1}
                    value={frequencyValue}
                    onChange={(e) => setFrequencyValue(Math.max(1, Number(e.target.value) || 1))}
                    className="min-h-11"
                  />
                </FormField>
                <FormField label="Start date">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="min-h-11"
                  />
                </FormField>
                <FormField
                  label="Next due date"
                  className="sm:col-span-2"
                  hint={autoDue ? 'Synced from start date + frequency' : 'Manual override'}
                >
                  <Input
                    type="date"
                    value={nextDueDate}
                    onChange={(e) => {
                      setAutoDue(false)
                      setNextDueDate(e.target.value)
                    }}
                    className="min-h-11"
                  />
                </FormField>
                <div className="flex items-end">
                  <button
                    type="button"
                    className="mb-0.5 text-xs font-semibold text-erp-primary hover:underline"
                    onClick={() => setAutoDue(true)}
                    disabled={autoDue}
                  >
                    {autoDue ? 'Auto-calculated' : 'Recalculate from frequency'}
                  </button>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-erp-border bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-erp-border bg-erp-page px-4 py-3 sm:px-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-erp-border bg-white text-erp-primary">
                  <ClipboardList className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-erp-text">Service checklist</h2>
                  <p className="text-xs text-erp-muted">
                    Steps technicians complete when a PM ticket is opened.
                  </p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-erp-muted shadow-sm">
                  {checklistCount} item{checklistCount === 1 ? '' : 's'}
                </span>
              </div>

              <div className="grid gap-2 p-4 sm:p-5">
                {checklistItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-erp-border bg-erp-page text-[11px] font-semibold text-erp-muted">
                      {index + 1}
                    </span>
                    <Input
                      value={item}
                      onChange={(e) => updateChecklistItem(index, e.target.value)}
                      className="min-h-10"
                      placeholder={`Checklist step ${index + 1}`}
                    />
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-erp-border text-erp-muted hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
                      onClick={() => removeChecklistItem(index)}
                      disabled={checklistItems.length <= 1}
                      aria-label={`Remove checklist step ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addChecklistItem}
                  className="mt-1 inline-flex items-center justify-center gap-2 rounded-md border border-dashed border-erp-border px-3 py-2.5 text-xs font-semibold text-erp-primary hover:bg-erp-page"
                >
                  <ListPlus className="h-4 w-4" />
                  Add checklist step
                </button>
              </div>
            </section>
          </div>

          <aside className="grid gap-4 lg:sticky lg:top-4">
            <section className="rounded-lg border border-erp-border bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-erp-primary" />
                <h2 className="text-sm font-semibold text-erp-text">Plan summary</h2>
              </div>
              <dl className="grid gap-3 text-xs">
                <div>
                  <dt className="text-erp-muted">Machine</dt>
                  <dd className="mt-0.5 font-medium text-erp-text">
                    {selected ? `${selected.code} — ${selected.name}` : 'Not selected'}
                  </dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Cadence</dt>
                  <dd className="mt-0.5 font-medium text-erp-text">
                    {frequencyLabel(frequencyType, frequencyValue)}
                  </dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Next due</dt>
                  <dd className="mt-0.5 font-semibold text-erp-text">{formatDisplayDate(nextDueDate)}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Checklist</dt>
                  <dd className="mt-0.5 font-medium text-erp-text">
                    {checklistCount} step{checklistCount === 1 ? '' : 's'}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-erp-primary" />
                <h2 className="text-sm font-semibold text-erp-text">After you save</h2>
              </div>
              <ol className="grid gap-2.5 text-xs text-erp-muted">
                <li className="flex gap-2">
                  <span className="font-semibold text-erp-primary">1.</span>
                  Plan appears on the PM register with due status.
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-erp-primary">2.</span>
                  When due, create a maintenance ticket from the plan.
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-erp-primary">3.</span>
                  Close the ticket to roll the next due date forward.
                </li>
              </ol>
            </section>

            <button
              type="submit"
              disabled={!canSave}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-erp-primary px-4 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 lg:hidden"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving…' : 'Save Plan'}
            </button>
          </aside>
        </div>
      </form>
    </OperationalPageShell>
  )
}
