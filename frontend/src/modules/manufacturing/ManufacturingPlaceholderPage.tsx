import { Link, useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'

interface ManufacturingPlaceholderPageProps {
  title: string
  breadcrumbLabel: string
}

export function ManufacturingPlaceholderPage({ title, breadcrumbLabel }: ManufacturingPlaceholderPageProps) {
  const navigate = useNavigate()
  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title={title}
      description="This workspace will be implemented in a later phase."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: breadcrumbLabel },
      ]}
      autoBreadcrumbs={false}
      favoritePath={`/manufacturing/${breadcrumbLabel.toLowerCase().replace(/\s+/g, '-')}`}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'back', label: 'Back to Dashboard', onClick: () => navigate('/manufacturing') },
          ]}
        />
      )}
    >
      <div className="rounded-lg border border-erp-border bg-erp-surface p-6 shadow-[var(--erp-shadow-card)]">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-800">
            <Clock className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-erp-text">Coming in a later phase</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-erp-muted">
              This workspace will be implemented in a later phase. Planning screens (Dashboard, BOM, Production Plan) are available now.
            </p>
            <Link to="/manufacturing" className="mt-4 inline-flex text-[13px] font-medium text-erp-primary hover:underline">
              Return to Manufacturing Dashboard
            </Link>
          </div>
        </div>
      </div>
    </OperationalPageShell>
  )
}
