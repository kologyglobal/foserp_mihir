import { Link } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'

/** Maintenance V1 requires VITE_USE_API=true — no demo store. */
export function MaintenanceApiRequiredPage() {
  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Maintenance"
      title="API mode required"
      description="Maintenance V1 uses live API and database only. Enable VITE_USE_API=true to continue."
      breadcrumbs={[{ label: 'Maintenance' }]}
      autoBreadcrumbs={false}
    >
      <p className="text-sm text-erp-muted">
        Switch to API mode, then open{' '}
        <Link to="/maintenance" className="text-erp-primary hover:underline">
          /maintenance
        </Link>
        .
      </p>
    </OperationalPageShell>
  )
}
