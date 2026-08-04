import type { ReactNode } from 'react'
import { Input } from '../forms/Inputs'
import { formatCurrency } from '../../utils/formatters/currency'
import type { OrderDiscountMode } from '../../utils/opportunityLineCalc'

/** Shared GST rate options for charge taxability controls. */
export const PRODUCT_PRICING_GST_RATES = [0, 5, 12, 18, 28] as const

export function ModeToggle({
  mode,
  onChange,
  readOnly,
  flatLabel = 'Flat ₹',
  pctLabel = '%',
}: {
  mode: OrderDiscountMode
  onChange: (m: OrderDiscountMode) => void
  readOnly?: boolean
  flatLabel?: string
  pctLabel?: string
}) {
  if (readOnly) return null
  return (
    <div className="so-pricing-discount-mode" role="group" aria-label="Calculation type">
      <button
        type="button"
        className={`so-pricing-discount-mode__btn${mode === 'flat' ? ' so-pricing-discount-mode__btn--active' : ''}`}
        aria-pressed={mode === 'flat'}
        onClick={() => {
          if (mode === 'flat') return
          onChange('flat')
        }}
      >
        {flatLabel}
      </button>
      <button
        type="button"
        className={`so-pricing-discount-mode__btn${mode === 'percent' ? ' so-pricing-discount-mode__btn--active' : ''}`}
        aria-pressed={mode === 'percent'}
        onClick={() => {
          if (mode === 'percent') return
          onChange('percent')
        }}
      >
        {pctLabel}
      </button>
    </div>
  )
}

export type ChargeEditorProps = {
  label: string
  mode: OrderDiscountMode
  value: number
  calculatedAmount: number
  isTaxable?: boolean
  taxRate?: number
  readOnly?: boolean
  disabled?: boolean
  onModeChange: (m: OrderDiscountMode) => void
  onValueChange: (n: number) => void
  onIsTaxableChange?: (v: boolean) => void
  onTaxRateChange?: (r: number) => void
  showTax?: boolean
  /** Extra amount line when no tax (e.g. discount explanation). */
  amountHint?: string
  modePctLabel?: string
}

/**
 * One adjustment row in the 6-column grid:
 * Charge | Type | Value | Apply tax | GST % | Amount
 */
export function ChargeEditor({
  label,
  mode,
  value,
  calculatedAmount,
  isTaxable = false,
  taxRate = 0,
  readOnly,
  disabled,
  onModeChange,
  onValueChange,
  onIsTaxableChange,
  onTaxRateChange,
  showTax,
  amountHint,
  modePctLabel = '%',
}: ChargeEditorProps) {
  const showCalc = mode === 'percent' || calculatedAmount > 0

  return (
    <div className="so-pricing-charge so-pricing-charge--row" role="row">
      <span className="so-pricing-charge__label">{label}</span>

      <div className="so-pricing-charge__mode">
        <ModeToggle
          mode={mode}
          readOnly={readOnly || disabled}
          onChange={onModeChange}
          pctLabel={modePctLabel}
        />
      </div>

      <label className="so-pricing-charge__control">
        <span className="so-pricing-charge__prefix" aria-hidden>
          {mode === 'percent' ? '%' : '₹'}
        </span>
        <Input
          type="number"
          min={0}
          max={mode === 'percent' ? 100 : undefined}
          step={mode === 'percent' ? 0.5 : 1}
          className="so-pricing-input so-pricing-input--num"
          value={value}
          onChange={(e) => {
            const raw = Math.max(0, Number(e.target.value) || 0)
            onValueChange(mode === 'percent' ? Math.min(100, raw) : raw)
          }}
          disabled={readOnly || disabled}
          aria-label={`${label} value`}
        />
      </label>

      {showTax ? (
        <label className="so-pricing-charge__tax">
          <span className="so-pricing-charge__tax-label so-pricing-charge__tax-label--mobile">Apply tax</span>
          <select
            className="erp-input so-pricing-input so-pricing-input--select"
            value={isTaxable ? 'taxable' : 'non_taxable'}
            disabled={readOnly || disabled}
            onChange={(e) => onIsTaxableChange?.(e.target.value === 'taxable')}
            aria-label={`${label} tax applicability`}
          >
            <option value="non_taxable">Non-Taxable</option>
            <option value="taxable">Taxable</option>
          </select>
        </label>
      ) : (
        <span className="so-pricing-charge__tax-na" title="Not taxable">
          —
        </span>
      )}

      {showTax && isTaxable ? (
        <label className="so-pricing-charge__tax">
          <span className="so-pricing-charge__tax-label so-pricing-charge__tax-label--mobile">GST %</span>
          <select
            className="erp-input so-pricing-input so-pricing-input--select"
            value={taxRate > 0 ? taxRate : 18}
            disabled={readOnly || disabled}
            onChange={(e) => onTaxRateChange?.(Number(e.target.value))}
            aria-label={`${label} GST rate`}
          >
            {PRODUCT_PRICING_GST_RATES.map((rate) => (
              <option key={rate} value={rate}>{rate}%</option>
            ))}
          </select>
        </label>
      ) : (
        <span className="so-pricing-charge__tax-na" aria-hidden>
          —
        </span>
      )}

      <div className="so-pricing-charge__amount">
        {showCalc ? (
          <>
            <span className="so-pricing-charge__amount-value tabular-nums">
              {formatCurrency(calculatedAmount)}
            </span>
            {amountHint ? (
              <span className="so-pricing-charge__hint">{amountHint}</span>
            ) : mode === 'percent' ? (
              <span className="so-pricing-charge__hint">of taxable</span>
            ) : null}
          </>
        ) : (
          <span className="so-pricing-charge__tax-na">—</span>
        )}
      </div>
    </div>
  )
}

/** Shared Order adjustments shell: title + 6-col header + rows. */
export function OrderAdjustmentsPanel({
  title = 'Order adjustments',
  children,
  className,
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className ? `so-pricing-adjust ${className}` : 'so-pricing-adjust'}>
      <p className="so-pricing-adjust__title">{title}</p>
      <div className="so-pricing-charges" role="table" aria-label={title}>
        <div className="so-pricing-charges__head" role="row" aria-hidden>
          <span>Charge</span>
          <span>Type</span>
          <span>Value</span>
          <span>Apply tax</span>
          <span>GST %</span>
          <span>Amount</span>
        </div>
        {children}
      </div>
    </div>
  )
}
