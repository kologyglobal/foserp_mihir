import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

export type DocumentWorkspaceTabStatus =
  | 'complete'
  | 'fields_pending'
  | 'incomplete_lines'
  | 'validation_error'
  | 'unsaved'

export type DocumentWorkspaceTabModel<TId extends string = string> = {
  id: TId
  label: string
  icon: LucideIcon
  status: DocumentWorkspaceTabStatus
  /** Short status text shown after an em dash, e.g. "2 fields pending" */
  statusDetail: string
}

const STATUS_CHIP: Record<
  DocumentWorkspaceTabStatus,
  { label: string; className: string }
> = {
  complete: {
    label: 'Complete',
    className: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
  },
  fields_pending: {
    label: 'Fields Pending',
    className: 'bg-amber-50 text-amber-900 ring-amber-200/80',
  },
  incomplete_lines: {
    label: 'Incomplete Lines',
    className: 'bg-amber-50 text-amber-900 ring-amber-200/80',
  },
  validation_error: {
    label: 'Validation Error',
    className: 'bg-red-50 text-red-800 ring-red-200/80',
  },
  unsaved: {
    label: 'Unsaved',
    className: 'bg-sky-50 text-sky-900 ring-sky-200/80',
  },
}

export type PurchaseDocumentWorkspaceTabsProps<TId extends string = string> = {
  active: TId
  onChange: (workspace: TId) => void
  tabs: DocumentWorkspaceTabModel<TId>[]
  /** Accessible name for the tablist, e.g. "Purchase order workspaces" */
  ariaLabel: string
  /** Prefix for tab/panel ids, e.g. "po" → `po-workspace-tab-…` */
  idPrefix: string
  className?: string
}

/** Two-workspace document tab strip with progress / validation status chips. */
export function PurchaseDocumentWorkspaceTabs<TId extends string = string>({
  active,
  onChange,
  tabs,
  ariaLabel,
  idPrefix,
  className,
}: PurchaseDocumentWorkspaceTabsProps<TId>) {
  return (
    <div
      className={cn(
        'mb-3 overflow-hidden rounded-md border border-erp-border bg-erp-surface-alt/40 shadow-[var(--erp-shadow-card)]',
        className,
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      <div className="flex flex-wrap gap-0">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const chip = STATUS_CHIP[tab.status]
          const selected = active === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-current={selected ? 'page' : undefined}
              id={`${idPrefix}-workspace-tab-${tab.id}`}
              aria-controls={`${idPrefix}-workspace-panel-${tab.id}`}
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative flex min-w-0 flex-1 items-center gap-2.5 border-b-[3px] px-3 py-3 text-left transition-all sm:px-4',
                selected
                  ? 'z-[1] border-erp-primary bg-erp-surface shadow-[inset_3px_0_0_0_var(--erp-primary)]'
                  : 'border-transparent bg-transparent text-erp-muted opacity-80 hover:bg-erp-surface/80 hover:opacity-100',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                  selected
                    ? 'bg-erp-primary text-white'
                    : 'bg-erp-surface-alt text-erp-muted ring-1 ring-erp-border',
                )}
                aria-hidden
              >
                <Icon className="h-4 w-4" strokeWidth={selected ? 2.25 : 1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span
                    className={cn(
                      'truncate text-[13px] font-semibold tracking-tight',
                      selected ? 'text-erp-primary' : 'text-erp-text',
                    )}
                  >
                    {tab.label}
                  </span>
                  {selected ? (
                    <span className="rounded bg-erp-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                      Active
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    'mt-0.5 block truncate text-[11px]',
                    selected ? 'font-medium text-erp-text' : 'text-erp-muted',
                  )}
                >
                  {tab.statusDetail}
                </span>
                <span
                  className={cn(
                    'mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset',
                    chip.className,
                  )}
                >
                  {chip.label}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
