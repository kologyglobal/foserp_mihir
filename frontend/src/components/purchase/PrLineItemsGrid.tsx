import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { ErpSmartSelect, type ErpSmartSelectOption } from '../../components/erp/ErpSmartSelect'
import { ItemLookupSelect } from '../../components/lookups/ItemLookupSelect'
import { VendorLookupSelect } from '../../components/lookups/VendorLookupSelect'
import { ErpButton } from '../../components/erp/ErpButton'
import { FormattedCurrencyInput } from '../../components/forms/FormattedCurrencyInput'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { resolveLocationWarehouseId } from '../../utils/locationUtils'
import { useMasterStore } from '../../store/masterStore'
import { cn } from '../../utils/cn'

export type PrLineRow = {
  key: string
  itemId: string
  itemCode?: string
  itemName?: string
  uomId?: string
  uomName?: string
  locationId: string
  warehouseId: string
  vendorId: string
  vendorCode?: string
  vendorName?: string
  qty: string
  rate: string
  requiredDate: string
  remarks: string
}

type PrLineItemsGridProps = {
  lines: PrLineRow[]
  onChange: (lines: PrLineRow[]) => void
  locationOptions: ErpSmartSelectOption<string>[]
  warehouseOptions: ErpSmartSelectOption<string>[]
  stockByItem: Map<string, number>
  readOnly?: boolean
  /** Kept for callers — density now matches CRM opportunity grid either way */
  compact?: boolean
  onAddLine?: () => void
}

function emptyLine(partial?: Partial<PrLineRow>): PrLineRow {
  return {
    key: crypto.randomUUID(),
    itemId: '',
    locationId: '',
    warehouseId: '',
    vendorId: '',
    qty: '1',
    rate: '0',
    requiredDate: new Date().toISOString().slice(0, 10),
    remarks: '',
    ...partial,
  }
}

/**
 * Purchase requisition lines — mirrors CRM `ErpLineItemsGrid` opportunity variant
 * (classes, expand rows, Add line, copy/delete icon actions, currency inputs).
 */
export function PrLineItemsGrid({
  lines,
  onChange,
  locationOptions,
  warehouseOptions,
  stockByItem,
  readOnly,
}: PrLineItemsGridProps) {
  const locations = useMasterStore((s) => s.locations)
  const getItem = useMasterStore((s) => s.getItem)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})

  const lineTotal = lines.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0)
  const productCount = lines.filter((l) => Boolean(l.itemId)).length

  function patchLine(key: string, patch: Partial<PrLineRow>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function addLine() {
    const last = lines[lines.length - 1]
    onChange([
      ...lines,
      emptyLine({
        itemId: '',
        itemCode: undefined,
        itemName: undefined,
        uomId: undefined,
        uomName: undefined,
        locationId: last?.locationId ?? '',
        warehouseId: last?.warehouseId ?? '',
        vendorId: '',
        qty: '1',
        rate: '0',
        requiredDate: last?.requiredDate ?? new Date().toISOString().slice(0, 10),
        remarks: '',
      }),
    ])
  }

  function removeLine(key: string) {
    if (lines.length <= 1) {
      onChange([emptyLine({
        locationId: lines[0]?.locationId ?? '',
        warehouseId: lines[0]?.warehouseId ?? '',
        requiredDate: lines[0]?.requiredDate ?? new Date().toISOString().slice(0, 10),
      })])
      return
    }
    onChange(lines.filter((l) => l.key !== key))
  }

  function duplicateLine(key: string) {
    const src = lines.find((l) => l.key === key)
    if (!src) return
    onChange([...lines, { ...src, key: crypto.randomUUID() }])
  }

  function toggleExpanded(key: string) {
    setExpandedRows((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const colSpan = readOnly ? 10 : 11

  return (
    <div className="erp-line-items-grid erp-line-items-grid--opportunity erp-line-items-grid--purchase">
      <div className="erp-line-items-grid__toolbar">
        <span className="erp-line-items-grid__toolbar-spacer" aria-hidden />
        {!readOnly ? (
          <ErpButton type="button" variant="secondary" size="sm" icon={Plus} onClick={addLine}>
            Add line
          </ErpButton>
        ) : null}
      </div>

      {lines.length === 0 ? (
        <div className="erp-line-items-grid__empty">
          <p>No line items yet. Add a blank line and select an item from the grid.</p>
        </div>
      ) : (
        <div className="quo-editor-price__table-wrap erp-line-items-grid__wrap">
          <table className="quo-editor-price__table erp-line-items-grid__table erp-line-items-grid__table--opportunity">
            <thead>
              <tr>
                <th className="w-8 erp-line-items-grid__sticky-expand" aria-label="Expand" />
                <th className="erp-line-items-grid__sticky-sr">#</th>
                <th className="erp-line-items-grid__sticky-product">Item</th>
                <th className="erp-line-items-grid__col-desc erp-line-items-grid__col--desktop">Description</th>
                <th className="text-right erp-line-items-grid__col-qty">Quantity</th>
                <th className="erp-line-items-grid__col-unit erp-line-items-grid__col--desktop">Unit</th>
                <th className="erp-line-items-grid__col--desktop">Location</th>
                <th className="text-right erp-line-items-grid__col--desktop">Stock</th>
                <th className="erp-line-items-grid__col--desktop">Required</th>
                <th className="text-right erp-line-items-grid__col-price">Rate</th>
                <th className="text-right erp-line-items-grid__col-total">Line Total</th>
                {!readOnly ? <th className="erp-line-items-grid__col-actions" aria-label="Actions" /> : null}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const item = line.itemId ? getItem(line.itemId) : undefined
                const qty = Number(line.qty) || 0
                const rate = Number(line.rate) || 0
                const amount = qty * rate
                const stock = stockByItem.get(line.itemId) ?? 0
                const stockLow = stock <= 0 && Boolean(line.itemId)
                const itemCode = line.itemCode ?? item?.itemCode
                const itemName = line.itemName ?? item?.itemName
                const expanded = Boolean(expandedRows[line.key])
                const locationLabel =
                  locationOptions.find((o) => o.value === line.locationId)?.label
                  ?? warehouseOptions.find((o) => o.value === line.warehouseId)?.label
                  ?? '—'

                return (
                  <Fragment key={line.key}>
                    <tr>
                      <td className="erp-line-items-grid__sticky-expand">
                        <button
                          type="button"
                          className="erp-line-items-grid__expand"
                          onClick={() => toggleExpanded(line.key)}
                          aria-expanded={expanded}
                          aria-label={expanded ? 'Hide line details' : 'Show line details'}
                        >
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="tabular-nums text-erp-muted erp-line-items-grid__sticky-sr">{idx + 1}</td>
                      <td className="erp-line-items-grid__sticky-product">
                        <div className="erp-line-items-grid__product-stack">
                          {readOnly ? (
                            <p className="erp-line-items-grid__product-name">{itemCode ?? '—'}</p>
                          ) : (
                            <ItemLookupSelect
                              compact
                              value={line.itemId}
                              placeholder="Select item…"
                              onChange={(sel) => {
                                const master = sel ? getItem(sel.itemId) : undefined
                                patchLine(line.key, {
                                  itemId: sel?.itemId ?? '',
                                  itemCode: sel?.itemCode,
                                  itemName: sel?.itemName,
                                  uomId: sel?.uomId,
                                  uomName: sel?.uomName,
                                  rate: String(master?.standardRate ?? 0),
                                })
                              }}
                            />
                          )}
                          {itemCode ? (
                            <p className="erp-line-items-grid__product-code">{itemCode}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="erp-line-items-grid__col-desc erp-line-items-grid__col--desktop">
                        <p className="erp-line-items-grid__desc-text">{itemName || '—'}</p>
                      </td>
                      <td className="text-right erp-line-items-grid__col-qty">
                        {readOnly ? (
                          <span className="tabular-nums font-semibold">{line.qty}</span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            step="any"
                            className="erp-line-items-grid__input-num"
                            value={line.qty}
                            onChange={(e) => patchLine(line.key, { qty: e.target.value })}
                            aria-label="Quantity"
                          />
                        )}
                      </td>
                      <td className="erp-line-items-grid__col-unit erp-line-items-grid__col--desktop">
                        <span className="erp-line-items-grid__unit-badge">{line.uomName || '—'}</span>
                      </td>
                      <td className="erp-line-items-grid__col--desktop">
                        {readOnly ? (
                          <span className="erp-line-items-grid__cell-text">{locationLabel}</span>
                        ) : (
                          <ErpSmartSelect
                            compact
                            options={locationOptions}
                            value={line.locationId}
                            placeholder="Location…"
                            onChange={(v) => {
                              const warehouseId = resolveLocationWarehouseId(v || '', locations) ?? ''
                              patchLine(line.key, { locationId: v || '', warehouseId })
                            }}
                          />
                        )}
                      </td>
                      <td className={cn(
                        'text-right tabular-nums erp-line-items-grid__col--desktop',
                        stockLow && 'text-erp-danger-fg font-semibold',
                      )}>
                        {line.itemId ? stock : '—'}
                      </td>
                      <td className="erp-line-items-grid__col--desktop">
                        {readOnly ? (
                          formatDate(line.requiredDate)
                        ) : (
                          <input
                            type="date"
                            className="erp-line-items-grid__input-date"
                            value={line.requiredDate}
                            onChange={(e) => patchLine(line.key, { requiredDate: e.target.value })}
                            aria-label="Required date"
                          />
                        )}
                      </td>
                      <td className="text-right erp-line-items-grid__col-price tabular-nums">
                        {readOnly ? (
                          formatCurrency(rate)
                        ) : (
                          <FormattedCurrencyInput
                            className="erp-line-items-grid__input-num"
                            value={rate}
                            onValueChange={(next) => patchLine(line.key, { rate: String(Math.max(0, next)) })}
                            aria-label="Rate"
                          />
                        )}
                      </td>
                      <td className="text-right tabular-nums font-semibold erp-line-items-grid__col-total">
                        {formatCurrency(amount)}
                      </td>
                      {!readOnly ? (
                        <td className="erp-line-items-grid__col-actions">
                          <div className="erp-line-items-grid__actions">
                            <button
                              type="button"
                              className="erp-line-items-grid__action-btn"
                              onClick={() => duplicateLine(line.key)}
                              title="Duplicate line"
                              aria-label="Duplicate line"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              className="erp-line-items-grid__action-btn erp-line-items-grid__action-btn--danger"
                              onClick={() => removeLine(line.key)}
                              title="Remove line"
                              aria-label="Remove line"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                    {expanded ? (
                      <tr className="erp-line-items-grid__detail-row">
                        <td colSpan={colSpan}>
                          <div className="erp-line-items-grid__detail-grid">
                            <label className="erp-line-items-grid__detail-field erp-line-items-grid__detail-field--compact-only">
                              <span>Description</span>
                              <p>{itemName || '—'}</p>
                            </label>
                            <label className="erp-line-items-grid__detail-field erp-line-items-grid__detail-field--compact-only">
                              <span>Unit</span>
                              <p>{line.uomName || '—'}</p>
                            </label>
                            <label className="erp-line-items-grid__detail-field erp-line-items-grid__detail-field--compact-only">
                              <span>Location</span>
                              {readOnly ? (
                                <p>{locationLabel}</p>
                              ) : (
                                <ErpSmartSelect
                                  compact
                                  options={locationOptions}
                                  value={line.locationId}
                                  placeholder="Location…"
                                  onChange={(v) => {
                                    const warehouseId = resolveLocationWarehouseId(v || '', locations) ?? ''
                                    patchLine(line.key, { locationId: v || '', warehouseId })
                                  }}
                                />
                              )}
                            </label>
                            <div className="erp-line-items-grid__detail-field erp-line-items-grid__detail-field--compact-only">
                              <span>Stock on hand</span>
                              <p className={cn(stockLow && 'text-erp-danger-fg font-semibold')}>
                                {line.itemId ? stock : '—'}
                              </p>
                            </div>
                            <label className="erp-line-items-grid__detail-field erp-line-items-grid__detail-field--compact-only">
                              <span>Required date</span>
                              {readOnly ? (
                                <p>{formatDate(line.requiredDate)}</p>
                              ) : (
                                <input
                                  type="date"
                                  className="erp-line-items-grid__input-date"
                                  value={line.requiredDate}
                                  onChange={(e) => patchLine(line.key, { requiredDate: e.target.value })}
                                />
                              )}
                            </label>
                            <div className="erp-line-items-grid__detail-field">
                              <span>Material / grade</span>
                              <p>{item?.materialGrade || '—'}</p>
                            </div>
                            <label className="erp-line-items-grid__detail-field">
                              <span>Preferred vendor</span>
                              {readOnly ? (
                                <p>{line.vendorName ?? line.vendorCode ?? '—'}</p>
                              ) : (
                                <VendorLookupSelect
                                  compact
                                  allowEmpty
                                  value={line.vendorId}
                                  onChange={(sel) =>
                                    patchLine(line.key, {
                                      vendorId: sel?.vendorId ?? '',
                                      vendorCode: sel?.vendorCode,
                                      vendorName: sel?.vendorName,
                                    })
                                  }
                                />
                              )}
                            </label>
                            <label className="erp-line-items-grid__detail-field">
                              <span>Line remarks</span>
                              {readOnly ? (
                                <p>{line.remarks?.trim() || '—'}</p>
                              ) : (
                                <input
                                  className="quo-editor-price__input"
                                  value={line.remarks}
                                  onChange={(e) => patchLine(line.key, { remarks: e.target.value })}
                                  placeholder="Notes for this line…"
                                />
                              )}
                            </label>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="quo-editor-price__summary">
        <div className="quo-editor-price__summary-row">
          <span>Lines with items</span>
          <span className="tabular-nums text-right">{productCount}</span>
        </div>
        <div className="quo-editor-price__summary-row quo-editor-price__summary-row--total">
          <span>Estimated total</span>
          <span className="tabular-nums text-right">{formatCurrency(lineTotal)}</span>
        </div>
      </div>
    </div>
  )
}
