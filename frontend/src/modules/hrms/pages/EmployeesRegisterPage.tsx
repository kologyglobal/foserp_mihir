import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, Users } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { fetchAdminDepartmentsApi, type AdminDepartment } from '@/services/api/adminApi'
import { listBranches, listLegalEntities } from '@/services/api/financeApi'
import { listHrEmployees, type HrEmployee, type HrEmployeeStatus } from '@/services/api/hrmsApi'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import {
  EMPLOYMENT_TYPE_LABELS,
  HrEmployeeCell,
  HrEmptyState,
  HrRegisterShell,
  HrStatusChip,
  hrStatusLabel,
} from '../components'
import '../hrms-ui.css'

const HR_EMPLOYEE_STATUSES: HrEmployeeStatus[] = ['DRAFT', 'ACTIVE', 'ON_NOTICE', 'INACTIVE', 'EXITED']

type SimpleBranch = { id: string; code: string; name: string }

export function EmployeesRegisterPage() {
  const navigate = useNavigate()
  const perms = useHrmsPermissions()
  const [rows, setRows] = useState<HrEmployee[]>([])
  const [meta, setMeta] = useState<{ page: number; totalPages: number; total: number } | null>(null)
  const [loading, setLoading] = useState(true)

  const [departments, setDepartments] = useState<AdminDepartment[]>([])
  const [branches, setBranches] = useState<SimpleBranch[]>([])

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [page, setPage] = useState(1)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    void fetchAdminDepartmentsApi()
      .then((data) => setDepartments(data.filter((d) => d.isActive)))
      .catch(() => undefined)
    void listLegalEntities({ limit: 100 })
      .then(async (res) => {
        const entities = res.data ?? []
        const lists = await Promise.all(
          entities.map((le) =>
            listBranches(le.id, { limit: 100 })
              .then((r) => r.data ?? [])
              .catch(() => []),
          ),
        )
        const flat = lists.flat().map((b) => ({ id: b.id, code: b.code, name: b.name }))
        setBranches(flat)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    listHrEmployees({
      page,
      limit: 20,
      search: search || undefined,
      status: (status || undefined) as HrEmployeeStatus | undefined,
      departmentId: departmentId || undefined,
      branchId: branchId || undefined,
      sortBy: 'displayName',
      sortOrder: 'asc',
    })
      .then((res) => {
        if (!alive) return
        setRows(res.data ?? [])
        setMeta(res.meta ? { page: res.meta.page, totalPages: res.meta.totalPages, total: res.meta.total } : null)
      })
      .catch((e) => {
        if (alive) notify.error(e instanceof Error ? e.message : 'Failed to load employees')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [search, status, departmentId, branchId, page, reloadTick])

  if (!perms.canViewEmployee) {
    return (
      <OperationalPageShell title="Employees" breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Employees' }]}>
        <HrEmptyState icon={Users} title="No access" description="Requires employee view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title="Employees"
      description="Employee master — profile, employment assignment, and reporting structure."
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Employees' }]}
    >
      <ErpCommandBar
        primaryAction={
          perms.canCreateEmployee
            ? { id: 'add', label: 'Add Employee', icon: Plus, onClick: () => navigate('/hrms/employees/new') }
            : undefined
        }
        secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setReloadTick((t) => t + 1) }]}
      />

      <HrRegisterShell
        search={{ value: searchInput, onChange: setSearchInput, placeholder: 'Search name, code, email, mobile…' }}
        filters={
          <>
            <FormField label="Branch" className="w-40">
              <Select
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value)
                  setPage(1)
                }}
                wrapClassName="w-40"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Department" className="w-40">
              <Select
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value)
                  setPage(1)
                }}
                wrapClassName="w-40"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Status" className="w-36">
              <Select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value)
                  setPage(1)
                }}
                wrapClassName="w-36"
              >
                <option value="">All Statuses</option>
                {HR_EMPLOYEE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {hrStatusLabel(s, 'employee')}
                  </option>
                ))}
              </Select>
            </FormField>
          </>
        }
        pagination={
          meta
            ? { page: meta.page, totalPages: meta.totalPages, total: meta.total, onPageChange: setPage }
            : undefined
        }
      >
        {loading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <HrEmptyState
            icon={Users}
            title="No employees found"
            description="Try adjusting filters, or add the first employee."
            primaryAction={perms.canCreateEmployee ? { label: 'Add Employee', onClick: () => navigate('/hrms/employees/new') } : undefined}
          />
        ) : (
          <table className="hr-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Code</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Branch</th>
                <th>Manager</th>
                <th>Employment Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} onClick={() => navigate(`/hrms/employees/${e.id}`)}>
                  <td>
                    <HrEmployeeCell name={e.displayName} size="sm" />
                  </td>
                  <td>{e.employeeCode}</td>
                  <td>{e.department?.name ?? '—'}</td>
                  <td>{e.designation?.name ?? '—'}</td>
                  <td>{e.branch?.name ?? '—'}</td>
                  <td>{e.reportingManager?.displayName ?? '—'}</td>
                  <td>{EMPLOYMENT_TYPE_LABELS[e.employmentType] ?? e.employmentType}</td>
                  <td>
                    <HrStatusChip status={e.status} domain="employee" />
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
