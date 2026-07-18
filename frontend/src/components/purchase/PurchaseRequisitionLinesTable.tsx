import { useMemo, type KeyboardEvent, type ReactNode } from 'react'
import { Copy, FileSpreadsheet, Package, Plus, Trash2 } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import {
  PurchaseItemCodeCell,
  type PurchaseItemCodeCatalogOption,
} from '@/components/purchase/PurchaseItemCodeCell'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/utils/cn'
import type { PrEditorLine } from '@/utils/purchaseRequisitionValidation'
import {
  PURCHASE_ITEM_CATEGORIES,
  PURCHASE_ITEM_CATEGORY_LABELS,
  type PurchaseItemCategory,
  type Vendor,
} from '@/types/purchaseDomain'
import { formatDate } from '@/utils/dates/format'

export type PurchaseRequisitionLinesTableProps = {
  lines: PrEditorLine[]
  catalogItems: PurchaseItemCodeCatalogOption[]
  vendors: Vendor[]
  editable: boolean
  readOnly?: boolean
  reqNo?: string | null
  showErrors?: boolean
  lineErrors?: Record<string, string | undefined>
  formatCurrency: (n: number) => string
  estimatedTotal: number
  onAddLine?: () => void
  onCopyLastLine?: () => void
  onImportExcel?: () => void
  onClearLines?: () => void
  onPatchLine?: (key: string, patch: Partial<PrEditorLine>) => void
  onRemoveLine?: (key: string) => void
  onSelectCatalogItem?: (key: string, itemId: string) => void
  toolbarExtra?: ReactNode
  title?: string
}

function missingMandatory(line: PrEditorLine) {
  const started = Boolean(
    line.category ||
      line.itemId ||
      line.itemCode.trim() ||
      line.itemName.trim() ||
      Number(line.quantity) > 0,
  )
  if (!started) return { missingItem: false, missingQty: false, any: false }
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

function displayOrDash(value: string | number | null | undefined) {
  if (value === null || value === undefined) return '—'
  const text = String(value).trim()
  return text || '—'
}

/**
 * PR line items — Product Type sticky first; Item sticky; Actions sticky right.
 * Extra: BIN, PO Number, Quote Number, Required Date. No Action Message / Vendor No / Order Date.
 */
export function PurchaseRequisitionLinesTable({
  lines,
  catalogItems,
  editable,
  readOnly = false,
  showErrors,
  lineErrors,
  formatCurrency,
  estimatedTotal,
  onAddLine,
  onCopyLastLine,
  onImportExcel,
  onClearLines,
  onPatchLine,
  onRemoveLine,
  onSelectCatalogItem,
  toolbarExtra,
}: PurchaseRequisitionLinesTableProps) {
  const canEdit = editable && !readOnly

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, l) => ({
        qty: acc.qty + (Number(l.quantity) || 0),
        amount: acc.amount + (Number(l.amount) || 0),
      }),
      { qty: 0, amount: 0 },
    )
  }, [lines])

  const patch = (key: string, next: Partial<PrEditorLine>) => onPatchLine?.(key, next)

  const catalogForLine = (category: PurchaseItemCategory | '') => {
    if (!category) return []
    return catalogItems.filter((item) => item.category === category)
  }

  const setRowProductType = (line: PrEditorLine, category: PurchaseItemCategory | '') => {
    if (!category) {
      patch(line.key, {
        category: '',
        itemId: '',
        itemCode: '',
        itemName: '',
        uom: 'NOS',
        hsnCode: '',
        sacCode: null,
        estimatedRate: 0,
        preferredVendorId: null,
        preferredVendorName: null,
        vendorNumber: '',
        currentStock: 0,
        openPoQty: 0,
      })
      return
    }
    const matched = line.itemId
      ? catalogItems.find((i) => i.id === line.itemId && i.category === category)
      : undefined
    if (matched) {
      patch(line.key, { category })
      return
    }
    patch(line.key, {
      category,
      itemId: '',
      itemCode: '',
      itemName: '',
      uom: 'NOS',
      hsnCode: '',
      sacCode: null,
      estimatedRate: 0,
      preferredVendorId: null,
      preferredVendorName: null,
      vendorNumber: '',
      currentStock: 0,
      openPoQty: 0,
    })
  }

  return (
    <>
      {!readOnly ? (
        <div className="mb-3 flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <ErpButton
              type="button"
              size="sm"
              variant="secondary"
              icon={Plus}
              disabled={!canEdit}
              onClick={onAddLine}
            >
              Add Item
            </ErpButton>
            <ErpButton
              type="button"
              size="sm"
              variant="secondary"
              icon={Copy}
              disabled={!canEdit || lines.length === 0}
              onClick={onCopyLastLine}
            >
              Copy Lines
            </ErpButton>
            <ErpButton
              type="button"
              size="sm"
              variant="secondary"
              icon={FileSpreadsheet}
              disabled={!canEdit}
              onClick={onImportExcel}
            >
              Import from Excel
            </ErpButton>
            <ErpButton
              type="button"
              size="sm"
              variant="secondary"
              disabled={!canEdit}
              onClick={onClearLines}
            >
              Clear Lines
            </ErpButton>
            {toolbarExtra}
          </div>
          <span className="shrink-0 text-[12px] tabular-nums text-erp-muted">
            {lines.length} line{lines.length === 1 ? '' : 's'} · {formatCurrency(estimatedTotal)}
          </span>
        </div>
      ) : (
        <div className="mb-3 flex justify-end">
          <span className="shrink-0 text-[12px] tabular-nums text-erp-muted">
            {lines.length} line{lines.length === 1 ? '' : 's'} · {formatCurrency(estimatedTotal)}
          </span>
        </div>
      )}

      {lines.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No item lines yet"
          description="Add catalog or manual lines for this purchase requisition."
          className="rounded-md border border-dashed border-erp-border bg-erp-surface-alt/40 py-12"
          action={
            canEdit && onAddLine ? (
              <ErpButton type="button" size="sm" variant="secondary" icon={Plus} onClick={onAddLine}>
                Add Item
              </ErpButton>
            ) : undefined
          }
        />
      ) : (
        <div className="purchase-pr-lines-scroll max-h-[min(32rem,60vh)] overflow-auto rounded-md border border-erp-border">
          <table className="erp-table purchase-pr-lines-grid w-max min-w-full text-[12px]">
            <thead>
              <tr>
                <th className="purchase-doc-lines-grid__sticky-line">#</th>
                <th className="purchase-doc-lines-grid__sticky-type">Product Type</th>
                <th className="purchase-doc-lines-grid__sticky-item">Item</th>
                <th className="min-w-[11rem]">Description</th>
                <th className="min-w-[9rem]">Specification</th>
                <th>UOM</th>
                <th className="num">Qty</th>
                <th className="num">Est. Rate</th>
                <th className="num">Est. Amount</th>
                <th className="min-w-[7rem]">BIN Code</th>
                <th className="min-w-[8rem]" title="Filled when a PO is created">
                  PO Number
                </th>
                <th className="min-w-[8rem]" title="Filled when a quote is linked">
                  Quote Number
                </th>
                <th className="min-w-[8rem]">Required Date</th>
                {!readOnly ? (
                  <th className="purchase-doc-lines-grid__sticky-actions">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const miss = missingMandatory(line)
                const qtyError = showErrors && lineErrors?.[`${line.key}:quantity`]
                const typeError = showErrors && lineErrors?.[`${line.key}:category`]
                const rowCatalog = catalogForLine(line.category)
                const itemReady = Boolean(line.category)
                return (
                  <tr
                    key={line.key}
                    className={cn((miss.any || qtyError || typeError) && canEdit && 'bg-amber-50/50')}
                  >
                    <td className="purchase-doc-lines-grid__sticky-line tabular-nums">{line.lineNo}</td>
                    <td
                      className={cn(
                        'purchase-doc-lines-grid__sticky-type',
                        typeError && canEdit && 'ring-1 ring-inset ring-amber-400/70',
                      )}
                      onKeyDown={canEdit ? onCellKeyDown : undefined}
                    >
                      {canEdit ? (
                        <select
                          className="erp-input h-8 w-full min-w-0 text-[12px]"
                          value={line.category}
                          onChange={(e) =>
                            setRowProductType(line, e.target.value as PurchaseItemCategory | '')
                          }
                        >
                          <option value="">Select…</option>
                          {PURCHASE_ITEM_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {PURCHASE_ITEM_CATEGORY_LABELS[cat]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        displayOrDash(
                          line.category ? PURCHASE_ITEM_CATEGORY_LABELS[line.category] : '',
                        )
                      )}
                    </td>
                    <td
                      className={cn(
                        'purchase-doc-lines-grid__sticky-item',
                        miss.missingItem &&
                          canEdit &&
                          itemReady &&
                          'ring-1 ring-inset ring-amber-400/70',
                      )}
                      onKeyDown={canEdit ? onCellKeyDown : undefined}
                    >
                      {canEdit && onSelectCatalogItem ? (
                        <PurchaseItemCodeCell
                          itemId={line.itemId}
                          itemCode={line.itemCode}
                          itemName={line.itemName}
                          catalogItems={rowCatalog}
                          disabled={!itemReady}
                          labelMode="name"
                          allowManual={false}
                          onSelectItem={(id) => onSelectCatalogItem(line.key, id)}
                          onClearCatalog={() =>
                            patch(line.key, { itemId: '', itemCode: '', itemName: '' })
                          }
                          onManualCodeChange={() => undefined}
                        />
                      ) : (
                        <span className="block truncate font-medium text-[12px]">
                          {displayOrDash(line.itemName || line.itemCode)}
                        </span>
                      )}
                    </td>
                    <td onKeyDown={canEdit ? onCellKeyDown : undefined}>
                      {canEdit ? (
                        <input
                          className="erp-input h-8 min-w-[11rem] text-[12px]"
                          value={line.itemName}
                          onChange={(e) => patch(line.key, { itemName: e.target.value })}
                          placeholder="Description"
                        />
                      ) : (
                        displayOrDash(line.itemName)
                      )}
                    </td>
                    <td onKeyDown={canEdit ? onCellKeyDown : undefined}>
                      {canEdit ? (
                        <input
                          className="erp-input h-8 min-w-[9rem] text-[12px]"
                          value={line.specification}
                          onChange={(e) => patch(line.key, { specification: e.target.value })}
                        />
                      ) : (
                        displayOrDash(line.specification)
                      )}
                    </td>
                    <td onKeyDown={canEdit ? onCellKeyDown : undefined}>
                      {canEdit ? (
                        <input
                          className="erp-input h-8 w-16 text-[12px]"
                          value={line.uom}
                          onChange={(e) => patch(line.key, { uom: e.target.value })}
                        />
                      ) : (
                        displayOrDash(line.uom)
                      )}
                    </td>
                    <td
                      className={cn(
                        'num',
                        (miss.missingQty || qtyError) && canEdit && 'ring-1 ring-inset ring-amber-400/70',
                      )}
                      onKeyDown={canEdit ? onCellKeyDown : undefined}
                    >
                      {canEdit ? (
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className="erp-input h-8 w-20 text-right text-[12px]"
                          value={line.quantity}
                          onChange={(e) => patch(line.key, { quantity: Number(e.target.value) })}
                        />
                      ) : (
                        <span className="tabular-nums">{line.quantity}</span>
                      )}
                    </td>
                    <td className="num" onKeyDown={canEdit ? onCellKeyDown : undefined}>
                      {canEdit ? (
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className="erp-input h-8 w-24 text-right text-[12px]"
                          value={line.estimatedRate}
                          onChange={(e) =>
                            patch(line.key, { estimatedRate: Number(e.target.value) })
                          }
                        />
                      ) : (
                        <span className="tabular-nums">{formatCurrency(line.estimatedRate)}</span>
                      )}
                    </td>
                    <td className="num tabular-nums">{formatCurrency(line.amount)}</td>
                    <td onKeyDown={canEdit ? onCellKeyDown : undefined}>
                      {canEdit ? (
                        <input
                          className="erp-input h-8 min-w-[6.5rem] font-mono text-[12px]"
                          value={line.binCode}
                          onChange={(e) => patch(line.key, { binCode: e.target.value })}
                          placeholder="BIN"
                        />
                      ) : (
                        <span className="font-mono">{displayOrDash(line.binCode)}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-erp-muted">
                      {displayOrDash(line.purchaseOrderNumber)}
                    </td>
                    <td className="whitespace-nowrap text-erp-muted">
                      {displayOrDash(line.purchaseQuoteNumber)}
                    </td>
                    <td onKeyDown={canEdit ? onCellKeyDown : undefined}>
                      {canEdit ? (
                        <input
                          type="date"
                          className="erp-input h-8 min-w-[8rem] text-[12px]"
                          value={line.requiredDate}
                          onChange={(e) => patch(line.key, { requiredDate: e.target.value })}
                        />
                      ) : (
                        displayOrDash(line.requiredDate ? formatDate(line.requiredDate) : '')
                      )}
                    </td>
                    {!readOnly ? (
                      <td className="purchase-doc-lines-grid__sticky-actions">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            className="rounded p-1 text-erp-danger-fg hover:bg-red-50 disabled:opacity-40"
                            disabled={!canEdit}
                            onClick={() => onRemoveLine?.(line.key)}
                            title="Delete line"
                            aria-label="Delete line"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-erp-surface-alt font-semibold">
                <td className="purchase-doc-lines-grid__sticky-line">Total</td>
                <td className="purchase-doc-lines-grid__sticky-type" />
                <td className="purchase-doc-lines-grid__sticky-item" />
                <td colSpan={3} />
                <td className="num tabular-nums">{totals.qty}</td>
                <td className="num" />
                <td className="num tabular-nums">{formatCurrency(totals.amount)}</td>
                <td colSpan={4} />
                {!readOnly ? <td className="purchase-doc-lines-grid__sticky-actions" /> : null}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <style>{`
        .purchase-pr-lines-grid {
          border-collapse: separate !important;
          border-spacing: 0;
        }
        .purchase-pr-lines-grid thead th {
          position: sticky;
          top: 0;
          z-index: 20;
          background: var(--erp-surface-alt, #f8fafc);
          white-space: nowrap;
        }
        /* # | Product Type | Item — left offsets must match column widths exactly */
        .purchase-pr-lines-grid .purchase-doc-lines-grid__sticky-line {
          position: sticky;
          left: 0;
          z-index: 13;
          width: 2.5rem;
          min-width: 2.5rem;
          max-width: 2.5rem;
          box-sizing: border-box;
          background: #fff;
          box-shadow: 2px 0 4px rgb(15 23 42 / 0.04);
        }
        .purchase-pr-lines-grid thead .purchase-doc-lines-grid__sticky-line,
        .purchase-pr-lines-grid tfoot .purchase-doc-lines-grid__sticky-line {
          top: 0;
          z-index: 31;
          background: var(--erp-surface-alt, #f8fafc);
        }
        .purchase-pr-lines-grid .purchase-doc-lines-grid__sticky-type {
          position: sticky;
          left: 2.5rem;
          z-index: 12;
          width: 9.5rem;
          min-width: 9.5rem;
          max-width: 9.5rem;
          box-sizing: border-box;
          background: #fff;
          box-shadow: 2px 0 4px rgb(15 23 42 / 0.04);
        }
        .purchase-pr-lines-grid thead .purchase-doc-lines-grid__sticky-type,
        .purchase-pr-lines-grid tfoot .purchase-doc-lines-grid__sticky-type {
          top: 0;
          z-index: 30;
          background: var(--erp-surface-alt, #f8fafc);
        }
        .purchase-pr-lines-grid .purchase-doc-lines-grid__sticky-item {
          position: sticky;
          left: 12rem; /* 2.5 + 9.5 */
          z-index: 11;
          width: 12rem;
          min-width: 12rem;
          max-width: 12rem;
          box-sizing: border-box;
          background: #fff;
          box-shadow: 4px 0 8px -4px rgb(15 23 42 / 0.12);
          overflow: hidden;
        }
        .purchase-pr-lines-grid .purchase-doc-lines-grid__sticky-item > * {
          width: 100%;
          max-width: 100%;
          min-width: 0 !important;
        }
        .purchase-pr-lines-grid thead .purchase-doc-lines-grid__sticky-item,
        .purchase-pr-lines-grid tfoot .purchase-doc-lines-grid__sticky-item {
          top: 0;
          z-index: 29;
          background: var(--erp-surface-alt, #f8fafc);
          overflow: hidden;
        }
        .purchase-pr-lines-grid .purchase-doc-lines-grid__sticky-actions {
          position: sticky;
          right: 0;
          z-index: 12;
          min-width: 3.25rem;
          width: 3.25rem;
          text-align: center;
          background: #fff;
          box-shadow: -4px 0 8px rgb(15 23 42 / 0.06);
        }
        .purchase-pr-lines-grid thead .purchase-doc-lines-grid__sticky-actions,
        .purchase-pr-lines-grid tfoot .purchase-doc-lines-grid__sticky-actions {
          top: 0;
          z-index: 30;
          background: var(--erp-surface-alt, #f8fafc);
        }
        .purchase-pr-lines-grid tbody tr:hover .purchase-doc-lines-grid__sticky-line,
        .purchase-pr-lines-grid tbody tr:hover .purchase-doc-lines-grid__sticky-type,
        .purchase-pr-lines-grid tbody tr:hover .purchase-doc-lines-grid__sticky-item,
        .purchase-pr-lines-grid tbody tr:hover .purchase-doc-lines-grid__sticky-actions {
          background: #f0f7ff;
        }
        .purchase-pr-lines-grid tfoot td {
          border-top: 1px solid var(--erp-border-strong, #cbd5e1);
        }
      `}</style>
    </>
  )
}
