import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import type { OpportunityLine } from '../../types/crm'
import { ErpSmartSelect, type ErpSmartSelectOption } from './ErpSmartSelect'
import { ErpButton } from './ErpButton'
import { FormattedCurrencyInput } from '../forms/FormattedCurrencyInput'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import {
  calcOpportunityLinesSummary,
  calcWeightedValue,
  createEmptyOpportunityLine,
  syncOpportunityLines,
} from '../../utils/opportunityLineCalc'
import type { ProductMasterPick } from '../../utils/opportunityProductOptions'
import { buildOpportunityLineFromProduct } from '../../utils/opportunityLineCalc'
import { useMasterStore } from '../../store/masterStore'
import { cn } from '../../utils/cn'

interface ErpLineItemsGridProps {
  lines: OpportunityLine[]
  onChange: (lines: OpportunityLine[]) => void
  productOptions: ErpSmartSelectOption<string>[]
  productPickMap: Map<string, ProductMasterPick>
  rowErrors?: Record<string, string[]>
  probability?: number
  readOnly?: boolean
  /** Opportunity / quotation — compact line grid with expandable rows */
  variant?: 'full' | 'opportunity'
}

function lineHsn(pick: ProductMasterPick | undefined): string {
  if (!pick) return ''
  return (pick.product.hsnCode || pick.item?.hsnCode || '').trim()
}

function lineTechSpecs(pick: ProductMasterPick | undefined): string {
  return pick?.product.specifications?.trim() || ''
}

export function ErpLineItemsGrid({
  lines,
  onChange,
  productOptions,
  productPickMap,
  rowErrors = {},
  probability = 0,
  readOnly,
  variant = 'full',
}: ErpLineItemsGridProps) {
  const warehouses = useMasterStore((s) => s.warehouses)
  const categories = useMasterStore((s) => s.categories)
  const synced = syncOpportunityLines(lines)
  const summary = calcOpportunityLinesSummary(synced)
  const weighted = calcWeightedValue(summary.grandTotal, probability)
  const isOpportunity = variant === 'opportunity'
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})

  function commit(next: OpportunityLine[]) {
    onChange(syncOpportunityLines(next))
  }

  function updateLine(id: string, patch: Partial<OpportunityLine>) {
    commit(synced.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function addRow() {
    commit([...synced, createEmptyOpportunityLine(synced.length + 1)])
  }

  function removeRow(id: string) {
    if (synced.length <= 1 && isOpportunity) {
      commit([createEmptyOpportunityLine(1)])
      return
    }
    commit(synced.filter((l) => l.id !== id))
  }

  function duplicateRow(id: string) {
    const src = synced.find((l) => l.id === id)
    if (!src) return
    const dup = createEmptyOpportunityLine(synced.length + 1, {
      ...src,
      id: `opp-line-${crypto.randomUUID().slice(0, 8)}`,
    })
    commit([...synced, dup])
  }

  function toggleRowExpanded(id: string) {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function selectProduct(lineId: string, productId: string) {
    const pick = productPickMap.get(productId)
    if (!pick) return
    const idx = synced.findIndex((l) => l.id === lineId)
    const built = buildOpportunityLineFromProduct(pick.product, pick.item, pick.uomName, idx + 1)
    updateLine(lineId, built)
  }

  const productCount = synced.filter((l) => Boolean(l.productOrItem?.trim() || l.productId)).length
  const displayProductCount = productCount > 0 ? productCount : synced.length
  const multiItem = displayProductCount > 1

  return (
    <div className={cn('erp-line-items-grid', isOpportunity && 'erp-line-items-grid--opportunity')}>
      <div className="erp-line-items-grid__toolbar">
        {!isOpportunity ? (
          <div className="erp-line-items-grid__toolbar-stats">
            <span>
              <strong>{synced.length}</strong> line{synced.length === 1 ? '' : 's'}
            </span>
          </div>
        ) : (
          <span className="erp-line-items-grid__toolbar-spacer" aria-hidden />
        )}
        {!readOnly ? (
          <ErpButton type="button" variant="secondary" size="sm" icon={Plus} onClick={addRow}>
            {isOpportunity ? 'Add line' : 'Add Row'}
          </ErpButton>
        ) : null}
      </div>

      {synced.length === 0 ? (
        <div className="erp-line-items-grid__empty">
          <p>No line items yet. Add a blank line and select a product from the grid.</p>
        </div>
      ) : (
        <div className="quo-editor-price__table-wrap erp-line-items-grid__wrap">
          <table className={cn(
            'quo-editor-price__table erp-line-items-grid__table',
            isOpportunity && 'erp-line-items-grid__table--opportunity',
          )}>
            <thead>
              <tr>
                {isOpportunity ? <th className="w-8 erp-line-items-grid__sticky-expand" aria-label="Expand" /> : null}
                <th className="erp-line-items-grid__sticky-sr">#</th>
                <th className="erp-line-items-grid__sticky-product">
                  {isOpportunity ? 'Product / Item' : 'Product'}
                </th>
                {isOpportunity ? (
                  <th className="erp-line-items-grid__col-desc erp-line-items-grid__col--desktop">Description</th>
                ) : null}
                {!isOpportunity ? <th>Item Code</th> : null}
                {!isOpportunity ? <th>Description</th> : null}
                <th className={cn('text-right', isOpportunity ? 'erp-line-items-grid__col-qty' : 'erp-line-items-grid__col-qty')}>
                  {isOpportunity ? 'Quantity' : 'Qty'}
                </th>
                {isOpportunity ? (
                  <th className="erp-line-items-grid__col-unit erp-line-items-grid__col--desktop">Unit</th>
                ) : (
                  <th className="erp-line-items-grid__col-uom">UOM</th>
                )}
                <th className="text-right erp-line-items-grid__col-price">Unit Price</th>
                <th className={cn(
                  'text-right',
                  isOpportunity ? 'erp-line-items-grid__col-discount erp-line-items-grid__col--desktop' : 'erp-line-items-grid__col-pct',
                )}>
                  {isOpportunity ? (
                    <span className="erp-line-items-grid__th-stack">
                      <span>Discount</span>
                      <span className="erp-line-items-grid__th-sub">% · amount</span>
                    </span>
                  ) : (
                    'Disc %'
                  )}
                </th>
                {!isOpportunity ? <th className="text-right">Disc Amt</th> : null}
                {!isOpportunity ? <th className="text-right">Taxable</th> : null}
                <th className={cn(
                  'text-right',
                  isOpportunity ? 'erp-line-items-grid__col-tax erp-line-items-grid__col--desktop' : 'erp-line-items-grid__col-pct',
                )}>
                  {isOpportunity ? (
                    <span className="erp-line-items-grid__th-stack">
                      <span>Tax</span>
                      <span className="erp-line-items-grid__th-sub">GST % · amount</span>
                    </span>
                  ) : (
                    'GST %'
                  )}
                </th>
                {!isOpportunity ? <th className="text-right">GST Amt</th> : null}
                <th className="text-right erp-line-items-grid__col-total">
                  {isOpportunity ? 'Line Total' : 'Total'}
                </th>
                {!isOpportunity ? <th>Delivery</th> : null}
                {!isOpportunity ? <th>Remarks</th> : null}
                {!readOnly ? <th className="erp-line-items-grid__col-actions" aria-label="Actions" /> : null}
              </tr>
            </thead>
            <tbody>
              {synced.map((line, idx) => {
                const errs = rowErrors[line.id] ?? []
                const expanded = expandedRows[line.id]
                const pick = line.productId ? productPickMap.get(line.productId) : undefined
                const hsn = lineHsn(pick)
                const techSpecs = lineTechSpecs(pick)
                const warehouseName = (() => {
                  const category = pick?.item
                    ? categories.find((c) => c.id === pick.item!.categoryId)
                    : undefined
                  const whId = category?.defaultWarehouseId
                  if (!whId) return ''
                  const wh = warehouses.find((w) => w.id === whId)
                  return wh ? `${wh.warehouseCode} · ${wh.warehouseName}` : ''
                })()
                const colSpan = isOpportunity
                  ? (readOnly ? 10 : 11)
                  : (readOnly ? 14 : 15)

                return (
                  <Fragment key={line.id}>
                    <tr className={cn(errs.length > 0 && 'erp-line-items-grid__row--error')}>
                      {isOpportunity ? (
                        <td className="erp-line-items-grid__sticky-expand">
                          <button
                            type="button"
                            className="erp-line-items-grid__expand"
                            onClick={() => toggleRowExpanded(line.id)}
                            aria-expanded={expanded}
                            aria-label={expanded ? 'Hide line details' : 'Show line details'}
                          >
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                      ) : null}
                      <td className="tabular-nums text-erp-muted erp-line-items-grid__sticky-sr">{idx + 1}</td>
                      <td className="erp-line-items-grid__sticky-product">
                        <div className="erp-line-items-grid__product-stack">
                          {readOnly ? (
                            <p className="erp-line-items-grid__product-name">{line.productOrItem || '—'}</p>
                          ) : (
                            <ErpSmartSelect
                              options={productOptions}
                              value={line.productId ?? ''}
                              onChange={(pid) => selectProduct(line.id, pid)}
                              placeholder="Select product…"
                              appearance="dropdown"
                            />
                          )}
                          {line.itemCode ? (
                            <p className="erp-line-items-grid__product-code">{line.itemCode}</p>
                          ) : null}
                          {errs.length ? <p className="erp-line-items-grid__row-error">{errs.join(' · ')}</p> : null}
                        </div>
                      </td>
                      {isOpportunity ? (
                        <td className="erp-line-items-grid__col-desc erp-line-items-grid__col--desktop">
                          {readOnly ? (
                            <p className="erp-line-items-grid__desc-text">{line.description || '—'}</p>
                          ) : (
                            <input
                              className="quo-editor-price__input"
                              value={line.description}
                              onChange={(e) => updateLine(line.id, { description: e.target.value })}
                              placeholder="Description"
                              aria-label="Description"
                            />
                          )}
                        </td>
                      ) : null}
                      {!isOpportunity ? <td className="text-[12px]">{line.itemCode || '—'}</td> : null}
                      {!isOpportunity ? (
                        <td className="min-w-[140px]">
                          {readOnly ? line.description : (
                            <input className="quo-editor-price__input" value={line.description} onChange={(e) => updateLine(line.id, { description: e.target.value })} />
                          )}
                        </td>
                      ) : null}
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
                            onChange={(e) => updateLine(line.id, { qty: Number(e.target.value) })}
                            aria-label="Quantity"
                          />
                        )}
                      </td>
                      {isOpportunity ? (
                        <td className="erp-line-items-grid__col-unit erp-line-items-grid__col--desktop">
                          <span className="erp-line-items-grid__unit-badge">{line.uom || '—'}</span>
                        </td>
                      ) : (
                        <td className="erp-line-items-grid__col-uom">{line.uom}</td>
                      )}
                      <td className="text-right erp-line-items-grid__col-price tabular-nums">
                        {readOnly ? formatCrmCurrency(line.unitPrice) : (
                          <FormattedCurrencyInput
                            className="erp-line-items-grid__input-num"
                            value={line.unitPrice}
                            onValueChange={(unitPrice) => updateLine(line.id, { unitPrice: Math.max(0, unitPrice) })}
                            aria-label="Unit price"
                          />
                        )}
                      </td>
                      <td className={cn(
                        'text-right',
                        isOpportunity ? 'erp-line-items-grid__col-discount erp-line-items-grid__col--desktop' : 'erp-line-items-grid__col-pct',
                      )}>
                        <div className="erp-line-items-grid__money-stack">
                          {readOnly ? (
                            <span className="tabular-nums">{line.discountPct}%</span>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              max={100}
                              className="erp-line-items-grid__input-num"
                              value={line.discountPct}
                              onChange={(e) => updateLine(line.id, { discountPct: Number(e.target.value) })}
                              aria-label="Discount percent"
                            />
                          )}
                          {isOpportunity ? (
                            <span className="erp-line-items-grid__money-hint" title="Discount amount">
                              −{formatCrmCurrency(line.discountAmount)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      {!isOpportunity ? <td className="text-right tabular-nums">{formatCrmCurrency(line.discountAmount)}</td> : null}
                      {!isOpportunity ? <td className="text-right tabular-nums">{formatCrmCurrency(line.taxableValue)}</td> : null}
                      <td className={cn(
                        'text-right',
                        isOpportunity ? 'erp-line-items-grid__col-tax erp-line-items-grid__col--desktop' : 'erp-line-items-grid__col-pct',
                      )}>
                        <div className="erp-line-items-grid__money-stack">
                          {readOnly ? (
                            <span className="tabular-nums">{line.taxPct}%</span>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              max={100}
                              className="erp-line-items-grid__input-num"
                              value={line.taxPct}
                              onChange={(e) => updateLine(line.id, { taxPct: Number(e.target.value) })}
                              aria-label="Tax / GST percent"
                            />
                          )}
                          {isOpportunity ? (
                            <span className="erp-line-items-grid__money-hint" title="GST amount">
                              +{formatCrmCurrency(line.gstAmount)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      {!isOpportunity ? <td className="text-right tabular-nums">{formatCrmCurrency(line.gstAmount)}</td> : null}
                      <td className="text-right tabular-nums font-semibold erp-line-items-grid__col-total">{formatCrmCurrency(line.lineTotal)}</td>
                      {!isOpportunity ? (
                        <td className="erp-line-items-grid__col-delivery">
                          {readOnly ? (line.expectedDeliveryDate ?? '—') : (
                            <input type="date" className="erp-line-items-grid__input-date" value={line.expectedDeliveryDate ?? ''} onChange={(e) => updateLine(line.id, { expectedDeliveryDate: e.target.value || null })} />
                          )}
                        </td>
                      ) : null}
                      {!isOpportunity ? (
                        <td>
                          {readOnly ? line.remarks : (
                            <input className="quo-editor-price__input" value={line.remarks} onChange={(e) => updateLine(line.id, { remarks: e.target.value })} placeholder="Notes" />
                          )}
                        </td>
                      ) : null}
                      {!readOnly ? (
                        <td className="erp-line-items-grid__col-actions">
                          <div className="erp-line-items-grid__actions">
                            <button type="button" className="erp-line-items-grid__action-btn" onClick={() => duplicateRow(line.id)} title="Duplicate line">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" className="erp-line-items-grid__action-btn erp-line-items-grid__action-btn--danger" onClick={() => removeRow(line.id)} title="Remove line">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                    {isOpportunity && expanded ? (
                      <tr className="erp-line-items-grid__detail-row">
                        <td colSpan={colSpan}>
                          <div className="erp-line-items-grid__detail-grid">
                            <label className="erp-line-items-grid__detail-field erp-line-items-grid__detail-field--compact-only">
                              <span>Description</span>
                              {readOnly ? (
                                <p>{line.description || '—'}</p>
                              ) : (
                                <input
                                  className="quo-editor-price__input"
                                  value={line.description}
                                  onChange={(e) => updateLine(line.id, { description: e.target.value })}
                                  placeholder="Description"
                                />
                              )}
                            </label>
                            <label className="erp-line-items-grid__detail-field erp-line-items-grid__detail-field--compact-only">
                              <span>Unit</span>
                              <p>{line.uom || '—'}</p>
                            </label>
                            <label className="erp-line-items-grid__detail-field erp-line-items-grid__detail-field--compact-only">
                              <span>Discount</span>
                              {readOnly ? (
                                <p>{line.discountPct}% (−{formatCrmCurrency(line.discountAmount)})</p>
                              ) : (
                                <div className="erp-line-items-grid__detail-inline">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    className="erp-line-items-grid__input-num"
                                    value={line.discountPct}
                                    onChange={(e) => updateLine(line.id, { discountPct: Number(e.target.value) })}
                                    aria-label="Discount percent"
                                  />
                                  <span className="erp-line-items-grid__money-hint">−{formatCrmCurrency(line.discountAmount)}</span>
                                </div>
                              )}
                            </label>
                            <label className="erp-line-items-grid__detail-field erp-line-items-grid__detail-field--compact-only">
                              <span>Tax (GST)</span>
                              {readOnly ? (
                                <p>{line.taxPct}% (+{formatCrmCurrency(line.gstAmount)})</p>
                              ) : (
                                <div className="erp-line-items-grid__detail-inline">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    className="erp-line-items-grid__input-num"
                                    value={line.taxPct}
                                    onChange={(e) => updateLine(line.id, { taxPct: Number(e.target.value) })}
                                    aria-label="Tax / GST percent"
                                  />
                                  <span className="erp-line-items-grid__money-hint">+{formatCrmCurrency(line.gstAmount)}</span>
                                </div>
                              )}
                            </label>

                            <div className="erp-line-items-grid__detail-field">
                              <span>HSN / SAC</span>
                              <p>{hsn || '—'}</p>
                            </div>
                            <label className="erp-line-items-grid__detail-field">
                              <span>Delivery details</span>
                              {readOnly ? (
                                <p>{line.expectedDeliveryDate ?? '—'}</p>
                              ) : (
                                <input
                                  type="date"
                                  className="erp-line-items-grid__input-date"
                                  value={line.expectedDeliveryDate ?? ''}
                                  onChange={(e) => updateLine(line.id, { expectedDeliveryDate: e.target.value || null })}
                                />
                              )}
                            </label>
                            <label className="erp-line-items-grid__detail-field erp-line-items-grid__detail-field--wide">
                              <span>Product notes</span>
                              {readOnly ? (
                                <p>{line.remarks || '—'}</p>
                              ) : (
                                <input
                                  className="quo-editor-price__input"
                                  value={line.remarks}
                                  onChange={(e) => updateLine(line.id, { remarks: e.target.value })}
                                  placeholder="Line notes"
                                />
                              )}
                            </label>
                            <div className="erp-line-items-grid__detail-field erp-line-items-grid__detail-field--wide">
                              <span>Technical specifications</span>
                              <p className="erp-line-items-grid__detail-specs">{techSpecs || '—'}</p>
                            </div>
                            <div className="erp-line-items-grid__detail-field">
                              <span>Warehouse / location</span>
                              <p>
                                {[
                                  warehouseName || null,
                                  line.productFamily || null,
                                  pick?.stockQty != null ? `Stock ${pick.stockQty}` : null,
                                ].filter(Boolean).join(' · ') || '—'}
                              </p>
                            </div>
                            <div className="erp-line-items-grid__detail-metrics">
                              <span>Taxable {formatCrmCurrency(line.taxableValue)}</span>
                              <span>Discount {formatCrmCurrency(line.discountAmount)}</span>
                              <span>GST {formatCrmCurrency(line.gstAmount)} ({line.taxPct}%)</span>
                              <span>Line total {formatCrmCurrency(line.lineTotal)}</span>
                              {line.itemCode ? <span>Code {line.itemCode}</span> : null}
                            </div>
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

      {synced.length > 0 ? (
        <div
          className={cn(
            'erp-line-items-grid__totals',
            isOpportunity && 'erp-line-items-grid__totals--compact',
            !isOpportunity && multiItem && 'erp-line-items-grid__totals--panel',
          )}
          aria-label="Line item totals"
        >
          {isOpportunity ? (
            <div className="erp-line-items-grid__totals-compact">
              <p className="erp-line-items-grid__totals-meta">
                <strong>{displayProductCount}</strong>
                {' '}
                {displayProductCount === 1 ? 'product' : 'products'}
                <span className="erp-line-items-grid__totals-sep" aria-hidden>·</span>
                Qty <strong>{summary.totalQty}</strong>
                <span className="erp-line-items-grid__totals-sep" aria-hidden>·</span>
                Taxable <strong>{formatCrmCurrency(summary.taxableAmount)}</strong>
                <span className="erp-line-items-grid__totals-sep" aria-hidden>·</span>
                GST <strong>{formatCrmCurrency(summary.gstAmount)}</strong>
                {multiItem ? (
                  <>
                    <span className="erp-line-items-grid__totals-sep" aria-hidden>·</span>
                    Weighted <strong>{formatCrmCurrency(weighted)}</strong>
                    <span className="erp-line-items-grid__totals-pct">({probability}%)</span>
                  </>
                ) : null}
              </p>
              <span className="erp-line-items-grid__totals-item erp-line-items-grid__totals-item--total" title="Final Quoted Value = product subtotal − discount + tax">
                Final Quoted <strong>{formatCrmCurrency(summary.grandTotal)}</strong>
              </span>
            </div>
          ) : (
            <>
              <p className="erp-line-items-grid__totals-meta">
                <strong>{displayProductCount}</strong>
                {' '}
                {displayProductCount === 1 ? 'Product' : 'Products'}
                <span className="erp-line-items-grid__totals-sep" aria-hidden>·</span>
                Qty <strong>{summary.totalQty}</strong>
              </p>

              <div className="erp-line-items-grid__totals-row erp-line-items-grid__totals-row--money">
                <span className="erp-line-items-grid__totals-item">
                  Taxable <strong>{formatCrmCurrency(summary.taxableAmount)}</strong>
                </span>
                <span className="erp-line-items-grid__totals-item">
                  GST <strong>{formatCrmCurrency(summary.gstAmount)}</strong>
                </span>
                {multiItem && summary.totalDiscount > 0 ? (
                  <span className="erp-line-items-grid__totals-item">
                    Disc <strong>{formatCrmCurrency(summary.totalDiscount)}</strong>
                  </span>
                ) : null}
              </div>

              <div className="erp-line-items-grid__totals-row erp-line-items-grid__totals-row--grand">
                {multiItem ? (
                  <span className="erp-line-items-grid__totals-item erp-line-items-grid__totals-item--muted">
                    Weighted <strong>{formatCrmCurrency(weighted)}</strong>
                    <span className="erp-line-items-grid__totals-pct">({probability}%)</span>
                  </span>
                ) : (
                  <span className="erp-line-items-grid__totals-spacer" aria-hidden />
                )}
                <span className="erp-line-items-grid__totals-item erp-line-items-grid__totals-item--total">
                  TOTAL <strong>{formatCrmCurrency(summary.grandTotal)}</strong>
                </span>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
