import { Link } from 'react-router-dom'
import { Scale } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { useHrmsPermissions } from '@/utils/permissions/hrms'

const LINKS = [
  { path: '/hrms/payroll/statutory/pf', label: 'PF', desc: 'Provident Fund rates, ceiling, wage basis' },
  { path: '/hrms/payroll/statutory/esic', label: 'ESIC', desc: 'ESIC rates, eligibility ceiling, wage basis' },
  { path: '/hrms/payroll/statutory/pt', label: 'Professional Tax', desc: 'State slabs (not India-wide)' },
  { path: '/hrms/payroll/statutory/tds', label: 'Salary TDS', desc: 'Foundation / review-required monthly' },
  { path: '/hrms/payroll/statutory/lwf', label: 'LWF', desc: 'State labour welfare fund' },
]

export function StatutoryHubPage() {
  const perms = useHrmsPermissions()

  if (!perms.canViewStatutory) {
    return (
      <OperationalPageShell title="Statutory Setup" breadcrumbs={[{ label: 'HRMS' }, { label: 'Statutory' }]}>
        <p className="text-sm text-erp-muted">You do not have permission to view statutory setup.</p>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title="Statutory Setup"
      description="Effective-dated PF / ESIC / PT / TDS / LWF rules. No government portal filing in Phase 8."
      breadcrumbs={[
        { label: 'HRMS', to: '/hrms' },
        { label: 'Payroll', to: '/hrms/payroll/runs' },
        { label: 'Statutory' },
      ]}
    >
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => (
          <Link
            key={l.path}
            to={l.path}
            className="rounded border border-erp-border bg-white p-4 text-sm hover:border-erp-primary"
          >
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <Scale className="h-4 w-4 text-erp-primary" />
              {l.label}
            </div>
            <p className="text-erp-muted">{l.desc}</p>
          </Link>
        ))}
      </div>
      {perms.canViewStatutoryReports ? (
        <p className="mt-4 text-xs text-erp-muted">
          Compliance registers are available via API under <code>/hrms/statutory/registers/*</code> (CSV export
          supported). Wire a dedicated register UI in a later pass if needed.
        </p>
      ) : null}
    </OperationalPageShell>
  )
}
