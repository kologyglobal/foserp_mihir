import { useMemo } from 'react'
import { Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { ErpSmartSelect } from '../erp/ErpSmartSelect'
import { Input } from '../forms/Inputs'
import {
  canUseItemInSales,
  isItemSellable,
  itemNotSellableForSalesMessage,
  useSalesItemOptionMap,
} from '../../utils/opportunityItemOptions'
import { useMasterStore } from '../../store/masterStore'
import { useSellableItems } from '../../hooks/useMasterLists'
import { notify } from '../../store/toastStore'
import { formatCurrency } from '../../utils/formatters/currency'
import {
  SO_GST_RATE_OPTIONS,
  computeSoLineTotals,
  newSoLineDraft,
  type SoLineDraft,
} from '../../utils/salesOrderLineDraft'

export interface SalesOrderLinesEditorProps {
  lines: SoLineDraft[]
  onChange: (lines: SoLineDraft[]) => void
  readOnly?: boolean
}

export function SalesOrderLinesEditor({ lines, onChange, readOnly = false }: SalesOrderLinesEditorProps) {
  const allItems = useMasterStore((s) => s.items)
  const uoms = useMasterStore((s) => s.uoms)
  const getItem = useMasterStore((s) => s.getItem)
  useSellableItems()

  const { options: itemSmartOptions } = useSalesItemOptionMap(
    allItems,
    uoms,
    undefined,
    lines.map((l) => l.itemId),
  )

  const computedLines = useMemo(
    () => lines.map((line) => {
      const totals = computeSoLineTotals(line)
      const item = line.itemId ? getItem(line.itemId) : undefined
      return { ...line, ...totals, productName: item?.itemName ?? '—' }
    }),
    [lines, getItem],
  )

  function updateLine(key: string, patch: Partial<SoLineDraft>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function addLine() {
    onChange([...lines, newSoLineDraft('', 0)])
  }

  function removeLine(key: string) {
    if (lines.length <= 1) return
    onChange(lines.filter((l) => l.key !== key))
  }

  return (
    <div className="so-pricing-panel so-pricing-panel--pro">
      <div className="so-pricing-table-wrap">
        <table className="so-pricing-table">
          <colgroup>
            <col className="so-pricing-col-idx" />
            <col className="so-pricing-col-product" />
            <col className="so-pricing-col-qty" />
            <col className="so-pricing-col-price" />
            <col className="so-pricing-col-disc" />
            <col className="so-pricing-col-gst" />
            <col className="so-pricing-col-money" />
            <col className="so-pricing-col-money" />
            <col className="so-pricing-col-money" />
            <col className="so-pricing-col-action" />
          </colgroup>
          <thead>
            <tr>
              <th className="so-pricing-th so-pricing-th--center">#</th>
              <th className="so-pricing-th">Product</th>
              <th className="so-pricing-th so-pricing-th--right">Qty</th>
              <th className="so-pricing-th so-pricing-th--right">Unit price</th>
              <th className="so-pricing-th so-pricing-th--right">Disc %</th>
              <th className="so-pricing-th so-pricing-th--right">GST %</th>
              <th className="so-pricing-th so-pricing-th--right so-pricing-th--calc">Taxable</th>
              <th className="so-pricing-th so-pricing-th--right so-pricing-th--calc">GST</th>
              <th className="so-pricing-th so-pricing-th--right so-pricing-th--calc">Line total</th>
              {!readOnly ? (
                <th className="so-pricing-th so-pricing-th--center" aria-label="Actions" />
              ) : null}
            </tr>
          </thead>
          <tbody>
            {computedLines.map((line, idx) => {
              const draft = lines[idx]
              if (!draft) return null
              const item = draft.itemId ? getItem(draft.itemId) : undefined
              return (
                <tr key={line.key} className="so-pricing-row">
                  <td className="so-pricing-td so-pricing-td--center tabular-nums text-erp-muted">
                    {idx + 1}
                  </td>
                  <td className="so-pricing-td so-pricing-td--product">
                    {readOnly ? (
                      <span className="text-sm font-medium text-erp-text">{line.productName}</span>
                    ) : (
                      <>
                        <ErpSmartSelect
                          options={itemSmartOptions}
                          value={draft.itemId}
                          onChange={(id) => {
                            if (!id) return
                            const nextItem = getItem(id)
                            const sellable = canUseItemInSales(id)
                            if (!sellable.ok) {
                              notify.warning(sellable.error ?? 'Item is not allowed for sales')
                              return
                            }
                            updateLine(line.key, {
                              itemId: id,
                              unitPrice: nextItem?.defaultSalesRate ?? nextItem?.standardRate ?? draft.unitPrice,
                            })
                          }}
                          placeholder="Select sellable item…"
                          appearance="dropdown"
                          dropdownMinWidth={360}
                          emptyMessage="No sellable items match. Only items allowed for sales can be selected."
                        />
                        {item && !isItemSellable(item) ? (
                          <p className="so-pricing-warn">
                            <ShieldAlert className="h-3 w-3" /> {itemNotSellableForSalesMessage(item)}
                          </p>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="so-pricing-td">
                    {readOnly ? (
                      <span className="tabular-nums">{draft.qty}</span>
                    ) : (
                      <Input
                        type="number"
                        min={1}
                        className="so-pricing-input so-pricing-input--num"
                        value={draft.qty}
                        onChange={(e) => updateLine(line.key, { qty: Math.max(1, Number(e.target.value) || 1) })}
                      />
                    )}
                  </td>
                  <td className="so-pricing-td">
                    {readOnly ? (
                      <span className="tabular-nums">{formatCurrency(draft.unitPrice)}</span>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        className="so-pricing-input so-pricing-input--num"
                        value={draft.unitPrice}
                        onChange={(e) => updateLine(line.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    )}
                  </td>
                  <td className="so-pricing-td">
                    {readOnly ? (
                      <span className="tabular-nums">{draft.discountPct}%</span>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="so-pricing-input so-pricing-input--num"
                        value={draft.discountPct}
                        onChange={(e) => updateLine(line.key, { discountPct: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    )}
                  </td>
                  <td className="so-pricing-td">
                    {readOnly ? (
                      <span className="tabular-nums">{draft.taxPct}%</span>
                    ) : (
                      <select
                        className="erp-input so-pricing-input so-pricing-input--select"
                        value={draft.taxPct}
                        onChange={(e) => updateLine(line.key, { taxPct: Number(e.target.value) })}
                      >
                        {SO_GST_RATE_OPTIONS.map((rate) => (
                          <option key={rate} value={rate}>{rate}%</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="so-pricing-td so-pricing-td--right so-pricing-td--calc tabular-nums">
                    {formatCurrency(line.taxableValue)}
                  </td>
                  <td className="so-pricing-td so-pricing-td--right so-pricing-td--calc tabular-nums">
                    {formatCurrency(line.gstAmount)}
                  </td>
                  <td className="so-pricing-td so-pricing-td--right so-pricing-td--total tabular-nums">
                    {formatCurrency(line.lineTotal)}
                  </td>
                  {!readOnly ? (
                    <td className="so-pricing-td so-pricing-td--center">
                      <button
                        type="button"
                        className="so-pricing-remove"
                        onClick={() => removeLine(line.key)}
                        aria-label="Remove line"
                        disabled={lines.length <= 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!readOnly ? (
        <div className="so-pricing-toolbar">
          <button type="button" className="so-pricing-add" onClick={addLine}>
            <Plus className="h-4 w-4" />
            Add product line
          </button>
          <p className="so-pricing-toolbar__hint">
            <span className="so-pricing-toolbar__count">{lines.length}</span>
            {' '}line{lines.length === 1 ? '' : 's'} · qty, price & GST edit inline
          </p>
        </div>
      ) : null}
    </div>
  )
}
