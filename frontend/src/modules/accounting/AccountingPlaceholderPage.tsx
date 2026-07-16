import { Link, useNavigate } from 'react-router-dom'
import { Clock, Download, Plus, Upload } from 'lucide-react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'

interface AccountingPlaceholderPageProps {
  title: string
  description: string
  breadcrumbLabel: string
  bullets?: string[]
}

/** CRM/Masters-style "shell ready" placeholder for Accounting screens not yet built. */
export function AccountingPlaceholderPage({
  title,
  description,
  breadcrumbLabel,
  bullets = [
    'Full list / smart form with real posting rules',
    'Filters, export, and audit trail (created/modified by)',
    'Role-based view · create · edit · approve permissions',
  ],
}: AccountingPlaceholderPageProps) {
  const navigate = useNavigate()

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={title}
      description={description}
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: breadcrumbLabel }]}
      autoBreadcrumbs={false}
      favoritePath={`/accounting/${breadcrumbLabel.toLowerCase().replace(/\s+/g, '-')}`}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{ id: 'new', label: 'New', icon: Plus, disabled: true, onClick: () => undefined }}
          secondaryActions={[
            { id: 'import', label: 'Import', icon: Upload, disabled: true, onClick: () => undefined },
            { id: 'export', label: 'Export', icon: Download, disabled: true, onClick: () => undefined },
          ]}
        />
      )}
    >
      <div className="masters-empty-state crm-masters-card rounded-lg border border-erp-border bg-erp-surface p-6 shadow-[var(--erp-shadow-card)]">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-800">
            <Clock className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-erp-text">Screen planned — UI shell ready</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-erp-muted">
              {description} Navigation, routing, and breadcrumbs are already wired from the Accounting Dashboard;
              the full screen ships in a later sprint (demo/UI-only — no backend posting).
            </p>
            <ul className="mt-4 space-y-1.5 text-[12px] text-erp-muted">
              {bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="erp-btn erp-btn-primary inline-flex h-9 items-center px-4 text-[13px] font-semibold"
                onClick={() => navigate('/accounting')}
              >
                Back to Accounting Dashboard
              </button>
              <Link to="/accounting" className="erp-btn erp-btn-ghost inline-flex h-9 items-center px-4 text-[13px] font-semibold">
                Browse Accounting module
              </Link>
            </div>
          </div>
        </div>
      </div>
    </OperationalPageShell>
  )
}
