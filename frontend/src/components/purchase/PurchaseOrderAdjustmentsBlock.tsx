import { useMemo } from 'react'
import {
  ChargeEditor,
  OrderAdjustmentsPanel,
} from '@/components/erp/OrderAdjustmentsGrid'
import {
  calcOrderDocumentTotals,
  type OrderDocumentTotals,
} from '@/utils/orderAdjustmentsCalc'
import type { OrderDiscountMode } from '@/utils/opportunityLineCalc'
import { formatCurrency } from '@/utils/formatters/currency'

/** Default provisional GST used for PR estimate lines (matches `summarizePrLines`). */
export const PR_ESTIMATE_TAX_PCT = 18

export type PurchaseOrderAdjustmentsState = {
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

export function emptyPurchaseOrderAdjustments(): PurchaseOrderAdjustmentsState {
  return {
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
}

export type PrLineForOrderAdjust = {
  quantity: number
  estimatedRate: number
  amount?: number
  itemId?: string
  itemCode?: string
  itemName?: string
}

function isUsableLine(line: PrLineForOrderAdjust): boolean {
  return Boolean(
    (line.itemName ?? '').trim() ||
      (line.itemCode ?? '').trim() ||
      (line.itemId ?? '').trim(),
  )
}

function modeToCalcType(mode: OrderDiscountMode) {
  return mode === 'percent' ? ('PERCENTAGE' as const) : ('FLAT' as const)
}

/**
 * Live estimate totals from PR lines + Zoho-style order adjustments.
 * Client-side only — PR domain/API does not yet persist adjustment specs.
 */
export function computePrOrderDocumentTotals(
  lines: PrLineForOrderAdjust[],
  adj: PurchaseOrderAdjustmentsState,
  taxPct: number = PR_ESTIMATE_TAX_PCT,
): OrderDocumentTotals & { totalQty: number } {
  const usable = lines.filter(isUsableLine)
  const totalQty = usable.reduce((s, l) => s + (Number(l.quantity) || 0), 0)
  const totals = calcOrderDocumentTotals(
    usable.map((l) => ({
      qty: Number(l.quantity) || 0,
      unitPrice: Number(l.estimatedRate) || 0,
      discountPct: 0,
      taxPct,
    })),
    {
      orderDiscount: {
        calculationType: modeToCalcType(adj.orderDiscountMode),
        value: adj.orderDiscountInput,
      },
      freight: {
        calculationType: modeToCalcType(adj.freightMode),
        value: adj.freightValue,
        isTaxable: adj.freightIsTaxable,
        taxRate: adj.freightTaxRate,
      },
      installation: {
        calculationType: modeToCalcType(adj.installationMode),
        value: adj.installationValue,
        isTaxable: adj.installationIsTaxable,
        taxRate: adj.installationTaxRate,
      },
      otherCharges: {
        calculationType: modeToCalcType(adj.customChargesMode),
        value: adj.customChargesValue,
        isTaxable: adj.customChargesIsTaxable,
        taxRate: adj.customChargesTaxRate,
      },
    },
  )
  return { ...totals, totalQty }
}

export type PurchaseOrderAdjustmentsBlockProps = {
  lines: PrLineForOrderAdjust[]
  value: PurchaseOrderAdjustmentsState
  onChange: (next: PurchaseOrderAdjustmentsState) => void
  readOnly?: boolean
  taxPct?: number
  className?: string
}

/**
 * Zoho-style Order Adjustments + Order Summary after product lines
 * (shared charge grid + sales SO summary layout).
 */
export function PurchaseOrderAdjustmentsBlock({
  lines,
  value,
  onChange,
  readOnly = false,
  taxPct = PR_ESTIMATE_TAX_PCT,
  className,
}: PurchaseOrderAdjustmentsBlockProps) {
  const orderSummary = useMemo(
    () => computePrOrderDocumentTotals(lines, value, taxPct),
    [lines, value, taxPct],
  )

  const patch = (partial: Partial<PurchaseOrderAdjustmentsState>) => {
    onChange({ ...value, ...partial })
  }

  return (
    <div
      className={
        className
          ? `so-pricing-totals so-direct-order-summary ${className}`
          : 'so-pricing-totals so-direct-order-summary'
      }
    >
      <OrderAdjustmentsPanel title="Order adjustments">
        <ChargeEditor
          label="Order discount"
          mode={value.orderDiscountMode}
          value={value.orderDiscountInput}
          calculatedAmount={orderSummary.orderDiscount.calculatedAmount}
          isTaxable={false}
          taxRate={0}
          readOnly={readOnly}
          modePctLabel="% Disc."
          amountHint={
            orderSummary.orderDiscount.calculatedAmount > 0
              ? 'off taxable (before GST)'
              : undefined
          }
          onModeChange={(m) => patch({ orderDiscountMode: m, orderDiscountInput: 0 })}
          onValueChange={(n) => patch({ orderDiscountInput: n })}
        />
        <ChargeEditor
          label="Freight"
          mode={value.freightMode}
          value={value.freightValue}
          calculatedAmount={orderSummary.freight.calculatedAmount}
          isTaxable={value.freightIsTaxable}
          taxRate={value.freightTaxRate}
          readOnly={readOnly}
          showTax
          onModeChange={(m) => patch({ freightMode: m, freightValue: 0 })}
          onValueChange={(n) => patch({ freightValue: n })}
          onIsTaxableChange={(v) => patch({ freightIsTaxable: v })}
          onTaxRateChange={(r) => patch({ freightTaxRate: r })}
        />
        <ChargeEditor
          label="Installation"
          mode={value.installationMode}
          value={value.installationValue}
          calculatedAmount={orderSummary.installation.calculatedAmount}
          isTaxable={value.installationIsTaxable}
          taxRate={value.installationTaxRate}
          readOnly={readOnly}
          showTax
          onModeChange={(m) => patch({ installationMode: m, installationValue: 0 })}
          onValueChange={(n) => patch({ installationValue: n })}
          onIsTaxableChange={(v) => patch({ installationIsTaxable: v })}
          onTaxRateChange={(r) => patch({ installationTaxRate: r })}
        />
        <ChargeEditor
          label="Other charges"
          mode={value.customChargesMode}
          value={value.customChargesValue}
          calculatedAmount={orderSummary.otherCharges.calculatedAmount}
          isTaxable={value.customChargesIsTaxable}
          taxRate={value.customChargesTaxRate}
          readOnly={readOnly}
          showTax
          onModeChange={(m) => patch({ customChargesMode: m, customChargesValue: 0 })}
          onValueChange={(n) => patch({ customChargesValue: n })}
          onIsTaxableChange={(v) => patch({ customChargesIsTaxable: v })}
          onTaxRateChange={(r) => patch({ customChargesTaxRate: r })}
        />
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
          <div className="so-pricing-summary__row">
            <span>Taxable amount</span>
            <span className="tabular-nums">{formatCurrency(orderSummary.taxableAmount)}</span>
          </div>
          <div className="so-pricing-summary__row">
            <span>
              Overall discount
              {value.orderDiscountMode === 'percent' && value.orderDiscountInput > 0
                ? ` (${value.orderDiscountInput}%)`
                : ''}
            </span>
            <span className="tabular-nums">
              {orderSummary.orderDiscount.calculatedAmount > 0
                ? `−${formatCurrency(orderSummary.orderDiscount.calculatedAmount)}`
                : formatCurrency(0)}
            </span>
          </div>
          {orderSummary.orderDiscount.calculatedAmount > 0 ? (
            <div className="so-pricing-summary__row">
              <span>Taxable after discount</span>
              <span className="tabular-nums">
                {formatCurrency(orderSummary.discountedTaxableAmount)}
              </span>
            </div>
          ) : null}
          {orderSummary.freight.calculatedAmount > 0 ? (
            <div className="so-pricing-summary__row">
              <span>
                Freight
                {value.freightIsTaxable ? ' (taxable)' : ''}
                {value.freightMode === 'percent' && value.freightValue > 0
                  ? ` ${value.freightValue}%`
                  : ''}
              </span>
              <span className="tabular-nums">
                {formatCurrency(orderSummary.freight.calculatedAmount)}
              </span>
            </div>
          ) : null}
          {orderSummary.installation.calculatedAmount > 0 ? (
            <div className="so-pricing-summary__row">
              <span>
                Installation
                {value.installationIsTaxable ? ' (taxable)' : ''}
              </span>
              <span className="tabular-nums">
                {formatCurrency(orderSummary.installation.calculatedAmount)}
              </span>
            </div>
          ) : null}
          {orderSummary.otherCharges.calculatedAmount > 0 ? (
            <div className="so-pricing-summary__row">
              <span>
                Other charges
                {value.customChargesIsTaxable ? ' (taxable)' : ''}
              </span>
              <span className="tabular-nums">
                {formatCurrency(orderSummary.otherCharges.calculatedAmount)}
              </span>
            </div>
          ) : null}
          {orderSummary.gstByRate.map(({ rate, amount }) => (
            <div key={rate} className="so-pricing-summary__row">
              <span>GST @ {rate}%</span>
              <span className="tabular-nums">{formatCurrency(amount)}</span>
            </div>
          ))}
          <div className="so-pricing-summary__row">
            <span>Total GST</span>
            <span className="tabular-nums">{formatCurrency(orderSummary.gstAmount)}</span>
          </div>
        </div>
        <div className="so-pricing-summary__grand">
          <span>Grand total</span>
          <strong className="tabular-nums">{formatCurrency(orderSummary.grandTotal)}</strong>
        </div>
      </aside>
    </div>
  )
}
