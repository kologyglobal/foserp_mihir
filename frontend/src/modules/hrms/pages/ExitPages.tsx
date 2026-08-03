import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Plus, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LoadingState } from '@/design-system/components/LoadingState'
import { fetchAdminDepartmentsApi, type AdminDepartment } from '@/services/api/adminApi'
import { listBranches, listLegalEntities } from '@/services/api/financeApi'
import {
  createExit,
  listExits,
  listFnfSettlements,
  listHrEmployees,
  type HrEmployeeExit,
  type HrExitType,
  type HrFullFinalSettlement,
  type HrNoticeSettlementMode,
} from '@/services/api/hrmsApi'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import { EXIT_TYPE_LABELS, clearanceSummaryFromExitStatus } from './exitUi'
import { HrEmployeeCell, HrEmptyState, HrRegisterShell, HrStatusChip, hrStatusLabel } from '@/modules/hrms/components'
import '../hrms-ui.css'

type SimpleEmployee = {
  id: string
  employeeCode: string
  displayName: string
  departmentId?: string | null
  branchId?: string | null
  legalEntityId?: string | null
}
type SimpleLegalEntity = { id: string; code: string; displayName: string }
type SimpleBranch = { id: string; code: string; name: string }

const EXIT_TYPES: HrExitType[] = ['RESIGNATION', 'TERMINATION', 'RETIREMENT', 'CONTRACT_END', 'ABSCONDING', 'OTHER']
const EXIT_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'CLEARANCE_PENDING',
  'READY_FOR_SETTLEMENT',
  'SETTLED',
  'CLOSED',
  'CANCELLED',
]

export function ExitRegisterPage() {
  const navigate = useNavigate()
  const perms = useHrmsPermissions()
  const [rows, setRows] = useState<HrEmployeeExit[]>([])
  const [fnfByExitId, setFnfByExitId] = useState<Map<string, HrFullFinalSettlement>>(new Map())
  const [loading, setLoading] = useState(true)

  const [legalEntities, setLegalEntities] = useState<SimpleLegalEntity[]>([])
  const [branches, setBranches] = useState<SimpleBranch[]>([])
  const [departments, setDepartments] = useState<AdminDepartment[]>([])
  const [employees, setEmployees] = useState<SimpleEmployee[]>([])

  const [legalEntityId, setLegalEntityId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [exitType, setExitType] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    void listLegalEntities({ limit: 100 })
      .then((res) => setLegalEntities((res.data ?? []).map((x) => ({ id: x.id, code: x.code, displayName: x.displayName }))))
      .catch(() => undefined)
    void listHrEmployees({ limit: 500 })
      .then((res) => setEmployees(res.data ?? []))
      .catch(() => undefined)
    void fetchAdminDepartmentsApi()
      .then((rows) => setDepartments(rows))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!legalEntityId) {
      setBranches([])
      setBranchId('')
      return
    }
    void listBranches(legalEntityId, { limit: 100 })
      .then((res) =>
        setBranches((res.data ?? []).map((x: { id: string; code: string; name: string }) => ({ id: x.id, code: x.code, name: x.name }))),
      )
      .catch(() => setBranches([]))
  }, [legalEntityId])

  const load = async () => {
    setLoading(true)
    try {
      const params = {
        limit: 200,
        legalEntityId: legalEntityId || undefined,
        branchId: branchId || undefined,
        employeeId: employeeId || undefined,
        exitType: exitType || undefined,
        status: status || undefined,
      }
      const [exitsRes, fnfRes] = await Promise.all([
        listExits(params),
        listFnfSettlements({ limit: 500 }).catch(() => ({ data: [] as HrFullFinalSettlement[] })),
      ])
      setRows(exitsRes.data ?? [])
      setFnfByExitId(new Map((fnfRes.data ?? []).map((s) => [s.employeeExitId, s])))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load exits')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legalEntityId, branchId, employeeId, exitType, status])

  const departmentOptions = useMemo(() => departments.filter((d) => d.isActive), [departments])
  const employeeDeptMap = useMemo(() => new Map(employees.map((e) => [e.id, e.departmentId ?? null])), [employees])
  const departmentNameMap = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments])
  const visibleRows = useMemo(() => {
    if (!departmentId) return rows
    return rows.filter((r) => employeeDeptMap.get(r.employeeId) === departmentId)
  }, [rows, departmentId, employeeDeptMap])

  if (!perms.canViewExit) {
    return (
      <OperationalPageShell title="Exits" breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Exits' }]}>
        <HrEmptyState icon={LogOut} title="No access" description="Requires exit view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title="Employee Exits"
      description="Resignation, termination, and separation requests through clearance and settlement."
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Exits' }]}
    >
      <ErpCommandBar
        primaryAction={
          perms.canCreateExit ? { id: 'new', label: 'New', icon: Plus, onClick: () => navigate('/hrms/exits/new') } : undefined
        }
        secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
      />

      <div className="mb-4 grid gap-2 rounded border border-erp-border bg-white p-3 md:grid-cols-3 lg:grid-cols-6">
        <FormField label="Employee">
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">All Employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employeeCode} — {e.displayName}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Department">
          <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All Departments</option>
            {departmentOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Legal entity">
          <Select value={legalEntityId} onChange={(e) => setLegalEntityId(e.target.value)}>
            <option value="">All Legal Entities</option>
            {legalEntities.map((le) => (
              <option key={le.id} value={le.id}>
                {le.code} — {le.displayName}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Branch">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={!legalEntityId}>
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Exit type">
          <Select value={exitType} onChange={(e) => setExitType(e.target.value)}>
            <option value="">All Types</option>
            {EXIT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EXIT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {EXIT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {hrStatusLabel(s, 'exit')}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <HrRegisterShell>
        {loading ? (
          <LoadingState />
        ) : visibleRows.length === 0 ? (
          <HrEmptyState icon={LogOut} title="No exits" description="Create an exit request to get started." />
        ) : (
          <table className="hr-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Dept</th>
                <th>Exit Type</th>
                <th>Resignation</th>
                <th>LWD</th>
                <th>Clearance</th>
                <th>F&amp;F Status</th>
                <th>Exit Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const deptId = employeeDeptMap.get(r.employeeId)
                const fnf = fnfByExitId.get(r.id)
                return (
                  <tr key={r.id} onClick={() => navigate(`/hrms/exits/${r.id}`)}>
                    <td>
                      <HrEmployeeCell name={r.employee?.displayName ?? r.employeeId} code={r.employee?.employeeCode} />
                      <div className="text-xs text-erp-muted">{r.code}</div>
                    </td>
                    <td>{deptId ? departmentNameMap.get(deptId) ?? '—' : '—'}</td>
                    <td>{EXIT_TYPE_LABELS[r.exitType] ?? r.exitType}</td>
                    <td>{r.resignationDate ?? '—'}</td>
                    <td>{r.approvedLastWorkingDate ?? r.requestedLastWorkingDate}</td>
                    <td>{clearanceSummaryFromExitStatus(r.status)}</td>
                    <td>{fnf ? <HrStatusChip status={fnf.status} domain="fnf" /> : <span className="text-erp-muted">—</span>}</td>
                    <td>
                      <HrStatusChip status={r.status} domain="exit" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </HrRegisterShell>
    </OperationalPageShell>
  )
}

export function ExitFormPage() {
  const navigate = useNavigate()
  const perms = useHrmsPermissions()

  const [employees, setEmployees] = useState<SimpleEmployee[]>([])
  const [busy, setBusy] = useState(false)

  const [employeeId, setEmployeeId] = useState('')
  const [exitType, setExitType] = useState<HrExitType>('RESIGNATION')
  const [resignationDate, setResignationDate] = useState('')
  const [requestedLastWorkingDate, setRequestedLastWorkingDate] = useState('')
  const [noticePeriodDays, setNoticePeriodDays] = useState('')
  const [noticeSettlementMode, setNoticeSettlementMode] = useState<HrNoticeSettlementMode>('recover')
  const [reason, setReason] = useState('')
  const [remarks, setRemarks] = useState('')

  useEffect(() => {
    void listHrEmployees({ limit: 500 })
      .then((res) => setEmployees(res.data ?? []))
      .catch(() => undefined)
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!perms.canCreateExit) return
    if (!requestedLastWorkingDate) {
      notify.error('Enter the requested last working date')
      return
    }
    setBusy(true)
    try {
      const created = await createExit({
        employeeId: employeeId || undefined,
        exitType,
        resignationDate: resignationDate || undefined,
        requestedLastWorkingDate,
        noticePeriodDays: noticePeriodDays ? Number(noticePeriodDays) : undefined,
        noticeSettlementMode,
        reason: reason.trim() || undefined,
        remarks: remarks.trim() || undefined,
      })
      notify.success('Exit draft created')
      navigate(`/hrms/exits/${created.data.id}`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <OperationalPageShell
      title="New Exit"
      breadcrumbs={[
        { label: 'HRMS', to: '/hrms' },
        { label: 'Exits', to: '/hrms/exits' },
        { label: 'New' },
      ]}
    >
      <form onSubmit={onSubmit} className="max-w-xl space-y-3 rounded border border-erp-border bg-white p-4">
        <FormField label="Employee" hint="Leave blank to request for yourself">
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">{SELECT_PLACEHOLDER}</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.employeeCode} — {emp.displayName}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Exit type" required>
          <Select value={exitType} onChange={(e) => setExitType(e.target.value as HrExitType)} required>
            {EXIT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EXIT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Resignation date">
            <Input type="date" value={resignationDate} onChange={(e) => setResignationDate(e.target.value)} />
          </FormField>
          <FormField label="Requested last working date" required>
            <Input
              type="date"
              value={requestedLastWorkingDate}
              onChange={(e) => setRequestedLastWorkingDate(e.target.value)}
              required
            />
          </FormField>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Notice period (days)" hint="Defaults to the employee's configured notice period">
            <Input type="number" min={0} value={noticePeriodDays} onChange={(e) => setNoticePeriodDays(e.target.value)} />
          </FormField>
          <FormField label="Notice settlement mode" required>
            <Select
              value={noticeSettlementMode}
              onChange={(e) => setNoticeSettlementMode(e.target.value as HrNoticeSettlementMode)}
              required
            >
              <option value="recover">Recover shortfall</option>
              <option value="pay">Pay in lieu</option>
              <option value="none">None</option>
            </Select>
          </FormField>
        </div>
        <FormField label="Reason">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </FormField>
        <FormField label="Remarks">
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
        </FormField>

        <div className="flex gap-2">
          <button type="submit" className="btn btn--primary" disabled={busy || !perms.canCreateExit}>
            {busy ? 'Saving…' : 'Create Draft'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/hrms/exits')}>
            Cancel
          </button>
        </div>
      </form>
    </OperationalPageShell>
  )
}
