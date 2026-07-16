import { ErpViewField } from '@/components/erp/card-form'
import { formatCrmCurrency } from '@/utils/crmMetrics'
import { formatDate } from '@/utils/dates/format'
import type { OpportunityCommercialBreakdown } from '@/utils/opportunityLineCalc'
import { cn } from '@/utils/cn'

export interface OpportunityCommercialBreakdownPanelProps {
  breakdown: OpportunityCommercialBreakdown
  expectedCloseDate?: string | null
  className?: string
}

/** Commercial value breakdown — separates pipeline estimate from product quote totals. */
export function OpportunityCommercialBreakdownPanel({
  breakdown,
  expectedCloseDate,
  className,
}: OpportunityCommercialBreakdownPanelProps) {
  const {
    hasProductLines,
    dealValueIsManualEstimate,
    dealValueLabel,
    dealValueHint,
    estimatedDealValue,
    productSubtotal,
    discount,
    tax,
    otherCharges,
    finalQuotedValue,
    probability,
    weightedForecast,
    weightedHint,
  } = breakdown

  return (
    <div className={cn('opp-commercial-breakdown', className)}>
      <div className="erp-form-grid erp-form-grid--dense erp-form-grid--cols-3">
        <ErpViewField
          label={`${dealValueLabel} (₹)`}
          value={formatCrmCurrency(estimatedDealValue)}
          hint={dealValueHint}
        />
        <ErpViewField
          label="Probability"
          value={`${probability}%`}
          hint="Win probability used for pipeline weighted forecast."
        />
        <ErpViewField
          label="Weighted Forecast (₹)"
          value={formatCrmCurrency(weightedForecast)}
          hint={weightedHint}
        />
        <ErpViewField
          label="Expected Close Date"
          value={expectedCloseDate ? formatDate(expectedCloseDate) : undefined}
        />
      </div>

      {hasProductLines ? (
        <div className="opp-commercial-breakdown__quote" aria-label="Product quote breakdown">
          <p className="opp-commercial-breakdown__quote-title">Product quote breakdown</p>
          {dealValueIsManualEstimate ? (
            <p className="opp-commercial-breakdown__note">
              Estimated Deal Value differs from product totals. Final Quoted Value is what the lines add up to;
              sync on edit saves the product total as the deal value.
            </p>
          ) : null}
          <dl className="opp-commercial-breakdown__rows">
            <div className="opp-commercial-breakdown__row">
              <dt title="Sum of qty × unit price before discount">Product Subtotal</dt>
              <dd>{formatCrmCurrency(productSubtotal)}</dd>
            </div>
            <div className="opp-commercial-breakdown__row">
              <dt title="Total line discounts">Discount</dt>
              <dd>{discount > 0 ? `− ${formatCrmCurrency(discount)}` : formatCrmCurrency(0)}</dd>
            </div>
            <div className="opp-commercial-breakdown__row">
              <dt title="GST / tax from product lines">Tax</dt>
              <dd>{formatCrmCurrency(tax)}</dd>
            </div>
            <div className="opp-commercial-breakdown__row">
              <dt title="Freight, installation, and other commercial charges (when captured)">Other Charges</dt>
              <dd>{otherCharges > 0 ? formatCrmCurrency(otherCharges) : '—'}</dd>
            </div>
            <div className="opp-commercial-breakdown__row opp-commercial-breakdown__row--total">
              <dt title="Product subtotal − discount + tax + other charges">Final Quoted Value</dt>
              <dd>{formatCrmCurrency(finalQuotedValue)}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="opp-commercial-breakdown__note">
          Add product lines to build Product Subtotal, Tax, and Final Quoted Value. Until then,
          Estimated Deal Value drives the weighted forecast.
        </p>
      )}
    </div>
  )
}
