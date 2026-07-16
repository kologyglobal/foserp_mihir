import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  Copy,
  FileSpreadsheet,
  Package,
  PanelRight,
  Plus,
  Trash2,
} from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import {
  PurchaseItemCodeCell,
  type PurchaseItemCodeCatalogOption,
} from '@/components/purchase/PurchaseItemCodeCell'
import { PurchaseLineDetailsDrawer } from '@/components/purchase/PurchaseLineDetailsDrawer'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input, Textarea } from '@/components/forms/Inputs'
import { ErpFieldRow } from '@/components/erp/card-form'
import { cn } from '@/utils/cn'
import type { PrEditorLine } from '@/utils/purchaseRequisitionValidation'
import type { Vendor } from '@/types/purchaseDomain'

export type PurchaseRequisitionLinesTableProps = {
  lines: PrEditorLine[]
  catalogItems: PurchaseItemCodeCatalogOption[]
  vendors: Vendor[]
  locationOptions: Array<{ id: string; name: string }>
  editable: boolean
  showErrors?: boolean
  lineErrors?: Record<string, string | undefined>
  formatCurrency: (n: number) => string
  estimatedTotal: number
  onAddLine: () => void
  onAddMultipleLines: () => void
  onCopyLastLine: () => void
  onImportExcel: () => void
  onClearLines: () => void
  onPatchLine: (key: string, patch: Partial<PrEditorLine>) => void
  onRemoveLine: (key: string) => void
  onSelectCatalogItem: (key: string, itemId: string) => void
  toolbarExtra?: ReactNode
}

function missingMandatory(line: PrEditorLine) {
  const missingItem = !line.itemId && !line.itemCode.trim() && !line.itemName.trim()
  const missingQty = !(Number(line.quantity) > 0)
  return { missingItem, missingQty, any: missingItem || missingQty }
}

function onCellKeyDown(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Enter') return
  const cell = e.currentTarget.closest('td')
  const row = cell?.closest('tr')
  if (!cell || !row) return
  const sameIndex = Array.from(row.children).indexOf(cell)
  const nextRow = row.nextElementSibling as HTMLTableRowElement | null
  const nextCell = nextRow?.children[sameIndex]
  const target = nextCell?.querySelector<HTMLElement>(
    'input:not([disabled]), select:not([disabled]), button:not([disabled])',
  )
  if (target) {
    e.preventDefault()
    target.focus()
    if (target instanceof HTMLInputElement) target.select?.()
  }
}

/**
 * PR Item Lines grid — primary columns + row-details drawer for secondary fields.
 * Shares sticky / empty-state / rich item picker UX with the PO lines table.
 */
export function PurchaseRequisitionLinesTable({
  lines,
  catalogItems,
  vendors,
  locationOptions,
  editable,
  showErrors,
  lineErrors,
  formatCurrency,
  estimatedTotal,
  onAddLine,
  onAddMultipleLines,
  onCopyLastLine,
  onImportExcel,
  onClearLines,
  onPatchLine,
  onRemoveLine,
  onSelectCatalogItem,
  toolbarExtra,
}: PurchaseRequisitionLinesTableProps) {
  const [detailsKey, setDetailsKey] = useState<string | null>(null)
  const detailsLine = lines.find((l) => l.key === detailsKey) ?? null

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, l) => ({
        qty: acc.qty + (Number(l.quantity) || 0),
        amount: acc.amount + (Number(l.amount) || 0),
      }),
      { qty: 0, amount: 0 },
    )
  }, [lines])

  const openDetails = (key: string) => setDetailsKey(key)
  const closeDetails = () => setDetailsKey(null)

  return (
    <>
      <div className="mb-3 flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <ErpButton
            type="button"
            size="sm"
            variant="secondary"
            icon={Plus}
            disabled={!editable}
            onClick={onAddLine}
          >
            Add Item
          </ErpButton>
          <ErpButton
            type="button"
            size="sm"
            variant="outline"
            icon={Plus}
            disabled={!editable}
            onClick={onAddMultipleLines}
          >
            Add Multiple Items
          </ErpButton>
          <ErpButton
            type="button"
            size="sm"
            variant="outline"
            icon={Copy}
            disabled={!editable || lines.length === 0}
            onClick={onCopyLastLine}
          >
            Copy Lines
          </ErpButton>
          <ErpButton
            type="button"
            size="sm"
            variant="outline"
            icon={FileSpreadsheet}
            disabled={!editable}
            onClick={onImportExcel}
          >
            Import from Excel
          </ErpButton>
          <ErpButton type="button" size="sm" variant="ghost" disabled={!editable} onClick={onClearLines}>
            Clear Lines
          </ErpButton>
          {toolbarExtra}
        </div>
        <span className="shrink-0 text-[12px] tabular-nums text-erp-muted">
          {lines.length} line{lines.length === 1 ? '' : 's'} · {formatCurrency(estimatedTotal)}
        </span>
      </div>

      {lines.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No item lines yet"
          description="Add catalog or manual lines for this purchase requisition."
          className="rounded-md border border-dashed border-erp-border bg-erp-surface-alt/40 py-12"
          action={
            editable ? (
              <ErpButton type="button" size="sm" variant="secondary" icon={Plus} onClick={onAddLine}>
                Add Item
              </ErpButton>
            ) : undefined
          }
        />
      ) : (
        <div className="erp-table-wrap max-h-[min(28rem,55vh)] overflow-auto rounded-md border border-erp-border">
          <table className="erp-table purchase-doc-lines-grid w-full text-[12px]">
            <thead>
              <tr>
                <th className="purchase-doc-lines-grid__sticky-line">#</th>
                <th className="purchase-doc-lines-grid__sticky-item">Item</th>
                <th className="min-w-[11rem]">Description</th>
                <th className="min-w-[9rem]">Specification</th>
                <th>UOM</th>
                <th className="num">Qty</th>
                <th className="num">Est. Rate</th>
                <th className="num">Est. Amount</th>
                <th className="purchase-doc-lines-grid__sticky-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const miss = missingMandatory(line)
                const qtyError = showErrors && lineErrors?.[`${line.key}:quantity`]
                return (
                  <tr
                    key={line.key}
                    className={cn(
                      'cursor-pointer',
                      (miss.any || qtyError) && 'bg-amber-50/50',
                      detailsKey === line.key && 'bg-sky-50/60',
                    )}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) return
                      openDetails(line.key)
                    }}
                  >
                    <td className="purchase-doc-lines-grid__sticky-line tabular-nums">{line.lineNo}</td>
                    <td
                      className={cn(
                        'purchase-doc-lines-grid__sticky-item',
                        miss.missingItem && 'ring-1 ring-inset ring-amber-400/70',
                      )}
                      onKeyDown={onCellKeyDown}
                    >
                      <PurchaseItemCodeCell
                        itemId={line.itemId}
                        itemCode={line.itemCode}
                        catalogItems={catalogItems}
                        disabled={!editable}
                        onSelectItem={(id) => onSelectCatalogItem(line.key, id)}
                        onClearCatalog={() => onPatchLine(line.key, { itemId: '', itemCode: '' })}
                        onManualCodeChange={(code) => onPatchLine(line.key, { itemCode: code })}
                      />
                    </td>
                    <td onKeyDown={onCellKeyDown}>
                      <input
                        className="erp-input h-8 min-w-[11rem] text-[12px]"
                        disabled={!editable}
                        value={line.itemName}
                        onChange={(e) => onPatchLine(line.key, { itemName: e.target.value })}
                        placeholder="Description"
                      />
                    </td>
                    <td onKeyDown={onCellKeyDown}>
                      <input
                        className="erp-input h-8 min-w-[9rem] text-[12px]"
                        disabled={!editable}
                        value={line.specification}
                        onChange={(e) => onPatchLine(line.key, { specification: e.target.value })}
                      />
                    </td>
                    <td onKeyDown={onCellKeyDown}>
                      <input
                        className="erp-input h-8 w-16 text-[12px]"
                        disabled={!editable}
                        value={line.uom}
                        onChange={(e) => onPatchLine(line.key, { uom: e.target.value })}
                      />
                    </td>
                    <td
                      className={cn('num', (miss.missingQty || qtyError) && 'ring-1 ring-inset ring-amber-400/70')}
                      onKeyDown={onCellKeyDown}
                    >
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className="erp-input h-8 w-20 text-right text-[12px]"
                        disabled={!editable}
                        value={line.quantity}
                        onChange={(e) => onPatchLine(line.key, { quantity: Number(e.target.value) })}
                      />
                    </td>
                    <td className="num" onKeyDown={onCellKeyDown}>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className="erp-input h-8 w-24 text-right text-[12px]"
                        disabled={!editable}
                        value={line.estimatedRate}
                        onChange={(e) =>
                          onPatchLine(line.key, { estimatedRate: Number(e.target.value) })
                        }
                      />
                    </td>
                    <td className="num tabular-nums">{formatCurrency(line.amount)}</td>
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
                <td className="num" />
                <td className="num tabular-nums">{formatCurrency(totals.amount)}</td>
                <td className="purchase-doc-lines-grid__sticky-actions" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <PurchaseLineDetailsDrawer
        open={Boolean(detailsLine)}
        onClose={closeDetails}
        title={
          detailsLine
            ? `Line ${detailsLine.lineNo}${detailsLine.itemCode ? ` · ${detailsLine.itemCode}` : ''}`
            : 'Line details'
        }
        subtitle={detailsLine?.itemName || undefined}
        footer={
          <ErpButton type="button" size="sm" variant="secondary" onClick={closeDetails}>
            Done
          </ErpButton>
        }
      >
        {detailsLine ? (
          <div className="space-y-3">
            <ErpFieldRow label="HSN / SAC">
              <Input
                className="font-mono"
                disabled={!editable}
                value={detailsLine.hsnCode || detailsLine.sacCode || ''}
                onChange={(e) =>
                  onPatchLine(detailsLine.key, {
                    hsnCode: detailsLine.itemType === 'service' ? '' : e.target.value,
                    sacCode: detailsLine.itemType === 'service' ? e.target.value : detailsLine.sacCode,
                  })
                }
              />
            </ErpFieldRow>
            <ErpFieldRow label="Required delivery date">
              <Input
                type="date"
                disabled={!editable}
                value={detailsLine.requiredDate}
                onChange={(e) => onPatchLine(detailsLine.key, { requiredDate: e.target.value })}
              />
            </ErpFieldRow>
            <ErpFieldRow label="Delivery location">
              <select
                className="erp-input h-9 w-full text-[13px]"
                disabled={!editable}
                value={detailsLine.locationId}
                onChange={(e) => {
                  const loc = locationOptions.find((l) => l.id === e.target.value)
                  onPatchLine(detailsLine.key, {
                    locationId: loc?.id ?? e.target.value,
                    locationName: loc?.name ?? '',
                  })
                }}
              >
                {locationOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </ErpFieldRow>
            <ErpFieldRow label="Preferred vendor">
              <select
                className="erp-input h-9 w-full text-[13px]"
                disabled={!editable}
                value={detailsLine.preferredVendorId ?? ''}
                onChange={(e) => {
                  const vendor = vendors.find((v) => v.id === e.target.value)
                  onPatchLine(detailsLine.key, {
                    preferredVendorId: vendor?.id ?? null,
                    preferredVendorName: vendor?.vendorName ?? null,
                  })
                }}
              >
                <option value="">—</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vendorName}
                  </option>
                ))}
              </select>
            </ErpFieldRow>
            <ErpFieldRow label="Available stock" readOnly>
              <Input value={String(detailsLine.currentStock)} readOnly className="bg-erp-surface-alt" />
            </ErpFieldRow>
            <ErpFieldRow label="Open PO qty" readOnly>
              <Input value={String(detailsLine.openPoQty)} readOnly className="bg-erp-surface-alt" />
            </ErpFieldRow>
            <ErpFieldRow label="Purpose">
              <Input
                disabled={!editable}
                value={detailsLine.purpose}
                onChange={(e) => onPatchLine(detailsLine.key, { purpose: e.target.value })}
              />
            </ErpFieldRow>
            <ErpFieldRow label="Remarks">
              <Textarea
                disabled={!editable}
                value={detailsLine.remarks}
                onChange={(e) => onPatchLine(detailsLine.key, { remarks: e.target.value })}
                rows={2}
              />
            </ErpFieldRow>
            <ErpFieldRow label="Attachments">
              <Input
                disabled={!editable}
                value={detailsLine.attachmentNote}
                onChange={(e) => onPatchLine(detailsLine.key, { attachmentNote: e.target.value })}
                placeholder="File ref / note"
              />
            </ErpFieldRow>
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
          min-width: 11rem;
          background: #fff;
          box-shadow: 4px 0 8px -4px rgb(15 23 42 / 0.12);
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
