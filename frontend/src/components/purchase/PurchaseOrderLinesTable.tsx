import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { MoreHorizontal, PanelRight, Package, Plus, Trash2, type LucideIcon } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { PurchaseTableToolbar } from '@/components/purchase/purchaseCardFormShared'
import {
  PurchaseItemCodeCell,
  type PurchaseItemCodeCatalogOption,
} from '@/components/purchase/PurchaseItemCodeCell'
import { PurchaseDocumentLineCards } from '@/components/purchase/PurchaseDocumentLineCards'
import { PurchaseLineDetailsDrawer, PurchaseLineDrawerSection, PurchaseLineDrawerStat } from '@/components/purchase/PurchaseLineDetailsDrawer'
import { EmptyState } from '@/components/ui/EmptyState'
import { CommandBarOverflowMenu } from '@/components/ui/CommandBar'
import { Input, Textarea } from '@/components/forms/Inputs'
import { ErpFieldRow } from '@/components/erp/card-form'
import { MQ_BELOW_LG, useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/utils/cn'
import type { PurchaseOrderLine } from '@/types/purchaseDomain'

export type PoLinesEditorLine = PurchaseOrderLine & { key: string }

export type PurchaseOrderLinesToolbarAction = {
  id: string
  label: string
  icon?: LucideIcon
  onClick?: () => void
  disabled?: boolean
  disabledReason?: string
}

export type PurchaseOrderLinesTableProps = {
  lines: PoLinesEditorLine[]
  catalogItems: PurchaseItemCodeCatalogOption[]
  warehouseOptions: Array<{ id: string; name: string }>
  editable: boolean
  isInterstate: boolean
  dirty?: boolean
  formatCurrency: (n: number) => string
  onAddLine: () => void
  onPatchLine: (key: string, patch: Partial<PurchaseOrderLine>) => void
  onRemoveLine: (key: string) => void
  onSelectCatalogItem: (key: string, itemId: string) => void
  /** When true, incomplete cells use error styling + messages instead of soft amber peek */
  showErrors?: boolean
  lineErrors?: Record<string, string>
  /** Secondary line tooling (Copy / Import / Clear) — collapses under More below lg */
  secondaryActions?: PurchaseOrderLinesToolbarAction[]
  toolbarExtra?: ReactNode
}

function missingMandatory(line: PoLinesEditorLine) {
  const missingItem = !line.itemId && !line.itemCode.trim()
  const missingQty = !(Number(line.quantity) > 0)
  const missingRate = !(Number(line.rate) > 0)
  return { missingItem, missingQty, missingRate, any: missingItem || missingQty || missingRate }
}

function focusNextCell(e: KeyboardEvent<HTMLElement>, advanceRow = false) {
  const cell = e.currentTarget.closest('td')
  const row = cell?.closest('tr')
  const tbody = row?.closest('tbody')
  if (!cell || !row || !tbody) return

  const focusable = (el: Element | null | undefined) =>
    el?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), button:not([disabled])')

  if (advanceRow) {
    const nextRow = row.nextElementSibling as HTMLTableRowElement | null
    const sameIndex = Array.from(row.children).indexOf(cell)
    const nextCell = nextRow?.children[sameIndex]
    const target = focusable(nextCell)
    if (target) {
      e.preventDefault()
      target.focus()
      if (target instanceof HTMLInputElement) target.select?.()
    }
    return
  }

  let next: Element | null = cell.nextElementSibling
  while (next) {
    const target = focusable(next)
    if (target) {
      e.preventDefault()
      target.focus()
      if (target instanceof HTMLInputElement) target.select?.()
      return
    }
    next = next.nextElementSibling
  }
  const nextRow = row.nextElementSibling as HTMLTableRowElement | null
  const first = focusable(nextRow?.querySelector('td'))
  if (first) {
    e.preventDefault()
    first.focus()
    if (first instanceof HTMLInputElement) first.select?.()
  }
}

function onCellKeyDown(e: KeyboardEvent<HTMLElement>) {
  if (e.key === 'Enter') {
    focusNextCell(e, true)
  } else if (e.key === 'Tab' && !e.shiftKey) {
    // Allow native Tab; enhance when at actionable end via default browser path.
  }
}

/**
 * PO Item Lines grid — primary visible columns + row-details drawer for secondary fields.
 * Sticky Line/Item columns, sticky header, totals footer, no auto-blank line.
 */
export function PurchaseOrderLinesTable({
  lines,
  catalogItems,
  warehouseOptions,
  editable,
  isInterstate,
  dirty,
  formatCurrency,
  onAddLine,
  onPatchLine,
  onRemoveLine,
  onSelectCatalogItem,
  showErrors = false,
  lineErrors = {},
  secondaryActions = [],
  toolbarExtra,
}: PurchaseOrderLinesTableProps) {
  const [detailsKey, setDetailsKey] = useState<string | null>(null)
  const detailsLine = lines.find((l) => l.key === detailsKey) ?? null
  const collapseSecondary = useMediaQuery(MQ_BELOW_LG)

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, l) => ({
        qty: acc.qty + (Number(l.quantity) || 0),
        taxable: acc.taxable + (Number(l.taxableAmount) || 0),
        tax: acc.tax + (Number(l.taxAmount) || 0),
        lineTotal: acc.lineTotal + (Number(l.lineTotal) || 0),
      }),
      { qty: 0, taxable: 0, tax: 0, lineTotal: 0 },
    )
  }, [lines])

  const openDetails = (key: string) => setDetailsKey(key)
  const closeDetails = () => setDetailsKey(null)

  const secondaryOverflow = secondaryActions.map((a) => ({
    id: a.id,
    label: a.label,
    icon: a.icon ?? MoreHorizontal,
    onClick: a.onClick,
    disabled: a.disabled,
    disabledReason: a.disabledReason,
  }))

  return (
    <>
      <PurchaseTableToolbar>
        <ErpButton
          type="button"
          size="sm"
          variant="secondary"
          icon={Plus}
          disabled={!editable}
          onClick={onAddLine}
        >
          Add Line
        </ErpButton>
        {collapseSecondary ? (
          secondaryOverflow.length > 0 ? (
            <CommandBarOverflowMenu actions={secondaryOverflow} label="More actions" />
          ) : null
        ) : (
          secondaryActions.map((action) => {
            const Icon = action.icon
            return (
              <ErpButton
                key={action.id}
                type="button"
                size="sm"
                variant="outline"
                icon={Icon}
                disabled={action.disabled}
                title={action.disabled ? action.disabledReason : undefined}
                onClick={action.onClick}
              >
                {action.label}
              </ErpButton>
            )
          })
        )}
        {toolbarExtra}
        <span className="text-[12px] tabular-nums text-erp-muted">
          {lines.length} line(s) · Total {formatCurrency(totals.lineTotal)}
          {dirty ? ' · Unsaved' : ''}
        </span>
      </PurchaseTableToolbar>

      {lines.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No item lines yet"
          description="Add catalog or manual lines to build this purchase order."
          className="rounded-md border border-dashed border-erp-border bg-erp-surface-alt/40 py-12"
          action={
            editable ? (
              <ErpButton type="button" size="sm" variant="secondary" icon={Plus} onClick={onAddLine}>
                Add Line
              </ErpButton>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Mobile: expandable item cards — avoid 15-col horizontal scroll as primary UX */}
          <div className="md:hidden">
            <PurchaseDocumentLineCards
              lines={lines}
              catalogItems={catalogItems}
              editable={editable}
              formatCurrency={formatCurrency}
              onPatchLine={onPatchLine}
              onRemoveLine={onRemoveLine}
              onSelectCatalogItem={onSelectCatalogItem}
              onOpenDetails={openDetails}
              requireOneLine={false}
            />
          </div>

          {/* Tablet / desktop: grid table */}
          <div className="erp-table-wrap hidden max-h-[min(28rem,55vh)] overflow-auto rounded-md border border-erp-border md:block">
          <table className="erp-table purchase-doc-lines-grid text-[11px]">
            <thead>
              <tr>
                <th className="purchase-doc-lines-grid__sticky-line">#</th>
                <th className="purchase-doc-lines-grid__sticky-item">Item</th>
                <th className="min-w-[11rem]">Description</th>
                <th className="min-w-[9rem]">Specification</th>
                <th>UOM</th>
                <th className="num">Qty</th>
                <th className="num">Rate</th>
                <th className="num">Discount</th>
                <th className="num">Tax %</th>
                <th className="num">Taxable Amount</th>
                <th className="num">Line Total</th>
                <th className="purchase-doc-lines-grid__sticky-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const miss = missingMandatory(line)
                const itemErr = showErrors ? lineErrors[`${line.key}:item`] : undefined
                const qtyErr = showErrors ? lineErrors[`${line.key}:quantity`] : undefined
                const rateErr = showErrors ? lineErrors[`${line.key}:rate`] : undefined
                const hasSubmitError = Boolean(itemErr || qtyErr || rateErr)
                return (
                  <tr
                    key={line.key}
                    className={cn(
                      'cursor-pointer',
                      hasSubmitError
                        ? 'bg-red-50/40'
                        : miss.any && 'bg-amber-50/50',
                      detailsKey === line.key && 'bg-sky-50/60',
                    )}
                    onClick={(e) => {
                      const tag = (e.target as HTMLElement).tagName
                      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'TEXTAREA') return
                      if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) return
                      openDetails(line.key)
                    }}
                  >
                    <td className="purchase-doc-lines-grid__sticky-line tabular-nums">{line.lineNo}</td>
                    <td
                      id={`purchase-line-${line.key}-item`}
                      className={cn(
                        'purchase-doc-lines-grid__sticky-item',
                        itemErr
                          ? 'ring-1 ring-inset ring-red-400/80'
                          : miss.missingItem && 'ring-1 ring-inset ring-amber-400/70',
                      )}
                      onKeyDown={onCellKeyDown}
                    >
                      <PurchaseItemCodeCell
                        itemId={line.itemId}
                        itemCode={line.itemCode}
                        catalogItems={catalogItems}
                        disabled={!editable}
                        textClassName="text-[11px]"
                        onSelectItem={(id) => onSelectCatalogItem(line.key, id)}
                        onClearCatalog={() => onPatchLine(line.key, { itemId: '', itemCode: '' })}
                        onManualCodeChange={(code) => onPatchLine(line.key, { itemCode: code })}
                      />
                      {itemErr ? (
                        <p className="mt-0.5 text-[10px] text-erp-danger-fg">{itemErr}</p>
                      ) : null}
                    </td>
                    <td onKeyDown={onCellKeyDown}>
                      <input
                        className="erp-input h-8 min-w-[11rem] text-[11px]"
                        disabled={!editable}
                        value={line.itemName}
                        onChange={(e) =>
                          onPatchLine(line.key, { itemName: e.target.value, description: e.target.value })
                        }
                      />
                    </td>
                    <td onKeyDown={onCellKeyDown}>
                      <input
                        className="erp-input h-8 min-w-[9rem] text-[11px]"
                        disabled={!editable}
                        value={line.specification}
                        onChange={(e) => onPatchLine(line.key, { specification: e.target.value })}
                      />
                    </td>
                    <td onKeyDown={onCellKeyDown}>
                      <input
                        className="erp-input h-8 w-16 text-[11px]"
                        disabled={!editable}
                        value={line.uom}
                        onChange={(e) => onPatchLine(line.key, { uom: e.target.value })}
                      />
                    </td>
                    <td
                      id={`purchase-line-${line.key}-quantity`}
                      className={cn(
                        'num',
                        qtyErr
                          ? 'ring-1 ring-inset ring-red-400/80'
                          : miss.missingQty && 'ring-1 ring-inset ring-amber-400/70',
                      )}
                      onKeyDown={onCellKeyDown}
                    >
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className={cn(
                          'erp-input h-8 w-20 text-right text-[11px]',
                          qtyErr && 'border-erp-danger-fg',
                        )}
                        disabled={!editable}
                        value={line.quantity}
                        onChange={(e) => onPatchLine(line.key, { quantity: Number(e.target.value) })}
                      />
                      {qtyErr ? (
                        <p className="mt-0.5 text-[10px] text-erp-danger-fg">{qtyErr}</p>
                      ) : null}
                    </td>
                    <td
                      id={`purchase-line-${line.key}-rate`}
                      className={cn(
                        'num',
                        rateErr
                          ? 'ring-1 ring-inset ring-red-400/80'
                          : miss.missingRate && 'ring-1 ring-inset ring-amber-400/70',
                      )}
                      onKeyDown={onCellKeyDown}
                    >
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className={cn(
                          'erp-input h-8 w-24 text-right text-[11px]',
                          rateErr && 'border-erp-danger-fg',
                        )}
                        disabled={!editable}
                        value={line.rate}
                        onChange={(e) => onPatchLine(line.key, { rate: Number(e.target.value) })}
                      />
                      {rateErr ? (
                        <p className="mt-0.5 text-[10px] text-erp-danger-fg">{rateErr}</p>
                      ) : null}
                    </td>
                    <td className="num" onKeyDown={onCellKeyDown}>
                      <input
                        type="number"
                        min={0}
                        className="erp-input h-8 w-14 text-right text-[11px]"
                        disabled={!editable}
                        value={line.discountPct}
                        onChange={(e) => onPatchLine(line.key, { discountPct: Number(e.target.value) })}
                        title="Discount %"
                      />
                    </td>
                    <td className="num" onKeyDown={onCellKeyDown}>
                      <input
                        type="number"
                        min={0}
                        className="erp-input h-8 w-14 text-right text-[11px]"
                        disabled={!editable}
                        value={line.gstRatePct}
                        onChange={(e) => onPatchLine(line.key, { gstRatePct: Number(e.target.value) })}
                      />
                    </td>
                    <td className="num tabular-nums">{formatCurrency(line.taxableAmount)}</td>
                    <td className="num tabular-nums font-medium">{formatCurrency(line.lineTotal)}</td>
                    <td className="purchase-doc-lines-grid__sticky-actions">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
                          onClick={() => openDetails(line.key)}
                          title="Line details"
                          aria-label="Line details"
                        >
                          <PanelRight className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-erp-danger-fg hover:bg-red-50 disabled:opacity-40"
                          disabled={!editable}
                          onClick={() => onRemoveLine(line.key)}
                          title="Delete line"
                          aria-label="Delete line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="purchase-doc-lines-grid__totals bg-erp-surface-alt font-semibold">
                <td className="purchase-doc-lines-grid__sticky-line" colSpan={2}>
                  Total
                </td>
                <td colSpan={3} />
                <td className="num tabular-nums">{totals.qty}</td>
                <td className="num" colSpan={2} />
                <td className="num text-erp-muted" title="Tax amount">
                  {formatCurrency(totals.tax)}
                </td>
                <td className="num tabular-nums">{formatCurrency(totals.taxable)}</td>
                <td className="num tabular-nums">{formatCurrency(totals.lineTotal)}</td>
                <td className="purchase-doc-lines-grid__sticky-actions" />
              </tr>
            </tfoot>
          </table>
        </div>
        </>
      )}

      <PurchaseLineDetailsDrawer
        open={Boolean(detailsLine)}
        onClose={closeDetails}
        title={
          detailsLine
            ? `Line ${detailsLine.lineNo}${detailsLine.itemCode ? ` · ${detailsLine.itemCode}` : ''}`
            : 'Line details'
        }
        subtitle={detailsLine?.itemName || detailsLine?.description || undefined}
        footer={
          <ErpButton type="button" size="sm" variant="primary" onClick={closeDetails}>
            Done
          </ErpButton>
        }
      >
        {detailsLine ? (
          <div className="space-y-4">
            <div className={cn('grid gap-3', isInterstate ? 'grid-cols-1' : 'grid-cols-2')}>
              {isInterstate ? (
                <PurchaseLineDrawerStat label="IGST" value={formatCurrency(detailsLine.igst)} />
              ) : (
                <>
                  <PurchaseLineDrawerStat label="CGST" value={formatCurrency(detailsLine.cgst)} />
                  <PurchaseLineDrawerStat label="SGST" value={formatCurrency(detailsLine.sgst)} />
                </>
              )}
            </div>

            <PurchaseLineDrawerSection
              title="Delivery"
              description="Warehouse and schedule for this line."
            >
              <ErpFieldRow label="Required delivery date" horizontal={false}>
                <Input
                  type="date"
                  disabled={!editable}
                  value={detailsLine.requiredDate}
                  onChange={(e) =>
                    onPatchLine(detailsLine.key, {
                      requiredDate: e.target.value,
                      expectedDeliveryDate: e.target.value,
                    })
                  }
                />
              </ErpFieldRow>
              <ErpFieldRow label="Warehouse" horizontal={false}>
                <select
                  className="erp-input h-9 w-full text-[13px]"
                  disabled={!editable}
                  value={detailsLine.warehouseId}
                  title={detailsLine.warehouseName || undefined}
                  onChange={(e) => {
                    const loc = warehouseOptions.find((l) => l.id === e.target.value)
                    onPatchLine(detailsLine.key, {
                      warehouseId: loc?.id ?? e.target.value,
                      warehouseName: loc?.name ?? '',
                      locationId: loc?.id ?? e.target.value,
                      locationName: loc?.name ?? '',
                    })
                  }}
                >
                  {warehouseOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </ErpFieldRow>
              <ErpFieldRow label="Delivery schedule" horizontal={false}>
                <Input
                  disabled={!editable}
                  value={detailsLine.deliverySchedule}
                  onChange={(e) => onPatchLine(detailsLine.key, { deliverySchedule: e.target.value })}
                  placeholder="e.g. Week 30 / staggered"
                />
              </ErpFieldRow>
            </PurchaseLineDrawerSection>

            <PurchaseLineDrawerSection title="Accounting & tax">
              <ErpFieldRow label="HSN / SAC" horizontal={false}>
                <Input
                  className="font-mono"
                  disabled={!editable}
                  value={detailsLine.hsnCode || detailsLine.sacCode || ''}
                  onChange={(e) => onPatchLine(detailsLine.key, { hsnCode: e.target.value })}
                />
              </ErpFieldRow>
              <ErpFieldRow label="Cost centre" horizontal={false}>
                <Input
                  disabled={!editable}
                  value={detailsLine.costCentre}
                  onChange={(e) => onPatchLine(detailsLine.key, { costCentre: e.target.value })}
                />
              </ErpFieldRow>
              <ErpFieldRow label="Project" horizontal={false}>
                <Input
                  disabled={!editable}
                  value={detailsLine.project}
                  onChange={(e) => onPatchLine(detailsLine.key, { project: e.target.value })}
                />
              </ErpFieldRow>
              <ErpFieldRow label="Production order" horizontal={false}>
                <Input
                  disabled={!editable}
                  value={detailsLine.productionOrder}
                  onChange={(e) => onPatchLine(detailsLine.key, { productionOrder: e.target.value })}
                />
              </ErpFieldRow>
            </PurchaseLineDrawerSection>

            <PurchaseLineDrawerSection title="Notes">
              <ErpFieldRow label="Remarks" horizontal={false}>
                <Textarea
                  disabled={!editable}
                  value={detailsLine.remarks}
                  onChange={(e) => onPatchLine(detailsLine.key, { remarks: e.target.value })}
                  rows={3}
                  placeholder="Optional line remarks"
                />
              </ErpFieldRow>
              <p className="text-[12px] text-erp-muted">
                Line-level file uploads are not configured in demo mode. Use document attachments on Terms &amp;
                Notes.
              </p>
            </PurchaseLineDrawerSection>
          </div>
        ) : null}
      </PurchaseLineDetailsDrawer>

      <style>{`
        .purchase-doc-lines-grid thead th {
          position: sticky;
          top: 0;
          z-index: 20;
          background: var(--erp-surface-alt, #f8fafc);
        }
        .purchase-doc-lines-grid__sticky-line {
          position: sticky;
          left: 0;
          z-index: 12;
          min-width: 2.5rem;
          width: 2.5rem;
          background: #fff;
          box-shadow: 2px 0 4px rgb(15 23 42 / 0.04);
        }
        .purchase-doc-lines-grid thead .purchase-doc-lines-grid__sticky-line,
        .purchase-doc-lines-grid tfoot .purchase-doc-lines-grid__sticky-line {
          z-index: 22;
          background: var(--erp-surface-alt, #f8fafc);
        }
        .purchase-doc-lines-grid__sticky-item {
          position: sticky;
          left: 2.5rem;
          z-index: 11;
          min-width: 10.5rem;
          max-width: 14rem;
          background: #fff;
          box-shadow: 4px 0 8px -4px rgb(15 23 42 / 0.12);
          overflow: visible;
        }
        .purchase-doc-lines-grid thead .purchase-doc-lines-grid__sticky-item,
        .purchase-doc-lines-grid tfoot .purchase-doc-lines-grid__sticky-item {
          z-index: 21;
          background: var(--erp-surface-alt, #f8fafc);
        }
        .purchase-doc-lines-grid__sticky-actions {
          position: sticky;
          right: 0;
          z-index: 12;
          min-width: 4.5rem;
          width: 4.5rem;
          text-align: center;
          background: #fff;
          box-shadow: -4px 0 8px rgb(15 23 42 / 0.06);
        }
        .purchase-doc-lines-grid thead .purchase-doc-lines-grid__sticky-actions,
        .purchase-doc-lines-grid tfoot .purchase-doc-lines-grid__sticky-actions {
          z-index: 22;
          background: var(--erp-surface-alt, #f8fafc);
        }
        .purchase-doc-lines-grid tbody tr:hover .purchase-doc-lines-grid__sticky-line,
        .purchase-doc-lines-grid tbody tr:hover .purchase-doc-lines-grid__sticky-item,
        .purchase-doc-lines-grid tbody tr:hover .purchase-doc-lines-grid__sticky-actions {
          background: #f0f7ff;
        }
        .purchase-doc-lines-grid tfoot td {
          border-top: 1px solid var(--erp-border-strong, #cbd5e1);
        }
      `}</style>
    </>
  )
}
