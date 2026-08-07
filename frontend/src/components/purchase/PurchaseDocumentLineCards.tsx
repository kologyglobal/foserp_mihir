import { useState } from 'react'
import { ChevronDown, ChevronRight, PanelRight, Trash2 } from 'lucide-react'
import {
  PurchaseItemCodeCell,
  type PurchaseItemCodeCatalogOption,
} from '@/components/purchase/PurchaseItemCodeCell'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { filterPurchaseCatalogByProductType } from '@/utils/purchaseCatalogFilter'
import { getPurchaseLineUomOptions } from '@/utils/purchaseLineUom'
import { PurchaseLineQtyCell } from '@/components/purchase/PurchaseLineQtyCell'
import { cn } from '@/utils/cn'
import {
  ENGINEERING_PRODUCT_TYPES,
  ENGINEERING_PRODUCT_TYPE_LABELS,
  type EngineeringProductType,
} from '@/types/taxMaster'
import type { PurchaseOrderLine } from '@/types/purchaseDomain'

export type PurchaseDocumentLineCardRow = PurchaseOrderLine & {
  key: string
  /** Client-only free-text / Quick New Item flag from PO editor. */
  manualEntry?: boolean
}

export type PurchaseDocumentLineCardsProps = {
  lines: PurchaseDocumentLineCardRow[]
  catalogItems: PurchaseItemCodeCatalogOption[]
  editable: boolean
  formatCurrency: (n: number) => string
  onPatchLine: (key: string, patch: Partial<PurchaseOrderLine> & { manualEntry?: boolean }) => void
  onRemoveLine: (key: string) => void
  onSelectCatalogItem: (key: string, itemId: string) => void
  /** When set, shows Product Type and filters the item picker to Item Master matches only. */
  onSetProductType?: (line: PurchaseDocumentLineCardRow, productType: EngineeringProductType | '') => void
  onOpenDetails?: (key: string) => void
  /** When true, require at least one line (PO starts with a blank row). */
  requireOneLine?: boolean
}

function isCardFreeTextLine(line: PurchaseDocumentLineCardRow) {
  if (line.itemId) return false
  if (line.manualEntry) return true
  return Boolean(
    line.itemName?.trim() ||
      line.itemCode?.trim() ||
      line.hsnCode?.trim() ||
      line.hsnId ||
      line.sacCode?.trim(),
  )
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
  onSetProductType,
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
        const freeText = isCardFreeTextLine(line)
        const lineType: 'GOODS' | 'SERVICE' =
          line.lineType === 'SERVICE' || line.itemType === 'service' ? 'SERVICE' : 'GOODS'
        const title = line.itemName || line.itemCode || `Line ${line.lineNo}`
        const rowCatalog = (() => {
          const filtered = filterPurchaseCatalogByProductType(catalogItems, line.productType)
          if (!line.itemId || filtered.some((i) => i.id === line.itemId)) return filtered
          const selected = catalogItems.find((i) => i.id === line.itemId)
          return selected ? [selected, ...filtered] : filtered
        })()
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
                    {freeText ? (
                      <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wide text-erp-muted">
                        Quick
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[12px] font-semibold tabular-nums text-erp-text">
                    {formatCurrency(line.lineTotal)}
                  </p>
                </div>
                <p className="mt-0.5 text-[11px] tabular-nums text-erp-muted">
                  Qty {Number(line.uomQuantity ?? line.quantity) || 0} · Rate {formatCurrency(line.rate)} ·
                  Tax {line.gstRatePct}%
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
                {freeText ? (
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-erp-muted">Type</span>
                    <select
                      className="erp-input h-9 w-full text-[13px]"
                      disabled={!editable}
                      value={lineType}
                      onChange={(e) => {
                        const next = e.target.value === 'SERVICE' ? 'SERVICE' : 'GOODS'
                        const service = next === 'SERVICE'
                        onPatchLine(line.key, {
                          manualEntry: true,
                          lineType: next,
                          itemType: service ? 'service' : 'raw_material',
                          category: service ? 'job_work' : 'raw_material',
                          productType: service ? 'service' : '',
                          sacCode: service ? line.hsnCode || line.sacCode || null : null,
                        })
                      }}
                    >
                      <option value="GOODS">Goods</option>
                      <option value="SERVICE">Service</option>
                    </select>
                  </label>
                ) : onSetProductType ? (
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-erp-muted">Product Type</span>
                    <select
                      className="erp-input h-9 w-full text-[13px]"
                      disabled={!editable}
                      value={line.productType ?? ''}
                      onChange={(e) =>
                        onSetProductType(line, e.target.value as EngineeringProductType | '')
                      }
                    >
                      <option value="">{SELECT_PLACEHOLDER}</option>
                      {ENGINEERING_PRODUCT_TYPES.map((pt) => (
                        <option key={pt} value={pt}>
                          {ENGINEERING_PRODUCT_TYPE_LABELS[pt]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-erp-muted">
                    {freeText ? 'Item / service name' : 'Item'}
                  </span>
                  {freeText ? (
                    <input
                      className="erp-input h-9 w-full text-[13px]"
                      disabled={!editable}
                      value={line.itemName}
                      placeholder="Free-text name"
                      onChange={(e) =>
                        onPatchLine(line.key, {
                          manualEntry: true,
                          itemId: '',
                          itemName: e.target.value,
                          description: e.target.value,
                        })
                      }
                    />
                  ) : (
                    <PurchaseItemCodeCell
                      itemId={line.itemId}
                      itemCode={line.itemCode}
                      catalogItems={rowCatalog}
                      disabled={!editable}
                      textClassName="text-[12px]"
                      emptyCatalogHint={
                        line.productType
                          ? 'No Item Master rows for this product type'
                          : 'No purchasable items from Item Master'
                      }
                      onSelectItem={(id) => onSelectCatalogItem(line.key, id)}
                      onClearCatalog={() => onPatchLine(line.key, { itemId: '', itemCode: '' })}
                      onManualCodeChange={(code) => onPatchLine(line.key, { itemCode: code })}
                    />
                  )}
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-erp-muted">Description</span>
                  <input
                    className="erp-input h-9 w-full text-[13px]"
                    disabled={!editable}
                    value={line.description || line.itemName}
                    onChange={(e) =>
                      onPatchLine(line.key, {
                        description: e.target.value,
                        ...(freeText
                          ? {
                              manualEntry: true,
                              itemName: line.itemName.trim() ? line.itemName : e.target.value,
                            }
                          : { itemName: e.target.value }),
                      })
                    }
                  />
                </label>
                {!line.itemId ? (
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-erp-muted">
                      {lineType === 'SERVICE' ? 'SAC code' : 'HSN code'}
                    </span>
                    <input
                      className="erp-input h-9 w-full font-mono text-[13px]"
                      disabled={!editable}
                      value={line.hsnCode || line.sacCode || ''}
                      placeholder={lineType === 'SERVICE' ? 'e.g. 998314' : 'e.g. 7208'}
                      onChange={(e) => {
                        const raw = e.target.value
                        onPatchLine(line.key, {
                          manualEntry: true,
                          hsnId: null,
                          hsnCode: raw,
                          sacCode: lineType === 'SERVICE' ? raw : null,
                        })
                      }}
                    />
                  </label>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  {(() => {
                    const uomOptions = getPurchaseLineUomOptions(line.itemId)
                    const multi = uomOptions.length > 1
                    return (
                      <>
                        <label className={cn('block', multi ? '' : 'col-span-2')}>
                          <span className="mb-1 block text-[11px] font-medium text-erp-muted">Qty</span>
                          <PurchaseLineQtyCell
                            line={line}
                            editable={editable}
                            disabled={!editable}
                            onChange={(v) => onPatchLine(line.key, { uomQuantity: v })}
                          />
                        </label>
                        {multi ? (
                          <label className="block">
                            <span className="mb-1 block text-[11px] font-medium text-erp-muted">UOM</span>
                            {editable && line.itemId ? (
                              <select
                                className="erp-input h-9 w-full text-[13px]"
                                value={line.uomId || uomOptions[0]?.id || ''}
                                onChange={(e) => {
                                  const opt = uomOptions.find((o) => o.id === e.target.value)
                                  if (!opt) return
                                  onPatchLine(line.key, {
                                    uomId: opt.id,
                                    uom: opt.code,
                                    uomConversionFactor: opt.factor,
                                  })
                                }}
                              >
                                {uomOptions.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.code}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                className="erp-input h-9 w-full text-[13px]"
                                disabled
                                readOnly
                                value={uomOptions[0]?.code || line.uom || '-'}
                              />
                            )}
                          </label>
                        ) : null}
                      </>
                    )
                  })()}
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
