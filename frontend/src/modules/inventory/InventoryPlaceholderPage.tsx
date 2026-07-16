import { Link, useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'

interface InventoryPlaceholderPageProps {
  title: string
  description?: string
}

export function InventoryPlaceholderPage({
  title,
  description = 'This workspace will be implemented in a later phase.',
}: InventoryPlaceholderPageProps) {
  const navigate = useNavigate()

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title={title}
      description={description}
      breadcrumbs={[{ label: 'Inventory & Warehouse', to: '/inventory' }, { label: title }]}
      autoBreadcrumbs={false}
      favoritePath={`/inventory/${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="masters-empty-state crm-masters-card rounded-lg border border-erp-border bg-erp-surface p-6 shadow-[var(--erp-shadow-card)]">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-800">
            <Clock className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-erp-text">Coming in a later phase</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-erp-muted">
              {description}
            </p>
            <p className="mt-3 text-[12px] text-erp-muted">
              Navigation and routing are wired. Movement transactions, stock count workflows, and warehouse automation are not part of Phase 1.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="erp-btn erp-btn-primary inline-flex h-9 items-center px-4 text-[13px] font-semibold"
                onClick={() => navigate('/inventory')}
              >
                Back to Inventory Overview
              </button>
              <Link to="/inventory/items" className="erp-btn erp-btn-ghost inline-flex h-9 items-center px-4 text-[13px] font-semibold">
                Browse Items
              </Link>
            </div>
          </div>
        </div>
      </div>
    </OperationalPageShell>
  )
}
