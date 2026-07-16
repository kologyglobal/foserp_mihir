import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export function BudgetingWorkspacePanelTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="mb-3 flex gap-1 border-b border-erp-border" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'border-b-2 px-3 py-2 text-[12px] font-semibold transition-colors',
            value === t.id
              ? 'border-erp-primary text-erp-primary'
              : 'border-transparent text-erp-muted hover:text-erp-text',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function BudgetingCollapsedSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details className="rounded border border-erp-border bg-erp-surface/40" open={defaultOpen}>
      <summary className="cursor-pointer select-none px-3 py-2 text-[12px] font-semibold text-erp-text">
        {title}
      </summary>
      <div className="border-t border-erp-border px-3 py-2 text-[12px] text-erp-muted">{children}</div>
    </details>
  )
}
