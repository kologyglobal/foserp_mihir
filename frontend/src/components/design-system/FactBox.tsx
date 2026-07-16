import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface FactBoxField {
  label: string
  value: ReactNode
}

interface FactBoxProps {
  title: string
  fields: FactBoxField[]
  defaultOpen?: boolean
  className?: string
  actions?: ReactNode
}

/** BC-style collapsible fact box panel for card/detail pages */
export function FactBox({ title, fields, defaultOpen = true, className, actions }: FactBoxProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <aside className={cn('erp-factbox', className)}>
      <div className="erp-factbox-header">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left transition-colors hover:text-erp-primary"
        >
          <span className="text-[13px] font-semibold text-erp-text">{title}</span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-erp-muted transition-colors hover:bg-erp-surface-alt hover:text-erp-text"
            aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
      </div>
      {open && (
        <div className="erp-factbox-body">
          {fields.map((f) => (
            <div key={f.label} className="erp-factbox-row">
              <span className="erp-factbox-label">{f.label}</span>
              <span className="erp-factbox-value">{f.value}</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}

interface FactBoxPanelProps {
  children: ReactNode
  className?: string
}

export function FactBoxPanel({ children, className }: FactBoxPanelProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {children}
    </div>
  )
}

interface DocumentLayoutProps {
  main: ReactNode
  factBoxes?: ReactNode
  className?: string
}

/** Two-column document layout: main content + fact box rail */
export function DocumentLayout({ main, factBoxes, className }: DocumentLayoutProps) {
  return (
    <div className={cn('grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]', className)}>
      <div className="min-w-0 space-y-5">{main}</div>
      {factBoxes && (
        <div className="space-y-3 xl:sticky xl:top-[calc(var(--erp-topbar-height)+20px)] xl:self-start">
          {factBoxes}
        </div>
      )}
    </div>
  )
}

interface FastTabsProps {
  tabs: { id: string; label: string; count?: number }[]
  active: string
  onChange: (id: string) => void
  className?: string
}

export function FastTabs({ tabs, active, onChange, className }: FastTabsProps) {
  return (
    <div className={cn('flex flex-wrap gap-1 border-b border-erp-border', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn('erp-fast-tab', active === tab.id && 'erp-fast-tab-active')}
        >
          {tab.label}
          {tab.count != null && (
            <span className="rounded-full bg-erp-surface-alt px-1.5 py-0.5 text-[10px] font-bold text-erp-muted">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
