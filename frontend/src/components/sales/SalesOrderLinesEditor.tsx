/**
 * Shared sales-order product lines grid (create + draft edit).
 * Mirrors quotation Product & Pricing: lines, full order adjustments, summary, scope notes.
 */
import { useMemo } from 'react'
import { ErpProductPricingPanel } from '../erp/ErpProductPricingSection'
import type { OpportunityLine } from '../../types/crm'
import { useMasterStore } from '../../store/masterStore'
import {
  calcProductPricingSummary,
  createEmptyOpportunityLine,
  syncOpportunityLines,
  type OrderDiscountMode,
  type ProductPricingAdjustments,
  type ProductPricingSummary,
} from '../../utils/opportunityLineCalc'
import { useSalesItemOptionMap } from '../../utils/opportunityItemOptions'
import type { Item } from '../../types/master'

export const SO_GST_RATE_OPTIONS = [0, 5, 12, 18, 28] as const

export interface SoLineDraft {
  key: string
  /** Persist across save when editing existing SO lines. */
  id?: string
  itemId: string
  qty: number
  unitPrice: number
  discountPct: number
  taxPct: number
  hsnCode?: string
  hsnId?: string
  taxScheme?: string
  cgstRate?: number
  sgstRate?: number
  igstRate?: number
  utgstRate?: number
}

/** Order-level charges (same model as quotation Product & Pricing). */
export interface SoOrderCharges {
  orderDiscountMode: OrderDiscountMode
  orderDiscountInput: number
  freightMode: OrderDiscountMode
  freightValue: number
  freightIsTaxable: boolean
  freightTaxRate: number
  installationMode: OrderDiscountMode
  installationValue: number
  installationIsTaxable: boolean
  installationTaxRate: number
  customChargesMode: OrderDiscountMode
  customChargesValue: number
  customChargesIsTaxable: boolean
  customChargesTaxRate: number
}

export const EMPTY_SO_ORDER_CHARGES: SoOrderCharges = {
  orderDiscountMode: 'flat',
  orderDiscountInput: 0,
  freightMode: 'flat',
  freightValue: 0,
  freightIsTaxable: false,
  freightTaxRate: 18,
  installationMode: 'flat',
  installationValue: 0,
  installationIsTaxable: false,
  installationTaxRate: 18,
  customChargesMode: 'flat',
  customChargesValue: 0,
  customChargesIsTaxable: false,
  customChargesTaxRate: 18,
}

/** Serialised into SalesOrder.commercialNotes for re-hydrate (API has no charge columns yet). */
const SO_PRICING_V1 = 'fos.soPricing.v1'

export function emptySoOrderCharges(): SoOrderCharges {
  return { ...EMPTY_SO_ORDER_CHARGES }
}

export function serializeSoOrderCharges(charges: SoOrderCharges): string {
  return JSON.stringify({ kind: SO_PRICING_V1, ...charges })
}

export function parseSoOrderCharges(raw: string | null | undefined): SoOrderCharges {
  if (!raw?.trim()) return emptySoOrderCharges()
  try {
    const parsed = JSON.parse(raw) as Partial<SoOrderCharges> & { kind?: string }
    if (parsed.kind !== SO_PRICING_V1) return emptySoOrderCharges()
    return {
      ...emptySoOrderCharges(),
      orderDiscountMode: parsed.orderDiscountMode === 'percent' ? 'percent' : 'flat',
      orderDiscountInput: Number(parsed.orderDiscountInput) || 0,
      freightMode: parsed.freightMode === 'percent' ? 'percent' : 'flat',
      freightValue: Number(parsed.freightValue) || 0,
      freightIsTaxable: Boolean(parsed.freightIsTaxable),
      freightTaxRate: Number(parsed.freightTaxRate) || 18,
      installationMode: parsed.installationMode === 'percent' ? 'percent' : 'flat',
      installationValue: Number(parsed.installationValue) || 0,
      installationIsTaxable: Boolean(parsed.installationIsTaxable),
      installationTaxRate: Number(parsed.installationTaxRate) || 18,
      customChargesMode: parsed.customChargesMode === 'percent' ? 'percent' : 'flat',
      customChargesValue: Number(parsed.customChargesValue) || 0,
      customChargesIsTaxable: Boolean(parsed.customChargesIsTaxable),
      customChargesTaxRate: Number(parsed.customChargesTaxRate) || 18,
    }
  } catch {
    return emptySoOrderCharges()
  }
}

export function roundSoMoney(n: number) {
  return Math.round(n * 100) / 100
}

export function computeSoLineTotals(line: SoLineDraft) {
  const taxableValue = roundSoMoney(line.qty * line.unitPrice * (1 - line.discountPct / 100))
  const gstAmount = roundSoMoney(taxableValue * (line.taxPct / 100))
  return { taxableValue, gstAmount, lineTotal: roundSoMoney(taxableValue + gstAmount) }
}

export function newSoLineDraft(itemId = '', unitPrice = 0): SoLineDraft {
  return {
    key: crypto.randomUUID(),
    itemId,
    qty: 1,
    unitPrice,
    discountPct: 0,
    /** 0 until resolved from masters on item select ΓÇö never silent 18. */
    taxPct: 0,
  }
}

export function soLinesFromOrder(
  so: {
    lines?: Array<{
      id?: string
      itemId?: string | null
      productId?: string | null
      qty: number
      unitPrice: number
      discountPct?: number
      taxPct?: number
      hsnCode?: string | null
      taxScheme?: string | null
      cgstRate?: number | null
      sgstRate?: number | null
      igstRate?: number | null
      utgstRate?: number | null
      hsnId?: string | null
    }>
    productId?: string
    itemId?: string | null
    qty?: number
    unitPrice?: number | null
    discountPct?: number | null
  },
  getItem: (id: string) => Item | undefined,
): SoLineDraft[] {
  const raw = so.lines ?? []
  if (raw.length > 0) {
    return raw.map((l) => {
      const itemId = l.itemId ?? l.productId ?? ''
      const item = itemId ? getItem(itemId) : undefined
      return {
        key: l.id ?? crypto.randomUUID(),
        id: l.id,
        itemId,
        qty: l.qty > 0 ? l.qty : 1,
        unitPrice: l.unitPrice ?? 0,
        discountPct: l.discountPct ?? 0,
        taxPct: l.taxPct ?? 0,
        hsnCode: (l.hsnCode ?? item?.hsnCode ?? '') || '',
        hsnId: l.hsnId ?? undefined,
        taxScheme: l.taxScheme ?? undefined,
        cgstRate: l.cgstRate ?? undefined,
        sgstRate: l.sgstRate ?? undefined,
        igstRate: l.igstRate ?? undefined,
        utgstRate: l.utgstRate ?? undefined,
      }
    })
  }
  const itemId = so.itemId || so.productId || ''
  const item = itemId ? getItem(itemId) : undefined
  return [
    {
      ...newSoLineDraft(
        itemId,
        so.unitPrice ?? item?.defaultSalesRate ?? item?.standardRate ?? 0,
      ),
      qty: so.qty && so.qty > 0 ? so.qty : 1,
      discountPct: so.discountPct ?? 0,
      hsnCode: item?.hsnCode ?? '',
    },
  ]
}

export function buildSoLineApiPayload(
  lines: SoLineDraft[],
  getItem: (id: string) => Item | undefined,
) {
  return lines.map((l) => {
    const item = getItem(l.itemId)
    const totals = computeSoLineTotals(l)
    const scheme = l.taxScheme
    return {
      ...(l.id ? { id: l.id } : {}),
      productOrItem: item?.itemName ?? l.itemId,
      description: item?.itemName ?? '',
      itemId: l.itemId,
      qty: l.qty,
      uom: 'NOS',
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      taxPct: l.taxPct,
      hsnCode: l.hsnCode || item?.hsnCode || null,
      hsnId: l.hsnId || item?.hsnId || null,
      taxScheme: scheme ?? null,
      cgstRate: l.cgstRate ?? null,
      sgstRate: l.sgstRate ?? null,
      igstRate: l.igstRate ?? null,
      utgstRate: l.utgstRate ?? null,
      cgstAmount:
        scheme === 'igst'
          ? 0
          : Math.round(totals.taxableValue * ((l.cgstRate ?? l.taxPct / 2) / 100) * 100) / 100,
      sgstAmount:
        scheme === 'igst'
          ? 0
          : Math.round(totals.taxableValue * ((l.sgstRate ?? l.taxPct / 2) / 100) * 100) / 100,
      igstAmount:
        scheme === 'igst'
          ? Math.round(totals.taxableValue * ((l.igstRate ?? l.taxPct) / 100) * 100) / 100
          : 0,
    }
  })
}

function soDraftToOpportunityLine(line: SoLineDraft, lineNo: number, getItem: (id: string) => Item | undefined): OpportunityLine {
  const item = line.itemId ? getItem(line.itemId) : undefined
  const productName = item?.itemName ?? ''
  const taxableValue = roundSoMoney(line.qty * line.unitPrice * (1 - line.discountPct / 100))
  const gstAmount = roundSoMoney(taxableValue * (line.taxPct / 100))
  return {
    id: line.key,
    lineNo,
    productId: null,
    itemId: line.itemId || null,
    itemCode: item?.itemCode ?? '',
    productOrItem: productName || line.itemId,
    description: productName,
    productFamily: '',
    itemType: '',
    qty: line.qty,
    uom: 'Nos',
    unitPrice: line.unitPrice,
    discountPct: line.discountPct,
    discountAmount: 0,
    taxableValue,
    taxPct: line.taxPct,
    gstAmount,
    lineTotal: roundSoMoney(taxableValue + gstAmount),
    expectedDeliveryDate: null,
    remarks: '',
    hsnCode: line.hsnCode || item?.hsnCode || '',
    taxScheme: (line.taxScheme as OpportunityLine['taxScheme']) ?? undefined,
    cgstRate: line.cgstRate,
    sgstRate: line.sgstRate,
    igstRate: line.igstRate,
  }
}

function opportunityLinesToSoDrafts(
  next: OpportunityLine[],
  prev: SoLineDraft[],
): SoLineDraft[] {
  const byKey = new Map(prev.map((l) => [l.key, l]))
  const synced = syncOpportunityLines(next)
  return synced.map((l) => {
    const existing = byKey.get(l.id)
    return {
      key: l.id,
      id: existing?.id,
      itemId: l.itemId ?? '',
      qty: l.qty > 0 ? l.qty : 1,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      taxPct: l.taxPct,
      hsnCode: l.hsnCode || existing?.hsnCode || '',
      hsnId: existing?.hsnId,
      taxScheme: l.taxScheme || existing?.taxScheme,
      cgstRate: l.cgstRate ?? existing?.cgstRate,
      sgstRate: l.sgstRate ?? existing?.sgstRate,
      igstRate: l.igstRate ?? existing?.igstRate,
    }
  })
}

export function chargesToAdjustments(charges: SoOrderCharges, showFreight: boolean): ProductPricingAdjustments {
  return {
    orderDiscountMode: charges.orderDiscountMode,
    orderDiscountInput: charges.orderDiscountInput,
    freight: showFreight
      ? {
          calculationType: charges.freightMode,
          value: charges.freightValue,
          isTaxable: charges.freightIsTaxable,
          taxRate: charges.freightTaxRate,
        }
      : { calculationType: 'flat', value: 0, isTaxable: false },
    installation: {
      calculationType: charges.installationMode,
      value: charges.installationValue,
      isTaxable: charges.installationIsTaxable,
      taxRate: charges.installationTaxRate,
    },
    otherCharges: {
      calculationType: charges.customChargesMode,
      value: charges.customChargesValue,
      isTaxable: charges.customChargesIsTaxable,
      taxRate: charges.customChargesTaxRate,
    },
  }
}

/** Live order total for factbox / save without remounting the full editor. */
export function summarizeSoLines(
  lines: SoLineDraft[],
  getItem: (id: string) => Item | undefined,
  charges: SoOrderCharges = emptySoOrderCharges(),
  opts?: { showFreight?: boolean },
): ProductPricingSummary {
  const showFreight = opts?.showFreight !== false
  const oppLines = lines.map((l, idx) => soDraftToOpportunityLine(l, idx + 1, getItem))
  return calcProductPricingSummary(oppLines, chargesToAdjustments(charges, showFreight))
}

export function SalesOrderLinesEditor({
  lines,
  onChange,
  charges,
  onChargesChange,
  showFreight = true,
  showExtendedCharges = true,
  scopeNotes,
  onScopeNotesChange,
  fieldError,
  readOnly,
}: {
  lines: SoLineDraft[]
  onChange: (next: SoLineDraft[]) => void
  charges: SoOrderCharges
  onChargesChange: (next: SoOrderCharges) => void
  showFreight?: boolean
  showExtendedCharges?: boolean
  scopeNotes?: string
  onScopeNotesChange?: (value: string) => void
  fieldError?: string
  readOnly?: boolean
}) {
  const allItems = useMasterStore((s) => s.items)
  const uoms = useMasterStore((s) => s.uoms)
  const getItem = useMasterStore((s) => s.getItem)

  const { options: itemSmartOptions, pickMap } = useSalesItemOptionMap(
    allItems,
    uoms,
    undefined,
    lines.map((l) => l.itemId),
  )

  const opportunityLines = useMemo(() => {
    if (!lines.length) return [createEmptyOpportunityLine(1)]
    return lines.map((l, idx) => soDraftToOpportunityLine(l, idx + 1, getItem))
  }, [lines, getItem])

  function patchCharges(partial: Partial<SoOrderCharges>) {
    onChargesChange({ ...charges, ...partial })
  }

  return (
    <div className="space-y-4">
      {fieldError ? (
        <p className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
          {fieldError}
        </p>
      ) : null}

      <ErpProductPricingPanel
        lines={opportunityLines}
        onChange={(next) => onChange(opportunityLinesToSoDrafts(next, lines))}
        productOptions={itemSmartOptions}
        productPickMap={pickMap}
        readOnly={readOnly}
        showAdjustments
        showExtendedCharges={showExtendedCharges}
        orderDiscountMode={charges.orderDiscountMode}
        onOrderDiscountModeChange={(m) => patchCharges({ orderDiscountMode: m, orderDiscountInput: 0 })}
        orderDiscountInput={charges.orderDiscountInput}
        onOrderDiscountInputChange={(v) => patchCharges({ orderDiscountInput: v })}
        freightMode={showFreight ? charges.freightMode : 'flat'}
        onFreightModeChange={
          showFreight
            ? (m) => patchCharges({ freightMode: m, freightValue: 0 })
            : undefined
        }
        freightValue={showFreight ? charges.freightValue : 0}
        onFreightValueChange={showFreight ? (v) => patchCharges({ freightValue: v }) : undefined}
        freightIsTaxable={showFreight ? charges.freightIsTaxable : false}
        onFreightIsTaxableChange={
          showFreight ? (v) => patchCharges({ freightIsTaxable: v, freightTaxRate: v ? charges.freightTaxRate || 18 : 0 }) : undefined
        }
        freightTaxRate={showFreight ? charges.freightTaxRate : 0}
        onFreightTaxRateChange={showFreight ? (r) => patchCharges({ freightTaxRate: r }) : undefined}
        installationMode={charges.installationMode}
        onInstallationModeChange={(m) => patchCharges({ installationMode: m, installationValue: 0 })}
        installationValue={charges.installationValue}
        onInstallationValueChange={(v) => patchCharges({ installationValue: v })}
        installationIsTaxable={charges.installationIsTaxable}
        onInstallationIsTaxableChange={(v) =>
          patchCharges({ installationIsTaxable: v, installationTaxRate: v ? charges.installationTaxRate || 18 : 0 })
        }
        installationTaxRate={charges.installationTaxRate}
        onInstallationTaxRateChange={(r) => patchCharges({ installationTaxRate: r })}
        customChargesMode={charges.customChargesMode}
        onCustomChargesModeChange={(m) => patchCharges({ customChargesMode: m, customChargesValue: 0 })}
        customChargesValue={charges.customChargesValue}
        onCustomChargesValueChange={(v) => patchCharges({ customChargesValue: v })}
        customChargesIsTaxable={charges.customChargesIsTaxable}
        onCustomChargesIsTaxableChange={(v) =>
          patchCharges({ customChargesIsTaxable: v, customChargesTaxRate: v ? charges.customChargesTaxRate || 18 : 0 })
        }
        customChargesTaxRate={charges.customChargesTaxRate}
        onCustomChargesTaxRateChange={(r) => patchCharges({ customChargesTaxRate: r })}
      />

      {scopeNotes !== undefined || onScopeNotesChange ? (
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-erp-text">Scope Notes</span>
          {readOnly ? (
            <p className="text-[14px] text-erp-muted">{scopeNotes?.trim() || 'ΓÇö'}</p>
          ) : (
            <textarea
              rows={3}
              value={scopeNotes ?? ''}
              onChange={(e) => onScopeNotesChange?.(e.target.value)}
              placeholder="Additional technical-commercial scope beyond line itemsΓÇª"
              className="erp-input w-full resize-y"
            />
          )}
        </label>
      ) : null}
    </div>
  )
}
