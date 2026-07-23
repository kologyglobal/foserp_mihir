/**
 * FORM-A — Manufacturing document shell (CRM-aligned).
 * Composes OperationalPageShell + ErpCommandBar; adds the standard document
 * architecture: alert/guidance area → operational summary strip → main content
 * with an optional collapsible information side panel.
 *
 * Do not invent page-specific chrome — this is the single shell for
 * Manufacturing create/detail/review forms.
 */
import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar, type ErpCommandAction } from '@/components/erp/ErpCommandBar'
import { cn } from '@/utils/cn'

export interface DocumentSummaryItem {
  id: string
  label: string
  value: ReactNode
  /** Optional tone for attention values (shortage, overdue). */
  tone?: 'default' | 'success' | 'warning' | 'danger'
  helper?: string
}

/** B. Operational summary strip — 4–6 important facts, not decorative KPIs. */
export function DocumentSummaryStrip({ items }: { items: DocumentSummaryItem[] }) {
  if (items.length === 0) return null
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-erp-border bg-erp-border sm:grid-cols-3',
        items.length >= 6 ? 'lg:grid-cols-6' : items.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4',
      )}
    >
      {items.map((item) => (
        <div key={item.id} className="bg-white px-3.5 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-erp-muted">{item.label}</div>
          <div
            className={cn(
              'mt-1 text-[18px] font-semibold leading-none tabular-nums tracking-tight',
              item.tone === 'danger'
                ? 'text-rose-700'
                : item.tone === 'warning'
                  ? 'text-amber-700'
                  : item.tone === 'success'
                    ? 'text-emerald-700'
                    : 'text-erp-text',
            )}
          >
            {item.value}
          </div>
          {item.helper ? <div className="mt-1 truncate text-[11px] text-erp-muted">{item.helper}</div> : null}
        </div>
      ))}
    </div>
  )
}

export interface InfoPanelSection {
  title: string
  fields: Array<{ label: string; value: ReactNode }>
}

/** Consistent CRM-style collapsible information side panel. */
export function DocumentInfoPanel({
  title = 'Information',
  sections,
  defaultOpen = true,
}: {
  title?: string
  sections: InfoPanelSection[]
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <aside className="rounded-lg border border-erp-border bg-white">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-erp-text">
          <Info className="h-3.5 w-3.5 text-erp-muted" aria-hidden />
          {title}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-erp-muted" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 text-erp-muted" aria-hidden />
        )}
      </button>
      {open ? (
        <div className="space-y-4 border-t border-erp-border px-4 py-3">
          {sections.map((section) => (
            <div key={section.title}>
              <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                {section.title}
              </h4>
              <dl className="space-y-1.5">
                {section.fields.map((f) => (
                  <div key={f.label} className="flex items-baseline justify-between gap-3 text-[12px]">
                    <dt className="shrink-0 text-erp-muted">{f.label}</dt>
                    <dd className="min-w-0 text-right font-medium text-erp-text">{f.value ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  )
}

/** Collapsible ADVANCED section — progressive disclosure for rare fields. */
export function AdvancedSection({
  title = 'Advanced options',
  subtitle,
  children,
  defaultOpen = false,
}: {
  title?: string
  subtitle?: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="rounded-lg border border-erp-border bg-white">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>
          <span className="text-[13px] font-semibold text-erp-text">{title}</span>
          {subtitle ? <span className="ml-2 text-[11px] text-erp-muted">{subtitle}</span> : null}
        </span>
        <span className="text-[11px] font-medium text-erp-muted">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? <div className="border-t border-erp-border px-4 py-3">{children}</div> : null}
    </section>
  )
}

/** Standard form section card — one title, comfortable spacing, no decorative chrome. */
export function DocumentFormSection({
  title,
  subtitle,
  children,
  className,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-lg border border-erp-border bg-white p-4', className)}>
      <div className="mb-3">
        <h2 className="text-[13px] font-semibold text-erp-text">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[12px] text-erp-muted">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

export interface ManufacturingDocumentShellProps {
  /** Document number or "New Work Order". */
  title: string
  /** Supporting subtitle — product, customer, purpose. */
  description?: string
  breadcrumbs?: { label: string; to?: string }[]
  backLink?: { to: string; label: string }
  /** Status/priority badges rendered beside the title area. */
  statusArea?: ReactNode
  primaryAction?: ErpCommandAction
  secondaryActions?: ErpCommandAction[]
  moreActions?: ErpCommandAction[]
  /** C. Alert and guidance area — blockers, warnings, next best action. */
  alerts?: ReactNode
  /** B. Operational summary strip. */
  summary?: DocumentSummaryItem[]
  /** Right contextual panel (4 cols on desktop, stacks on tablet). */
  sidePanel?: ReactNode
  children: ReactNode
  favoritePath?: string
  className?: string
}

/**
 * A/B/C/D of the standard Manufacturing form page architecture.
 * Sticky lifecycle actions come from ErpCommandBar (sticky inline), matching
 * Accounting document pages — no duplicate top+bottom save buttons.
 */
export function ManufacturingDocumentShell({
  title,
  description,
  breadcrumbs,
  backLink,
  statusArea,
  primaryAction,
  secondaryActions,
  moreActions,
  alerts,
  summary,
  sidePanel,
  children,
  favoritePath,
  className,
}: ManufacturingDocumentShellProps) {
  const commandBar =
    primaryAction || moreActions?.length || secondaryActions?.length ? (
      <ErpCommandBar
        inline
        sticky
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
        moreActions={moreActions}
        moreActionsLabel="More"
      />
    ) : undefined

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title={title}
      description={description}
      showDescription={Boolean(description)}
      breadcrumbs={breadcrumbs ?? [{ label: 'Manufacturing & Production', to: '/manufacturing' }, { label: title }]}
      autoBreadcrumbs={false}
      backLink={backLink}
      favoritePath={favoritePath}
      commandBar={commandBar}
      className={className}
    >
      <div className="space-y-3">
        {statusArea ? <div className="flex flex-wrap items-center gap-1.5">{statusArea}</div> : null}
        {alerts}
        {summary && summary.length > 0 ? <DocumentSummaryStrip items={summary} /> : null}
        {sidePanel ? (
          <div className="grid gap-3 lg:grid-cols-12">
            <div className="min-w-0 space-y-3 lg:col-span-8">{children}</div>
            <div className="space-y-3 lg:col-span-4">{sidePanel}</div>
          </div>
        ) : (
          children
        )}
      </div>
    </OperationalPageShell>
  )
}
