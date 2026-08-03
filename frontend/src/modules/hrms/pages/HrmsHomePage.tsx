import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Banknote,
  CalendarCheck,
  CalendarDays,
  Clock,
  LogOut,
  Plus,
  Settings2,
  UserCircle,
  Users,
  Wallet,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import {
  listExits,
  listHrAttendanceDays,
  listHrEmployees,
  listLeaveRequests,
  listOvertime,
  listPayrollRuns,
} from '@/services/api/hrmsApi'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import { HrExceptionPanel, type HrExceptionItem, HrKpiStrip, hrStatusLabel } from '../components'
import '../hrms-ui.css'

const DASH = '—'

interface QuickAction {
  id: string
  label: string
  to: string
  icon: typeof Users
  show: boolean
}

export function HrmsHomePage() {
  const navigate = useNavigate()
  const perms = useHrmsPermissions()
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<number | null>(null)
  const [present, setPresent] = useState<number | null>(null)
  const [onLeave, setOnLeave] = useState<number | null>(null)
  const [absent, setAbsent] = useState<number | null>(null)
  const [otPending, setOtPending] = useState<number | null>(null)
  const [payrollStatus, setPayrollStatus] = useState<string | null>(null)
  const [needsAttention, setNeedsAttention] = useState<HrExceptionItem[]>([])

  useEffect(() => {
    let alive = true
    const today = new Date().toISOString().slice(0, 10)
    const attention: HrExceptionItem[] = []

    async function load() {
      setLoading(true)
      const tasks: Array<Promise<void>> = []

      if (perms.canViewEmployee) {
        tasks.push(
          listHrEmployees({ limit: 1 })
            .then((res) => {
              if (alive) setEmployees(res.meta?.total ?? res.data?.length ?? 0)
            })
            .catch(() => undefined),
        )
      }
      if (perms.canViewAttendance) {
        tasks.push(
          listHrAttendanceDays({ from: today, to: today, status: 'PRESENT', limit: 1 })
            .then((res) => {
              if (alive) setPresent(res.meta?.total ?? 0)
            })
            .catch(() => undefined),
        )
        tasks.push(
          listHrAttendanceDays({ from: today, to: today, status: 'LEAVE', limit: 1 })
            .then((res) => {
              if (alive) setOnLeave(res.meta?.total ?? 0)
            })
            .catch(() => undefined),
        )
        tasks.push(
          listHrAttendanceDays({ from: today, to: today, status: 'ABSENT', limit: 1 })
            .then((res) => {
              if (alive) setAbsent(res.meta?.total ?? 0)
            })
            .catch(() => undefined),
        )
      }
      if (perms.canViewOvertime) {
        tasks.push(
          listOvertime({ status: 'PENDING', limit: 1 })
            .then((res) => {
              if (alive) setOtPending(res.meta?.total ?? 0)
            })
            .catch(() => undefined),
        )
      }
      if (perms.canViewPayroll) {
        tasks.push(
          listPayrollRuns({ limit: 1 })
            .then((res) => {
              const latest = res.data?.[0]
              if (alive) setPayrollStatus(latest ? hrStatusLabel(latest.status, 'payrollRun') : null)
            })
            .catch(() => undefined),
        )
      }
      if (perms.canApproveLeave) {
        tasks.push(
          listLeaveRequests({ status: 'SUBMITTED', limit: 1 })
            .then((res) => {
              const count = res.meta?.total ?? 0
              if (count > 0) {
                attention.push({
                  id: 'leave',
                  label: 'Leave requests awaiting approval',
                  count,
                  to: '/hrms/leave/requests',
                  icon: CalendarDays,
                  tone: 'warning',
                })
              }
            })
            .catch(() => undefined),
        )
      }
      if (perms.canApproveOvertime) {
        tasks.push(
          listOvertime({ status: 'PENDING', limit: 1 })
            .then((res) => {
              const count = res.meta?.total ?? 0
              if (count > 0) {
                attention.push({
                  id: 'ot',
                  label: 'Overtime pending approval',
                  count,
                  to: '/hrms/overtime',
                  icon: Clock,
                  tone: 'warning',
                })
              }
            })
            .catch(() => undefined),
        )
      }
      if (perms.canManageExitClearance || perms.canApproveExit) {
        tasks.push(
          listExits({ status: 'CLEARANCE_PENDING', limit: 1 })
            .then((res) => {
              const count = res.meta?.total ?? 0
              if (count > 0) {
                attention.push({
                  id: 'exit-clearance',
                  label: 'Exits pending clearance',
                  count,
                  to: '/hrms/exits',
                  icon: LogOut,
                  tone: 'info',
                })
              }
            })
            .catch(() => undefined),
        )
      }

      await Promise.all(tasks)
      if (!alive) return
      setNeedsAttention(attention)
      setLoading(false)
    }

    void load()
    return () => {
      alive = false
    }
  }, [perms])

  const kpiItems: EnterpriseKpiItem[] = [
    { id: 'employees', label: 'Employees', value: employees ?? DASH, icon: Users, accent: 'blue' },
    { id: 'present', label: 'Present Today', value: present ?? DASH, icon: CalendarCheck, accent: 'green' },
    { id: 'on-leave', label: 'On Leave', value: onLeave ?? DASH, icon: CalendarDays, accent: 'amber' },
    { id: 'absent', label: 'Absent', value: absent ?? DASH, icon: Clock, accent: 'red' },
    { id: 'ot-pending', label: 'OT Pending', value: otPending ?? DASH, icon: Clock, accent: 'amber' },
    { id: 'payroll-status', label: 'Payroll Status', value: payrollStatus ?? DASH, icon: Banknote, accent: 'slate' },
  ]

  const quickActions: QuickAction[] = [
    { id: 'employees', label: 'Employees', to: '/hrms/employees', icon: Users, show: perms.canViewEmployee },
    { id: 'attendance', label: 'Attendance', to: '/hrms/attendance', icon: Clock, show: perms.canViewAttendance },
    { id: 'leave', label: 'Leave', to: '/hrms/leave', icon: CalendarDays, show: perms.canViewLeave },
    { id: 'overtime', label: 'Overtime', to: '/hrms/overtime', icon: Clock, show: perms.canViewOvertime },
    { id: 'payroll', label: 'Payroll Runs', to: '/hrms/payroll/runs', icon: Banknote, show: perms.canViewPayroll },
    { id: 'loans', label: 'Loans & Advances', to: '/hrms/loans', icon: Wallet, show: perms.canViewLoan },
    { id: 'exits', label: 'Exits', to: '/hrms/exits', icon: LogOut, show: perms.canViewExit },
    { id: 'designations', label: 'Designations', to: '/hrms/setup/designations', icon: Settings2, show: perms.canViewDesignation },
    { id: 'my-hr', label: 'My HR', to: '/hrms/my', icon: UserCircle, show: true },
  ].filter((a) => a.show)

  return (
    <OperationalPageShell
      title="HRMS"
      description="Workforce overview — employees, time, leave, payroll, and exits."
      breadcrumbs={[{ label: 'HRMS' }]}
    >
      <ErpCommandBar
        primaryAction={
          perms.canCreateEmployee
            ? { id: 'add-employee', label: 'Add Employee', icon: Plus, onClick: () => navigate('/hrms/employees/new') }
            : undefined
        }
        secondaryActions={
          perms.canCreatePayroll
            ? [{ id: 'run-payroll', label: 'Run Payroll', icon: Banknote, onClick: () => navigate('/hrms/payroll/runs') }]
            : []
        }
      />

      <div className="mb-4">
        <HrKpiStrip items={kpiItems} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-2 text-[13px] font-semibold text-erp-text">Quick Actions</h2>
          <div className="hr-quick-actions">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <a
                  key={action.id}
                  href={action.to}
                  className="hr-quick-actions__item"
                  onClick={(e) => {
                    e.preventDefault()
                    navigate(action.to)
                  }}
                >
                  <Icon className="hr-quick-actions__icon" aria-hidden />
                  <span className="hr-quick-actions__label">{action.label}</span>
                </a>
              )
            })}
          </div>
        </section>

        <HrExceptionPanel
          title="Needs Attention"
          items={loading ? [] : needsAttention}
          emptyLabel={loading ? 'Loading…' : 'Nothing needs attention right now'}
        />
      </div>
    </OperationalPageShell>
  )
}
