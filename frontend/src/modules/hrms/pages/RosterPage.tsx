import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  bulkRosterAssign,
  clearRosterOverrides,
  createRosterAssignment,
  getRosterGrid,
  listShifts,
  type HrShift,
  type RosterGrid,
} from '@/services/api/hrmsApi'
import { fetchAdminDepartmentsApi, type AdminDepartment } from '@/services/api/adminApi'
import { listBranches, listLegalEntities } from '@/services/api/financeApi'
import { notify } from '@/store/toastStore'
import { appConfirm } from '@/store/confirmDialogStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import { addDaysIso, startOfWeekIso, HrEmptyState, HrRegisterShell } from '../components'
import '../hrms-ui.css'

function badgeCode(shift: { code: string } | null | undefined): string {
  if (!shift) return '-'
  return shift.code.length > 6 ? shift.code.slice(0, 6) : shift.code
}

interface CellPopover {
  employeeId: string
  employeeName: string
  date: string
  x: number
  y: number
}

export function RosterPage() {
  const perms = useHrmsPermissions()
  const [weekStart, setWeekStart] = useState(startOfWeekIso())
  const from = weekStart
  const to = useMemo(() => addDaysIso(weekStart, 6), [weekStart])
  const [legalEntityId, setLegalEntityId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [search, setSearch] = useState('')
  const [grid, setGrid] = useState<RosterGrid | null>(null)
  const [shifts, setShifts] = useState<HrShift[]>([])
  const [legalEntities, setLegalEntities] = useState<Array<{ id: string; displayName: string }>>([])
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([])
  const [departments, setDepartments] = useState<AdminDepartment[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set())
  const [showBulkPanel, setShowBulkPanel] = useState(false)
  const [bulkShiftId, setBulkShiftId] = useState('')
  const [popover, setPopover] = useState<CellPopover | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  const weekdayLabels = useMemo(() => {
    if (!grid) return []
    return grid.dates.map((d) => {
      const dt = new Date(d + 'T00:00:00Z')
      return {
        date: d,
        label: dt.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' }),
      }
    })
  }, [grid])

  useEffect(() => {
    void (async () => {
      try {
        const [leRes, shiftRes, deptRes] = await Promise.all([
          listLegalEntities({ limit: 100 }),
          listShifts({ limit: 100, isActive: true }),
          fetchAdminDepartmentsApi().catch(() => []),
        ])
        setLegalEntities((leRes.data ?? []).map((x) => ({ id: x.id, displayName: x.displayName })))
        setShifts(shiftRes.data ?? [])
        setDepartments((deptRes ?? []).filter((d) => d.isActive))
      } catch {
        /* ignore */
      }
    })()
  }, [])

  useEffect(() => {
    if (!legalEntityId) {
      setBranches([])
      return
    }
    void (async () => {
      try {
        const res = await listBranches(legalEntityId, { limit: 100 })
        setBranches((res.data ?? []).map((b) => ({ id: b.id, name: b.name })))
      } catch {
        setBranches([])
      }
    })()
  }, [legalEntityId])

  const load = async () => {
    setLoading(true)
    try {
      const res = await getRosterGrid({
        from,
        to,
        legalEntityId: legalEntityId || undefined,
        branchId: branchId || undefined,
        departmentId: departmentId || undefined,
        search: search || undefined,
      })
      setGrid(res.data)
      setSelectedEmployees(new Set())
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load roster')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on range/filter change only
  }, [from, to, legalEntityId, branchId, departmentId])

  useEffect(() => {
    if (!popover) return
    const onClick = (e: globalThis.MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPopover(null)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopover(null)
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onEsc)
    }
  }, [popover])

  const toggleEmployee = (id: string) => {
    setSelectedEmployees((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const applyBulk = async () => {
    if (!perms.canManageRoster || !bulkShiftId || selectedEmployees.size === 0) return
    setBusy(true)
    try {
      await bulkRosterAssign({
        employeeIds: [...selectedEmployees],
        shiftId: bulkShiftId,
        effectiveFrom: from,
        effectiveTo: to,
        source: 'ROSTER',
      })
      notify.success(`Shift applied to ${selectedEmployees.size} employee(s) for the week`)
      setShowBulkPanel(false)
      setBulkShiftId('')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Bulk assign failed')
    } finally {
      setBusy(false)
    }
  }

  const clearBulk = async () => {
    if (!perms.canManageRoster || selectedEmployees.size === 0) return
    const ok = await appConfirm({
      title: 'Clear roster overrides?',
      description: `Removes temporary overrides for ${selectedEmployees.size} employee(s), this week — falls back to default shift.`,
    })
    if (!ok) return
    setBusy(true)
    try {
      await Promise.all(
        [...selectedEmployees].map((employeeId) => clearRosterOverrides({ employeeId, from, to })),
      )
      notify.success('Overrides cleared')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Clear failed')
    } finally {
      setBusy(false)
    }
  }

  const openCellPopover = (e: MouseEvent<HTMLButtonElement>, employeeId: string, employeeName: string, date: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setPopover({
      employeeId,
      employeeName,
      date,
      x: Math.min(rect.left, window.innerWidth - 260),
      y: rect.bottom + 6,
    })
  }

  const assignCellShift = async (shiftId: string) => {
    if (!popover) return
    setBusy(true)
    try {
      await createRosterAssignment({
        employeeId: popover.employeeId,
        shiftId,
        effectiveFrom: popover.date,
        effectiveTo: popover.date,
        source: 'TEMPORARY',
        note: 'Roster cell override',
      })
      notify.success('Override saved')
      setPopover(null)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Assign failed')
    } finally {
      setBusy(false)
    }
  }

  const clearCell = async () => {
    if (!popover) return
    setBusy(true)
    try {
      await clearRosterOverrides({ employeeId: popover.employeeId, from: popover.date, to: popover.date })
      notify.success('Override cleared')
      setPopover(null)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Clear failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <OperationalPageShell
      title="Roster"
      description="Weekly shift board — overrides never rewrite historical attendance."
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Roster' }]}
    >
      <ErpCommandBar
        secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="hr-date-nav">
          <button
            type="button"
            className="hr-date-nav__btn"
            onClick={() => setWeekStart((w) => addDaysIso(w, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="hr-date-nav__label">
            {from} → {to}
          </span>
          <button
            type="button"
            className="hr-date-nav__btn"
            onClick={() => setWeekStart((w) => addDaysIso(w, 7))}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setWeekStart(startOfWeekIso())}>
          This week
        </button>

        <FormField label="Legal Entity" className="ml-auto w-44">
          <Select
            value={legalEntityId}
            onChange={(e) => {
              setLegalEntityId(e.target.value)
              setBranchId('')
            }}
            wrapClassName="w-44"
          >
            <option value="">All</option>
            {legalEntities.map((le) => (
              <option key={le.id} value={le.id}>
                {le.displayName}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Branch" className="w-40">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} wrapClassName="w-40">
            <option value="">All</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Department" className="w-40">
          <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} wrapClassName="w-40">
            <option value="">All</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {perms.canManageRoster ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={selectedEmployees.size === 0}
            onClick={() => setShowBulkPanel((v) => !v)}
          >
            Bulk Assign ({selectedEmployees.size})
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={selectedEmployees.size === 0 || busy}
            onClick={() => void clearBulk()}
          >
            Clear Overrides
          </button>
          {showBulkPanel ? (
            <div className="flex flex-wrap items-end gap-2 rounded border border-erp-border bg-white p-2">
              <FormField label="Shift for this week">
                <Select value={bulkShiftId} onChange={(e) => setBulkShiftId(e.target.value)} wrapClassName="w-48">
                  <option value="">— Select —</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.startTime}–{s.endTime}
                    </option>
                  ))}
                </Select>
              </FormField>
              <button type="button" className="btn btn--primary btn--sm" disabled={!bulkShiftId || busy} onClick={() => void applyBulk()}>
                Apply
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowBulkPanel(false)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <HrRegisterShell search={{ value: search, onChange: setSearch, placeholder: 'Search employee…' }}>
        {loading ? (
          <LoadingState />
        ) : !grid || grid.employees.length === 0 ? (
          <HrEmptyState icon={CalendarDays} title="No employees" description="Adjust filters or create employees first." />
        ) : (
          <div className="hr-roster-grid">
            <table>
              <thead>
                <tr>
                  <th className="hr-roster-grid__employee-cell">Employee</th>
                  {weekdayLabels.map((d) => (
                    <th key={d.date} style={{ minWidth: 84 }}>
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.employees.map((emp) => (
                  <tr key={emp.employeeId}>
                    <td className="hr-roster-grid__employee-cell">
                      <label className="flex items-start gap-2">
                        {perms.canManageRoster ? (
                          <input
                            type="checkbox"
                            checked={selectedEmployees.has(emp.employeeId)}
                            onChange={() => toggleEmployee(emp.employeeId)}
                          />
                        ) : null}
                        <span>
                          <div className="font-medium">{emp.displayName}</div>
                          <div className="text-erp-muted">{emp.employeeCode}</div>
                        </span>
                      </label>
                    </td>
                    {emp.days.map((day) => (
                      <td key={day.date}>
                        <button
                          type="button"
                          className={[
                            'hr-roster-badge',
                            day.isWeeklyOff && 'hr-roster-badge--off',
                            day.source === 'TEMPORARY' && 'hr-roster-badge--override',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          disabled={!perms.canManageRoster}
                          onClick={(e) => openCellPopover(e, emp.employeeId, emp.displayName, day.date)}
                        >
                          <span className="hr-roster-badge__code">{day.isWeeklyOff ? 'WO' : badgeCode(day.shiftCode ? { code: day.shiftCode } : null)}</span>
                          <span className="hr-roster-badge__meta">{day.isWeeklyOff ? '' : day.source ?? ''}</span>
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </HrRegisterShell>

      {popover ? (
        <div
          ref={popoverRef}
          className="hr-roster-popover"
          style={{ left: popover.x, top: popover.y }}
        >
          <div className="hr-roster-popover__title">
            {popover.employeeName} · {popover.date}
          </div>
          <div className="hr-roster-popover__list">
            {shifts.map((s) => (
              <button
                key={s.id}
                type="button"
                className="hr-roster-popover__option"
                disabled={busy}
                onClick={() => void assignCellShift(s.id)}
              >
                <span className="font-medium">{s.code}</span>
                <span className="text-erp-muted">
                  {s.startTime}–{s.endTime}
                </span>
              </button>
            ))}
          </div>
          <div className="hr-roster-popover__footer">
            <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => void clearCell()}>
              Clear override
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPopover(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
