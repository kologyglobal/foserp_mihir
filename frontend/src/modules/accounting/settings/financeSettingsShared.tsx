import type { ReactNode } from 'react'
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react'
import { cn } from '@/utils/cn'

export function SetupStatusBadge({ status }: { status: 'complete' | 'incomplete' | 'attention' | 'optional' }) {
  const map = {
    complete: { label: 'Complete', className: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
    incomplete: { label: 'Incomplete', className: 'bg-amber-50 text-amber-900 border-amber-200', Icon: Circle },
    attention: { label: 'Needs attention', className: 'bg-orange-50 text-orange-900 border-orange-200', Icon: AlertCircle },
    optional: { label: 'Optional', className: 'bg-slate-50 text-slate-600 border-slate-200', Icon: Circle },
  } as const
  const { label, className, Icon } = map[status]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold', className)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

export function SetupCard({
  title,
  description,
  status,
  action,
  children,
}: {
  title: string
  description: string
  status: 'complete' | 'incomplete' | 'attention' | 'optional'
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <article className="rounded-md border border-erp-border bg-erp-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-erp-text">{title}</h3>
          <p className="mt-0.5 text-[12px] text-erp-muted">{description}</p>
        </div>
        <SetupStatusBadge status={status} />
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </article>
  )
}

export function FinanceSettingsTable({
  headers,
  children,
}: {
  headers: string[]
  children: ReactNode
}) {
  return (
    <div className="overflow-x-auto rounded border border-erp-border">
      <table className="w-full min-w-[640px] text-left text-[12px]">
        <thead className="border-b border-erp-border bg-erp-surface-alt text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-erp-border">{children}</tbody>
      </table>
    </div>
  )
}
