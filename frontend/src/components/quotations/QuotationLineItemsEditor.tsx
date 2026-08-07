import { useMemo, useState } from 'react'
import type { QuotationPriceLine } from '../../types/crm'
import { ErpProductPricingPanel } from '../erp/ErpProductPricingSection'
import { useMasterStore } from '../../store/masterStore'
import {
  opportunityLinesToQuotationPriceLines,
  quotationPriceLinesToOpportunityLines,
  syncOpportunityLines,
  type OrderDiscountMode,
} from '../../utils/opportunityLineCalc'
import { useProductMasterOptionMap } from '../../utils/opportunityProductOptions'
import {
  calcOrderDocumentTotals,
  adjustmentsFromDocumentFields,
  normalizeCalcType,
} from '../../utils/orderAdjustmentsCalc'

export type AdjustmentCalcTypeUi = 'FLAT' | 'PERCENTAGE'

export interface QuotationLineExtras {
  freightAmount: number
  installationAmount: number
  customCharges: number
  orderDiscountCalcType: AdjustmentCalcTypeUi
  orderDiscountValue: number
  orderDiscountAmount: number
  freightCalcType: AdjustmentCalcTypeUi
  freightValue: number
  freightIsTaxable: boolean
  freightTaxRate: number
  freightTaxAmount: number
  installationCalcType: AdjustmentCalcTypeUi
  installationValue: number
  installationIsTaxable: boolean
  installationTaxRate: number
  installationTaxAmount: number
  customChargesCalcType: AdjustmentCalcTypeUi
  customChargesValue: number
  customChargesIsTaxable: boolean
  customChargesTaxRate: number
  customChargesTaxAmount: number
  totalAmount: number
}

export function emptyQuotationLineExtras(): QuotationLineExtras {
  return {
    freightAmount: 0,
    installationAmount: 0,
    customCharges: 0,
    orderDiscountCalcType: 'FLAT',
    orderDiscountValue: 0,
    orderDiscountAmount: 0,
    freightCalcType: 'FLAT',
    freightValue: 0,
    freightIsTaxable: false,
    freightTaxRate: 0,
    freightTaxAmount: 0,
    installationCalcType: 'FLAT',
    installationValue: 0,
    installationIsTaxable: false,
    installationTaxRate: 0,
    installationTaxAmount: 0,
    customChargesCalcType: 'FLAT',
    customChargesValue: 0,
    customChargesIsTaxable: false,
    customChargesTaxRate: 0,
    customChargesTaxAmount: 0,
    totalAmount: 0,
  }
}

export function extrasFromDocument(doc: Partial<QuotationLineExtras> & {
  freightAmount?: number
  installationAmount?: number
  customCharges?: number
}): QuotationLineExtras {
  const base = emptyQuotationLineExtras()
  return {
    ...base,
    freightAmount: doc.freightAmount ?? 0,
    installationAmount: doc.installationAmount ?? 0,
    customCharges: doc.customCharges ?? 0,
    orderDiscountCalcType: normalizeCalcType(doc.orderDiscountCalcType) as AdjustmentCalcTypeUi,
    orderDiscountValue: doc.orderDiscountValue ?? 0,
    orderDiscountAmount: doc.orderDiscountAmount ?? 0,
    freightCalcType: normalizeCalcType(doc.freightCalcType) as AdjustmentCalcTypeUi,
    freightValue: doc.freightValue ?? doc.freightAmount ?? 0,
    freightIsTaxable: Boolean(doc.freightIsTaxable),
    freightTaxRate: doc.freightTaxRate ?? 0,
    freightTaxAmount: doc.freightTaxAmount ?? 0,
    installationCalcType: normalizeCalcType(doc.installationCalcType) as AdjustmentCalcTypeUi,
    installationValue: doc.installationValue ?? doc.installationAmount ?? 0,
    installationIsTaxable: Boolean(doc.installationIsTaxable),
    installationTaxRate: doc.installationTaxRate ?? 0,
    installationTaxAmount: doc.installationTaxAmount ?? 0,
    customChargesCalcType: normalizeCalcType(doc.customChargesCalcType) as AdjustmentCalcTypeUi,
    customChargesValue: doc.customChargesValue ?? doc.customCharges ?? 0,
    customChargesIsTaxable: Boolean(doc.customChargesIsTaxable),
    customChargesTaxRate: doc.customChargesTaxRate ?? 0,
    customChargesTaxAmount: doc.customChargesTaxAmount ?? 0,
    totalAmount: doc.totalAmount ?? 0,
  }
}

function modeOf(t: AdjustmentCalcTypeUi): OrderDiscountMode {
  return t === 'PERCENTAGE' ? 'percent' : 'flat'
}

function typeOf(m: OrderDiscountMode): AdjustmentCalcTypeUi {
  return m === 'percent' ? 'PERCENTAGE' : 'FLAT'
}

function recomputeExtras(lines: QuotationPriceLine[], partial: Partial<QuotationLineExtras>): QuotationLineExtras {
  const merged = { ...emptyQuotationLineExtras(), ...partial }
  const totals = calcOrderDocumentTotals(
    lines.map((l) => ({
      qty: l.qty,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      taxPct: l.taxPct,
    })),
    adjustmentsFromDocumentFields(merged),
  )
  return {
    freightAmount: totals.freight.calculatedAmount,
    installationAmount: totals.installation.calculatedAmount,
    customCharges: totals.otherCharges.calculatedAmount,
    orderDiscountCalcType: totals.orderDiscount.calculationType,
    orderDiscountValue: totals.orderDiscount.value,
    orderDiscountAmount: totals.orderDiscount.calculatedAmount,
    freightCalcType: totals.freight.calculationType,
    freightValue: totals.freight.value,
    freightIsTaxable: totals.freight.isTaxable,
    freightTaxRate: totals.freight.taxRate,
    freightTaxAmount: totals.freight.taxAmount,
    installationCalcType: totals.installation.calculationType,
    installationValue: totals.installation.value,
    installationIsTaxable: totals.installation.isTaxable,
    installationTaxRate: totals.installation.taxRate,
    installationTaxAmount: totals.installation.taxAmount,
    customChargesCalcType: totals.otherCharges.calculationType,
    customChargesValue: totals.otherCharges.value,
    customChargesIsTaxable: totals.otherCharges.isTaxable,
    customChargesTaxRate: totals.otherCharges.taxRate,
    customChargesTaxAmount: totals.otherCharges.taxAmount,
    totalAmount: totals.grandTotal,
  }
}

interface QuotationLineItemsEditorProps {
  priceLines: QuotationPriceLine[]
  onChange?: (lines: QuotationPriceLine[], extras: QuotationLineExtras) => void
  freightAmount?: number
  installationAmount?: number
  customCharges?: number
  /** Full document charge fields when available */
  documentExtras?: Partial<QuotationLineExtras>
  probability?: number
  readOnly?: boolean
  scopeNotes?: string
  onScopeNotesChange?: (value: string) => void
  showFreightExtras?: boolean
  rowErrors?: Record<string, string[]>
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
}

export function QuotationLineItemsEditor({
  priceLines,
  onChange,
  freightAmount = 0,
  installationAmount = 0,
  customCharges = 0,
  documentExtras,
  readOnly,
  scopeNotes,
  onScopeNotesChange,
  showFreightExtras = true,
  rowErrors,
  companyState,
  companyStateCode,
  companyGstin,
  partyState,
  partyGstin,
  placeOfSupply,
}: QuotationLineItemsEditorProps) {
  const products = useMasterStore((s) => s.products)
  const items = useMasterStore((s) => s.items)
  const uoms = useMasterStore((s) => s.uoms)
  const retainItemIds = useMemo(
    () => priceLines.map((l) => l.itemId ?? l.productId),
    [priceLines],
  )
  const { options: productOptions, pickMap } = useProductMasterOptionMap(
    products,
    items,
    uoms,
    undefined,
    retainItemIds,
  )

  const oppLines = useMemo(
    () => quotationPriceLinesToOpportunityLines(priceLines),
    [priceLines],
  )

  const seed = useMemo(
    () =>
      extrasFromDocument({
        freightAmount,
        installationAmount,
        customCharges,
        ...documentExtras,
      }),
    // seed from document on load only via values — parent re-pass on hydrate
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      freightAmount,
      installationAmount,
      customCharges,
      documentExtras?.freightCalcType,
      documentExtras?.freightValue,
      documentExtras?.orderDiscountValue,
    ],
  )

  const [orderDiscountMode, setOrderDiscountMode] = useState<OrderDiscountMode>(() =>
    modeOf(seed.orderDiscountCalcType),
  )
  const [orderDiscountInput, setOrderDiscountInput] = useState(() => seed.orderDiscountValue)
  const [freightMode, setFreightMode] = useState<OrderDiscountMode>(() => modeOf(seed.freightCalcType))
  const [freightValue, setFreightValue] = useState(() => seed.freightValue)
  const [freightIsTaxable, setFreightIsTaxable] = useState(() => seed.freightIsTaxable)
  const [freightTaxRate, setFreightTaxRate] = useState(() => seed.freightTaxRate || 18)
  const [installMode, setInstallMode] = useState<OrderDiscountMode>(() => modeOf(seed.installationCalcType))
  const [installValue, setInstallValue] = useState(() => seed.installationValue)
  const [installIsTaxable, setInstallIsTaxable] = useState(() => seed.installationIsTaxable)
  const [installTaxRate, setInstallTaxRate] = useState(() => seed.installationTaxRate || 18)
  const [customMode, setCustomMode] = useState<OrderDiscountMode>(() => modeOf(seed.customChargesCalcType))
  const [customValue, setCustomValue] = useState(() => seed.customChargesValue)
  const [customIsTaxable, setCustomIsTaxable] = useState(() => seed.customChargesIsTaxable)
  const [customTaxRate, setCustomTaxRate] = useState(() => seed.customChargesTaxRate || 18)

  function buildPartial(): Partial<QuotationLineExtras> {
    return {
      orderDiscountCalcType: typeOf(orderDiscountMode),
      orderDiscountValue: orderDiscountInput,
      freightCalcType: typeOf(freightMode),
      freightValue,
      freightIsTaxable,
      freightTaxRate: freightIsTaxable ? freightTaxRate : 0,
      installationCalcType: typeOf(installMode),
      installationValue: installValue,
      installationIsTaxable: installIsTaxable,
      installationTaxRate: installIsTaxable ? installTaxRate : 0,
      customChargesCalcType: typeOf(customMode),
      customChargesValue: customValue,
      customChargesIsTaxable: customIsTaxable,
      customChargesTaxRate: customIsTaxable ? customTaxRate : 0,
    }
  }

  function emit(lines: QuotationPriceLine[]) {
    if (!onChange) return
    onChange(lines, recomputeExtras(lines, buildPartial()))
  }

  function handleLinesChange(nextOppLines: ReturnType<typeof syncOpportunityLines>) {
    emit(opportunityLinesToQuotationPriceLines(nextOppLines))
  }

  return (
    <div className="quotation-line-items-editor space-y-4">
      <ErpProductPricingPanel
        lines={oppLines}
        onChange={handleLinesChange}
        productOptions={productOptions}
        productPickMap={pickMap}
        rowErrors={rowErrors}
        readOnly={readOnly}
        showAdjustments
        showExtendedCharges={showFreightExtras}
        companyState={companyState}
        companyStateCode={companyStateCode}
        companyGstin={companyGstin}
        partyState={partyState}
        partyGstin={partyGstin}
        placeOfSupply={placeOfSupply}
        orderDiscountMode={orderDiscountMode}
        onOrderDiscountModeChange={
          readOnly
            ? undefined
            : (m) => {
                setOrderDiscountMode(m)
                setOrderDiscountInput(0)
                if (!onChange) return
                onChange(
                  priceLines,
                  recomputeExtras(priceLines, {
                    ...buildPartial(),
                    orderDiscountCalcType: typeOf(m),
                    orderDiscountValue: 0,
                  }),
                )
              }
        }
        orderDiscountInput={orderDiscountInput}
        onOrderDiscountInputChange={
          readOnly
            ? undefined
            : (v) => {
                setOrderDiscountInput(v)
                if (!onChange) return
                onChange(
                  priceLines,
                  recomputeExtras(priceLines, {
                    ...buildPartial(),
                    orderDiscountValue: v,
                  }),
                )
              }
        }
        freightMode={freightMode}
        onFreightModeChange={
          readOnly
            ? undefined
            : (m) => {
                setFreightMode(m)
                setFreightValue(0)
                if (!onChange) return
                onChange(
                  priceLines,
                  recomputeExtras(priceLines, {
                    ...buildPartial(),
                    freightCalcType: typeOf(m),
                    freightValue: 0,
                  }),
                )
              }
        }
        freightValue={freightValue}
        onFreightValueChange={
          readOnly
            ? undefined
            : (v) => {
                setFreightValue(v)
                if (!onChange) return
                onChange(
                  priceLines,
                  recomputeExtras(priceLines, {
                    ...buildPartial(),
                    freightValue: v,
                  }),
                )
              }
        }
        freightIsTaxable={freightIsTaxable}
        onFreightIsTaxableChange={
          readOnly
            ? undefined
            : (v) => {
                setFreightIsTaxable(v)
                if (!onChange) return
                onChange(
                  priceLines,
                  recomputeExtras(priceLines, {
                    ...buildPartial(),
                    freightIsTaxable: v,
                    freightTaxRate: v ? freightTaxRate || 18 : 0,
                  }),
                )
              }
        }
        freightTaxRate={freightTaxRate}
        onFreightTaxRateChange={
          readOnly
            ? undefined
            : (r) => {
                setFreightTaxRate(r)
                if (!onChange) return
                onChange(
                  priceLines,
                  recomputeExtras(priceLines, {
                    ...buildPartial(),
                    freightTaxRate: r,
                  }),
                )
              }
        }
        installationMode={installMode}
        onInstallationModeChange={
          readOnly
            ? undefined
            : (m) => {
                setInstallMode(m)
                setInstallValue(0)
                if (!onChange) return
                onChange(
                  priceLines,
                  recomputeExtras(priceLines, {
                    ...buildPartial(),
                    installationCalcType: typeOf(m),
                    installationValue: 0,
                  }),
                )
              }
        }
        installationValue={installValue}
        onInstallationValueChange={
          readOnly
            ? undefined
            : (v) => {
                setInstallValue(v)
                if (!onChange) return
                onChange(
                  priceLines,
                  recomputeExtras(priceLines, {
                    ...buildPartial(),
                    installationValue: v,
                  }),
                )
              }
        }
        installationIsTaxable={installIsTaxable}
        onInstallationIsTaxableChange={
          readOnly
            ? undefined
            : (v) => {
                setInstallIsTaxable(v)
                if (!onChange) return
                onChange(
                  priceLines,
                  recomputeExtras(priceLines, {
                    ...buildPartial(),
                    installationIsTaxable: v,
                    installationTaxRate: v ? installTaxRate || 18 : 0,
                  }),
                )
              }
        }
        installationTaxRate={installTaxRate}
        onInstallationTaxRateChange={
          readOnly
            ? undefined
            : (r) => {
                setInstallTaxRate(r)
                if (!onChange) return
                onChange(
                  priceLines,
                  recomputeExtras(priceLines, {
                    ...buildPartial(),
                    installationTaxRate: r,
                  }),
                )
              }
        }
        customChargesMode={customMode}
        onCustomChargesModeChange={
          readOnly
            ? undefined
            : (m) => {
                setCustomMode(m)
                setCustomValue(0)
                if (!onChange) return
                onChange(
                  priceLines,
                  recomputeExtras(priceLines, {
                    ...buildPartial(),
                    customChargesCalcType: typeOf(m),
                    customChargesValue: 0,
                  }),
                )
              }
        }
        customChargesValue={customValue}
        onCustomChargesValueChange={
          readOnly
            ? undefined
            : (v) => {
                setCustomValue(v)
                if (!onChange) return
                onChange(
                  priceLines,
                  recomputeExtras(priceLines, {
                    ...buildPartial(),
                    customChargesValue: v,
                  }),
                )
              }
        }
        customChargesIsTaxable={customIsTaxable}
        onCustomChargesIsTaxableChange={
          readOnly
            ? undefined
            : (v) => {
                setCustomIsTaxable(v)
                if (!onChange) return
                onChange(
                  priceLines,
                  recomputeExtras(priceLines, {
                    ...buildPartial(),
                    customChargesIsTaxable: v,
                    customChargesTaxRate: v ? customTaxRate || 18 : 0,
                  }),
                )
              }
        }
        customChargesTaxRate={customTaxRate}
        onCustomChargesTaxRateChange={
          readOnly
            ? undefined
            : (r) => {
                setCustomTaxRate(r)
                if (!onChange) return
                onChange(
                  priceLines,
                  recomputeExtras(priceLines, {
                    ...buildPartial(),
                    customChargesTaxRate: r,
                  }),
                )
              }
        }
      />

      {scopeNotes !== undefined || onScopeNotesChange ? (
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-erp-text">Scope Notes</span>
          {readOnly ? (
            <p className="text-[14px] text-erp-muted">{scopeNotes?.trim() || '-'}</p>
          ) : (
            <textarea
              rows={3}
              value={scopeNotes ?? ''}
              onChange={(e) => onScopeNotesChange?.(e.target.value)}
              placeholder="Additional technical-commercial scope beyond line items…"
              className="erp-input w-full resize-y"
            />
          )}
        </label>
      ) : null}
    </div>
  )
}

export { recomputeExtras }
