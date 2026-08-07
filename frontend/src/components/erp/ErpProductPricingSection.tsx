import { useEffect, useRef, useState, type ReactNode } from 'react'
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
  shouldShowTaxUnresolvedWarning,
  syncOpportunityLines,
  UNIT_PRICE_REQUIRED_MESSAGE,
  type OpportunityLineTaxSupply,
  type OrderDiscountMode,
  type ProductPricingAdjustments,
} from '../../utils/opportunityLineCalc'
import type { ProductMasterPick } from '../../utils/opportunityProductOptions'
import { isItemSellable, itemNotSellableForSalesMessage } from '../../utils/opportunityItemOptions'
import { notify } from '../../store/toastStore'
import { useMasterStore } from '../../store/masterStore'
import { useTenantProfileStore } from '../../store/tenantProfileStore'
import { cn } from '../../utils/cn'
import { resolveCommercialLineTax } from '../../utils/commercialLineTax'
import {
  ChargeEditor,
  OrderAdjustmentsPanel,
  PRODUCT_PRICING_GST_RATES,
} from './OrderAdjustmentsGrid'

export { PRODUCT_PRICING_GST_RATES } from './OrderAdjustmentsGrid'
export { ChargeEditor, ModeToggle, OrderAdjustmentsPanel } from './OrderAdjustmentsGrid'

export type ChargeTaxability = 'taxable' | 'non_taxable'

export interface AdjustmentFieldState {
  mode: OrderDiscountMode
  value: number
  isTaxable: boolean
  taxRate: number
}

export interface ErpProductPricingPanelProps {
  lines: OpportunityLine[]
  onChange: (lines: OpportunityLine[]) => void
  productOptions: ErpSmartSelectOption<string>[]
  productPickMap: Map<string, ProductMasterPick>
  rowErrors?: Record<string, string[]>
  readOnly?: boolean
  /** Show freight + order discount + charge editors (default true). */
  showAdjustments?: boolean
  /** When false, hide installation / other (default true for full quotation). */
  showExtendedCharges?: boolean
  /**
   * Seller LE + customer/POS — drives IGST vs CGST+SGST on item tax resolve.
   * When omitted, scheme defaults to intra-state (same as missing-state resolve).
   */
  companyState?: string | null
  companyStateCode?: string | null
  companyGstin?: string | null
  partyState?: string | null
  partyGstin?: string | null
  placeOfSupply?: string | null

  freightAmount?: number
  onFreightChange?: (amount: number) => void
  freightMode?: OrderDiscountMode
  onFreightModeChange?: (mode: OrderDiscountMode) => void
  freightValue?: number
  onFreightValueChange?: (value: number) => void
  freightIsTaxable?: boolean
  onFreightIsTaxableChange?: (v: boolean) => void
  freightTaxRate?: number
  onFreightTaxRateChange?: (rate: number) => void

  orderDiscountMode?: OrderDiscountMode
  onOrderDiscountModeChange?: (mode: OrderDiscountMode) => void
  orderDiscountInput?: number
  onOrderDiscountInputChange?: (value: number) => void

  installationAmount?: number
  onInstallationChange?: (amount: number) => void
  installationMode?: OrderDiscountMode
  onInstallationModeChange?: (mode: OrderDiscountMode) => void
  installationValue?: number
  onInstallationValueChange?: (value: number) => void
  installationIsTaxable?: boolean
  onInstallationIsTaxableChange?: (v: boolean) => void
  installationTaxRate?: number
  onInstallationTaxRateChange?: (rate: number) => void

  customCharges?: number
  onCustomChargesChange?: (amount: number) => void
  customChargesMode?: OrderDiscountMode
  onCustomChargesModeChange?: (mode: OrderDiscountMode) => void
  customChargesValue?: number
  onCustomChargesValueChange?: (value: number) => void
  customChargesIsTaxable?: boolean
  onCustomChargesIsTaxableChange?: (v: boolean) => void
  customChargesTaxRate?: number
  onCustomChargesTaxRateChange?: (rate: number) => void

  className?: string
}

export interface ErpProductPricingSectionProps extends ErpProductPricingPanelProps {
  sectionId?: string
  nbaTarget?: string
  forceOpenKey?: number
  title?: string
  subtitle?: string
  accent?: 'blue' | 'teal' | 'green' | 'violet' | 'amber' | 'slate'
  children?: ReactNode
  wrapInSection?: boolean
  sectionClassName?: string
  defaultOpen?: boolean
}

export function ErpProductPricingPanel({
  lines,
  onChange,
  productOptions,
  productPickMap,
  rowErrors = {},
  readOnly,
  showAdjustments = true,
  showExtendedCharges = true,
  companyState,
  companyStateCode,
  companyGstin,
  partyState,
  partyGstin,
  placeOfSupply,
  freightAmount: freightAmountProp,
  onFreightChange,
  freightMode: freightModeProp,
  onFreightModeChange,
  freightValue: freightValueProp,
  onFreightValueChange,
  freightIsTaxable: freightTaxableProp,
  onFreightIsTaxableChange,
  freightTaxRate: freightTaxRateProp,
  onFreightTaxRateChange,
  orderDiscountMode: discountModeProp,
  onOrderDiscountModeChange,
  orderDiscountInput: discountInputProp,
  onOrderDiscountInputChange,
  installationAmount: installationAmountProp,
  onInstallationChange,
  installationMode: installModeProp,
  onInstallationModeChange,
  installationValue: installValueProp,
  onInstallationValueChange,
  installationIsTaxable: installTaxableProp,
  onInstallationIsTaxableChange,
  installationTaxRate: installTaxRateProp,
  onInstallationTaxRateChange,
  customCharges: customAmountProp,
  onCustomChargesChange,
  customChargesMode: customModeProp,
  onCustomChargesModeChange,
  customChargesValue: customValueProp,
  onCustomChargesValueChange,
  customChargesIsTaxable: customTaxableProp,
  onCustomChargesIsTaxableChange,
  customChargesTaxRate: customTaxRateProp,
  onCustomChargesTaxRateChange,
  className,
}: ErpProductPricingPanelProps) {
  /** Freight is manufacturing-oriented; hide for SERVICES packaging (e.g. Kology). */
  const showFreight = !useTenantProfileStore((s) => s.isServices())
  const [localFreightMode, setLocalFreightMode] = useState<OrderDiscountMode>('flat')
  const [localFreightValue, setLocalFreightValue] = useState(0)
  const [localFreightTaxable, setLocalFreightTaxable] = useState(false)
  const [localFreightTaxRate, setLocalFreightTaxRate] = useState(18)
  const [localDiscountMode, setLocalDiscountMode] = useState<OrderDiscountMode>('flat')
  const [localDiscountInput, setLocalDiscountInput] = useState(0)
  const [localInstallMode, setLocalInstallMode] = useState<OrderDiscountMode>('flat')
  const [localInstallValue, setLocalInstallValue] = useState(0)
  const [localInstallTaxable, setLocalInstallTaxable] = useState(false)
  const [localInstallTaxRate, setLocalInstallTaxRate] = useState(18)
  const [localCustomMode, setLocalCustomMode] = useState<OrderDiscountMode>('flat')
  const [localCustomValue, setLocalCustomValue] = useState(0)
  const [localCustomTaxable, setLocalCustomTaxable] = useState(false)
  const [localCustomTaxRate, setLocalCustomTaxRate] = useState(18)

  const freightMode = freightModeProp ?? localFreightMode
  const freightValue =
    freightValueProp ??
    (freightAmountProp != null && freightModeProp == null ? freightAmountProp : localFreightValue)
  const freightIsTaxable = freightTaxableProp ?? localFreightTaxable
  const freightTaxRate = freightTaxRateProp ?? localFreightTaxRate

  const orderDiscountMode = discountModeProp ?? localDiscountMode
  const orderDiscountInput = discountInputProp ?? localDiscountInput

  const installationMode = installModeProp ?? localInstallMode
  const installationValue =
    installValueProp ??
    (installationAmountProp != null && installModeProp == null ? installationAmountProp : localInstallValue)
  const installationIsTaxable = installTaxableProp ?? localInstallTaxable
  const installationTaxRate = installTaxRateProp ?? localInstallTaxRate

  const customChargesMode = customModeProp ?? localCustomMode
  const customChargesValue =
    customValueProp ??
    (customAmountProp != null && customModeProp == null ? customAmountProp : localCustomValue)
  const customChargesIsTaxable = customTaxableProp ?? localCustomTaxable
  const customChargesTaxRate = customTaxRateProp ?? localCustomTaxRate

  const setFreightMode = (mode: OrderDiscountMode) => {
    if (onFreightModeChange) onFreightModeChange(mode)
    else setLocalFreightMode(mode)
  }

  const synced = syncOpportunityLines(lines)
  const adjustments: ProductPricingAdjustments = {
    orderDiscountMode,
    orderDiscountInput,
    freight: {
      calculationType: freightMode,
      value: freightValue,
      isTaxable: freightIsTaxable,
      taxRate: freightTaxRate,
    },
    installation: {
      calculationType: installationMode,
      value: installationValue,
      isTaxable: installationIsTaxable,
      taxRate: installationTaxRate,
    },
    otherCharges: {
      calculationType: customChargesMode,
      value: customChargesValue,
      isTaxable: customChargesIsTaxable,
      taxRate: customChargesTaxRate,
    },
  }
  const orderSummary = calcProductPricingSummary(synced, adjustments)

  /**
   * Always patch against the latest lines. Async tax resolve used to close over
   * render-time `synced` and re-commit a blank draft after item pick — looking like
   * “select does nothing” on Lead/Opportunity product grids.
   */
  const linesRef = useRef(synced)
  linesRef.current = synced

  const taxSupply: OpportunityLineTaxSupply = {
    companyState,
    companyStateCode,
    companyGstin,
    partyState,
    partyGstin,
    placeOfSupply,
  }
  const taxSupplyKey = [
    companyState ?? '',
    companyStateCode ?? '',
    companyGstin ?? '',
    partyState ?? '',
    partyGstin ?? '',
    placeOfSupply ?? '',
  ].join('|')
  const taxSupplyRef = useRef(taxSupply)
  taxSupplyRef.current = taxSupply

  function commit(next: OpportunityLine[]) {
    const normalized = syncOpportunityLines(next)
    linesRef.current = normalized
    onChange(normalized)
  }

  function updateLine(id: string, patch: Partial<OpportunityLine>) {
    const base = syncOpportunityLines(linesRef.current)
    commit(base.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function addLine() {
    const base = syncOpportunityLines(linesRef.current)
    commit([...base, createEmptyOpportunityLine(base.length + 1)])
  }

  function removeLine(id: string) {
    const base = syncOpportunityLines(linesRef.current)
    if (base.length <= 1) {
      commit([createEmptyOpportunityLine(1)])
      return
    }
    commit(base.filter((l) => l.id !== id))
  }

  function masterTaxHelpers() {
    const store = useMasterStore.getState()
    return {
      hsnById: (hid: string) => store.getHsn(hid),
      hsnByCode: (code: string) => store.getHsnByCode(code),
      gstRates: store.gstRates,
    }
  }

  function selectItem(lineId: string, itemId: string) {
    const base = syncOpportunityLines(linesRef.current)
    // Clear product → blank draft (must not show “Tax unresolved”).
    if (!itemId) {
      const idx = base.findIndex((l) => l.id === lineId)
      updateLine(lineId, createEmptyOpportunityLine(idx >= 0 ? idx + 1 : 1, { id: lineId }))
      return
    }
    const pick = productPickMap.get(itemId)
    if (!pick) return
    if (!isItemSellable(pick.item)) {
      notify.warning(itemNotSellableForSalesMessage(pick.item))
      return
    }
    const idx = base.findIndex((l) => l.id === lineId)
    const supply = taxSupplyRef.current
    const built = buildOpportunityLineFromItem(pick.item, pick.uomName, idx + 1, supply)
    // Keep stable row id so async tax resolve can still patch this line.
    updateLine(lineId, { ...built, id: lineId })
    if (built.taxUnresolved) {
      notify.warning(
        built.hsnCode
          ? `GST unresolved for HSN ${built.hsnCode} — configure GST rate master or fix item tax group`
          : 'GST unresolved — set HSN and GST group on Item master',
      )
    }
    // Dual-mode: re-resolve via API/local masters with full seller+party+POS context.
    void resolveCommercialLineTax({
      direction: 'SALES',
      item: pick.item,
      ...supply,
      ...masterTaxHelpers(),
    }).then((snap) => {
      if (snap.resolved) {
        updateLine(lineId, {
          taxPct: snap.taxPct,
          hsnCode: snap.hsnSacCode,
          taxScheme: snap.taxScheme,
          taxSource: snap.source,
          taxUnresolved: false,
          cgstRate: snap.cgstRate,
          sgstRate: snap.sgstRate,
          igstRate: snap.igstRate,
        })
      } else if (snap.blockers.length) {
        updateLine(lineId, {
          taxUnresolved: true,
          taxSource: 'UNRESOLVED',
          hsnCode: snap.hsnSacCode || built.hsnCode,
        })
      }
    })
  }

  // Re-resolve line schemes when seller LE, customer state/GSTIN, or POS changes.
  useEffect(() => {
    if (readOnly) return
    let cancelled = false
    const base = syncOpportunityLines(linesRef.current)
    const targets = base.filter((l) => l.itemId)
    if (!targets.length) return

    void (async () => {
      const supply = taxSupplyRef.current
      const helpers = masterTaxHelpers()
      const nextMap = new Map<string, Partial<OpportunityLine>>()
      await Promise.all(
        targets.map(async (line) => {
          const pick = productPickMap.get(line.itemId!)
          if (!pick?.item) return
          const snap = await resolveCommercialLineTax({
            direction: 'SALES',
            item: pick.item,
            ...supply,
            ...helpers,
          })
          if (!snap.resolved) {
            nextMap.set(line.id, {
              taxUnresolved: true,
              taxSource: 'UNRESOLVED',
              hsnCode: snap.hsnSacCode || line.hsnCode,
            })
            return
          }
          if (
            line.taxPct === snap.taxPct &&
            line.taxScheme === snap.taxScheme &&
            line.cgstRate === snap.cgstRate &&
            line.sgstRate === snap.sgstRate &&
            line.igstRate === snap.igstRate &&
            !line.taxUnresolved
          ) {
            return
          }
          nextMap.set(line.id, {
            taxPct: snap.taxPct,
            hsnCode: snap.hsnSacCode || line.hsnCode,
            taxScheme: snap.taxScheme,
            taxSource: snap.source,
            taxUnresolved: false,
            cgstRate: snap.cgstRate,
            sgstRate: snap.sgstRate,
            igstRate: snap.igstRate,
          })
        }),
      )
      if (cancelled || nextMap.size === 0) return
      const latest = syncOpportunityLines(linesRef.current)
      commit(
        latest.map((l) => {
          const patch = nextMap.get(l.id)
          return patch ? { ...l, ...patch } : l
        }),
      )
    })()

    return () => {
      cancelled = true
    }
    // productPickMap identity is stable enough when items already selected; supply drives re-resolve.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional supply fingerprint only
  }, [taxSupplyKey])

  const showCharges = showExtendedCharges

  return (
    <div className={cn('so-pricing-panel so-pricing-panel--pro', className)}>
      <div className="so-pricing-table-wrap">
        <table className="so-pricing-table">
          <colgroup>
            <col className="so-pricing-col-idx" />
            <col className="so-pricing-col-product" />
            <col className="so-pricing-col-hsn" />
            <col className="so-pricing-col-qty" />
            <col className="so-pricing-col-price" />
            <col className="so-pricing-col-disc" />
            <col className="so-pricing-col-gst" />
            <col className="so-pricing-col-money" />
            <col className="so-pricing-col-money" />
            <col className="so-pricing-col-money-wide" />
            {!readOnly ? <col className="so-pricing-col-action" /> : null}
          </colgroup>
          <thead>
            <tr>
              <th className="so-pricing-th so-pricing-th--center">#</th>
              <th className="so-pricing-th">Item</th>
              <th className="so-pricing-th">HSN</th>
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
                      <p className="text-[13px] font-medium text-erp-text">
                        {item
                          ? (item.itemCode ? `${item.itemCode} — ${item.itemName}` : item.itemName)
                          : (line.itemCode?.trim()
                            ? (line.productOrItem?.trim() && line.productOrItem !== line.itemCode
                              ? `${line.itemCode} — ${line.productOrItem}`
                              : line.itemCode)
                            : (line.productOrItem || '-'))}
                      </p>
                    ) : (
                      <ErpSmartSelect
                        options={productOptions}
                        value={line.itemId ?? ''}
                        onChange={(id) => selectItem(line.id, id ?? '')}
                        placeholder="Select sellable item…"
                        appearance="dropdown"
                        allowEmpty
                        dropdownMinWidth={440}
                        emptyMessage="No sellable items match. Enable Sales allowed on the Item master."
                        resolveOrphanLabel={(id) => {
                          const orphan = productPickMap.get(id)?.item
                          if (orphan) {
                            return orphan.itemCode
                              ? `${orphan.itemCode} — ${orphan.itemName}`
                              : orphan.itemName
                          }
                          // Prefer line snapshots over raw UUID display
                          if (line.itemId === id) {
                            if (line.itemCode?.trim()) {
                              return line.productOrItem?.trim() && line.productOrItem !== line.itemCode
                                ? `${line.itemCode} — ${line.productOrItem}`
                                : line.itemCode
                            }
                            if (line.productOrItem?.trim() && !/^[0-9a-f-]{32,36}$/i.test(line.productOrItem.trim())) {
                              return line.productOrItem.trim()
                            }
                          }
                          return undefined
                        }}
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
                    {shouldShowTaxUnresolvedWarning(line) ? (
                      <p className="so-pricing-warn">Tax unresolved — set Item HSN / GST group / rate masters</p>
                    ) : null}
                  </td>
                  <td className="so-pricing-td tabular-nums text-[12px] text-erp-muted">
                    {line.hsnCode || item?.hsnCode || '-'}
                        {line.taxScheme ? (
                      <div className="text-[10px] uppercase tracking-wide">
                        {line.taxScheme === 'igst' ? 'IGST' : line.taxScheme === 'utgst_pair' ? 'CGST+UTGST' : 'CGST+SGST'}
                      </div>
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
                      <span className="tabular-nums">
                        {line.taxPct}%
                        {line.taxSource === 'MASTER' ? (
                          <span className="ml-1 text-[10px] text-erp-muted">master</span>
                        ) : null}
                      </span>
                    ) : (
                      <select
                        className="erp-input so-pricing-input so-pricing-input--select"
                        value={
                          PRODUCT_PRICING_GST_RATES.includes(line.taxPct as (typeof PRODUCT_PRICING_GST_RATES)[number])
                            ? line.taxPct
                            : line.taxPct
                        }
                        onChange={(e) =>
                          updateLine(line.id, {
                            taxPct: Number(e.target.value),
                            taxSource: 'OVERRIDE',
                            taxUnresolved: false,
                          })
                        }
                        aria-label="GST percent (from tax master; change only to override)"
                        title={
                          line.taxSource === 'MASTER'
                            ? 'Rate from GST tax master — changing marks as override'
                            : shouldShowTaxUnresolvedWarning(line)
                              ? 'Unresolved tax — fix item masters or set rate deliberately'
                              : undefined
                        }
                      >
                        {!PRODUCT_PRICING_GST_RATES.includes(line.taxPct as (typeof PRODUCT_PRICING_GST_RATES)[number]) ? (
                          <option value={line.taxPct}>{line.taxPct}%</option>
                        ) : null}
                        {PRODUCT_PRICING_GST_RATES.map((rate) => (
                          <option key={rate} value={rate}>
                            {rate}%
                          </option>
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
        <div className="so-pricing-totals so-direct-order-summary">
          <OrderAdjustmentsPanel>
              <ChargeEditor
                label="Order discount"
                mode={orderDiscountMode}
                value={orderDiscountInput}
                calculatedAmount={orderSummary.orderDiscountAmount}
                isTaxable={false}
                taxRate={0}
                readOnly={readOnly}
                modePctLabel="% Disc."
                amountHint={
                  orderSummary.orderDiscountAmount > 0
                    ? 'off taxable (before GST)'
                    : undefined
                }
                onModeChange={(m) => {
                  if (onOrderDiscountModeChange) onOrderDiscountModeChange(m)
                  else setLocalDiscountMode(m)
                  if (onOrderDiscountInputChange) onOrderDiscountInputChange(0)
                  else setLocalDiscountInput(0)
                }}
                onValueChange={(n) => {
                  if (onOrderDiscountInputChange) onOrderDiscountInputChange(n)
                  else setLocalDiscountInput(n)
                }}
              />

              {showFreight ? (
                <ChargeEditor
                  label="Freight"
                  mode={freightMode}
                  value={freightValue}
                  calculatedAmount={orderSummary.freightAmount}
                  isTaxable={freightIsTaxable}
                  taxRate={freightTaxRate}
                  readOnly={readOnly}
                  showTax
                  onModeChange={(m) => {
                    setFreightMode(m)
                    const zero = 0
                    if (onFreightValueChange) onFreightValueChange(zero)
                    else setLocalFreightValue(zero)
                    if (onFreightChange) onFreightChange(0)
                  }}
                  onValueChange={(n) => {
                    if (onFreightValueChange) onFreightValueChange(n)
                    else setLocalFreightValue(n)
                    if (onFreightChange && freightMode === 'flat') onFreightChange(n)
                  }}
                  onIsTaxableChange={(v) => {
                    if (onFreightIsTaxableChange) onFreightIsTaxableChange(v)
                    else setLocalFreightTaxable(v)
                  }}
                  onTaxRateChange={(r) => {
                    if (onFreightTaxRateChange) onFreightTaxRateChange(r)
                    else setLocalFreightTaxRate(r)
                  }}
                />
              ) : null}

              {showCharges ? (
                <>
                  <ChargeEditor
                    label="Installation"
                    mode={installationMode}
                    value={installationValue}
                    calculatedAmount={orderSummary.installationAmount}
                    isTaxable={installationIsTaxable}
                    taxRate={installationTaxRate}
                    readOnly={readOnly}
                    showTax
                    onModeChange={(m) => {
                      if (onInstallationModeChange) onInstallationModeChange(m)
                      else setLocalInstallMode(m)
                      if (onInstallationValueChange) onInstallationValueChange(0)
                      else setLocalInstallValue(0)
                      if (onInstallationChange) onInstallationChange(0)
                    }}
                    onValueChange={(n) => {
                      if (onInstallationValueChange) onInstallationValueChange(n)
                      else setLocalInstallValue(n)
                      if (onInstallationChange && installationMode === 'flat') onInstallationChange(n)
                    }}
                    onIsTaxableChange={(v) => {
                      if (onInstallationIsTaxableChange) onInstallationIsTaxableChange(v)
                      else setLocalInstallTaxable(v)
                    }}
                    onTaxRateChange={(r) => {
                      if (onInstallationTaxRateChange) onInstallationTaxRateChange(r)
                      else setLocalInstallTaxRate(r)
                    }}
                  />
                  <ChargeEditor
                    label="Other charges"
                    mode={customChargesMode}
                    value={customChargesValue}
                    calculatedAmount={orderSummary.customCharges}
                    isTaxable={customChargesIsTaxable}
                    taxRate={customChargesTaxRate}
                    readOnly={readOnly}
                    showTax
                    onModeChange={(m) => {
                      if (onCustomChargesModeChange) onCustomChargesModeChange(m)
                      else setLocalCustomMode(m)
                      if (onCustomChargesValueChange) onCustomChargesValueChange(0)
                      else setLocalCustomValue(0)
                      if (onCustomChargesChange) onCustomChargesChange(0)
                    }}
                    onValueChange={(n) => {
                      if (onCustomChargesValueChange) onCustomChargesValueChange(n)
                      else setLocalCustomValue(n)
                      if (onCustomChargesChange && customChargesMode === 'flat') onCustomChargesChange(n)
                    }}
                    onIsTaxableChange={(v) => {
                      if (onCustomChargesIsTaxableChange) onCustomChargesIsTaxableChange(v)
                      else setLocalCustomTaxable(v)
                    }}
                    onTaxRateChange={(r) => {
                      if (onCustomChargesTaxRateChange) onCustomChargesTaxRateChange(r)
                      else setLocalCustomTaxRate(r)
                    }}
                  />
                </>
              ) : null}
            </OrderAdjustmentsPanel>

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
                <span className="tabular-nums">{formatCurrency(orderSummary.taxableBeforeOverallDiscount)}</span>
              </div>
              <div className="so-pricing-summary__row">
                <span>
                  Overall discount
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
              {orderSummary.orderDiscountAmount > 0 ? (
                <div className="so-pricing-summary__row">
                  <span>Taxable after discount</span>
                  <span className="tabular-nums">{formatCurrency(orderSummary.taxableAfterOverallDiscount)}</span>
                </div>
              ) : null}
              {orderSummary.freightAmount > 0 ? (
                <div className="so-pricing-summary__row">
                  <span>
                    Freight
                    {freightIsTaxable ? ' (taxable)' : ''}
                    {freightMode === 'percent' && freightValue > 0 ? ` ${freightValue}%` : ''}
                  </span>
                  <span className="tabular-nums">{formatCurrency(orderSummary.freightAmount)}</span>
                </div>
              ) : null}
              {orderSummary.installationAmount > 0 ? (
                <div className="so-pricing-summary__row">
                  <span>
                    Installation
                    {installationIsTaxable ? ' (taxable)' : ''}
                  </span>
                  <span className="tabular-nums">{formatCurrency(orderSummary.installationAmount)}</span>
                </div>
              ) : null}
              {orderSummary.customCharges > 0 ? (
                <div className="so-pricing-summary__row">
                  <span>
                    Other charges
                    {customChargesIsTaxable ? ' (taxable)' : ''}
                  </span>
                  <span className="tabular-nums">{formatCurrency(orderSummary.customCharges)}</span>
                </div>
              ) : null}
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
  defaultOpen = true,
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
      defaultOpen={defaultOpen}
      forceOpenKey={forceOpenKey}
      className={cn('!max-w-none so-pricing-section', sectionClassName)}
      columns={1}
    >
      {panel}
      {children}
    </ErpCardSection>
  )
}
