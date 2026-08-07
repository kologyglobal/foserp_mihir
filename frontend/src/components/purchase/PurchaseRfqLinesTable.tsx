import { useMemo, type KeyboardEvent } from 'react'
import { Package, Plus, Trash2 } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import {
  PurchaseItemCodeCell,
  type PurchaseItemCodeCatalogOption,
} from '@/components/purchase/PurchaseItemCodeCell'
import { PurchaseLineQtyCell } from '@/components/purchase/PurchaseLineQtyCell'
import { DecimalInput, Input, Select } from '@/components/forms/Inputs'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/utils/cn'
import {
  filterPurchaseCatalogByProductType,
} from '@/utils/purchaseCatalogFilter'
import {
  ENGINEERING_PRODUCT_TYPES,
  ENGINEERING_PRODUCT_TYPE_LABELS,
  type EngineeringProductType,
} from '@/types/taxMaster'
import type { RfqLine } from '@/types/purchaseDomain'
import { getPurchaseLineUomOptions, purchaseQtyToBaseQty } from '@/utils/purchaseLineUom'

export type RfqEditorLine = RfqLine & {
  productType?: EngineeringProductType | ''
  uomId?: string | null
  uomConversionFactor?: number
}

export type PurchaseRfqLinesTableProps = {
  lines: RfqEditorLine[]
  catalogItems: PurchaseItemCodeCatalogOption[]
  editable: boolean
  formatCurrency: (n: number) => string
  onAddLine: () => void
  onPatchLine: (lineId: string, patch: Partial<RfqEditorLine>) => void
  onRemoveLine: (lineId: string) => void
  onSelectCatalogItem: (lineId: string, itemId: string) => void
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

function missingMandatory(line: RfqEditorLine) {
  const started = Boolean(
    line.productType ||
      line.itemId ||
      line.itemCode.trim() ||
      line.itemName.trim() ||
      Number(line.quantity) > 0,
  )
  if (!started) return { missingItem: false, missingQty: false, any: false }
  const missingItem = !line.itemId && !line.itemCode.trim()
  const missingQty = !(Number(line.quantity) > 0)
  return { missingItem, missingQty, any: missingItem || missingQty }
}

/**
 * RFQ item lines — same item block as PO/PR (Product Type, Item, Description, Spec, UOM, Qty).
 */
export function PurchaseRfqLinesTable({
  lines,
  catalogItems,
  editable,
  formatCurrency,
  onAddLine,
  onPatchLine,
  onRemoveLine,
  onSelectCatalogItem,
}: PurchaseRfqLinesTableProps) {
  const estimatedValue = useMemo(
    () => lines.reduce((s, l) => s + Number(l.amount || 0), 0),
    [lines],
  )

  const patch = (lineId: string, next: Partial<RfqEditorLine>) => onPatchLine(lineId, next)

  const catalogForLine = (
    productType: EngineeringProductType | '' | null | undefined,
    selectedItemId?: string,
  ) => {
    const filtered = filterPurchaseCatalogByProductType(catalogItems, productType)
    if (!selectedItemId) return filtered
    if (filtered.some((i) => i.id === selectedItemId)) return filtered
    const selected = catalogItems.find((i) => i.id === selectedItemId)
    return selected ? [selected, ...filtered] : filtered
  }

  const setRowProductType = (line: RfqEditorLine, productType: EngineeringProductType | '') => {
    if (!productType) {
      patch(line.id, {
        productType: '',
        itemId: '',
        itemCode: '',
        itemName: '',
        uomId: null,
        uom: 'NOS',
        uomConversionFactor: 1,
      })
      return
    }
    patch(line.id, {
      productType,
      itemId: '',
      itemCode: '',
      itemName: '',
      uomId: null,
      uom: 'NOS',
      uomConversionFactor: 1,
    })
  }

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ErpButton
          type="button"
          size="sm"
          variant="secondary"
          icon={Plus}
          disabled={!editable}
          onClick={onAddLine}
        >
          Add line
        </ErpButton>
      </div>

      {lines.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No RFQ lines"
          description="Add an item line for vendor quotation."
          className="rounded-md border border-dashed border-erp-border bg-erp-surface-alt/40 py-12"
          action={
            editable ? (
              <ErpButton type="button" size="sm" variant="secondary" icon={Plus} onClick={onAddLine}>
                Add line
              </ErpButton>
            ) : undefined
          }
        />
      ) : (
        <div className="purchase-doc-lines-grid-scroll relative rounded-md border border-erp-border">
          <table className="erp-table purchase-doc-lines-grid purchase-rfq-lines-grid w-max min-w-full text-[11px]">
            <thead>
              <tr>
                <th className="purchase-doc-lines-grid__sticky-line">#</th>
                <th className="purchase-doc-lines-grid__sticky-type">Product Type</th>
                <th className="purchase-doc-lines-grid__sticky-item">Item</th>
                <th className="min-w-[11rem]">Description</th>
                <th className="min-w-[9rem]">Specification</th>
                <th className="purchase-doc-lines-grid__uom-col">UOM</th>
                <th className="num min-w-[11rem] purchase-doc-lines-grid__qty-col">Qty</th>
                <th className="min-w-[8rem]">Source PR</th>
                <th className="min-w-[9rem]">Required Date</th>
                <th className="num min-w-[5.75rem]">Target Price</th>
                <th className="num min-w-[5.75rem]">Amount</th>
                <th className="purchase-doc-lines-grid__sticky-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const miss = missingMandatory(line)
                const rowCatalog = catalogForLine(line.productType, line.itemId)
                return (
                  <tr key={line.id} className={cn(miss.any && editable && 'bg-amber-50/50')}>
                    <td className="purchase-doc-lines-grid__sticky-line tabular-nums">{line.lineNo}</td>
                    <td className="purchase-doc-lines-grid__sticky-type" onKeyDown={onCellKeyDown}>
                      <select
                        className="erp-input h-8 w-full min-w-0 text-[11px]"
                        disabled={!editable}
                        value={line.productType ?? ''}
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
                    </td>
                    <td
                      className={cn(
                        'purchase-doc-lines-grid__sticky-item',
                        miss.missingItem && editable && 'ring-1 ring-inset ring-amber-400/70',
                      )}
                      onKeyDown={onCellKeyDown}
                    >
                      <PurchaseItemCodeCell
                        itemId={line.itemId}
                        itemCode={line.itemCode}
                        catalogItems={rowCatalog}
                        disabled={!editable}
                        textClassName="text-[11px]"
                        className="w-full min-w-0 max-w-none"
                        emptyCatalogHint={
                          line.productType
                            ? 'No Item Master rows for this product type'
                            : 'No purchasable items from Item Master'
                        }
                        onSelectItem={(id) => onSelectCatalogItem(line.id, id)}
                        onClearCatalog={() =>
                          patch(line.id, {
                            itemId: '',
                            itemCode: '',
                            itemName: '',
                            uomId: null,
                            uom: 'NOS',
                            uomConversionFactor: 1,
                          })
                        }
                        onManualCodeChange={(code) => patch(line.id, { itemCode: code })}
                      />
                    </td>
                    <td onKeyDown={onCellKeyDown}>
                      <input
                        className="erp-input h-8 min-w-[11rem] text-[11px]"
                        disabled={!editable}
                        value={line.itemName}
                        onChange={(e) => patch(line.id, { itemName: e.target.value })}
                      />
                    </td>
                    <td onKeyDown={onCellKeyDown}>
                      <input
                        className="erp-input h-8 min-w-[9rem] text-[11px]"
                        disabled={!editable}
                        value={line.specification}
                        onChange={(e) => patch(line.id, { specification: e.target.value })}
                      />
                    </td>
                    <td className="purchase-doc-lines-grid__uom-col" onKeyDown={onCellKeyDown}>
                      {(() => {
                        const uomOptions = getPurchaseLineUomOptions(line.itemId)
                        const multi = uomOptions.length > 1
                        const uomCode = uomOptions[0]?.code || line.uom || '-'
                        if (!editable || !line.itemId) {
                          return (
                            <span className="block text-center text-[11px] font-medium uppercase text-erp-text">
                              {line.uom || '-'}
                            </span>
                          )
                        }
                        if (multi) {
                          return (
                            <Select
                              className="h-8 w-full px-0.5 text-center text-[10px]"
                              value={line.uomId || uomOptions[0]?.id || ''}
                              title="Select purchase unit from Item Master"
                              onChange={(e) => {
                                const opt = uomOptions.find((o) => o.id === e.target.value)
                                if (!opt) return
                                patch(line.id, {
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
                            </Select>
                          )
                        }
                        return (
                          <span className="block text-center text-[11px] font-medium uppercase text-erp-text">
                            {uomCode}
                          </span>
                        )
                      })()}
                    </td>
                    <td
                      className={cn(
                        'num purchase-doc-lines-grid__qty-col min-w-[11rem]',
                        miss.missingQty && editable && 'ring-1 ring-inset ring-amber-400/70',
                      )}
                      onKeyDown={onCellKeyDown}
                    >
                      <PurchaseLineQtyCell
                        line={{
                          itemId: line.itemId,
                          uom: line.uom,
                          uomQuantity: line.quantity,
                          quantity: purchaseQtyToBaseQty(
                            line.quantity,
                            line.uomConversionFactor ?? 1,
                          ),
                          uomConversionFactor: line.uomConversionFactor ?? 1,
                        }}
                        editable={editable}
                        disabled={!editable}
                        onChange={(v) => patch(line.id, { quantity: v })}
                      />
                    </td>
                    <td className="font-mono text-[11px] text-erp-muted">
                      {line.purchaseRequisitionNumber || '-'}
                    </td>
                    <td onKeyDown={onCellKeyDown}>
                      <Input
                        type="date"
                        className="h-8 min-w-[9rem] text-[11px]"
                        disabled={!editable}
                        value={line.requiredDate}
                        onChange={(e) => patch(line.id, { requiredDate: e.target.value })}
                      />
                    </td>
                    <td className="num" onKeyDown={onCellKeyDown}>
                      <DecimalInput
                        min={0}
                        className="h-8 w-20 text-right text-[11px]"
                        disabled={!editable}
                        value={line.targetPrice}
                        onChange={(v) => patch(line.id, { targetPrice: v })}
                      />
                    </td>
                    <td className="num font-medium tabular-nums">{formatCurrency(line.amount)}</td>
                    <td className="purchase-doc-lines-grid__sticky-actions">
                      <button
                        type="button"
                        className="rounded p-1 text-erp-danger-fg hover:bg-red-50 disabled:opacity-40"
                        disabled={!editable || lines.length <= 1}
                        aria-label="Remove line"
                        onClick={() => onRemoveLine(line.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="purchase-doc-lines-grid__totals bg-erp-surface-alt font-semibold">
                <td className="purchase-doc-lines-grid__sticky-line">Total</td>
                <td className="purchase-doc-lines-grid__sticky-type" />
                <td className="purchase-doc-lines-grid__sticky-item" />
                <td colSpan={3} />
                <td className="num tabular-nums">
                  {lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0)}
                </td>
                <td colSpan={3} />
                <td className="num tabular-nums">{formatCurrency(estimatedValue)}</td>
                <td className="purchase-doc-lines-grid__sticky-actions" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
