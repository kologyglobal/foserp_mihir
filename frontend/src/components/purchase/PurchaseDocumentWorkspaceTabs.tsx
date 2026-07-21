import type { LucideIcon } from 'lucide-react'
import { Check } from 'lucide-react'
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
  /** Short status text, e.g. "2 fields pending" */
  statusDetail: string
}

const STATUS_TONE: Record<
  DocumentWorkspaceTabStatus,
  { dot: string; text: string }
> = {
  complete: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
  },
  fields_pending: {
    dot: 'bg-amber-500',
    text: 'text-amber-800',
  },
  incomplete_lines: {
    dot: 'bg-amber-500',
    text: 'text-amber-800',
  },
  validation_error: {
    dot: 'bg-red-500',
    text: 'text-red-700',
  },
  unsaved: {
    dot: 'bg-sky-500',
    text: 'text-sky-800',
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

/**
 * Compact two-step document workspace strip (PR / PO / similar).
 * Selected = primary underline + soft fill (no “Active” badge).
 * Status = one muted line + tone dot (no duplicate uppercase chips).
 */
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
        'purchase-doc-workspace-tabs mb-3 overflow-hidden rounded-md border border-erp-border bg-white',
        className,
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${Math.max(tabs.length, 1)}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab, index) => {
          const Icon = tab.icon
          const tone = STATUS_TONE[tab.status]
          const selected = active === tab.id
          const ready = tab.status === 'complete'
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
                'relative flex min-h-[3.5rem] min-w-0 items-center gap-3 border-b-[3px] px-3 py-2.5 text-left transition-colors sm:px-4',
                index > 0 && 'border-l border-l-erp-border',
                selected
                  ? 'border-b-erp-primary bg-erp-primary-soft/35'
                  : 'border-b-transparent hover:bg-erp-surface-alt/70',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tabular-nums',
                  selected
                    ? 'bg-erp-primary text-white'
                    : ready
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      : 'bg-erp-surface-alt text-erp-muted ring-1 ring-erp-border',
                )}
                aria-hidden
              >
                {ready && !selected ? (
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                ) : (
                  index + 1
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      selected ? 'text-erp-primary' : 'text-erp-muted',
                    )}
                    aria-hidden
                    strokeWidth={selected ? 2.25 : 1.75}
                  />
                  <span
                    className={cn(
                      'truncate text-[13px] font-semibold tracking-tight',
                      selected ? 'text-erp-primary' : 'text-erp-text',
                    )}
                  >
                    {tab.label}
                  </span>
                  <span
                    className={cn('ml-0.5 h-1.5 w-1.5 shrink-0 rounded-full', tone.dot)}
                    aria-hidden
                  />
                </span>
                <span
                  className={cn(
                    'mt-0.5 block min-h-[1rem] truncate pl-[1.125rem] text-[11px] leading-tight',
                    selected ? cn('font-medium', tone.text) : 'text-erp-muted',
                  )}
                >
                  {tab.statusDetail}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
