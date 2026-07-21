import type { LucideIcon } from 'lucide-react'
import {
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

const ORIGIN_META: Record<
  PurchaseOrderOrigin,
  { icon: LucideIcon; description: string }
> = {
  manual: {
    icon: FileEdit,
    description: 'Start a blank PO and enter vendor, lines, and terms yourself.',
  },
  purchase_requisition: {
    icon: ClipboardList,
    description: 'Create from an approved requisition — including PRs marked for direct PO.',
  },
  quotation_comparison: {
    icon: Scale,
    description: 'Award a completed vendor quote comparison into a purchase order.',
  },
  vendor_quotation: {
    icon: FileSpreadsheet,
    description: 'Convert an approved vendor quotation into a purchase order.',
  },
  blanket_order: {
    icon: Layers,
    description: 'Raise a call-off against an active blanket / rate-contract order.',
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
  /** Currently selected origin — chips stay mounted so the bar does not jump. */
  selected?: PurchaseOrderOrigin | null
  /** Optional count badge on Approved PR (e.g. pending direct PO). */
  pendingPoCount?: number
  /** Origins that cannot be used (e.g. not API-backed yet). */
  disabledOrigins?: Partial<Record<PurchaseOrderOrigin, string>>
  className?: string
}

/**
 * Compact origin chips (invoice-style). Selection does not swap the whole block —
 * only highlights the chip and lets the parent show the source panel below.
 */
export function PurchaseOrderOriginPicker({
  onSelect,
  selected = null,
  pendingPoCount,
  disabledOrigins,
  className,
}: PurchaseOrderOriginPickerProps) {
  return (
    <div
      className={cn('rounded-md border border-erp-border bg-white p-4', className)}
    >
      <div className="mb-3 max-w-2xl">
        <h2 className="text-[15px] font-semibold text-erp-text">How do you want to create this PO?</h2>
        <p className="mt-0.5 text-[12px] leading-snug text-erp-muted">
          Prefer Planning (direct PR) or Quotation Comparison (RFQ path). Other origins require APIs not enabled yet.
        </p>
      </div>

      <div
        className="flex flex-wrap gap-1.5"
        role="listbox"
        aria-label="Create purchase order from"
      >
        {ORIGIN_ORDER.map((mode) => {
          const meta = ORIGIN_META[mode]
          const Icon = meta.icon
          const isSelected = selected === mode
          const recommended = mode === 'purchase_requisition' || mode === 'quotation_comparison'
          const disabledReason = disabledOrigins?.[mode]
          const disabled = Boolean(disabledReason)
          return (
            <button
              key={mode}
              type="button"
              role="option"
              aria-selected={isSelected}
              aria-disabled={disabled}
              disabled={disabled}
              title={disabledReason ?? meta.description}
              className={cn(
                'inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[12px] font-medium transition-colors',
                isSelected
                  ? 'border-erp-primary bg-erp-primary text-white'
                  : 'border-erp-border bg-erp-surface text-erp-text hover:border-erp-primary hover:bg-erp-primary-soft',
                recommended && !isSelected && !disabled && 'border-erp-primary/50',
                disabled && 'cursor-not-allowed opacity-45 hover:border-erp-border hover:bg-erp-surface',
              )}
              onClick={() => {
                if (!disabled) onSelect(mode)
              }}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              <span>{PURCHASE_ORDER_ORIGIN_LABELS[mode]}</span>
              {mode === 'purchase_requisition' && pendingPoCount != null && pendingPoCount > 0 ? (
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                    isSelected ? 'bg-white/20 text-white' : 'bg-erp-primary text-white',
                  )}
                >
                  {pendingPoCount}
                </span>
              ) : null}
            </button>
          )
        })}
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

/** Inline source picker after choosing an origin chip (PR / VQ / comparison / blanket). */
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
