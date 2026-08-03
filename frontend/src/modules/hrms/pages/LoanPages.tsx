import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, RefreshCw, Wallet } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LoadingState } from '@/design-system/components/LoadingState'
import { fetchAdminDepartmentsApi, type AdminDepartment } from '@/services/api/adminApi'
import { listBranches, listLegalEntities } from '@/services/api/financeApi'
import {
  createLoan,
  getLoan,
  listHrEmployees,
  listLoans,
  listMyLoans,
  updateLoanDraft,
  type HrEmployeeLoan,
  type HrLoanType,
} from '@/services/api/hrmsApi'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import { money, nextRecoveryLabel } from './loanUi'
import { HrEmployeeCell, HrEmptyState, HrRegisterShell, HrStatusChip } from '@/modules/hrms/components'
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

const LOAN_TYPES: Array<{ value: HrLoanType; label: string }> = [
  { value: 'LOAN', label: 'Loan' },
  { value: 'SALARY_ADVANCE', label: 'Salary Advance' },
]

const LOAN_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'DISBURSED', 'RECOVERING', 'CLOSED', 'CANCELLED']

interface LoansRegisterPageProps {
  /** Initial tab — used by the "My Loans" self-service route. */
  initialTab?: 'all' | 'mine'
}

export function LoansRegisterPage({ initialTab = 'all' }: LoansRegisterPageProps) {
  const navigate = useNavigate()
  const perms = useHrmsPermissions()
  const [tab, setTab] = useState<'all' | 'mine'>(initialTab)
  const [rows, setRows] = useState<HrEmployeeLoan[]>([])
  const [loading, setLoading] = useState(true)

  const [legalEntities, setLegalEntities] = useState<SimpleLegalEntity[]>([])
  const [branches, setBranches] = useState<SimpleBranch[]>([])
  const [departments, setDepartments] = useState<AdminDepartment[]>([])
  const [employees, setEmployees] = useState<SimpleEmployee[]>([])

  const [legalEntityId, setLegalEntityId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [type, setType] = useState('')
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
        type: type || undefined,
        status: status || undefined,
      }
      const res = tab === 'mine' ? await listMyLoans(params) : await listLoans(params)
      setRows(res.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load loans')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, legalEntityId, branchId, employeeId, type, status])

  const departmentOptions = useMemo(() => departments.filter((d) => d.isActive), [departments])
  const employeeDeptMap = useMemo(() => new Map(employees.map((e) => [e.id, e.departmentId ?? null])), [employees])
  const visibleRows = useMemo(() => {
    if (!departmentId) return rows
    return rows.filter((r) => employeeDeptMap.get(r.employeeId) === departmentId)
  }, [rows, departmentId, employeeDeptMap])

  if (!perms.canViewLoan) {
    return (
      <OperationalPageShell title="Loans & Advances" breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Loans' }]}>
        <HrEmptyState icon={Wallet} title="No access" description="Requires loan view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title={tab === 'mine' ? 'My Loans & Advances' : 'Loans & Advances'}
      description="Employee loan and salary advance requests, approvals, disbursement, and recovery."
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Loans & Advances' }]}
    >
      <ErpCommandBar
        primaryAction={
          perms.canCreateLoan
            ? { id: 'new', label: 'New', icon: Plus, onClick: () => navigate('/hrms/loans/new') }
            : undefined
        }
        secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        {(
          [
            ['all', 'All'],
            ['mine', 'My Requests'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`rounded border px-3 py-1 ${tab === k ? 'border-erp-primary bg-erp-primary/5' : 'border-erp-border'}`}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

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
        <FormField label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All Types</option>
            {LOAN_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {LOAN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <HrRegisterShell>
        {loading ? (
          <LoadingState />
        ) : visibleRows.length === 0 ? (
          <HrEmptyState
            icon={Wallet}
            title="No loans or advances"
            description="Create a loan or salary advance request to get started."
          />
        ) : (
          <table className="hr-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Original</th>
                <th>Recovered</th>
                <th>Outstanding</th>
                <th>Installment</th>
                <th>Next Recovery</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/hrms/loans/${r.id}`)}>
                  <td>
                    <HrEmployeeCell name={r.employee?.displayName ?? r.employeeId} code={r.employee?.employeeCode} />
                    <div className="text-xs text-erp-muted">{r.code}</div>
                  </td>
                  <td>{r.type === 'LOAN' ? 'Loan' : 'Salary Advance'}</td>
                  <td className="tabular-nums">{money(r.approvedAmount)}</td>
                  <td className="tabular-nums">{money(r.recoveredAmount)}</td>
                  <td className="tabular-nums font-medium">{money(r.outstandingAmount)}</td>
                  <td className="tabular-nums">{money(r.installmentAmount)}</td>
                  <td>{nextRecoveryLabel(r)}</td>
                  <td>
                    <HrStatusChip status={r.status} domain="loan" />
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

export function MyLoansPage() {
  return <LoansRegisterPage initialTab="mine" />
}

export function LoanFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const perms = useHrmsPermissions()
  const isEdit = Boolean(id)

  const [employees, setEmployees] = useState<SimpleEmployee[]>([])
  const [loading, setLoading] = useState(isEdit)
  const [busy, setBusy] = useState(false)

  const [employeeId, setEmployeeId] = useState('')
  const [type, setType] = useState<HrLoanType>('LOAN')
  const [requestDate, setRequestDate] = useState(new Date().toISOString().slice(0, 10))
  const [requestedAmount, setRequestedAmount] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    void listHrEmployees({ limit: 500 })
      .then((res) => setEmployees(res.data ?? []))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    void getLoan(id)
      .then((res) => {
        const loan = res.data
        if (!loan) return
        if (loan.status !== 'DRAFT') {
          notify.error('Only draft loans/advances can be edited')
          navigate(`/hrms/loans/${id}`)
          return
        }
        setEmployeeId(loan.employeeId)
        setType(loan.type)
        setRequestDate(loan.requestDate)
        setRequestedAmount(String(loan.requestedAmount))
        setReason(loan.reason ?? '')
      })
      .catch((e) => notify.error(e instanceof Error ? e.message : 'Failed to load loan'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!perms.canCreateLoan) return
    const amount = Number(requestedAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      notify.error('Enter a valid requested amount')
      return
    }
    setBusy(true)
    try {
      if (isEdit && id) {
        await updateLoanDraft(id, {
          type,
          requestDate,
          requestedAmount: amount,
          reason: reason.trim() || undefined,
        })
        notify.success('Draft updated')
        navigate(`/hrms/loans/${id}`)
      } else {
        const created = await createLoan({
          employeeId: employeeId || undefined,
          type,
          requestDate,
          requestedAmount: amount,
          reason: reason.trim() || undefined,
        })
        notify.success('Draft created')
        navigate(`/hrms/loans/${created.data.id}`)
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <OperationalPageShell
        title={isEdit ? 'Edit Loan / Advance' : 'New Loan / Advance'}
        breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Loans & Advances', to: '/hrms/loans' }]}
      >
        <LoadingState />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title={isEdit ? 'Edit Loan / Advance' : 'New Loan / Advance'}
      breadcrumbs={[
        { label: 'HRMS', to: '/hrms' },
        { label: 'Loans & Advances', to: '/hrms/loans' },
        { label: isEdit ? 'Edit' : 'New' },
      ]}
    >
      <form onSubmit={onSubmit} className="max-w-xl space-y-3 rounded border border-erp-border bg-white p-4">
        <FormField label="Employee" hint={isEdit ? undefined : 'Leave blank to request for yourself'}>
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} disabled={isEdit}>
            <option value="">{SELECT_PLACEHOLDER}</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.employeeCode} — {emp.displayName}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Type" required>
          <Select value={type} onChange={(e) => setType(e.target.value as HrLoanType)} required>
            {LOAN_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Request date" required>
            <Input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} required />
          </FormField>
          <FormField label="Requested amount" required>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(e.target.value)}
              required
            />
          </FormField>
        </div>
        <FormField label="Reason">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </FormField>

        <div className="flex gap-2">
          <button type="submit" className="btn btn--primary" disabled={busy || !perms.canCreateLoan}>
            {busy ? 'Saving…' : isEdit ? 'Save Draft' : 'Create Draft'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/hrms/loans')}>
            Cancel
          </button>
        </div>
      </form>
    </OperationalPageShell>
  )
}
