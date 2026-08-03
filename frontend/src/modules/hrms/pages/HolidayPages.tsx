import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  addHolidayDay,
  createHolidayCalendar,
  getHolidayCalendar,
  listHolidayCalendars,
  removeHolidayDay,
  type HrHolidayCalendar,
} from '@/services/api/hrmsApi'
import { listLegalEntities, listBranches } from '@/services/api/financeApi'
import { notify } from '@/store/toastStore'
import { appConfirm } from '@/store/confirmDialogStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import { HrEmptyState, HrRegisterShell } from '../components'
import '../hrms-ui.css'

export function HolidayListPage() {
  const navigate = useNavigate()
  const perms = useHrmsPermissions()
  const [rows, setRows] = useState<HrHolidayCalendar[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await listHolidayCalendars({ limit: 100 })
      setRows(res.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load calendars')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.legalEntity?.displayName ?? '').toLowerCase().includes(q),
    )
  }, [rows, search])

  return (
    <OperationalPageShell
      title="Holiday Calendars"
      description="Legal entity / branch holiday calendars for attendance."
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Holidays' }]}
    >
      <ErpCommandBar
        primaryAction={
          perms.canManageHoliday
            ? {
                id: 'new-calendar',
                label: 'New Calendar',
                icon: Plus,
                onClick: () => navigate('/hrms/holidays/new'),
              }
            : undefined
        }
        secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
      />
      <HrRegisterShell search={{ value: search, onChange: setSearch, placeholder: 'Search code or name…' }}>
        {loading ? (
          <LoadingState />
        ) : visibleRows.length === 0 ? (
          <HrEmptyState icon={CalendarDays} title="No calendars" description="Create a calendar for the current year." />
        ) : (
          <table className="hr-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Year</th>
                <th>Legal Entity</th>
                <th>Branch</th>
                <th>Days</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/hrms/holidays/${c.id}`)}>
                  <td className="font-medium text-erp-primary">{c.code}</td>
                  <td>{c.name}</td>
                  <td>{c.year}</td>
                  <td>{c.legalEntity?.displayName ?? '—'}</td>
                  <td>{c.branch?.name ?? 'All branches'}</td>
                  <td>{c.days?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </HrRegisterShell>
    </OperationalPageShell>
  )
}

export function HolidayDetailPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const perms = useHrmsPermissions()
  const [calendar, setCalendar] = useState<HrHolidayCalendar | null>(null)
  const [legalEntities, setLegalEntities] = useState<Array<{ id: string; displayName: string; code: string }>>([])
  const [branches, setBranches] = useState<Array<{ id: string; name: string; code: string }>>([])
  const [loading, setLoading] = useState(!isNew)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    code: '',
    name: '',
    year: String(new Date().getFullYear()),
    legalEntityId: '',
    branchId: '',
  })
  const [dayForm, setDayForm] = useState<{
    holidayDate: string
    name: string
    holidayType: 'NATIONAL' | 'FESTIVAL' | 'COMPANY' | 'OPTIONAL'
  }>({
    holidayDate: '',
    name: '',
    holidayType: 'FESTIVAL',
  })

  useEffect(() => {
    void (async () => {
      try {
        const les = await listLegalEntities({ limit: 100 })
        setLegalEntities((les.data ?? []) as Array<{ id: string; displayName: string; code: string }>)
      } catch {
        /* picker optional */
      }
    })()
  }, [])

  useEffect(() => {
    if (!form.legalEntityId) {
      setBranches([])
      return
    }
    void (async () => {
      try {
        const res = await listBranches(form.legalEntityId, { limit: 100 })
        setBranches((res.data ?? []) as Array<{ id: string; name: string; code: string }>)
      } catch {
        setBranches([])
      }
    })()
  }, [form.legalEntityId])

  useEffect(() => {
    if (isNew) return
    void (async () => {
      try {
        const res = await getHolidayCalendar(id!)
        setCalendar(res.data)
        setForm({
          code: res.data.code,
          name: res.data.name,
          year: String(res.data.year),
          legalEntityId: res.data.legalEntityId,
          branchId: res.data.branchId ?? '',
        })
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Failed to load calendar')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, isNew])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await createHolidayCalendar({
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        year: Number(form.year),
        legalEntityId: form.legalEntityId,
        branchId: form.branchId || null,
      })
      notify.success('Calendar created')
      navigate(`/hrms/holidays/${res.data.id}`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  const addDay = async (e: FormEvent) => {
    e.preventDefault()
    if (!calendar) return
    setBusy(true)
    try {
      await addHolidayDay(calendar.id, dayForm)
      notify.success('Holiday added')
      const res = await getHolidayCalendar(calendar.id)
      setCalendar(res.data)
      setDayForm({ holidayDate: '', name: '', holidayType: 'FESTIVAL' })
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Add failed')
    } finally {
      setBusy(false)
    }
  }

  const removeDay = async (dayId: string) => {
    if (!calendar) return
    const ok = await appConfirm({ title: 'Remove holiday?', description: 'Soft-delete this holiday day.' })
    if (!ok) return
    try {
      await removeHolidayDay(calendar.id, dayId)
      const res = await getHolidayCalendar(calendar.id)
      setCalendar(res.data)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Remove failed')
    }
  }

  if (loading) return <LoadingState />

  if (isNew) {
    return (
      <OperationalPageShell
        title="New Holiday Calendar"
        breadcrumbs={[
          { label: 'HRMS', to: '/hrms' },
          { label: 'Holidays', to: '/hrms/holidays' },
          { label: 'New' },
        ]}
      >
        <form onSubmit={create} className="max-w-xl space-y-3 rounded border border-erp-border bg-white p-4">
          <FormField label="Code" required>
            <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required />
          </FormField>
          <FormField label="Name" required>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </FormField>
          <FormField label="Year" required>
            <Input
              type="number"
              value={form.year}
              onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="Legal Entity" required>
            <Select
              value={form.legalEntityId}
              onChange={(e) => setForm((f) => ({ ...f, legalEntityId: e.target.value, branchId: '' }))}
              required
            >
              <option value="">{SELECT_PLACEHOLDER}</option>
              {legalEntities.map((le) => (
                <option key={le.id} value={le.id}>
                  {le.displayName}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Branch (optional)">
            <Select
              value={form.branchId}
              onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </FormField>
          <button type="submit" className="btn btn--primary" disabled={busy || !perms.canManageHoliday}>
            <CalendarDays className="mr-1 h-4 w-4" />
            Create Calendar
          </button>
        </form>
      </OperationalPageShell>
    )
  }

  if (!calendar) return <EmptyState icon={CalendarDays} title="Not found" />

  return (
    <OperationalPageShell
      title={calendar.name}
      description={`${calendar.code} · ${calendar.year}`}
      breadcrumbs={[
        { label: 'HRMS', to: '/hrms' },
        { label: 'Holidays', to: '/hrms/holidays' },
        { label: calendar.code },
      ]}
    >
      <div className="mb-4 grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded border border-erp-border bg-white p-3">
          <div className="text-xs text-erp-muted">Legal Entity</div>
          <div>{calendar.legalEntity?.displayName}</div>
        </div>
        <div className="rounded border border-erp-border bg-white p-3">
          <div className="text-xs text-erp-muted">Branch</div>
          <div>{calendar.branch?.name ?? 'All branches'}</div>
        </div>
        <div className="rounded border border-erp-border bg-white p-3">
          <div className="text-xs text-erp-muted">Holidays</div>
          <div>{calendar.days.length}</div>
        </div>
      </div>

      {perms.canManageHoliday ? (
        <form onSubmit={addDay} className="mb-4 flex flex-wrap items-end gap-2 rounded border border-erp-border bg-white p-3">
          <FormField label="Date" required>
            <Input
              type="date"
              value={dayForm.holidayDate}
              onChange={(e) => setDayForm((f) => ({ ...f, holidayDate: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="Name" required>
            <Input
              value={dayForm.name}
              onChange={(e) => setDayForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="Type">
            <Select
              value={dayForm.holidayType}
              onChange={(e) =>
                setDayForm((f) => ({
                  ...f,
                  holidayType: e.target.value as typeof dayForm.holidayType,
                }))
              }
            >
              <option value="NATIONAL">National</option>
              <option value="FESTIVAL">Festival</option>
              <option value="COMPANY">Company</option>
              <option value="OPTIONAL">Optional</option>
            </Select>
          </FormField>
          <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>
            Add Holiday
          </button>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded border border-erp-border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-erp-surface text-left text-xs uppercase text-erp-muted">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {calendar.days.map((d) => (
              <tr key={d.id} className="border-t border-erp-border">
                <td className="px-3 py-2 tabular-nums">{d.holidayDate}</td>
                <td className="px-3 py-2">{d.name}</td>
                <td className="px-3 py-2">{d.holidayType}</td>
                <td className="px-3 py-2 text-right">
                  {perms.canManageHoliday ? (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => void removeDay(d.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OperationalPageShell>
  )
}
