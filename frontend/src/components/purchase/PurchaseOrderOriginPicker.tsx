import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  ClipboardList,
  FileEdit,
  FileSpreadsheet,
  Layers,
  Scale,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'
import {
  PURCHASE_ORDER_ORIGIN_LABELS,
  type PurchaseOrderOrigin,
} from '@/types/purchaseDomain'

const OPTIONS: Array<{
  mode: PurchaseOrderOrigin
  title: string
  subtitle: string
  points: string[]
  icon: LucideIcon
  recommended?: boolean
}> = [
  {
    mode: 'purchase_requisition',
    title: PURCHASE_ORDER_ORIGIN_LABELS.purchase_requisition,
    subtitle: 'Create from an approved requisition — including PRs marked for direct PO.',
    points: [
      'Best for Planning / direct PR demand',
      'Vendor and lines can flow from the PR',
      'Keeps PR → PO traceability',
    ],
    icon: ClipboardList,
    recommended: true,
  },
  {
    mode: 'quotation_comparison',
    title: PURCHASE_ORDER_ORIGIN_LABELS.quotation_comparison,
    subtitle: 'Award a completed vendor quote comparison into a purchase order.',
    points: [
      'Use after RFQ → quotation → comparison',
      'Recommended vendor and rates carry over',
      'Preferred RFQ-path create PO',
    ],
    icon: Scale,
    recommended: true,
  },
  {
    mode: 'vendor_quotation',
    title: PURCHASE_ORDER_ORIGIN_LABELS.vendor_quotation,
    subtitle: 'Convert an approved vendor quotation into a purchase order.',
    points: [
      'Pick a selected / approved vendor quote',
      'Useful when comparison is not required',
      'Carries vendor commercial terms',
    ],
    icon: FileSpreadsheet,
  },
  {
    mode: 'blanket_order',
    title: PURCHASE_ORDER_ORIGIN_LABELS.blanket_order,
    subtitle: 'Raise a call-off against an active blanket / rate-contract order.',
    points: [
      'Release quantities against a blanket',
      'Reuse contracted rates and vendor',
      'Best for recurring scheduled buys',
    ],
    icon: Layers,
  },
  {
    mode: 'manual',
    title: PURCHASE_ORDER_ORIGIN_LABELS.manual,
    subtitle: 'Start a blank PO and enter vendor, lines, and terms yourself.',
    points: [
      'Full manual entry of header and lines',
      'Use for ad-hoc or exception buys',
      'No source document required',
    ],
    icon: FileEdit,
  },
]

export type PurchaseOrderOriginPickerProps = {
  onSelect: (origin: PurchaseOrderOrigin) => void
  onCancel: () => void
  /** Optional count badge on Approved PR (e.g. pending direct PO). */
  pendingPoCount?: number
  /** Origins that cannot be used (e.g. not API-backed yet). */
  disabledOrigins?: Partial<Record<PurchaseOrderOrigin, string>>
  className?: string
}

/**
 * First step for blank New Purchase Order — choose create path (quotation-style cards).
 */
export function PurchaseOrderOriginPicker({
  onSelect,
  onCancel,
  pendingPoCount,
  disabledOrigins,
  className,
}: PurchaseOrderOriginPickerProps) {
  return (
    <div
      className={cn('so-create-chooser', className)}
      role="dialog"
      aria-labelledby="po-create-chooser-title"
    >
      <div className="so-create-chooser__panel so-create-chooser__panel--wide">
        <header className="so-create-chooser__header">
          <p className="so-create-chooser__eyebrow">Purchase · Order</p>
          <h1 id="po-create-chooser-title" className="so-create-chooser__title">
            How do you want to create this PO?
          </h1>
          <p className="so-create-chooser__lead">
            Prefer Planning (direct PR) or Quotation Comparison (RFQ path). Pick a card to continue.
          </p>
        </header>

        <div className="so-create-chooser__grid so-create-chooser__grid--po">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon
            const disabledReason = disabledOrigins?.[opt.mode]
            const disabled = Boolean(disabledReason)
            return (
              <button
                key={opt.mode}
                type="button"
                className={cn(
                  'so-create-chooser__card',
                  opt.recommended && !disabled && 'so-create-chooser__card--recommended',
                  disabled && 'so-create-chooser__card--disabled',
                )}
                disabled={disabled}
                title={disabledReason ?? undefined}
                onClick={() => {
                  if (!disabled) onSelect(opt.mode)
                }}
              >
                <div className="so-create-chooser__card-top">
                  <span className="so-create-chooser__icon" aria-hidden>
                    <Icon className="h-5 w-5" />
                  </span>
                  {disabled ? (
                    <span className="so-create-chooser__pill so-create-chooser__pill--muted">
                      Unavailable
                    </span>
                  ) : opt.recommended ? (
                    <span className="so-create-chooser__pill">Recommended</span>
                  ) : null}
                  {opt.mode === 'purchase_requisition' &&
                  pendingPoCount != null &&
                  pendingPoCount > 0 ? (
                    <span className="so-create-chooser__count">{pendingPoCount}</span>
                  ) : null}
                </div>
                <h2 className="so-create-chooser__card-title">{opt.title}</h2>
                <p className="so-create-chooser__card-sub">
                  {disabledReason ?? opt.subtitle}
                </p>
                {!disabled ? (
                  <ul className="so-create-chooser__points">
                    {opt.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                ) : null}
                <span className="so-create-chooser__cta">
                  {disabled ? 'Not available' : 'Continue'}
                  {!disabled ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
                </span>
              </button>
            )
          })}
        </div>

        <div className="so-create-chooser__footer">
          <button type="button" className="so-create-chooser__cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export type PurchaseOrderOriginSourcePanelProps = {
  originLabel: string
  description: string
  onChangeSource?: () => void
  children: ReactNode
  actions: ReactNode
  className?: string
}

/** Inline source picker after choosing an origin card (PR / VQ / comparison / blanket). */
export function PurchaseOrderOriginSourcePanel({
  originLabel,
  description,
  onChangeSource,
  children,
  actions,
  className,
}: PurchaseOrderOriginSourcePanelProps) {
  return (
    <div className={cn('rounded-md border border-erp-border bg-white p-4', className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Create from</p>
          <p className="mt-0.5 text-[15px] font-semibold text-erp-text">{originLabel}</p>
          <p className="mt-1 max-w-xl text-[12px] leading-snug text-erp-muted">{description}</p>
        </div>
        {onChangeSource ? (
          <button
            type="button"
            className="erp-btn erp-btn-secondary h-8 shrink-0 px-3 text-[12px]"
            onClick={onChangeSource}
          >
            Change source
          </button>
        ) : null}
      </div>
      <div className="space-y-3">{children}</div>
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-erp-border pt-3">{actions}</div>
    </div>
  )
}

export type PurchaseOrderOriginBannerProps = {
  originLabel: string
  showSelectSource: boolean
  onSelectSource: () => void
  onChangeSource: () => void
}

/** @deprecated Prefer PurchaseOrderOriginSourcePanel for create flow */
export function PurchaseOrderOriginBanner({
  originLabel,
  showSelectSource,
  onSelectSource,
  onChangeSource,
}: PurchaseOrderOriginBannerProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-erp-border bg-erp-surface-alt/80 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Order origin</p>
        <p className="mt-0.5 text-[13px] font-semibold text-erp-text">{originLabel}</p>
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
