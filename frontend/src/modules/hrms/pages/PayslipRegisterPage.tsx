import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Eye, FileText, RefreshCw, Sparkles } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listBranches, listLegalEntities } from '@/services/api/financeApi'
import { fetchAdminDepartmentsApi, type AdminDepartment } from '@/services/api/adminApi'
import {
  generatePayslipsForRun,
  getPayslip,
  listHrEmployees,
  listPayrollRuns,
  listPayslips,
  type HrPayslip,
  type HrPayslipDetail,
  type HrPayslipPaymentStatus,
  type HrPayrollRun,
} from '@/services/api/hrmsApi'
import { downloadPayslipPdf } from '@/modules/hrms/payslipPdf'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import {
  HrApprovalDrawer,
  HrEmptyState,
  HrEmployeeCell,
  HrPayslipDocument,
  HrRegisterShell,
  HrStatusChip,
} from '@/modules/hrms/components'
import '../hrms-ui.css'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const PAYMENT_STATUSES: HrPayslipPaymentStatus[] = ['UNPAID', 'PARTIAL', 'PAID', 'FAILED']

function money(n: number) {
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

type SimpleEmployee = { id: string; employeeCode: string; displayName: string }
type SimpleLegalEntity = { id: string; code: string; displayName: string }
type SimpleBranch = { id: string; code: string; name: string }

export function PayslipRegisterPage() {
  const perms = useHrmsPermissions()
  const [rows, setRows] = useState<HrPayslip[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [legalEntities, setLegalEntities] = useState<SimpleLegalEntity[]>([])
  const [branches, setBranches] = useState<SimpleBranch[]>([])
  const [departments, setDepartments] = useState<AdminDepartment[]>([])
  const [employees, setEmployees] = useState<SimpleEmployee[]>([])
  const [finalizedRuns, setFinalizedRuns] = useState<HrPayrollRun[]>([])

  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [legalEntityId, setLegalEntityId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')

  const [generateRunId, setGenerateRunId] = useState('')
  const [preview, setPreview] = useState<HrPayslipDetail | null>(null)

  useEffect(() => {
    void listLegalEntities({ limit: 100 })
      .then((res) =>
        setLegalEntities(
          (res.data ?? []).map((x) => ({ id: x.id, code: x.code, displayName: x.displayName })),
        ),
      )
      .catch(() => undefined)
    void listHrEmployees({ limit: 500 })
      .then((res) => setEmployees(res.data ?? []))
      .catch(() => undefined)
    void fetchAdminDepartmentsApi()
      .then((rows) => setDepartments(rows))
      .catch(() => undefined)
    void listPayrollRuns({ status: 'FINALIZED', limit: 100 })
      .then((res) => setFinalizedRuns(res.data ?? []))
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
      const res = await listPayslips({
        limit: 200,
        year: year ? Number(year) : undefined,
        month: month ? Number(month) : undefined,
        legalEntityId: legalEntityId || undefined,
        branchId: branchId || undefined,
        departmentId: departmentId || undefined,
        employeeId: employeeId || undefined,
        paymentStatus: paymentStatus || undefined,
      })
      setRows(res.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load payslips')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, legalEntityId, branchId, departmentId, employeeId, paymentStatus])

  const departmentOptions = useMemo(() => departments.filter((d) => d.isActive), [departments])

  const onGenerate = async () => {
    if (!generateRunId || !perms.canGeneratePayslip) return
    setBusyId('generate')
    try {
      const res = await generatePayslipsForRun(generateRunId)
      notify.success(`Generated ${res.data?.generatedCount ?? 0} payslip(s)`)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Generate failed')
    } finally {
      setBusyId(null)
    }
  }

  const onPreview = async (row: HrPayslip) => {
    try {
      const res = await getPayslip(row.id)
      setPreview(res.data ?? null)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load payslip')
    }
  }

  const onDownload = async (row: HrPayslip) => {
    setBusyId(row.id)
    try {
      const result = await downloadPayslipPdf(row.id, `Payslip-${row.payslipNumber}`)
      if (!result.ok) notify.error(result.error)
    } finally {
      setBusyId(null)
    }
  }

  if (!perms.canViewPayslip) {
    return (
      <OperationalPageShell title="Payslips" breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Payslips' }]}>
        <HrEmptyState icon={FileText} title="No access" description="Requires payslip view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title="Payslips"
      description="Immutable payslip snapshots generated from finalized payroll runs."
      breadcrumbs={[
        { label: 'HRMS', to: '/hrms' },
        { label: 'Payroll', to: '/hrms/payroll/runs' },
        { label: 'Payslips' },
      ]}
    >
      <ErpCommandBar
        secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
      />

      {perms.canGeneratePayslip ? (
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded border border-erp-border bg-white p-3">
          <FormField label="Generate for finalized run" className="min-w-[260px]">
            <Select value={generateRunId} onChange={(e) => setGenerateRunId(e.target.value)}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {finalizedRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} {r.period ? `— ${MONTHS[r.period.month - 1]} ${r.period.year}` : ''}
                </option>
              ))}
            </Select>
          </FormField>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={!generateRunId || busyId === 'generate'}
            onClick={() => void onGenerate()}
          >
            <Sparkles className="mr-1 h-4 w-4" />
            Generate Payslips
          </button>
          <Link className="ml-auto text-sm text-erp-primary" to="/hrms/payroll/runs">
            Manage payroll runs →
          </Link>
        </div>
      ) : null}

      <div className="mb-4 grid gap-2 rounded border border-erp-border bg-white p-3 md:grid-cols-3 lg:grid-cols-6">
        <FormField label="Year">
          <Select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All Years</option>
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Month">
          <Select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">All Months</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1)}>
                {m}
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
        <FormField label="Payment status">
          <Select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {PAYMENT_STATUSES.map((s) => (
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
        ) : rows.length === 0 ? (
          <HrEmptyState icon={FileText} title="No payslips" description="Generate payslips from a finalized payroll run." />
        ) : (
          <table className="hr-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Period</th>
                <th>Gross</th>
                <th>Deduction</th>
                <th>Net</th>
                <th>Payslip Status</th>
                <th>Payment Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => void onPreview(r)}>
                  <td>
                    <HrEmployeeCell name={r.employee?.displayName ?? r.employeeId} code={r.employee?.employeeCode} />
                  </td>
                  <td>
                    {MONTHS[r.month - 1]} {r.year}
                  </td>
                  <td>{money(r.grossAmount)}</td>
                  <td>{money(r.deductionAmount)}</td>
                  <td className="font-medium">{money(r.netAmount)}</td>
                  <td>
                    <HrStatusChip status={r.status} domain="payslip" />
                  </td>
                  <td>
                    <HrStatusChip status={r.paymentStatus} domain="paymentStatus" />
                  </td>
                  <td className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => void onPreview(r)} title="Preview">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={busyId === r.id}
                        onClick={() => void onDownload(r)}
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </HrRegisterShell>

      <HrApprovalDrawer
        open={preview != null}
        onClose={() => setPreview(null)}
        title={preview?.payslipNumber ?? ''}
        subtitle={preview ? `${preview.employee?.displayName ?? ''} · ${MONTHS[preview.month - 1]} ${preview.year}` : undefined}
        footer={
          preview ? (
            <>
              <button type="button" className="btn btn--primary" onClick={() => void onDownload(preview)}>
                <Download className="mr-1 h-4 w-4" />
                Download PDF
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setPreview(null)}>
                Close
              </button>
            </>
          ) : undefined
        }
      >
        {preview ? <HrPayslipDocument payslip={preview} /> : null}
      </HrApprovalDrawer>
    </OperationalPageShell>
  )
}
