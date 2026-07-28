import { useState, type ReactNode } from 'react'
import { ClipboardList, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import type { OpportunityLine } from '../../types/crm'
import { ErpSmartSelect, type ErpSmartSelectOption } from './ErpSmartSelect'
import { ErpCardSection } from './card-form/ErpCardSection'
import { Input } from '../forms/Inputs'
import { formatCurrency } from '../../utils/formatters/currency'
import {
  buildOpportunityLineFromItem,
  calcProductPricingSummary,
  createEmptyOpportunityLine,
  opportunityLineUnitPriceDomId,
  opportunityLineUnitPriceFieldKey,
  syncOpportunityLines,
  UNIT_PRICE_REQUIRED_MESSAGE,
  type OrderDiscountMode,
  type ProductPricingAdjustments,
} from '../../utils/opportunityLineCalc'
import type { ProductMasterPick } from '../../utils/opportunityProductOptions'
import { isItemSellable, itemNotSellableForSalesMessage } from '../../utils/opportunityItemOptions'
import { notify } from '../../store/toastStore'
import { cn } from '../../utils/cn'

export const PRODUCT_PRICING_GST_RATES = [0, 5, 12, 18, 28] as const

export interface ErpProductPricingPanelProps {
  lines: OpportunityLine[]
  onChange: (lines: OpportunityLine[]) => void
  productOptions: ErpSmartSelectOption<string>[]
  productPickMap: Map<string, ProductMasterPick>
  rowErrors?: Record<string, string[]>
  readOnly?: boolean
  /** Show freight + order discount editors (default true). */
  showAdjustments?: boolean
  freightAmount?: number
  onFreightChange?: (amount: number) => void
  orderDiscountMode?: OrderDiscountMode
  onOrderDiscountModeChange?: (mode: OrderDiscountMode) => void
  orderDiscountInput?: number
  onOrderDiscountInputChange?: (value: number) => void
  /** Legacy quotation add-ons (shown in summary; editable when callbacks provided). */
  installationAmount?: number
  onInstallationChange?: (amount: number) => void
  customCharges?: number
  onCustomChargesChange?: (amount: number) => void
  className?: string
}

export interface ErpProductPricingSectionProps extends ErpProductPricingPanelProps {
  sectionId?: string
  nbaTarget?: string
  forceOpenKey?: number
  title?: string
  subtitle?: string
  accent?: 'blue' | 'teal' | 'green' | 'violet' | 'amber' | 'slate'
  /** Extra content below the pricing panel (e.g. scope notes). */
  children?: ReactNode
  /** When false, render panel only (caller supplies the card). Default true. */
  wrapInSection?: boolean
  sectionClassName?: string
}

export function ErpProductPricingPanel({
  lines,
  onChange,
  productOptions,
  productPickMap,
  rowErrors = {},
  readOnly,
  showAdjustments = true,
  freightAmount: freightProp,
  onFreightChange,
  orderDiscountMode: discountModeProp,
  onOrderDiscountModeChange,
  orderDiscountInput: discountInputProp,
  onOrderDiscountInputChange,
  installationAmount: installationProp,
  onInstallationChange,
  customCharges: customProp,
  onCustomChargesChange,
  className,
}: ErpProductPricingPanelProps) {
  const [localFreight, setLocalFreight] = useState(0)
  const [localDiscountMode, setLocalDiscountMode] = useState<OrderDiscountMode>('flat')
  const [localDiscountInput, setLocalDiscountInput] = useState(0)
  const [localInstallation, setLocalInstallation] = useState(0)
  const [localCustom, setLocalCustom] = useState(0)

  const freightAmount = freightProp ?? localFreight
  const orderDiscountMode = discountModeProp ?? localDiscountMode
  const orderDiscountInput = discountInputProp ?? localDiscountInput
  const installationAmount = installationProp ?? localInstallation
  const customCharges = customProp ?? localCustom

  const setFreight = (n: number) => {
    const next = Math.max(0, n)
    if (onFreightChange) onFreightChange(next)
    else setLocalFreight(next)
  }
  const setDiscountMode = (mode: OrderDiscountMode) => {
    if (onOrderDiscountModeChange) onOrderDiscountModeChange(mode)
    else setLocalDiscountMode(mode)
  }
  const setDiscountInput = (n: number) => {
    if (onOrderDiscountInputChange) onOrderDiscountInputChange(n)
    else setLocalDiscountInput(n)
  }
  const setInstallation = (n: number) => {
    const next = Math.max(0, n)
    if (onInstallationChange) onInstallationChange(next)
    else setLocalInstallation(next)
  }
  const setCustom = (n: number) => {
    const next = Math.max(0, n)
    if (onCustomChargesChange) onCustomChargesChange(next)
    else setLocalCustom(next)
  }

  const synced = syncOpportunityLines(lines)
  const adjustments: ProductPricingAdjustments = {
    freightAmount,
    orderDiscountMode,
    orderDiscountInput,
    installationAmount,
    customCharges,
  }
  const orderSummary = calcProductPricingSummary(synced, adjustments)

  function commit(next: OpportunityLine[]) {
    onChange(syncOpportunityLines(next))
  }

  function updateLine(id: string, patch: Partial<OpportunityLine>) {
    commit(synced.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function addLine() {
    commit([...synced, createEmptyOpportunityLine(synced.length + 1)])
  }

  function removeLine(id: string) {
    if (synced.length <= 1) {
      commit([createEmptyOpportunityLine(1)])
      return
    }
    commit(synced.filter((l) => l.id !== id))
  }

  function selectItem(lineId: string, itemId: string) {
    if (!itemId) return
    const pick = productPickMap.get(itemId)
    if (!pick) return
    if (!isItemSellable(pick.item)) {
      notify.warning(itemNotSellableForSalesMessage(pick.item))
      return
    }
    const idx = synced.findIndex((l) => l.id === lineId)
    const built = buildOpportunityLineFromItem(pick.item, pick.uomName, idx + 1)
    updateLine(lineId, built)
  }

  const showLegacyCharges =
    Boolean(onInstallationChange || onCustomChargesChange)
    || installationAmount > 0
    || customCharges > 0

  return (
    <div className={cn('so-pricing-panel so-pricing-panel--pro', className)}>
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
            {!readOnly ? <col className="so-pricing-col-action" /> : null}
          </colgroup>
          <thead>
            <tr>
              <th className="so-pricing-th so-pricing-th--center">#</th>
              <th className="so-pricing-th">Item</th>
              <th className="so-pricing-th so-pricing-th--right">Qty</th>
              <th className="so-pricing-th so-pricing-th--right">Unit price</th>
              <th className="so-pricing-th so-pricing-th--right">Disc %</th>
              <th className="so-pricing-th so-pricing-th--right">GST %</th>
              <th className="so-pricing-th so-pricing-th--right so-pricing-th--calc">Taxable</th>
              <th className="so-pricing-th so-pricing-th--right so-pricing-th--calc">GST</th>
              <th className="so-pricing-th so-pricing-th--right so-pricing-th--calc">Line total</th>
              {!readOnly ? <th className="so-pricing-th so-pricing-th--center" aria-label="Actions" /> : null}
            </tr>
          </thead>
          <tbody>
            {synced.map((line, idx) => {
              const errs = rowErrors[line.id] ?? []
              const unitPriceError = errs.find((e) => /unit price/i.test(e))
                ?? (errs.some((e) => e === UNIT_PRICE_REQUIRED_MESSAGE) ? UNIT_PRICE_REQUIRED_MESSAGE : undefined)
              const productColumnErrors = errs.filter((e) => !/unit price/i.test(e))
              const pick = line.itemId ? productPickMap.get(line.itemId) : undefined
              const item = pick?.item
              return (
                <tr key={line.id} className="so-pricing-row">
                  <td className="so-pricing-td so-pricing-td--center tabular-nums text-erp-muted">
                    {idx + 1}
                  </td>
                  <td className="so-pricing-td so-pricing-td--product">
                    {readOnly ? (
                      <p className="text-[13px] font-medium text-erp-text">{line.productOrItem || '—'}</p>
                    ) : (
                      <ErpSmartSelect
                        options={productOptions}
                        value={line.itemId ?? ''}
                        onChange={(id) => selectItem(line.id, id)}
                        placeholder="Select sellable item…"
                        appearance="dropdown"
                        dropdownMinWidth={360}
                        emptyMessage="No sellable items match. Enable Sales allowed on the Item master."
                      />
                    )}
                    {item && !isItemSellable(item) ? (
                      <p className="so-pricing-warn">
                        <ShieldAlert className="h-3 w-3" /> {itemNotSellableForSalesMessage(item)}
                      </p>
                    ) : null}
                    {productColumnErrors.length ? (
                      <p className="so-pricing-warn">{productColumnErrors.join(' · ')}</p>
                    ) : null}
                  </td>
                  <td className="so-pricing-td">
                    {readOnly ? (
                      <span className="tabular-nums">{line.qty}</span>
                    ) : (
                      <Input
                        type="number"
                        min={1}
                        className="so-pricing-input so-pricing-input--num"
                        value={line.qty}
                        onChange={(e) => updateLine(line.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
                        aria-label="Quantity"
                        data-field={`qty-${line.id}`}
                      />
                    )}
                  </td>
                  <td className="so-pricing-td">
                    {readOnly ? (
                      <span className="tabular-nums">{formatCurrency(line.unitPrice)}</span>
                    ) : (
                      <Input
                        id={opportunityLineUnitPriceDomId(line.id)}
                        data-field={opportunityLineUnitPriceFieldKey(line.id)}
                        type="number"
                        min={0}
                        className={cn(
                          'so-pricing-input so-pricing-input--num',
                          unitPriceError && 'border-red-400',
                        )}
                        value={line.unitPrice}
                        onChange={(e) => updateLine(line.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                        aria-label="Unit price"
                        aria-invalid={Boolean(unitPriceError)}
                      />
                    )}
                    {unitPriceError ? (
                      <p className="so-pricing-warn">{UNIT_PRICE_REQUIRED_MESSAGE}</p>
                    ) : null}
                  </td>
                  <td className="so-pricing-td">
                    {readOnly ? (
                      <span className="tabular-nums">{line.discountPct}</span>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="so-pricing-input so-pricing-input--num"
                        value={line.discountPct}
                        onChange={(e) => updateLine(line.id, { discountPct: Math.max(0, Number(e.target.value) || 0) })}
                        aria-label="Discount percent"
                      />
                    )}
                  </td>
                  <td className="so-pricing-td">
                    {readOnly ? (
                      <span className="tabular-nums">{line.taxPct}%</span>
                    ) : (
                      <select
                        className="erp-input so-pricing-input so-pricing-input--select"
                        value={line.taxPct}
                        onChange={(e) => updateLine(line.id, { taxPct: Number(e.target.value) })}
                        aria-label="GST percent"
                      >
                        {PRODUCT_PRICING_GST_RATES.map((rate) => (
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
                        onClick={() => removeLine(line.id)}
                        aria-label="Remove line"
                        disabled={synced.length <= 1}
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
            <span className="so-pricing-toolbar__count">{synced.length}</span>
            {' '}line{synced.length === 1 ? '' : 's'} · qty, price & GST edit inline
          </p>
        </div>
      ) : (
        <div className="so-pricing-toolbar">
          <p className="so-pricing-toolbar__hint">
            <span className="so-pricing-toolbar__count">{synced.length}</span>
            {' '}line{synced.length === 1 ? '' : 's'}
          </p>
        </div>
      )}

      {showAdjustments ? (
        <div className="so-pricing-totals">
          <div className="so-pricing-adjust">
            <p className="so-pricing-adjust__title">Order adjustments</p>
            <div className="so-pricing-charges">
              <label className="so-pricing-charge">
                <span className="so-pricing-charge__label">Freight</span>
                <div className="so-pricing-charge__control">
                  <span className="so-pricing-charge__prefix" aria-hidden>₹</span>
                  <Input
                    type="number"
                    min={0}
                    className="so-pricing-input so-pricing-input--num"
                    value={freightAmount}
                    onChange={(e) => setFreight(Number(e.target.value) || 0)}
                    disabled={readOnly}
                    aria-label="Freight"
                  />
                </div>
              </label>
              <div className="so-pricing-charge">
                <div className="so-pricing-charge__label-row">
                  <span className="so-pricing-charge__label">Order discount</span>
                  {!readOnly ? (
                    <div className="so-pricing-discount-mode" role="group" aria-label="Discount type">
                      <button
                        type="button"
                        className={`so-pricing-discount-mode__btn${orderDiscountMode === 'flat' ? ' so-pricing-discount-mode__btn--active' : ''}`}
                        aria-pressed={orderDiscountMode === 'flat'}
                        onClick={() => {
                          if (orderDiscountMode === 'flat') return
                          setDiscountMode('flat')
                          setDiscountInput(0)
                        }}
                      >
                        Flat ₹
                      </button>
                      <button
                        type="button"
                        className={`so-pricing-discount-mode__btn${orderDiscountMode === 'percent' ? ' so-pricing-discount-mode__btn--active' : ''}`}
                        aria-pressed={orderDiscountMode === 'percent'}
                        onClick={() => {
                          if (orderDiscountMode === 'percent') return
                          setDiscountMode('percent')
                          setDiscountInput(0)
                        }}
                      >
                        % Discount
                      </button>
                    </div>
                  ) : null}
                </div>
                <label className="so-pricing-charge__control">
                  <span className="so-pricing-charge__prefix" aria-hidden>
                    {orderDiscountMode === 'percent' ? '%' : '₹'}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={orderDiscountMode === 'percent' ? 100 : undefined}
                    step={orderDiscountMode === 'percent' ? 0.5 : 1}
                    className="so-pricing-input so-pricing-input--num"
                    value={orderDiscountInput}
                    onChange={(e) => {
                      const raw = Math.max(0, Number(e.target.value) || 0)
                      setDiscountInput(orderDiscountMode === 'percent' ? Math.min(100, raw) : raw)
                    }}
                    disabled={readOnly}
                    aria-label={orderDiscountMode === 'percent' ? 'Order discount percent' : 'Order discount amount'}
                  />
                </label>
                {orderDiscountMode === 'percent' && orderDiscountInput > 0 ? (
                  <p className="so-pricing-charge__hint">
                    Equals {formatCurrency(orderSummary.orderDiscountAmount)} off taxable + GST
                  </p>
                ) : null}
              </div>
              {showLegacyCharges ? (
                <>
                  <label className="so-pricing-charge">
                    <span className="so-pricing-charge__label">Installation</span>
                    <div className="so-pricing-charge__control">
                      <span className="so-pricing-charge__prefix" aria-hidden>₹</span>
                      <Input
                        type="number"
                        min={0}
                        className="so-pricing-input so-pricing-input--num"
                        value={installationAmount}
                        onChange={(e) => setInstallation(Number(e.target.value) || 0)}
                        disabled={readOnly || !onInstallationChange}
                        aria-label="Installation"
                      />
                    </div>
                  </label>
                  <label className="so-pricing-charge">
                    <span className="so-pricing-charge__label">Other charges</span>
                    <div className="so-pricing-charge__control">
                      <span className="so-pricing-charge__prefix" aria-hidden>₹</span>
                      <Input
                        type="number"
                        min={0}
                        className="so-pricing-input so-pricing-input--num"
                        value={customCharges}
                        onChange={(e) => setCustom(Number(e.target.value) || 0)}
                        disabled={readOnly || !onCustomChargesChange}
                        aria-label="Other charges"
                      />
                    </div>
                  </label>
                </>
              ) : null}
            </div>
          </div>

          <aside className="so-pricing-summary" aria-label="Order summary">
            <p className="so-pricing-summary__title">Order summary</p>
            <div className="so-pricing-summary__rows">
              <div className="so-pricing-summary__row">
                <span>Total quantity</span>
                <span className="tabular-nums">{orderSummary.totalQty}</span>
              </div>
              <div className="so-pricing-summary__row">
                <span>Basic amount</span>
                <span className="tabular-nums">{formatCurrency(orderSummary.basicAmount)}</span>
              </div>
              {orderSummary.totalLineDiscount > 0 ? (
                <div className="so-pricing-summary__row">
                  <span>Line discount</span>
                  <span className="tabular-nums">−{formatCurrency(orderSummary.totalLineDiscount)}</span>
                </div>
              ) : null}
              <div className="so-pricing-summary__row">
                <span>Taxable amount</span>
                <span className="tabular-nums">{formatCurrency(orderSummary.subtotal)}</span>
              </div>
              {[...orderSummary.gstByRate.entries()]
                .sort(([a], [b]) => a - b)
                .map(([rate, amount]) => (
                  <div key={rate} className="so-pricing-summary__row">
                    <span>GST @ {rate}%</span>
                    <span className="tabular-nums">{formatCurrency(amount)}</span>
                  </div>
                ))}
              <div className="so-pricing-summary__row">
                <span>Total GST</span>
                <span className="tabular-nums">{formatCurrency(orderSummary.totalGst)}</span>
              </div>
              <div className="so-pricing-summary__row">
                <span>Freight</span>
                <span className="tabular-nums">{formatCurrency(freightAmount)}</span>
              </div>
              {installationAmount > 0 ? (
                <div className="so-pricing-summary__row">
                  <span>Installation</span>
                  <span className="tabular-nums">{formatCurrency(installationAmount)}</span>
                </div>
              ) : null}
              {customCharges > 0 ? (
                <div className="so-pricing-summary__row">
                  <span>Other charges</span>
                  <span className="tabular-nums">{formatCurrency(customCharges)}</span>
                </div>
              ) : null}
              <div className="so-pricing-summary__row">
                <span>
                  Order discount
                  {orderDiscountMode === 'percent' && orderDiscountInput > 0
                    ? ` (${orderDiscountInput}%)`
                    : ''}
                </span>
                <span className="tabular-nums">
                  {orderSummary.orderDiscountAmount > 0
                    ? `−${formatCurrency(orderSummary.orderDiscountAmount)}`
                    : formatCurrency(0)}
                </span>
              </div>
            </div>
            <div className="so-pricing-summary__grand">
              <span>Grand total</span>
              <strong className="tabular-nums">{formatCurrency(orderSummary.grandTotal)}</strong>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}

export function ErpProductPricingSection({
  sectionId = 'section-products',
  nbaTarget = 'products',
  forceOpenKey,
  title = 'Product & Pricing',
  subtitle = 'Build line items, then review adjustments and the live order total.',
  accent = 'blue',
  children,
  wrapInSection = true,
  sectionClassName,
  ...panelProps
}: ErpProductPricingSectionProps) {
  const panel = <ErpProductPricingPanel {...panelProps} />
  if (!wrapInSection) {
    return (
      <>
        {panel}
        {children}
      </>
    )
  }
  return (
    <ErpCardSection
      id={sectionId}
      nbaTarget={nbaTarget}
      title={title}
      subtitle={subtitle}
      icon={ClipboardList}
      accent={accent}
      collapsible
      defaultOpen
      forceOpenKey={forceOpenKey}
      className={cn('!max-w-none so-pricing-section', sectionClassName)}
      columns={1}
    >
      {panel}
      {children}
    </ErpCardSection>
  )
}
