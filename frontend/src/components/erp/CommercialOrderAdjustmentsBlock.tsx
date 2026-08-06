import type { ReactNode } from 'react'
import {
  ChargeEditor,
  OrderAdjustmentsPanel,
} from '@/components/erp/OrderAdjustmentsGrid'
import type { SoOrderCharges } from '@/components/sales/SalesOrderLinesEditor'
import { emptySoOrderCharges } from '@/components/sales/SalesOrderLinesEditor'
import type { ProductPricingSummary } from '@/utils/opportunityLineCalc'
import type { OrderDiscountMode } from '@/utils/opportunityLineCalc'
import { formatCurrency } from '@/utils/formatters/currency'

export type CommercialOrderCharges = SoOrderCharges

export { emptySoOrderCharges as emptyCommercialOrderCharges }

/** Optional GST scheme breakdown for commercial documents (inter/intra). */
export type CommercialGstSummaryExtras = {
  schemeLabel?: string | null
  cgstAmount?: number
  sgstAmount?: number
  igstAmount?: number
}

export type CommercialOrderAdjustmentsBlockProps = {
  value: CommercialOrderCharges
  onChange: (next: CommercialOrderCharges) => void
  /** Live totals from `calcProductPricingSummary` (or equivalent). */
  summary: Pick<
    ProductPricingSummary,
    | 'totalQty'
    | 'basicAmount'
    | 'totalLineDiscount'
    | 'taxableBeforeOverallDiscount'
    | 'taxableAfterOverallDiscount'
    | 'orderDiscountAmount'
    | 'freightAmount'
    | 'installationAmount'
    | 'customCharges'
    | 'gstByRate'
    | 'totalGst'
    | 'grandTotal'
  >
  readOnly?: boolean
  showFreight?: boolean
  showExtendedCharges?: boolean
  /** GST scheme + CGST/SGST/IGST rows (tax invoice / proforma / SO with supply context). */
  gstExtras?: CommercialGstSummaryExtras | null
  title?: string
  summaryTitle?: string
  className?: string
  /** Extra rows between charge totals and GST (e.g. custom notes). */
  summaryExtraRows?: ReactNode
}

/**
 * Zoho-style Order adjustments (6-col: Charge | Type | Value | Apply tax | GST % | Amount)
 * + Order summary — shared across purchase, CRM pricing, SO, proforma, tax invoice.
 */
export function CommercialOrderAdjustmentsBlock({
  value,
  onChange,
  summary,
  readOnly = false,
  showFreight = true,
  showExtendedCharges = true,
  gstExtras,
  title = 'Order adjustments',
  summaryTitle = 'Order summary',
  className,
  summaryExtraRows,
}: CommercialOrderAdjustmentsBlockProps) {
  const patch = (partial: Partial<CommercialOrderCharges>) => {
    onChange({ ...value, ...partial })
  }

  const shellClass = className
    ? `so-pricing-totals so-direct-order-summary ${className}`
    : 'so-pricing-totals so-direct-order-summary'

  const showCgstSgst =
    Boolean(gstExtras) &&
    ((gstExtras?.cgstAmount ?? 0) > 0 || (gstExtras?.sgstAmount ?? 0) > 0)
  const showIgst = Boolean(gstExtras) && (gstExtras?.igstAmount ?? 0) > 0

  return (
    <div className={shellClass}>
      <OrderAdjustmentsPanel title={title}>
        <ChargeEditor
          label="Order discount"
          mode={value.orderDiscountMode}
          value={value.orderDiscountInput}
          calculatedAmount={summary.orderDiscountAmount}
          isTaxable={false}
          taxRate={0}
          readOnly={readOnly}
          modePctLabel="% Disc."
          amountHint={
            summary.orderDiscountAmount > 0 ? 'off taxable (before GST)' : undefined
          }
          onModeChange={(m: OrderDiscountMode) =>
            patch({ orderDiscountMode: m, orderDiscountInput: 0 })
          }
          onValueChange={(n) => patch({ orderDiscountInput: n })}
        />

        {showFreight ? (
          <ChargeEditor
            label="Freight"
            mode={value.freightMode}
            value={value.freightValue}
            calculatedAmount={summary.freightAmount}
            isTaxable={value.freightIsTaxable}
            taxRate={value.freightTaxRate}
            readOnly={readOnly}
            showTax
            onModeChange={(m) => patch({ freightMode: m, freightValue: 0 })}
            onValueChange={(n) => patch({ freightValue: n })}
            onIsTaxableChange={(v) =>
              patch({
                freightIsTaxable: v,
                freightTaxRate: v ? value.freightTaxRate || 18 : 0,
              })
            }
            onTaxRateChange={(r) => patch({ freightTaxRate: r })}
          />
        ) : null}

        {showExtendedCharges ? (
          <>
            <ChargeEditor
              label="Installation"
              mode={value.installationMode}
              value={value.installationValue}
              calculatedAmount={summary.installationAmount}
              isTaxable={value.installationIsTaxable}
              taxRate={value.installationTaxRate}
              readOnly={readOnly}
              showTax
              onModeChange={(m) => patch({ installationMode: m, installationValue: 0 })}
              onValueChange={(n) => patch({ installationValue: n })}
              onIsTaxableChange={(v) =>
                patch({
                  installationIsTaxable: v,
                  installationTaxRate: v ? value.installationTaxRate || 18 : 0,
                })
              }
              onTaxRateChange={(r) => patch({ installationTaxRate: r })}
            />
            <ChargeEditor
              label="Other charges"
              mode={value.customChargesMode}
              value={value.customChargesValue}
              calculatedAmount={summary.customCharges}
              isTaxable={value.customChargesIsTaxable}
              taxRate={value.customChargesTaxRate}
              readOnly={readOnly}
              showTax
              onModeChange={(m) => patch({ customChargesMode: m, customChargesValue: 0 })}
              onValueChange={(n) => patch({ customChargesValue: n })}
              onIsTaxableChange={(v) =>
                patch({
                  customChargesIsTaxable: v,
                  customChargesTaxRate: v ? value.customChargesTaxRate || 18 : 0,
                })
              }
              onTaxRateChange={(r) => patch({ customChargesTaxRate: r })}
            />
          </>
        ) : null}
      </OrderAdjustmentsPanel>

      <aside className="so-pricing-summary" aria-label={summaryTitle}>
        <p className="so-pricing-summary__title">{summaryTitle}</p>
        <div className="so-pricing-summary__rows">
          <div className="so-pricing-summary__row">
            <span>Total quantity</span>
            <span className="tabular-nums">{summary.totalQty}</span>
          </div>
          <div className="so-pricing-summary__row">
            <span>Basic amount</span>
            <span className="tabular-nums">{formatCurrency(summary.basicAmount)}</span>
          </div>
          {summary.totalLineDiscount > 0 ? (
            <div className="so-pricing-summary__row">
              <span>Line discount</span>
              <span className="tabular-nums">−{formatCurrency(summary.totalLineDiscount)}</span>
            </div>
          ) : null}
          <div className="so-pricing-summary__row">
            <span>Taxable amount</span>
            <span className="tabular-nums">
              {formatCurrency(summary.taxableBeforeOverallDiscount)}
            </span>
          </div>
          <div className="so-pricing-summary__row">
            <span>
              Overall discount
              {value.orderDiscountMode === 'percent' && value.orderDiscountInput > 0
                ? ` (${value.orderDiscountInput}%)`
                : ''}
            </span>
            <span className="tabular-nums">
              {summary.orderDiscountAmount > 0
                ? `−${formatCurrency(summary.orderDiscountAmount)}`
                : formatCurrency(0)}
            </span>
          </div>
          {summary.orderDiscountAmount > 0 ? (
            <div className="so-pricing-summary__row">
              <span>Taxable after discount</span>
              <span className="tabular-nums">
                {formatCurrency(summary.taxableAfterOverallDiscount)}
              </span>
            </div>
          ) : null}
          {summary.freightAmount > 0 ? (
            <div className="so-pricing-summary__row">
              <span>
                Freight
                {value.freightIsTaxable ? ' (taxable)' : ''}
                {value.freightMode === 'percent' && value.freightValue > 0
                  ? ` ${value.freightValue}%`
                  : ''}
              </span>
              <span className="tabular-nums">{formatCurrency(summary.freightAmount)}</span>
            </div>
          ) : null}
          {summary.installationAmount > 0 ? (
            <div className="so-pricing-summary__row">
              <span>
                Installation
                {value.installationIsTaxable ? ' (taxable)' : ''}
              </span>
              <span className="tabular-nums">{formatCurrency(summary.installationAmount)}</span>
            </div>
          ) : null}
          {summary.customCharges > 0 ? (
            <div className="so-pricing-summary__row">
              <span>
                Other charges
                {value.customChargesIsTaxable ? ' (taxable)' : ''}
              </span>
              <span className="tabular-nums">{formatCurrency(summary.customCharges)}</span>
            </div>
          ) : null}

          {gstExtras?.schemeLabel ? (
            <div className="so-pricing-summary__row">
              <span>GST scheme</span>
              <span>{gstExtras.schemeLabel}</span>
            </div>
          ) : null}

          {showCgstSgst || showIgst
            ? null
            : [...summary.gstByRate.entries()]
                .sort(([a], [b]) => a - b)
                .map(([rate, amount]) => (
                  <div key={rate} className="so-pricing-summary__row">
                    <span>GST @ {rate}%</span>
                    <span className="tabular-nums">{formatCurrency(amount)}</span>
                  </div>
                ))}

          {showCgstSgst ? (
            <>
              <div className="so-pricing-summary__row">
                <span>CGST</span>
                <span className="tabular-nums">{formatCurrency(gstExtras?.cgstAmount ?? 0)}</span>
              </div>
              <div className="so-pricing-summary__row">
                <span>SGST</span>
                <span className="tabular-nums">{formatCurrency(gstExtras?.sgstAmount ?? 0)}</span>
              </div>
            </>
          ) : null}
          {showIgst ? (
            <div className="so-pricing-summary__row">
              <span>IGST</span>
              <span className="tabular-nums">{formatCurrency(gstExtras?.igstAmount ?? 0)}</span>
            </div>
          ) : null}

          <div className="so-pricing-summary__row">
            <span>Total GST</span>
            <span className="tabular-nums">{formatCurrency(summary.totalGst)}</span>
          </div>

          {summaryExtraRows}
        </div>
        <div className="so-pricing-summary__grand">
          <span>Grand total</span>
          <strong className="tabular-nums">{formatCurrency(summary.grandTotal)}</strong>
        </div>
      </aside>
    </div>
  )
}
