import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import type { OpportunityLine } from '../../types/crm'
import { ErpSmartSelect, type ErpSmartSelectOption } from './ErpSmartSelect'
import { ErpButton } from './ErpButton'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import {
  calcOpportunityLinesSummary,
  calcWeightedValue,
  createEmptyOpportunityLine,
  syncOpportunityLines,
} from '../../utils/opportunityLineCalc'
import type { ProductMasterPick } from '../../utils/opportunityProductOptions'
import { buildOpportunityLineFromProduct } from '../../utils/opportunityLineCalc'
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

  function productSpec(line: OpportunityLine): string | null {
    const spec = line.description?.trim()
    if (!spec) return null
    if (spec === line.productOrItem?.trim()) return null
    return spec
  }

  return (
    <div className={cn('erp-line-items-grid', isOpportunity && 'erp-line-items-grid--opportunity')}>
      <div className="erp-line-items-grid__toolbar">
        <div className="erp-line-items-grid__toolbar-stats">
          <span>
            <strong>{synced.length}</strong> line{synced.length === 1 ? '' : 's'}
          </span>
        </div>
        {!readOnly ? (
          <ErpButton type="button" variant="secondary" size="sm" icon={Plus} onClick={addRow}>
            {isOpportunity ? 'Add blank line' : 'Add Row'}
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
                <th className="erp-line-items-grid__sticky-sr">Sr</th>
                <th className="erp-line-items-grid__sticky-product">Product / Item</th>
                {!isOpportunity ? <th>Item Code</th> : null}
                {!isOpportunity ? <th>Description</th> : null}
                <th className={cn('text-right', isOpportunity ? 'erp-line-items-grid__col-qty-uom' : 'erp-line-items-grid__col-qty')}>
                  {isOpportunity ? 'Qty' : 'Qty'}
                </th>
                {!isOpportunity ? <th className="erp-line-items-grid__col-uom">UOM</th> : null}
                <th className="text-right erp-line-items-grid__col-price">Unit Price</th>
                <th className="text-right erp-line-items-grid__col-pct">Disc %</th>
                {!isOpportunity ? <th className="text-right">Disc Amt</th> : null}
                {!isOpportunity ? <th className="text-right">Taxable</th> : null}
                <th className="text-right erp-line-items-grid__col-pct">GST %</th>
                {!isOpportunity ? <th className="text-right">GST Amt</th> : null}
                <th className="text-right erp-line-items-grid__col-total">Line Total</th>
                {!isOpportunity ? <th>Delivery</th> : null}
                {!isOpportunity ? <th>Remarks</th> : null}
                {!readOnly ? <th className="erp-line-items-grid__col-actions">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {synced.map((line, idx) => {
                const errs = rowErrors[line.id] ?? []
                const expanded = expandedRows[line.id]
                const spec = productSpec(line)
                const colSpan = isOpportunity
                  ? (readOnly ? 8 : 9)
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
                        {isOpportunity ? (
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
                            {spec && !expanded ? (
                              <p className="erp-line-items-grid__product-spec">{spec}</p>
                            ) : null}
                            {errs.length ? <p className="erp-line-items-grid__row-error">{errs.join(' · ')}</p> : null}
                          </div>
                        ) : (
                          <>
                            {readOnly ? (
                              <div className="erp-line-items-grid__product-stack">
                                <p className="erp-line-items-grid__product-name">{line.productOrItem || '—'}</p>
                                {line.itemCode ? <p className="erp-line-items-grid__product-code">{line.itemCode}</p> : null}
                              </div>
                            ) : (
                              <ErpSmartSelect
                                options={productOptions}
                                value={line.productId ?? ''}
                                onChange={(pid) => selectProduct(line.id, pid)}
                                placeholder="Select product…"
                                appearance="dropdown"
                              />
                            )}
                            {errs.length ? <p className="erp-line-items-grid__row-error">{errs.join(' · ')}</p> : null}
                          </>
                        )}
                      </td>
                      {!isOpportunity ? <td className="text-[12px]">{line.itemCode || '—'}</td> : null}
                      {!isOpportunity ? (
                        <td className="min-w-[140px]">
                          {readOnly ? line.description : (
                            <input className="quo-editor-price__input" value={line.description} onChange={(e) => updateLine(line.id, { description: e.target.value })} />
                          )}
                        </td>
                      ) : null}
                      {isOpportunity ? (
                        <td className="erp-line-items-grid__col-qty-uom">
                          <div className="erp-line-items-grid__qty-uom">
                            {readOnly ? (
                              <span className="erp-line-items-grid__qty-uom-value tabular-nums">{line.qty}</span>
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
                            <span className="erp-line-items-grid__qty-uom-unit">{line.uom}</span>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="text-right erp-line-items-grid__col-qty">
                            {readOnly ? line.qty : (
                              <input type="number" min={0} step="any" className="erp-line-items-grid__input-num" value={line.qty} onChange={(e) => updateLine(line.id, { qty: Number(e.target.value) })} />
                            )}
                          </td>
                          <td className="erp-line-items-grid__col-uom">{line.uom}</td>
                        </>
                      )}
                      <td className="text-right erp-line-items-grid__col-price">
                        {readOnly ? formatCrmCurrency(line.unitPrice) : (
                          <input type="number" min={0} className="erp-line-items-grid__input-num" value={line.unitPrice} onChange={(e) => updateLine(line.id, { unitPrice: Number(e.target.value) })} />
                        )}
                      </td>
                      <td className="text-right erp-line-items-grid__col-pct">
                        {readOnly ? `${line.discountPct}%` : (
                          <input type="number" min={0} max={100} className="erp-line-items-grid__input-num" value={line.discountPct} onChange={(e) => updateLine(line.id, { discountPct: Number(e.target.value) })} />
                        )}
                      </td>
                      {!isOpportunity ? <td className="text-right tabular-nums">{formatCrmCurrency(line.discountAmount)}</td> : null}
                      {!isOpportunity ? <td className="text-right tabular-nums">{formatCrmCurrency(line.taxableValue)}</td> : null}
                      <td className="text-right erp-line-items-grid__col-pct">
                        {readOnly ? `${line.taxPct}%` : (
                          <input type="number" min={0} max={100} className="erp-line-items-grid__input-num" value={line.taxPct} onChange={(e) => updateLine(line.id, { taxPct: Number(e.target.value) })} />
                        )}
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
                            <label className="erp-line-items-grid__detail-field">
                              <span>Description</span>
                              {readOnly ? (
                                <p>{line.description || '—'}</p>
                              ) : (
                                <input className="quo-editor-price__input" value={line.description} onChange={(e) => updateLine(line.id, { description: e.target.value })} />
                              )}
                            </label>
                            <label className="erp-line-items-grid__detail-field">
                              <span>Remarks</span>
                              {readOnly ? (
                                <p>{line.remarks || '—'}</p>
                              ) : (
                                <input className="quo-editor-price__input" value={line.remarks} onChange={(e) => updateLine(line.id, { remarks: e.target.value })} placeholder="Line notes" />
                              )}
                            </label>
                            <label className="erp-line-items-grid__detail-field">
                              <span>Delivery</span>
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
                            <div className="erp-line-items-grid__detail-metrics">
                              <span>Taxable {formatCrmCurrency(line.taxableValue)}</span>
                              <span>GST {formatCrmCurrency(line.gstAmount)}</span>
                              <span>Disc {formatCrmCurrency(line.discountAmount)}</span>
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
            multiItem && 'erp-line-items-grid__totals--panel',
          )}
          aria-label="Line item totals"
        >
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
        </div>
      ) : null}
    </div>
  )
}
