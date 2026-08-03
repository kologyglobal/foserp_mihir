import { ChevronRight, FileCheck2, Settings2, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import '../hrms-ui.css'

interface SettingsLink {
  id: string
  label: string
  description: string
  to: string
  icon: typeof Settings2
  show: boolean
}

/** Simple settings hub — links out to the existing setup pages, no new backend surfaces. */
export function HrSettingsHubPage() {
  const perms = useHrmsPermissions()

  const links: SettingsLink[] = [
    {
      id: 'designations',
      label: 'Designations',
      description: 'Job titles used on employee master and roster.',
      to: '/hrms/setup/designations',
      icon: Users,
      show: perms.canViewDesignation,
    },
    {
      id: 'leave-types',
      label: 'Leave Types',
      description: 'CL, SL, EL, LOP — accrual and half-day rules.',
      to: '/hrms/leave/types',
      icon: Settings2,
      show: perms.canViewLeave,
    },
    {
      id: 'statutory',
      label: 'Statutory Setup',
      description: 'PF, ESI, PT, TDS rules by legal entity.',
      to: '/hrms/payroll/statutory',
      icon: FileCheck2,
      show: perms.canViewStatutory,
    },
  ].filter((l) => l.show)

  return (
    <OperationalPageShell
      title="HR Settings"
      description="Quick links to HRMS setup and configuration."
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'HR Settings' }]}
    >
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
