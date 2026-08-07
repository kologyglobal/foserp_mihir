import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarCheck, ChevronLeft, ChevronRight, Clock, Plus, RefreshCw, X } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import {
  createAttendancePunch,
  listHrAttendanceDays,
  listHrAttendanceExceptions,
  listHrEmployees,
  listShifts,
  type HrAttendanceDay,
  type HrAttendanceException,
  type HrAttendanceStatus,
  type HrEmployee,
  type HrShift,
} from '@/services/api/hrmsApi'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import {
  HrApprovalDrawer,
  HrEmployeeCell,
  HrEmptyState,
  HrExceptionPanel,
  HrKpiStrip,
  HrRegisterShell,
  HrStatusChip,
  HrTimeline,
  addDaysIso,
  formatHrDateLong,
  formatHrMinutes,
  formatHrTime,
  hrExceptionTypeLabel,
  todayIso,
  type HrExceptionItem,
} from '../components'
import '../hrms-ui.css'

const DASH = '-'
const STATUS_OPTIONS: HrAttendanceStatus[] = [
  'PRESENT',
  'ABSENT',
  'LEAVE',
  'HALF_DAY',
  'WEEKLY_OFF',
  'HOLIDAY',
  'ON_DUTY',
]

export function AttendanceRegisterPage() {
  const perms = useHrmsPermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const date = searchParams.get('date') || todayIso()
  const onlyExceptions = searchParams.get('onlyExceptions') === '1'

  const [rows, setRows] = useState<HrAttendanceDay[]>([])
  const [exceptions, setExceptions] = useState<HrAttendanceException[]>([])
  const [shifts, setShifts] = useState<HrShift[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedRow, setSelectedRow] = useState<HrAttendanceDay | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const shiftMap = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts])

  useEffect(() => {
    void listShifts({ limit: 200 })
      .then((res) => setShifts(res.data ?? []))
      .catch(() => undefined)
  }, [])

  const load = async () => {
    if (!perms.canViewAttendance) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [dayRes, excRes] = await Promise.all([
        listHrAttendanceDays({ from: date, to: date, limit: 500 }),
        listHrAttendanceExceptions({ from: date, to: date, limit: 500 }),
      ])
      setRows(dayRes.data ?? [])
      setExceptions(excRes.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load attendance')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on date change only
  }, [date])

  const setDate = (next: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('date', next)
    params.delete('onlyExceptions')
    setSearchParams(params)
  }

  const clearExceptionFocus = () => {
    const params = new URLSearchParams(searchParams)
    params.delete('onlyExceptions')
    setSearchParams(params)
  }

  const unresolvedExceptions = useMemo(() => exceptions.filter((e) => !e.resolved), [exceptions])
  const exceptionEmployeeIds = useMemo(
    () => new Set(unresolvedExceptions.map((e) => e.employeeId)),
    [unresolvedExceptions],
  )

  const counts = useMemo(() => {
    const c: Record<HrAttendanceStatus, number> = {
      PRESENT: 0,
      ABSENT: 0,
      LEAVE: 0,
      HALF_DAY: 0,
      WEEKLY_OFF: 0,
      HOLIDAY: 0,
      ON_DUTY: 0,
    }
    rows.forEach((r) => {
      c[r.status] = (c[r.status] ?? 0) + 1
    })
    return c
  }, [rows])

  const visibleRows = useMemo(() => {
    let list = rows
    if (statusFilter) list = list.filter((r) => r.status === statusFilter)
    if (onlyExceptions) list = list.filter((r) => r.exceptionFlag || exceptionEmployeeIds.has(r.employeeId))
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (r) =>
          (r.employee?.displayName ?? '').toLowerCase().includes(q) ||
          (r.employee?.employeeCode ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [rows, statusFilter, onlyExceptions, exceptionEmployeeIds, search])

  const kpiItems: EnterpriseKpiItem[] = [
    { id: 'present', label: 'Present', value: counts.PRESENT, icon: CalendarCheck, accent: 'green' },
    { id: 'absent', label: 'Absent', value: counts.ABSENT, icon: Clock, accent: 'red' },
    { id: 'half-day', label: 'Half Day', value: counts.HALF_DAY, icon: Clock, accent: 'amber' },
    { id: 'leave', label: 'Leave', value: counts.LEAVE, icon: CalendarCheck, accent: 'blue' },
    { id: 'weekly-off', label: 'Weekly Off', value: counts.WEEKLY_OFF, icon: CalendarCheck, accent: 'slate' },
    { id: 'exceptions', label: 'Exceptions', value: unresolvedExceptions.length, icon: Clock, accent: 'amber' },
  ]

  const exceptionTypeCounts = useMemo(() => {
    const m = new Map<string, number>()
    unresolvedExceptions.forEach((e) => {
      const key = e.exceptionType ?? 'OTHER'
      m.set(key, (m.get(key) ?? 0) + 1)
    })
    return m
  }, [unresolvedExceptions])

  const attentionItems: HrExceptionItem[] = useMemo(() => {
    if (unresolvedExceptions.length === 0) return []
    const items: HrExceptionItem[] = [
      {
        id: 'all-exceptions',
        label: 'Unresolved attendance exceptions',
        count: unresolvedExceptions.length,
        to: `/hrms/attendance?date=${date}&onlyExceptions=1`,
        icon: Clock,
        tone: 'warning',
      },
    ]
    exceptionTypeCounts.forEach((count, type) => {
      items.push({
        id: `type-${type}`,
        label: hrExceptionTypeLabel(type),
        count,
        to: `/hrms/attendance?date=${date}&onlyExceptions=1`,
        icon: Clock,
        tone: 'info',
      })
    })
    return items
  }, [unresolvedExceptions, exceptionTypeCounts, date])

  const drawerExceptions = useMemo(
    () => (selectedRow ? exceptions.filter((e) => e.employeeId === selectedRow.employeeId) : []),
    [selectedRow, exceptions],
  )

  if (!perms.canViewAttendance) {
    return (
      <OperationalPageShell title="Attendance" breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Attendance' }]}>
        <HrEmptyState icon={Clock} title="No access" description="Requires attendance view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title="Attendance"
      description="Daily attendance register — punches, worked time, and exceptions."
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Attendance' }]}
    >
      <ErpCommandBar
        primaryAction={
          perms.canManageAttendance
            ? { id: 'import', label: 'Import Attendance', icon: Plus, onClick: () => setImportOpen(true) }
            : undefined
        }
        secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="hr-date-nav">
          <button type="button" className="hr-date-nav__btn" onClick={() => setDate(addDaysIso(date, -1))} aria-label="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="hr-date-nav__label">{formatHrDateLong(date)}</span>
          <button type="button" className="hr-date-nav__btn" onClick={() => setDate(addDaysIso(date, 1))} aria-label="Next day">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDate(todayIso())}>
          Today
        </button>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        {onlyExceptions ? (
          <button type="button" className="hr-tab-strip__btn hr-tab-strip__btn--active" onClick={clearExceptionFocus}>
            Exceptions only <X className="ml-1 inline h-3 w-3" />
          </button>
        ) : null}
      </div>

      <div className="mb-4">
        <HrKpiStrip items={kpiItems} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_300px]">
        <HrRegisterShell
          search={{ value: search, onChange: setSearch, placeholder: 'Search employee, code…' }}
          filters={
            <FormField label="Status" className="w-40">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} wrapClassName="w-40">
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </FormField>
          }
        >
          {loading ? (
            <LoadingState />
          ) : visibleRows.length === 0 ? (
            <HrEmptyState icon={CalendarCheck} title="No attendance rows" description="No records match the current date/filters." />
          ) : (
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Shift</th>
                  <th>In</th>
                  <th>Out</th>
                  <th>Worked</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.id} onClick={() => setSelectedRow(r)}>
                    <td>
                      <HrEmployeeCell name={r.employee?.displayName ?? DASH} code={r.employee?.employeeCode} size="sm" />
                    </td>
                    <td>{r.shiftId ? (shiftMap.get(r.shiftId)?.code ?? DASH) : DASH}</td>
                    <td className="tabular-nums">{formatHrTime(r.firstInAt)}</td>
                    <td className="tabular-nums">{formatHrTime(r.lastOutAt)}</td>
                    <td className="tabular-nums">{formatHrMinutes(r.workedMinutes)}</td>
                    <td>
                      <HrStatusChip status={r.status} domain="attendance" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </HrRegisterShell>

        <HrExceptionPanel title="Needs Attention" items={attentionItems} emptyLabel="No unresolved exceptions for this date" />
      </div>

      <HrApprovalDrawer
        open={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        title={selectedRow?.employee?.displayName ?? 'Attendance'}
        subtitle={selectedRow ? `${selectedRow.employee?.employeeCode ?? ''} · ${formatHrDateLong(selectedRow.attendanceDate)}` : undefined}
        fields={
          selectedRow
            ? [
                { label: 'Status', value: <HrStatusChip status={selectedRow.status} domain="attendance" /> },
                { label: 'Shift', value: selectedRow.shiftId ? (shiftMap.get(selectedRow.shiftId)?.code ?? DASH) : DASH },
                { label: 'In', value: formatHrTime(selectedRow.firstInAt) },
                { label: 'Out', value: formatHrTime(selectedRow.lastOutAt) },
                { label: 'Worked', value: formatHrMinutes(selectedRow.workedMinutes) },
                { label: 'Source', value: selectedRow.source ?? DASH },
              ]
            : []
        }
      >
        {selectedRow?.exceptionReason ? (
          <div className="hr-info-section" style={{ padding: '0.6rem 0.75rem' }}>
            <div className="hr-info-section__label">Exception reason</div>
            <div className="hr-info-section__value">{selectedRow.exceptionReason}</div>
          </div>
        ) : null}
        <div>
          <h3 className="hr-exception-panel__title">Exceptions on this date</h3>
          <HrTimeline
            emptyLabel="No exceptions for this employee on this date"
            items={drawerExceptions.map((e) => ({
              id: e.id,
              label: hrExceptionTypeLabel(e.exceptionType),
              description: e.reason,
              timestamp: e.resolved ? 'Resolved' : 'Unresolved',
              tone: e.resolved ? 'success' : 'warning',
            }))}
          />
        </div>
      </HrApprovalDrawer>

      {perms.canManageAttendance ? (
        <ImportPunchDrawer
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onRecorded={() => {
            setImportOpen(false)
            void load()
          }}
        />
      ) : null}
    </OperationalPageShell>
  )
}

function ImportPunchDrawer({
  open,
  onClose,
  onRecorded,
}: {
  open: boolean
  onClose: () => void
  onRecorded: () => void
}) {
  const [employeeQuery, setEmployeeQuery] = useState('')
  const [employeeOptions, setEmployeeOptions] = useState<HrEmployee[]>([])
  const [employee, setEmployee] = useState<HrEmployee | null>(null)
  const [punchType, setPunchType] = useState<'IN' | 'OUT'>('IN')
  const [punchedAt, setPunchedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      setEmployeeQuery('')
      setEmployeeOptions([])
      setEmployee(null)
      setPunchType('IN')
      setPunchedAt(new Date().toISOString().slice(0, 16))
      setNote('')
    }
  }, [open])

  useEffect(() => {
    if (!open || employee || employeeQuery.trim().length < 2) {
      setEmployeeOptions([])
      return
    }
    const t = window.setTimeout(() => {
      void listHrEmployees({ search: employeeQuery.trim(), limit: 8 })
        .then((res) => setEmployeeOptions(res.data ?? []))
        .catch(() => setEmployeeOptions([]))
    }, 300)
    return () => window.clearTimeout(t)
  }, [employeeQuery, employee, open])

  const submit = async () => {
    if (!employee) {
      notify.error('Select an employee')
      return
    }
    setBusy(true)
    try {
      await createAttendancePunch({
        employeeId: employee.id,
        punchType,
        punchedAt: new Date(punchedAt).toISOString(),
        source: 'MANUAL',
        note: note || undefined,
      })
      notify.success('Punch recorded')
      onRecorded()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to record punch')
    } finally {
      setBusy(false)
    }
  }

  return (
    <HrApprovalDrawer
      open={open}
      onClose={onClose}
      title="Import / Record Punch"
      subtitle="Manual punch entry — never deletes existing punches."
      footer={
        <>
          <button type="button" className="btn btn--primary" disabled={busy || !employee} onClick={() => void submit()}>
            {busy ? 'Recording…' : 'Record Punch'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
        </>
      }
    >
      <FormField label="Employee" required>
        {employee ? (
          <div className="flex items-center justify-between rounded border border-erp-border px-2 py-1.5">
            <HrEmployeeCell name={employee.displayName} code={employee.employeeCode} size="sm" />
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEmployee(null)}>
              Change
            </button>
          </div>
        ) : (
          <div className="relative">
            <Input
              value={employeeQuery}
              onChange={(e) => setEmployeeQuery(e.target.value)}
              placeholder="Search name or code…"
            />
            {employeeOptions.length > 0 ? (
              <div className="absolute z-10 mt-1 w-full rounded border border-erp-border bg-white shadow-md">
                {employeeOptions.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="hr-roster-popover__option w-full"
                    onClick={() => {
                      setEmployee(e)
                      setEmployeeOptions([])
                    }}
                  >
                    <HrEmployeeCell name={e.displayName} code={e.employeeCode} size="sm" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </FormField>
      <FormField label="Punch type" required>
        <Select value={punchType} onChange={(e) => setPunchType(e.target.value as 'IN' | 'OUT')}>
          <option value="IN">IN</option>
          <option value="OUT">OUT</option>
        </Select>
      </FormField>
      <FormField label="Punched at" required>
        <Input type="datetime-local" value={punchedAt} onChange={(e) => setPunchedAt(e.target.value)} />
      </FormField>
      <FormField label="Note">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </FormField>
    </HrApprovalDrawer>
  )
}
