import { useMemo, type KeyboardEvent, type ReactNode } from 'react'
import { Copy, FileSpreadsheet, Package, Plus, Trash2 } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import {
  PurchaseItemCodeCell,
  type PurchaseItemCodeCatalogOption,
} from '@/components/purchase/PurchaseItemCodeCell'
import { Select } from '@/components/forms/Inputs'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableLink } from '@/components/ui/AppLink'
import { useBinCodeOptions } from '@/hooks/usePurchaseMasters'
import { cn } from '@/utils/cn'
import type { PrEditorLine } from '@/utils/purchaseRequisitionValidation'
import {
  mapEngineeringProductTypeToPurchaseCategory,
} from '@/utils/purchaseProductType'
import {
  ENGINEERING_PRODUCT_TYPES,
  ENGINEERING_PRODUCT_TYPE_LABELS,
  type EngineeringProductType,
} from '@/types/taxMaster'
import type { Vendor } from '@/types/purchaseDomain'
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
    line.productType ||
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
 * PR item details — Product Type + Item Code sticky left; Actions sticky right.
 * Columns include read-only PO No. after conversion (Planning→PO / RFQ→PO).
 */
export function PurchaseRequisitionLinesTable({
  lines,
  catalogItems,
  vendors,
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
  const binCodeOptions = useBinCodeOptions()

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

  const catalogForLine = (productType: EngineeringProductType | '') => {
    // Prefer items matching the selected Item Master product type; still show the rest.
    if (!productType) return catalogItems
    const matched = catalogItems.filter((item) => item.productType === productType)
    const rest = catalogItems.filter((item) => item.productType !== productType)
    return matched.length ? [...matched, ...rest] : catalogItems
  }

  const setRowProductType = (line: PrEditorLine, productType: EngineeringProductType | '') => {
    const category = mapEngineeringProductTypeToPurchaseCategory(productType)
    if (!productType) {
      patch(line.key, {
        productType: '',
        category: '',
        itemId: '',
        itemCode: '',
        itemName: '',
        uomId: null,
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
      ? catalogItems.find((i) => i.id === line.itemId && i.productType === productType)
      : undefined
    if (matched) {
      patch(line.key, { productType, category })
      return
    }
    patch(line.key, {
      productType,
      category,
      itemId: '',
      itemCode: '',
      itemName: '',
      uomId: null,
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
                <th className="purchase-doc-lines-grid__sticky-item">Item Code</th>
                <th className="min-w-[10rem]">Item Name</th>
                <th className="min-w-[9rem]">Specification</th>
                <th className="num">Required Qty</th>
                <th>UOM</th>
                <th className="num">Est. Rate</th>
                <th className="num">Est. Amount</th>
                <th className="min-w-[9rem]">Preferred Vendor</th>
                <th className="min-w-[8rem]">Warehouse</th>
                <th className="min-w-[7rem]">BIN</th>
                <th className="min-w-[8rem]">Required Date</th>
                <th className="min-w-[8rem]">PO No.</th>
                <th className="min-w-[8rem]">Remarks</th>
                {!readOnly ? (
                  <th className="purchase-doc-lines-grid__sticky-actions">Action</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const miss = missingMandatory(line)
                const qtyError = showErrors && lineErrors?.[`${line.key}:quantity`]
                const typeError = showErrors && lineErrors?.[`${line.key}:productType`]
                const rowCatalog = catalogForLine(line.productType)
                const lineLocked = Boolean(line.purchaseOrderId)
                const rowEditable = canEdit && !lineLocked
                return (
                  <tr
                    key={line.key}
                    className={cn((miss.any || qtyError || typeError) && rowEditable && 'bg-amber-50/50')}
                  >
                    <td className="purchase-doc-lines-grid__sticky-line tabular-nums">{line.lineNo}</td>
                    <td
                      className={cn(
                        'purchase-doc-lines-grid__sticky-type',
                        typeError && rowEditable && 'ring-1 ring-inset ring-amber-400/70',
                      )}
                      onKeyDown={rowEditable ? onCellKeyDown : undefined}
                    >
                      {rowEditable ? (
                        <select
                          className="erp-input h-8 w-full min-w-0 text-[12px]"
                          value={line.productType}
                          onChange={(e) =>
                            setRowProductType(line, e.target.value as EngineeringProductType | '')
                          }
                        >
                          <option value="">— Select —</option>
                          {ENGINEERING_PRODUCT_TYPES.map((pt) => (
                            <option key={pt} value={pt}>
                              {ENGINEERING_PRODUCT_TYPE_LABELS[pt]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        displayOrDash(
                          line.productType ? ENGINEERING_PRODUCT_TYPE_LABELS[line.productType] : '',
                        )
                      )}
                    </td>
                    <td
                      className={cn(
                        'purchase-doc-lines-grid__sticky-item',
                        miss.missingItem &&
                          rowEditable &&
                          'ring-1 ring-inset ring-amber-400/70',
                      )}
                      onKeyDown={rowEditable ? onCellKeyDown : undefined}
                    >
                      {rowEditable && onSelectCatalogItem ? (
                        <PurchaseItemCodeCell
                          itemId={line.itemId}
                          itemCode={line.itemCode}
                          itemName={line.itemName}
                          catalogItems={rowCatalog}
                          labelMode="code"
                          allowManual={false}
                          onSelectItem={(id) => onSelectCatalogItem(line.key, id)}
                          onClearCatalog={() =>
                            patch(line.key, { itemId: '', itemCode: '', itemName: '' })
                          }
                          onManualCodeChange={() => undefined}
                        />
                      ) : (
                        <span className="block truncate font-mono text-[12px]">
                          {displayOrDash(line.itemCode)}
                        </span>
                      )}
                    </td>
                    <td onKeyDown={rowEditable ? onCellKeyDown : undefined}>
                      {rowEditable ? (
                        <input
                          className="erp-input h-8 min-w-[10rem] text-[12px]"
                          value={line.itemName}
                          onChange={(e) => patch(line.key, { itemName: e.target.value })}
                          placeholder="Item name"
                        />
                      ) : (
                        displayOrDash(line.itemName)
                      )}
                    </td>
                    <td onKeyDown={rowEditable ? onCellKeyDown : undefined}>
                      {rowEditable ? (
                        <input
                          className="erp-input h-8 min-w-[9rem] text-[12px]"
                          value={line.specification}
                          onChange={(e) => patch(line.key, { specification: e.target.value })}
                        />
                      ) : (
                        displayOrDash(line.specification)
                      )}
                    </td>
                    <td
                      className={cn(
                        'num',
                        (miss.missingQty || qtyError) && rowEditable && 'ring-1 ring-inset ring-amber-400/70',
                      )}
                      onKeyDown={rowEditable ? onCellKeyDown : undefined}
                    >
                      {rowEditable ? (
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
                    <td onKeyDown={rowEditable ? onCellKeyDown : undefined}>
                      {rowEditable ? (
                        <input
                          className="erp-input h-8 w-16 text-[12px]"
                          value={line.uom}
                          onChange={(e) => patch(line.key, { uom: e.target.value })}
                        />
                      ) : (
                        displayOrDash(line.uom)
                      )}
                    </td>
                    <td className="num" onKeyDown={rowEditable ? onCellKeyDown : undefined}>
                      {rowEditable ? (
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
                    <td onKeyDown={rowEditable ? onCellKeyDown : undefined}>
                      {rowEditable ? (
                        <Select
                          className="h-8 min-w-[9rem] text-[12px]"
                          value={line.preferredVendorId ?? ''}
                          onChange={(e) => {
                            const id = e.target.value || null
                            const vendor = id ? vendors.find((v) => v.id === id) : undefined
                            patch(line.key, {
                              preferredVendorId: id,
                              preferredVendorName: vendor?.vendorName ?? null,
                              vendorNumber: vendor?.vendorCode ?? '',
                            })
                          }}
                        >
                          <option value="">— Select —</option>
                          {vendors.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.vendorName}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        displayOrDash(line.preferredVendorName)
                      )}
                    </td>
                    <td onKeyDown={rowEditable ? onCellKeyDown : undefined}>
                      {rowEditable ? (
                        <input
                          className="erp-input h-8 min-w-[8rem] text-[12px]"
                          value={line.locationName}
                          onChange={(e) => patch(line.key, { locationName: e.target.value })}
                        />
                      ) : (
                        displayOrDash(line.locationName)
                      )}
                    </td>
                    <td onKeyDown={rowEditable ? onCellKeyDown : undefined}>
                      {rowEditable ? (
                        <Select
                          className="h-8 min-w-[7rem] text-[12px]"
                          value={line.binCode}
                          onChange={(e) => patch(line.key, { binCode: e.target.value })}
                        >
                          <option value="">— Select —</option>
                          {binCodeOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.value} — {opt.label}
                            </option>
                          ))}
                          {line.binCode &&
                          !binCodeOptions.some((opt) => opt.value === line.binCode) ? (
                            <option value={line.binCode}>{line.binCode}</option>
                          ) : null}
                        </Select>
                      ) : (
                        <span className="font-mono">{displayOrDash(line.binCode)}</span>
                      )}
                    </td>
                    <td onKeyDown={rowEditable ? onCellKeyDown : undefined}>
                      {rowEditable ? (
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
                    <td>
                      {line.purchaseOrderNumber ? (
                        line.purchaseOrderId ? (
                          <TableLink
                            to={`/purchase/orders/${line.purchaseOrderId}`}
                            className="font-mono text-[12px]"
                          >
                            {line.purchaseOrderNumber}
                          </TableLink>
                        ) : (
                          <span className="font-mono text-[12px]">{line.purchaseOrderNumber}</span>
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                    <td onKeyDown={rowEditable ? onCellKeyDown : undefined}>
                      {rowEditable ? (
                        <input
                          className="erp-input h-8 min-w-[8rem] text-[12px]"
                          value={line.remarks}
                          onChange={(e) => patch(line.key, { remarks: e.target.value })}
                        />
                      ) : (
                        displayOrDash(line.remarks)
                      )}
                    </td>
                    {!readOnly ? (
                      <td className="purchase-doc-lines-grid__sticky-actions">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            className="rounded p-1 text-erp-danger-fg hover:bg-red-50 disabled:opacity-40"
                            disabled={!rowEditable}
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
                <td colSpan={2} />
                <td className="num tabular-nums">{totals.qty}</td>
                <td />
                <td className="num" />
                <td className="num tabular-nums">{formatCurrency(totals.amount)}</td>
                <td colSpan={6} />
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
          left: 12rem;
          z-index: 11;
          width: 10rem;
          min-width: 10rem;
          max-width: 10rem;
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
