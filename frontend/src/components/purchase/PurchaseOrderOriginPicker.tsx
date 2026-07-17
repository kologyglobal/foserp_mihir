import type { LucideIcon } from 'lucide-react'
import {
  ClipboardList,
  FileEdit,
  FileSpreadsheet,
  Layers,
  Scale,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  PURCHASE_ORDER_ORIGIN_LABELS,
  type PurchaseOrderOrigin,
} from '@/types/purchaseDomain'

const ORIGIN_META: Record<
  PurchaseOrderOrigin,
  { icon: LucideIcon; description: string; accent: string }
> = {
  manual: {
    icon: FileEdit,
    description: 'Start a blank PO and enter vendor, lines, and terms yourself.',
    accent: 'border-slate-200 hover:border-slate-400 hover:bg-slate-50',
  },
  purchase_requisition: {
    icon: ClipboardList,
    description: 'Create from an approved requisition — including PRs marked for direct PO.',
    accent: 'border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50/60',
  },
  quotation_comparison: {
    icon: Scale,
    description: 'Award a completed vendor quote comparison into a purchase order.',
    accent: 'border-sky-200 hover:border-sky-500 hover:bg-sky-50/60',
  },
  vendor_quotation: {
    icon: FileSpreadsheet,
    description: 'Convert an approved vendor quotation into a purchase order.',
    accent: 'border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50/60',
  },
  blanket_order: {
    icon: Layers,
    description: 'Raise a call-off against an active blanket / rate-contract order.',
    accent: 'border-amber-200 hover:border-amber-500 hover:bg-amber-50/60',
  },
}

const ORIGIN_ORDER: PurchaseOrderOrigin[] = [
  'purchase_requisition',
  'vendor_quotation',
  'quotation_comparison',
  'blanket_order',
  'manual',
]

export type PurchaseOrderOriginPickerProps = {
  onSelect: (origin: PurchaseOrderOrigin) => void
  /** Optional count badge on Approved PR (e.g. pending direct PO). */
  pendingPoCount?: number
  className?: string
}

export function PurchaseOrderOriginPicker({
  onSelect,
  pendingPoCount,
  className,
}: PurchaseOrderOriginPickerProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-erp-border bg-white p-5 shadow-[var(--erp-shadow-card,0_1px_2px_rgb(15_23_42/0.06))]',
        className,
      )}
    >
      <div className="mb-5 max-w-2xl">
        <h2 className="text-[16px] font-semibold text-erp-text">How do you want to create this PO?</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-erp-muted">
          Choose a source to prefill vendor and lines, or start with manual entry. You can change the
          source later before saving.
        </p>
      </div>

      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        role="listbox"
        aria-label="Create purchase order from"
      >
        {ORIGIN_ORDER.map((mode) => {
          const meta = ORIGIN_META[mode]
          const Icon = meta.icon
          const recommended = mode === 'purchase_requisition'
          return (
            <button
              key={mode}
              type="button"
              role="option"
              className={cn(
                'group relative flex h-full flex-col items-start rounded-lg border bg-white p-4 text-left transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-erp-primary/40',
                meta.accent,
                recommended && 'ring-1 ring-emerald-200',
              )}
              onClick={() => onSelect(mode)}
            >
              {recommended ? (
                <span className="absolute right-3 top-3 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                  Recommended
                </span>
              ) : null}
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-erp-surface-alt text-erp-primary group-hover:bg-white">
                <Icon className="h-4.5 w-4.5 h-4 w-4" aria-hidden />
              </span>
              <span className="pr-16 text-[14px] font-semibold text-erp-text">
                {PURCHASE_ORDER_ORIGIN_LABELS[mode]}
              </span>
              <span className="mt-1.5 text-[12px] leading-snug text-erp-muted">{meta.description}</span>
              {mode === 'purchase_requisition' && pendingPoCount != null && pendingPoCount > 0 ? (
                <span className="mt-3 inline-flex items-center rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                  {pendingPoCount} ready for PO
                </span>
              ) : (
                <span className="mt-3 text-[12px] font-medium text-erp-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Continue →
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export type PurchaseOrderOriginBannerProps = {
  originLabel: string
  showSelectSource: boolean
  onSelectSource: () => void
  onChangeSource: () => void
}

export function PurchaseOrderOriginBanner({
  originLabel,
  showSelectSource,
  onSelectSource,
  onChangeSource,
}: PurchaseOrderOriginBannerProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-erp-border bg-erp-surface-alt/80 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Order origin</p>
        <p className="mt-0.5 text-[14px] font-semibold text-erp-text">{originLabel}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {showSelectSource ? (
          <button
            type="button"
            className="erp-btn erp-btn-secondary h-8 px-3 text-[12px]"
            onClick={onSelectSource}
          >
            Select source…
          </button>
        ) : null}
        <button
          type="button"
          className="erp-btn erp-btn-ghost h-8 px-3 text-[12px]"
          onClick={onChangeSource}
        >
          Change source
        </button>
      </div>
    </div>
  )
}
