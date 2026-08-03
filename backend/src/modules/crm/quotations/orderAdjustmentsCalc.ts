/**
 * Shared order-adjustment calculation for Quotation (and conversion totals).
 * Keep in sync with frontend/src/utils/orderAdjustmentsCalc.ts
 */

export type AdjustmentCalcType = 'FLAT' | 'PERCENTAGE'

export interface OrderAdjustmentSpec {
  calculationType: AdjustmentCalcType
  value: number
  isTaxable: boolean
  taxRate?: number
}

export interface PriceLineForAdjustCalc {
  qty: number
  unitPrice: number
  discountPct?: number
  taxPct?: number
}

export interface OrderAdjustmentsBundle {
  orderDiscount: Pick<OrderAdjustmentSpec, 'calculationType' | 'value'>
  freight: OrderAdjustmentSpec
  installation: OrderAdjustmentSpec
  otherCharges: OrderAdjustmentSpec
}

export interface ResolvedAdjustment {
  calculationType: AdjustmentCalcType
  value: number
  calculatedAmount: number
  isTaxable: boolean
  taxRate: number
  taxAmount: number
}

export interface OrderDocumentTotals {
  basicAmount: number
  itemDiscountAmount: number
  taxableAmount: number
  orderDiscount: ResolvedAdjustment
  discountedTaxableAmount: number
  freight: ResolvedAdjustment
  installation: ResolvedAdjustment
  otherCharges: ResolvedAdjustment
  gstAmount: number
  gstByRate: Array<{ rate: number; amount: number }>
  taxableAdjustmentsTotal: number
  nonTaxableAdjustmentsTotal: number
  roundOff: number
  grandTotal: number
  freightAmount: number
  installationAmount: number
  customCharges: number
}

export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

export function normalizeCalcType(raw: unknown): AdjustmentCalcType {
  const s = String(raw ?? 'FLAT').toUpperCase()
  return s === 'PERCENTAGE' || s === 'PERCENT' || s === '%' ? 'PERCENTAGE' : 'FLAT'
}

export function sanitizeNonNeg(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v) || v < 0) return 0
  return v
}

export function sanitizePct(n: unknown): number {
  return Math.min(100, sanitizeNonNeg(n))
}

export function calcAdjustmentAmount(
  calculationType: AdjustmentCalcType,
  value: unknown,
  discountedTaxable: number,
): number {
  const type = normalizeCalcType(calculationType)
  if (type === 'PERCENTAGE') {
    return roundMoney(sanitizeNonNeg(discountedTaxable) * (sanitizePct(value) / 100))
  }
  return roundMoney(sanitizeNonNeg(value))
}

function defaultTaxRate(raw: unknown, isTaxable: boolean): number {
  if (!isTaxable) return 0
  const r = sanitizeNonNeg(raw)
  return r > 0 ? r : 18
}

function resolveAdjustment(
  spec: OrderAdjustmentSpec,
  discountedTaxable: number,
): ResolvedAdjustment {
  const calculationType = normalizeCalcType(spec.calculationType)
  const value =
    calculationType === 'PERCENTAGE' ? sanitizePct(spec.value) : sanitizeNonNeg(spec.value)
  const calculatedAmount = calcAdjustmentAmount(calculationType, value, discountedTaxable)
  const isTaxable = Boolean(spec.isTaxable) && calculatedAmount > 0
  const taxRate = defaultTaxRate(spec.taxRate, isTaxable)
  const taxAmount = isTaxable ? roundMoney(calculatedAmount * (taxRate / 100)) : 0
  return {
    calculationType,
    value,
    calculatedAmount,
    isTaxable,
    taxRate,
    taxAmount,
  }
}

function lineTaxable(line: PriceLineForAdjustCalc): number {
  const qty = sanitizeNonNeg(line.qty)
  const unit = sanitizeNonNeg(line.unitPrice)
  const disc = sanitizePct(line.discountPct ?? 0)
  return roundMoney(qty * unit * (1 - disc / 100))
}

function lineBasic(line: PriceLineForAdjustCalc): number {
  return roundMoney(sanitizeNonNeg(line.qty) * sanitizeNonNeg(line.unitPrice))
}

export function calcOrderDocumentTotals(
  lines: PriceLineForAdjustCalc[],
  adjustments: Partial<OrderAdjustmentsBundle> | null | undefined,
): OrderDocumentTotals {
  const safeLines = Array.isArray(lines) ? lines : []
  const basicAmount = roundMoney(safeLines.reduce((s, l) => s + lineBasic(l), 0))
  const taxableAmount = roundMoney(safeLines.reduce((s, l) => s + lineTaxable(l), 0))
  const itemDiscountAmount = roundMoney(basicAmount - taxableAmount)

  const orderDiscSpec = adjustments?.orderDiscount ?? {
    calculationType: 'FLAT' as const,
    value: 0,
  }
  const orderDiscountType = normalizeCalcType(orderDiscSpec.calculationType)
  const orderDiscountValue =
    orderDiscountType === 'PERCENTAGE'
      ? sanitizePct(orderDiscSpec.value)
      : sanitizeNonNeg(orderDiscSpec.value)
  const orderDiscountAmountRaw =
    orderDiscountType === 'PERCENTAGE'
      ? roundMoney(taxableAmount * (orderDiscountValue / 100))
      : roundMoney(Math.min(orderDiscountValue, taxableAmount))
  const orderDiscount: ResolvedAdjustment = {
    calculationType: orderDiscountType,
    value: orderDiscountValue,
    calculatedAmount: orderDiscountAmountRaw,
    isTaxable: false,
    taxRate: 0,
    taxAmount: 0,
  }

  const discountedTaxableAmount = roundMoney(Math.max(0, taxableAmount - orderDiscount.calculatedAmount))

  const freight = resolveAdjustment(
    adjustments?.freight ?? { calculationType: 'FLAT', value: 0, isTaxable: false },
    discountedTaxableAmount,
  )
  const installation = resolveAdjustment(
    adjustments?.installation ?? { calculationType: 'FLAT', value: 0, isTaxable: false },
    discountedTaxableAmount,
  )
  const otherCharges = resolveAdjustment(
    adjustments?.otherCharges ?? { calculationType: 'FLAT', value: 0, isTaxable: false },
    discountedTaxableAmount,
  )

  const gstByRateMap = new Map<number, number>()
  if (taxableAmount > 0) {
    for (const line of safeLines) {
      const lt = lineTaxable(line)
      if (lt <= 0) continue
      const lineAfterDisc = roundMoney(lt * (discountedTaxableAmount / taxableAmount))
      const taxPct = sanitizeNonNeg(line.taxPct ?? 0)
      const gst = roundMoney(lineAfterDisc * (taxPct / 100))
      if (taxPct > 0 && gst !== 0) {
        gstByRateMap.set(taxPct, roundMoney((gstByRateMap.get(taxPct) ?? 0) + gst))
      }
    }
  }

  for (const adj of [freight, installation, otherCharges]) {
    if (!adj.isTaxable || adj.taxAmount <= 0) continue
    gstByRateMap.set(adj.taxRate, roundMoney((gstByRateMap.get(adj.taxRate) ?? 0) + adj.taxAmount))
  }

  const gstByRate = [...gstByRateMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rate, amount]) => ({ rate, amount: roundMoney(amount) }))
  const gstAmount = roundMoney(gstByRate.reduce((s, r) => s + r.amount, 0))

  const taxableAdjustmentsTotal = roundMoney(
    (freight.isTaxable ? freight.calculatedAmount : 0) +
      (installation.isTaxable ? installation.calculatedAmount : 0) +
      (otherCharges.isTaxable ? otherCharges.calculatedAmount : 0),
  )
  const nonTaxableAdjustmentsTotal = roundMoney(
    (!freight.isTaxable ? freight.calculatedAmount : 0) +
      (!installation.isTaxable ? installation.calculatedAmount : 0) +
      (!otherCharges.isTaxable ? otherCharges.calculatedAmount : 0),
  )

  const grandTotal = roundMoney(
    discountedTaxableAmount +
      gstAmount +
      freight.calculatedAmount +
      installation.calculatedAmount +
      otherCharges.calculatedAmount,
  )

  return {
    basicAmount,
    itemDiscountAmount,
    taxableAmount,
    orderDiscount,
    discountedTaxableAmount,
    freight,
    installation,
    otherCharges,
    gstAmount,
    gstByRate,
    taxableAdjustmentsTotal,
    nonTaxableAdjustmentsTotal,
    roundOff: 0,
    grandTotal,
    freightAmount: freight.calculatedAmount,
    installationAmount: installation.calculatedAmount,
    customCharges: otherCharges.calculatedAmount,
  }
}

export function adjustmentsFromDocumentFields(doc: {
  freightAmount?: number | null
  installationAmount?: number | null
  customCharges?: number | null
  freightCalcType?: string | null
  freightValue?: number | null
  freightIsTaxable?: boolean | null
  freightTaxRate?: number | null
  installationCalcType?: string | null
  installationValue?: number | null
  installationIsTaxable?: boolean | null
  installationTaxRate?: number | null
  customChargesCalcType?: string | null
  customChargesValue?: number | null
  customChargesIsTaxable?: boolean | null
  customChargesTaxRate?: number | null
  orderDiscountCalcType?: string | null
  orderDiscountValue?: number | null
}): OrderAdjustmentsBundle {
  const freightType = normalizeCalcType(doc.freightCalcType ?? 'FLAT')
  const installType = normalizeCalcType(doc.installationCalcType ?? 'FLAT')
  const otherType = normalizeCalcType(doc.customChargesCalcType ?? 'FLAT')
  const discType = normalizeCalcType(doc.orderDiscountCalcType ?? 'FLAT')

  return {
    orderDiscount: {
      calculationType: discType,
      value: sanitizeNonNeg(doc.orderDiscountValue ?? 0),
    },
    freight: {
      calculationType: freightType,
      value:
        freightType === 'PERCENTAGE'
          ? sanitizePct(doc.freightValue ?? 0)
          : sanitizeNonNeg(doc.freightValue ?? doc.freightAmount ?? 0),
      isTaxable: Boolean(doc.freightIsTaxable),
      taxRate: doc.freightTaxRate ?? undefined,
    },
    installation: {
      calculationType: installType,
      value:
        installType === 'PERCENTAGE'
          ? sanitizePct(doc.installationValue ?? 0)
          : sanitizeNonNeg(doc.installationValue ?? doc.installationAmount ?? 0),
      isTaxable: Boolean(doc.installationIsTaxable),
      taxRate: doc.installationTaxRate ?? undefined,
    },
    otherCharges: {
      calculationType: otherType,
      value:
        otherType === 'PERCENTAGE'
          ? sanitizePct(doc.customChargesValue ?? 0)
          : sanitizeNonNeg(doc.customChargesValue ?? doc.customCharges ?? 0),
      isTaxable: Boolean(doc.customChargesIsTaxable),
      taxRate: doc.customChargesTaxRate ?? undefined,
    },
  }
}
