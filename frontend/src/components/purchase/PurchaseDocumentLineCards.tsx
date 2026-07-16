import { useState } from 'react'
import { ChevronDown, ChevronRight, PanelRight, Trash2 } from 'lucide-react'
import {
  PurchaseItemCodeCell,
  type PurchaseItemCodeCatalogOption,
} from '@/components/purchase/PurchaseItemCodeCell'
import { cn } from '@/utils/cn'
import type { PurchaseOrderLine } from '@/types/purchaseDomain'

export type PurchaseDocumentLineCardRow = PurchaseOrderLine & { key: string }

export type PurchaseDocumentLineCardsProps = {
  lines: PurchaseDocumentLineCardRow[]
  catalogItems: PurchaseItemCodeCatalogOption[]
  editable: boolean
  formatCurrency: (n: number) => string
  onPatchLine: (key: string, patch: Partial<PurchaseOrderLine>) => void
  onRemoveLine: (key: string) => void
  onSelectCatalogItem: (key: string, itemId: string) => void
  onOpenDetails?: (key: string) => void
  /** When true, require at least one line (PO starts with a blank row). */
  requireOneLine?: boolean
}

/**
 * Mobile (&lt;md) expandable item cards for purchase document lines.
 * Shares the same line state as the md+ table grid.
 */
export function PurchaseDocumentLineCards({
  lines,
  catalogItems,
  editable,
  formatCurrency,
  onPatchLine,
  onRemoveLine,
  onSelectCatalogItem,
  onOpenDetails,
  requireOneLine = true,
}: PurchaseDocumentLineCardsProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Item lines">
      {lines.map((line) => {
        const open = Boolean(expanded[line.key])
        const title = line.itemName || line.itemCode || `Line ${line.lineNo}`
        return (
          <li
            key={line.key}
            className="rounded-md border border-erp-border bg-erp-surface shadow-sm"
          >
            <div className="flex items-start gap-2 p-3">
              <button
                type="button"
                className="mt-0.5 rounded p-1 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
                onClick={() => toggle(line.key)}
                aria-expanded={open}
                aria-label={open ? 'Collapse line' : 'Expand line'}
              >
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                  <p className="text-[12px] font-semibold text-erp-text">
                    <span className="tabular-nums text-erp-muted">#{line.lineNo}</span>
                    <span className="mx-1.5 text-erp-border">·</span>
                    {title}
                  </p>
                  <p className="text-[12px] font-semibold tabular-nums text-erp-text">
                    {formatCurrency(line.lineTotal)}
                  </p>
                </div>
                <p className="mt-0.5 text-[11px] tabular-nums text-erp-muted">
                  Qty {line.quantity || 0} · Rate {formatCurrency(line.rate)} · Tax {line.gstRatePct}%
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {onOpenDetails ? (
                  <button
                    type="button"
                    className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
                    onClick={() => onOpenDetails(line.key)}
                    title="Line details"
                    aria-label="Line details"
                  >
                    <PanelRight className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded p-1 text-erp-danger-fg hover:bg-red-50 disabled:opacity-40"
                  disabled={!editable || (requireOneLine && lines.length <= 1)}
                  onClick={() => onRemoveLine(line.key)}
                  title="Delete line"
                  aria-label="Delete line"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {open ? (
              <div className="space-y-2 border-t border-erp-border px-3 py-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-erp-muted">Item</span>
                  <PurchaseItemCodeCell
                    itemId={line.itemId}
                    itemCode={line.itemCode}
                    catalogItems={catalogItems}
                    disabled={!editable}
                    textClassName="text-[12px]"
                    onSelectItem={(id) => onSelectCatalogItem(line.key, id)}
                    onClearCatalog={() => onPatchLine(line.key, { itemId: '', itemCode: '' })}
                    onManualCodeChange={(code) => onPatchLine(line.key, { itemCode: code })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-erp-muted">Description</span>
                  <input
                    className="erp-input h-9 w-full text-[13px]"
                    disabled={!editable}
                    value={line.itemName}
                    onChange={(e) =>
                      onPatchLine(line.key, { itemName: e.target.value, description: e.target.value })
                    }
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-erp-muted">Qty</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className="erp-input h-9 w-full text-right text-[13px]"
                      disabled={!editable}
                      value={line.quantity}
                      onChange={(e) => onPatchLine(line.key, { quantity: Number(e.target.value) })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-erp-muted">UOM</span>
                    <input
                      className="erp-input h-9 w-full text-[13px]"
                      disabled={!editable}
                      value={line.uom}
                      onChange={(e) => onPatchLine(line.key, { uom: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-erp-muted">Rate</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className="erp-input h-9 w-full text-right text-[13px]"
                      disabled={!editable}
                      value={line.rate}
                      onChange={(e) => onPatchLine(line.key, { rate: Number(e.target.value) })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-erp-muted">Discount %</span>
                    <input
                      type="number"
                      min={0}
                      className="erp-input h-9 w-full text-right text-[13px]"
                      disabled={!editable}
                      value={line.discountPct}
                      onChange={(e) => onPatchLine(line.key, { discountPct: Number(e.target.value) })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-erp-muted">Tax %</span>
                    <input
                      type="number"
                      min={0}
                      className="erp-input h-9 w-full text-right text-[13px]"
                      disabled={!editable}
                      value={line.gstRatePct}
                      onChange={(e) => onPatchLine(line.key, { gstRatePct: Number(e.target.value) })}
                    />
                  </label>
                  <div className="block">
                    <span className="mb-1 block text-[11px] font-medium text-erp-muted">Taxable</span>
                    <p className={cn('flex h-9 items-center justify-end text-[13px] tabular-nums')}>
                      {formatCurrency(line.taxableAmount)}
                    </p>
                  </div>
                </div>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-erp-muted">Specification</span>
                  <input
                    className="erp-input h-9 w-full text-[13px]"
                    disabled={!editable}
                    value={line.specification}
                    onChange={(e) => onPatchLine(line.key, { specification: e.target.value })}
                  />
                </label>
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
