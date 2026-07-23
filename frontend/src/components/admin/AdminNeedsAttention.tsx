import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../utils/cn'

export type AdminAttentionItem = {
  id: string
  title: string
  detail?: string
  severity?: 'info' | 'warning' | 'critical'
  to: string
}

const SEVERITY: Record<NonNullable<AdminAttentionItem['severity']>, string> = {
  info: 'border-erp-border bg-erp-surface',
  warning: 'border-amber-200 bg-amber-50/80',
  critical: 'border-red-200 bg-red-50/80',
}

export function AdminNeedsAttention({
  items,
  title = 'Needs attention',
  emptyMessage = 'No open administration issues.',
  className,
}: {
  items: AdminAttentionItem[]
  title?: string
  emptyMessage?: string
  className?: string
}) {
  return (
    <section className={cn('rounded border border-erp-border bg-white', className)}>
      <header className="border-b border-erp-border px-3 py-2.5">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-erp-muted">{title}</h2>
        <p className="mt-0.5 text-[12px] text-erp-muted">Actionable items from users, roles, and security.</p>
      </header>
      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-erp-muted">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-erp-border">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={item.to}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-erp-surface-alt/80',
                  SEVERITY[item.severity ?? 'info'],
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-erp-text">{item.title}</p>
                  {item.detail ? <p className="mt-0.5 text-[12px] text-erp-muted">{item.detail}</p> : null}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-erp-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function AdminPageHeader({
  title: _title,
  subtitle: _subtitle,
  actions,
  className,
}: {
  title: string
  subtitle?: string
  description?: string
  icon?: ComponentType<{ className?: string }>
  actions?: ReactNode
  className?: string
}) {
  /** Title/description live in WorkspaceUnifiedHeader via AdminWorkspaceShell — only keep actions. */
  if (!actions) return null
  return (
    <div className={cn('mb-3 flex flex-wrap items-center justify-end gap-2', className)}>
      {actions}
    </div>
  )
}
