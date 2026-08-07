import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, Clock, Moon, Plus, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LoadingState } from '@/design-system/components/LoadingState'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import {
  createShift,
  getShift,
  listShifts,
  updateShift,
  type HrShift,
} from '@/services/api/hrmsApi'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import { HrEmptyState, HrRegisterShell } from '../components'
import '../hrms-ui.css'

const WEEKDAYS = [
  { value: '', label: '— None —' },
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
]

export function ShiftListPage() {
  const navigate = useNavigate()
  const perms = useHrmsPermissions()
  const [rows, setRows] = useState<HrShift[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await listShifts({ limit: 100, search: search || undefined })
      setRows(res.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load shifts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void load(), 300)
    return () => clearTimeout(t)
  }, [search])

  return (
    <OperationalPageShell
      title="Shift Templates"
      description="Define day and overnight shifts used by roster and attendance."
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Shifts' }]}
    >
      <ErpCommandBar
        primaryAction={
          perms.canManageShift
            ? {
                id: 'new-shift',
                label: 'New Shift',
                icon: Plus,
                onClick: () => navigate('/hrms/shifts/new'),
              }
            : undefined
        }
        secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
      />
      <HrRegisterShell search={{ value: search, onChange: setSearch, placeholder: 'Search code or name…' }}>
        {loading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <HrEmptyState icon={CalendarDays} title="No shifts" description="Create GENERAL, SHIFT-A, or overnight SHIFT-C." />
        ) : (
          <table className="hr-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Timing</th>
                <th>Break</th>
                <th>Weekly Off</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} onClick={() => navigate(`/hrms/shifts/${s.id}`)}>
                  <td>
                    <span className="font-medium text-erp-primary">{s.code}</span>
                    {s.overnightShift ? (
                      <span className="ml-2 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
                        <Moon className="h-3 w-3" /> Overnight
                      </span>
                    ) : null}
                  </td>
                  <td>{s.name}</td>
                  <td className="tabular-nums">
                    {s.startTime} → {s.endTime}
                  </td>
                  <td>{s.breakMinutes}m</td>
                  <td>{WEEKDAYS.find((w) => w.value === String(s.weeklyOffDay ?? ''))?.label ?? '-'}</td>
                  <td>
                    <DynamicsStatusChip label={s.isActive ? 'Active' : 'Inactive'} tone={s.isActive ? 'success' : 'neutral'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </HrRegisterShell>
    </OperationalPageShell>
  )
}

type ShiftFormState = {
  code: string
  name: string
  startTime: string
  endTime: string
  breakMinutes: string
  graceInMinutes: string
  graceOutMinutes: string
  fullDayMinimumMinutes: string
  halfDayMinimumMinutes: string
  otEligible: boolean
  otStartsAfterMinutes: string
  overnightShift: boolean
  weeklyOffDay: string
  isActive: boolean
}

const emptyForm: ShiftFormState = {
  code: '',
  name: '',
  startTime: '09:00',
  endTime: '18:00',
  breakMinutes: '60',
  graceInMinutes: '10',
  graceOutMinutes: '',
  fullDayMinimumMinutes: '480',
  halfDayMinimumMinutes: '240',
  otEligible: true,
  otStartsAfterMinutes: '',
  overnightShift: false,
  weeklyOffDay: '',
  isActive: true,
}

export function ShiftFormPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const perms = useHrmsPermissions()
  const [form, setForm] = useState<ShiftFormState>(emptyForm)
  const [loading, setLoading] = useState(!isNew)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isNew) return
    void (async () => {
      try {
        const res = await getShift(id!)
        const s = res.data
        setForm({
          code: s.code,
          name: s.name,
          startTime: s.startTime,
          endTime: s.endTime,
          breakMinutes: String(s.breakMinutes),
          graceInMinutes: String(s.graceInMinutes),
          graceOutMinutes: s.graceOutMinutes != null ? String(s.graceOutMinutes) : '',
          fullDayMinimumMinutes: String(s.fullDayMinimumMinutes),
          halfDayMinimumMinutes: String(s.halfDayMinimumMinutes),
          otEligible: s.otEligible,
          otStartsAfterMinutes: s.otStartsAfterMinutes != null ? String(s.otStartsAfterMinutes) : '',
          overnightShift: s.overnightShift,
          weeklyOffDay: s.weeklyOffDay != null ? String(s.weeklyOffDay) : '',
          isActive: s.isActive,
        })
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Failed to load shift')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, isNew])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!perms.canManageShift) return
    setBusy(true)
    const body = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      startTime: form.startTime,
      endTime: form.endTime,
      breakMinutes: Number(form.breakMinutes) || 0,
      graceInMinutes: Number(form.graceInMinutes) || 0,
      graceOutMinutes: form.graceOutMinutes === '' ? null : Number(form.graceOutMinutes),
      fullDayMinimumMinutes: Number(form.fullDayMinimumMinutes),
      halfDayMinimumMinutes: Number(form.halfDayMinimumMinutes),
      otEligible: form.otEligible,
      otStartsAfterMinutes: form.otStartsAfterMinutes === '' ? null : Number(form.otStartsAfterMinutes),
      overnightShift: form.overnightShift,
      weeklyOffDay: form.weeklyOffDay === '' ? null : Number(form.weeklyOffDay),
      isActive: form.isActive,
    }
    try {
      if (isNew) {
        const res = await createShift(body)
        notify.success('Shift created')
        navigate(`/hrms/shifts/${res.data.id}`)
      } else {
        await updateShift(id!, body)
        notify.success('Shift updated')
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState />

  return (
    <OperationalPageShell
      title={isNew ? 'New Shift' : form.code || 'Shift'}
      description={isNew ? 'Create a shift template (overnight supported).' : form.name}
      breadcrumbs={[
        { label: 'HRMS', to: '/hrms' },
        { label: 'Shifts', to: '/hrms/shifts' },
        { label: isNew ? 'New' : form.code },
      ]}
    >
      <form onSubmit={onSubmit} className="max-w-3xl space-y-4 rounded border border-erp-border bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Code" required>
            <Input
              value={form.code}
              disabled={!isNew}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="Name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="Start" required>
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="End" required>
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="Break (minutes)">
            <Input
              type="number"
              min={0}
              value={form.breakMinutes}
              onChange={(e) => setForm((f) => ({ ...f, breakMinutes: e.target.value }))}
            />
          </FormField>
          <FormField label="Grace in (minutes)">
            <Input
              type="number"
              min={0}
              value={form.graceInMinutes}
              onChange={(e) => setForm((f) => ({ ...f, graceInMinutes: e.target.value }))}
            />
          </FormField>
          <FormField label="Full day min (minutes)" required>
            <Input
              type="number"
              min={1}
              value={form.fullDayMinimumMinutes}
              onChange={(e) => setForm((f) => ({ ...f, fullDayMinimumMinutes: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="Half day min (minutes)" required>
            <Input
              type="number"
              min={1}
              value={form.halfDayMinimumMinutes}
              onChange={(e) => setForm((f) => ({ ...f, halfDayMinimumMinutes: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="Weekly off">
            <Select
              value={form.weeklyOffDay}
              onChange={(e) => setForm((f) => ({ ...f, weeklyOffDay: e.target.value }))}
            >
              {WEEKDAYS.map((d) => (
                <option key={d.value || 'none'} value={d.value}>
                  {d.value === '' ? SELECT_PLACEHOLDER : d.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.overnightShift}
            onChange={(e) => setForm((f) => ({ ...f, overnightShift: e.target.checked }))}
          />
          Overnight shift (e.g. 22:00 → 06:00)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.otEligible}
            onChange={(e) => setForm((f) => ({ ...f, otEligible: e.target.checked }))}
          />
          OT eligible
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          Active
        </label>
        {perms.canManageShift ? (
          <button type="submit" className="btn btn--primary" disabled={busy}>
            <Clock className="mr-1 h-4 w-4" />
            {busy ? 'Saving…' : isNew ? 'Create Shift' : 'Save'}
          </button>
        ) : null}
      </form>
    </OperationalPageShell>
  )
}
