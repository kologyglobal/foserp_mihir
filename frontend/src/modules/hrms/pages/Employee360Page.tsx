import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Banknote,
  CalendarDays,
  Clock,
  Edit,
  FileText,
  History as HistoryIcon,
  LayoutDashboard,
  Users,
  Wallet,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { DocumentLayout } from '@/components/design-system/FactBox'
import { TabStrip, type TabItem } from '@/components/ui/TabStrip'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getHrEmployee,
  getHrEmployeeStatutory,
  listHrAttendanceDays,
  listHrEmployeeDocuments,
  listHrEmployeeHistory,
  listLoans,
  listLeaveBalances,
  listOvertime,
  type HrAttendanceDay,
  type HrEmployee,
  type HrEmployeeDocument,
  type HrEmployeeHistoryEntry,
  type HrEmployeeLoan,
  type HrLeaveBalance,
  type HrOvertimeRecord,
} from '@/services/api/hrmsApi'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import {
  EMPLOYMENT_TYPE_LABELS,
  GENDER_LABELS,
  HrEmptyState,
  HrInfoSection,
  HrPageHeader,
  HrSmartContext,
  HrStatusChip,
  WORKER_CATEGORY_LABELS,
  hrStatusLabel,
} from '../components'
import { EmployeeSalarySection } from './EmployeeSalarySection'
import '../hrms-ui.css'

type TabId = 'overview' | 'employment' | 'attendance' | 'leave' | 'overtime' | 'payroll' | 'loans' | 'documents' | 'history'

function fmtDate(value: string | null | undefined) {
  if (!value) return '-'
  return value.slice(0, 10)
}

export function Employee360Page() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const perms = useHrmsPermissions()

  const [employee, setEmployee] = useState<HrEmployee | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('overview')
  const [hasStatutorySensitive, setHasStatutorySensitive] = useState(false)

  useEffect(() => {
    if (!id || !perms.canViewEmployee) {
      setLoading(false)
      return
    }
    setLoading(true)
    void getHrEmployee(id)
      .then((res) => setEmployee(res.data))
      .catch((e) => notify.error(e instanceof Error ? e.message : 'Failed to load employee'))
      .finally(() => setLoading(false))
  }, [id, perms.canViewEmployee])

  useEffect(() => {
    if (!id || !perms.canViewEmployeeSensitive) return
    void getHrEmployeeStatutory(id)
      .then(() => setHasStatutorySensitive(true))
      .catch(() => undefined)
  }, [id, perms.canViewEmployeeSensitive])

  const tabs: TabItem<TabId>[] = useMemo(() => {
    const items: TabItem<TabId>[] = [{ id: 'overview', label: 'Overview', icon: LayoutDashboard }]
    items.push({ id: 'employment', label: 'Employment', icon: Users })
    if (perms.canViewAttendance) items.push({ id: 'attendance', label: 'Attendance', icon: Clock })
    if (perms.canViewLeave || perms.canViewLeaveBalance) items.push({ id: 'leave', label: 'Leave', icon: CalendarDays })
    if (perms.canViewOvertime) items.push({ id: 'overtime', label: 'Overtime', icon: Clock })
    if (perms.canViewSalaryAssignment) items.push({ id: 'payroll', label: 'Payroll', icon: Banknote })
    if (perms.canViewLoan) items.push({ id: 'loans', label: 'Loans', icon: Wallet })
    items.push({ id: 'documents', label: 'Documents', icon: FileText })
    items.push({ id: 'history', label: 'History', icon: HistoryIcon })
    return items
  }, [perms])

  if (!perms.canViewEmployee) {
    return (
      <OperationalPageShell title="Employee" breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Employees', to: '/hrms/employees' }]}>
        <HrEmptyState icon={Users} title="No access" description="Requires employee view permission." />
      </OperationalPageShell>
    )
  }

  if (loading) {
    return (
      <OperationalPageShell
        title="Employee"
        breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Employees', to: '/hrms/employees' }]}
        backLink={{ to: '/hrms/employees', label: 'Back to employees' }}
      >
        <LoadingState variant="card" />
      </OperationalPageShell>
    )
  }

  if (!employee) {
    return (
      <OperationalPageShell
        title="Employee"
        breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Employees', to: '/hrms/employees' }]}
        backLink={{ to: '/hrms/employees', label: 'Back to employees' }}
      >
        <HrEmptyState icon={Users} title="Employee not found" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title={employee.displayName}
      breadcrumbs={[
        { label: 'HRMS', to: '/hrms' },
        { label: 'Employees', to: '/hrms/employees' },
        { label: employee.displayName },
      ]}
      backLink={{ to: '/hrms/employees', label: 'Back to employees' }}
    >
      <ErpCommandBar
        primaryAction={
          perms.canEditEmployee
            ? { id: 'edit', label: 'Edit', icon: Edit, onClick: () => navigate(`/hrms/employees/${employee.id}/edit`) }
            : undefined
        }
      />

      <HrPageHeader
        name={employee.displayName}
        code={employee.employeeCode}
        subtitle={[employee.designation?.name, employee.department?.name].filter(Boolean).join(' · ') || undefined}
        branch={employee.branch?.name}
        status={<HrStatusChip status={employee.status} domain="employee" />}
      />

      <TabStrip tabs={tabs} active={tab} onChange={setTab} className="mb-4 rounded-t border border-b-0 border-erp-border" />

      <DocumentLayout
        main={
          <>
            {tab === 'overview' ? <OverviewTab employee={employee} hasStatutorySensitive={hasStatutorySensitive} canViewSensitive={perms.canViewEmployeeSensitive} /> : null}
            {tab === 'employment' ? <EmploymentTab employee={employee} /> : null}
            {tab === 'attendance' ? <AttendanceTab employeeId={employee.id} /> : null}
            {tab === 'leave' ? <LeaveTab employeeId={employee.id} /> : null}
            {tab === 'overtime' ? <OvertimeTab employeeId={employee.id} /> : null}
            {tab === 'payroll' ? <EmployeeSalarySection employeeId={employee.id} employeeLabel={employee.displayName} /> : null}
            {tab === 'loans' ? <LoansTab employeeId={employee.id} /> : null}
            {tab === 'documents' ? <DocumentsTab employeeId={employee.id} /> : null}
            {tab === 'history' ? <HistoryTab employeeId={employee.id} /> : null}
          </>
        }
        factBoxes={
          <HrSmartContext
            fields={[
              { label: 'Manager', value: employee.reportingManager?.displayName ?? '-' },
              { label: 'Work Centre', value: employee.primaryWorkCentre?.name ?? '-' },
              { label: 'Join Date', value: fmtDate(employee.joinDate) },
              { label: 'Employment Type', value: EMPLOYMENT_TYPE_LABELS[employee.employmentType] ?? employee.employmentType },
              { label: 'Shift', value: employee.defaultShift?.name ?? '-' },
            ]}
          />
        }
      />
    </OperationalPageShell>
  )
}

function OverviewTab({
  employee,
  canViewSensitive,
}: {
  employee: HrEmployee
  hasStatutorySensitive: boolean
  canViewSensitive: boolean
}) {
  return (
    <div className="space-y-4">
      <HrInfoSection
        title="Personal & Contact"
        fields={[
          { label: 'Gender', value: employee.gender ? GENDER_LABELS[employee.gender] : '-' },
          { label: 'Date of birth', value: fmtDate(employee.dateOfBirth) },
          { label: 'Mobile', value: employee.mobile ?? '-' },
          { label: 'Email', value: employee.email ?? '-' },
          { label: 'Address', value: employee.addressLine ?? '-' },
          { label: 'City / State', value: [employee.city, employee.state].filter(Boolean).join(', ') || '-' },
          { label: 'PIN', value: employee.pin ?? '-' },
          { label: 'Country', value: employee.country ?? '-' },
        ]}
      />
      <HrInfoSection
        title="Employment"
        fields={[
          { label: 'Employee code', value: employee.employeeCode },
          { label: 'Join date', value: fmtDate(employee.joinDate) },
          { label: 'Employment type', value: EMPLOYMENT_TYPE_LABELS[employee.employmentType] ?? employee.employmentType },
          { label: 'Worker category', value: WORKER_CATEGORY_LABELS[employee.workerCategory] ?? employee.workerCategory },
          { label: 'Status', value: hrStatusLabel(employee.status, 'employee') },
          {
            label: 'Sensitive details',
            value: canViewSensitive ? (
              <Link className="text-erp-primary" to={`/hrms/employees/${employee.id}/edit`}>
                Bank &amp; statutory (edit form)
              </Link>
            ) : (
              'Restricted'
            ),
          },
        ]}
      />
    </div>
  )
}

function EmploymentTab({ employee }: { employee: HrEmployee }) {
  return (
    <HrInfoSection
      title="Assignment"
      fields={[
        { label: 'Legal entity', value: employee.legalEntity?.displayName ?? '-' },
        { label: 'Branch', value: employee.branch?.name ?? '-' },
        { label: 'Department', value: employee.department?.name ?? '-' },
        { label: 'Designation', value: employee.designation?.name ?? '-' },
        { label: 'Reporting manager', value: employee.reportingManager?.displayName ?? '-' },
        { label: 'Primary work centre', value: employee.primaryWorkCentre?.name ?? '-' },
        { label: 'Default shift', value: employee.defaultShift?.name ?? '-' },
        { label: 'Weekly off', value: employee.weeklyOffDay != null ? WEEKDAYS[employee.weeklyOffDay] : '-' },
      ]}
    />
  )
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function AttendanceTab({ employeeId }: { employeeId: string }) {
  const [rows, setRows] = useState<HrAttendanceDay[] | null>(null)

  useEffect(() => {
    void listHrAttendanceDays({ employeeId, limit: 10 })
      .then((res) => setRows(res.data ?? []))
      .catch(() => setRows([]))
  }, [employeeId])

  if (rows === null) return <LoadingState variant="table" rows={4} cols={4} />
  if (rows.length === 0) {
    return (
      <HrEmptyState
        icon={Clock}
        title="No attendance recorded yet"
        description="The full attendance register UI is next — this tab already reads live attendance data once punches exist."
      />
    )
  }
  return (
    <section className="hr-form-section">
      <h3 className="hr-form-section__title">Recent Attendance</h3>
      <table className="hr-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Status</th>
            <th>First In</th>
            <th>Last Out</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.attendanceDate}</td>
              <td>{r.status}</td>
              <td>{r.firstInAt ? new Date(r.firstInAt).toLocaleTimeString() : '-'}</td>
              <td>{r.lastOutAt ? new Date(r.lastOutAt).toLocaleTimeString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function LeaveTab({ employeeId }: { employeeId: string }) {
  const [rows, setRows] = useState<HrLeaveBalance[] | null>(null)

  useEffect(() => {
    void listLeaveBalances({ employeeId, year: new Date().getFullYear(), limit: 50 })
      .then((res) => setRows(res.data ?? []))
      .catch(() => setRows([]))
  }, [employeeId])

  if (rows === null) return <LoadingState variant="table" rows={3} cols={4} />

  return (
    <section className="hr-form-section">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="hr-form-section__title !mb-0 !border-b-0">Leave Balances ({new Date().getFullYear()})</h3>
        <Link className="text-[12.5px] text-erp-primary" to="/hrms/leave/requests">
          View leave requests
        </Link>
      </div>
      {rows.length === 0 ? (
        <HrEmptyState icon={CalendarDays} title="No leave balances configured" />
      ) : (
        <table className="hr-table">
          <thead>
            <tr>
              <th>Leave Type</th>
              <th>Opening</th>
              <th>Accrued</th>
              <th>Used</th>
              <th>Available</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.leaveType?.name ?? '-'}</td>
                <td>{r.opening}</td>
                <td>{r.accrued}</td>
                <td>{r.used}</td>
                <td className="font-medium">{r.available}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function OvertimeTab({ employeeId }: { employeeId: string }) {
  const [rows, setRows] = useState<HrOvertimeRecord[] | null>(null)

  useEffect(() => {
    void listOvertime({ employeeId, limit: 10 })
      .then((res) => setRows(res.data ?? []))
      .catch(() => setRows([]))
  }, [employeeId])

  if (rows === null) return <LoadingState variant="table" rows={3} cols={4} />
  if (rows.length === 0) {
    return <HrEmptyState icon={Clock} title="No overtime records" description="Overtime candidates appear here once attendance is finalized." />
  }
  return (
    <section className="hr-form-section">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="hr-form-section__title !mb-0 !border-b-0">Recent Overtime</h3>
        <Link className="text-[12.5px] text-erp-primary" to="/hrms/overtime">
          Open overtime queue
        </Link>
      </div>
      <table className="hr-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Eligible</th>
            <th>Approved</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.attendanceDate}</td>
              <td>{r.eligibleMinutes}m</td>
              <td>{r.approvedMinutes != null ? `${r.approvedMinutes}m` : '-'}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function LoansTab({ employeeId }: { employeeId: string }) {
  const [rows, setRows] = useState<HrEmployeeLoan[] | null>(null)

  useEffect(() => {
    void listLoans({ employeeId, limit: 20 })
      .then((res) => setRows(res.data ?? []))
      .catch(() => setRows([]))
  }, [employeeId])

  if (rows === null) return <LoadingState variant="table" rows={3} cols={4} />
  if (rows.length === 0) {
    return <HrEmptyState icon={Wallet} title="No loans or advances" />
  }
  return (
    <section className="hr-form-section">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="hr-form-section__title !mb-0 !border-b-0">Loans &amp; Advances</h3>
        <Link className="text-[12.5px] text-erp-primary" to="/hrms/loans">
          Open loans register
        </Link>
      </div>
      <table className="hr-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Type</th>
            <th>Outstanding</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link className="text-erp-primary" to={`/hrms/loans/${r.id}`}>
                  {r.code}
                </Link>
              </td>
              <td>{r.type === 'LOAN' ? 'Loan' : 'Salary Advance'}</td>
              <td>₹{Number(r.outstandingAmount).toLocaleString('en-IN')}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function DocumentsTab({ employeeId }: { employeeId: string }) {
  const [rows, setRows] = useState<HrEmployeeDocument[] | null>(null)

  useEffect(() => {
    void listHrEmployeeDocuments(employeeId)
      .then((res) => setRows(res.data ?? []))
      .catch(() => setRows([]))
  }, [employeeId])

  if (rows === null) return <LoadingState variant="table" rows={3} cols={3} />
  if (rows.length === 0) {
    return <HrEmptyState icon={FileText} title="No documents uploaded" description="Document upload UI is a later slice." />
  }
  return (
    <section className="hr-form-section">
      <h3 className="hr-form-section__title">Documents</h3>
      <table className="hr-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>File</th>
            <th>Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id}>
              <td>{d.documentType}</td>
              <td>{d.originalFilename}</td>
              <td>{fmtDate(d.uploadedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function HistoryTab({ employeeId }: { employeeId: string }) {
  const [rows, setRows] = useState<HrEmployeeHistoryEntry[] | null>(null)

  useEffect(() => {
    void listHrEmployeeHistory(employeeId)
      .then((res) => setRows(res.data ?? []))
      .catch(() => setRows([]))
  }, [employeeId])

  if (rows === null) return <LoadingState variant="table" rows={3} cols={4} />
  if (rows.length === 0) {
    return <HrEmptyState icon={HistoryIcon} title="No employment history yet" />
  }
  return (
    <section className="hr-form-section">
      <h3 className="hr-form-section__title">Employment History</h3>
      <table className="hr-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>From</th>
            <th>To</th>
            <th>Effective</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h.id}>
              <td>{h.field}</td>
              <td>{h.oldValue ?? '-'}</td>
              <td>{h.newValue ?? '-'}</td>
              <td>{fmtDate(h.effectiveFrom)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
