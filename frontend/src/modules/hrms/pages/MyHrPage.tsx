import { useMemo } from 'react'
import { CalendarDays, ChevronRight, Clock, FileText, User, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { useAuth } from '@/context/AuthProvider'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import '../hrms-ui.css'

interface QuickLink {
  id: string
  label: string
  description: string
  to: string
  icon: typeof User
  visible: boolean
}

function timeOfDayGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function MyHrPage() {
  const { session } = useAuth()
  const perms = useHrmsPermissions()
  const name = session ? `${session.user.firstName} ${session.user.lastName}`.trim() : 'there'
  const greeting = useMemo(timeOfDayGreeting, [])

  const links: QuickLink[] = [
    {
      id: 'leave',
      label: 'Apply Leave',
      description: 'Submit a new leave request or check your balances.',
      to: '/hrms/leave',
      icon: CalendarDays,
      visible: perms.canApplyLeave || perms.canViewLeave,
    },
    {
      id: 'overtime',
      label: 'My Overtime',
      description: 'View overtime entries pending or approved for you.',
      to: '/hrms/overtime',
      icon: Clock,
      visible: perms.canViewOvertime,
    },
    {
      id: 'payslips',
      label: 'My Payslips',
      description: 'View and download your payslips.',
      to: '/hrms/payroll/my-payslips',
      icon: FileText,
      visible: perms.canViewPayslip,
    },
    {
      id: 'loans',
      label: 'My Loans',
      description: 'Track loan and salary advance balances.',
      to: '/hrms/my-loans',
      icon: Wallet,
      visible: perms.canViewLoan,
    },
  ].filter((l) => l.visible)

  return (
    <OperationalPageShell
      title="My HR"
      description="Your personal HR self-service hub."
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'My HR' }]}
    >
      <div className="hr-my-greeting">
        <div className="hr-my-greeting__avatar">
          <User size={20} />
        </div>
        <div>
          <div className="hr-my-greeting__title">
            {greeting}, {name}
          </div>
          <div className="hr-my-greeting__subtitle">Here's quick access to your HR essentials.</div>
        </div>
      </div>

      <div className="hr-my-links">
        {links.map((link) => (
          <Link key={link.id} to={link.to} className="hr-my-links__item">
            <link.icon size={18} className="hr-my-links__icon" />
            <div className="hr-my-links__body">
              <div className="hr-my-links__label">{link.label}</div>
              <div className="hr-my-links__desc">{link.description}</div>
            </div>
            <ChevronRight size={16} className="hr-my-links__chevron" />
          </Link>
        ))}
      </div>
    </OperationalPageShell>
  )
}
