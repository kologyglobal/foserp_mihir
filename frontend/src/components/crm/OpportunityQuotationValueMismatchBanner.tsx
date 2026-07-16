import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { formatCrmCurrency } from '@/utils/crmMetrics'
import { cn } from '@/utils/cn'
import {
  buildMismatchDismissKey,
  compareOpportunityQuotationValues,
  dismissOppQuoteMismatch,
  isOppQuoteMismatchDismissed,
} from '@/utils/opportunityQuotationValueMismatch'

export interface OpportunityQuotationValueMismatchBannerProps {
  opportunityId: string
  opportunityValue: number
  quotationGrandTotal: number
  /** Quotation document id, quotation id, or `new` while creating. */
  documentKey: string
  onUpdateOpportunityValue: () => void | Promise<void>
  onReviewPricing: () => void
  canUpdateOpportunity?: boolean
  className?: string
}

/**
 * Amber Dynamics-style callout when linked opportunity estimate ≠ quotation grand total.
 * Shared across quotation new / 360 and opportunity 360.
 */
export function OpportunityQuotationValueMismatchBanner({
  opportunityId,
  opportunityValue,
  quotationGrandTotal,
  documentKey,
  onUpdateOpportunityValue,
  onReviewPricing,
  canUpdateOpportunity = true,
  className,
}: OpportunityQuotationValueMismatchBannerProps) {
  const comparison = compareOpportunityQuotationValues(opportunityValue, quotationGrandTotal)
  const dismissKey = comparison
    ? buildMismatchDismissKey(opportunityId, documentKey, opportunityValue, quotationGrandTotal)
    : ''
  const [dismissed, setDismissed] = useState(() =>
    dismissKey ? isOppQuoteMismatchDismissed(dismissKey) : false,
  )
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    setDismissed(dismissKey ? isOppQuoteMismatchDismissed(dismissKey) : false)
  }, [dismissKey])

  if (!comparison || !dismissKey || dismissed) return null

  function handleKeep() {
    dismissOppQuoteMismatch(dismissKey)
    setDismissed(true)
  }

  async function handleUpdate() {
    setUpdating(true)
    try {
      await onUpdateOpportunityValue()
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div
      role="status"
      className={cn(
        'dyn-detail-banner dyn-detail-banner--warning flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] font-medium leading-snug">{comparison.message}</p>
          <p className="text-[12px] leading-snug opacity-90">
            Opportunity estimate {formatCrmCurrency(comparison.opportunityValue)}
            {' · '}
            Quotation grand total {formatCrmCurrency(comparison.quotationGrandTotal)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
        <ErpButton type="button" size="sm" variant="ghost" onClick={handleKeep}>
          Keep quotation value
        </ErpButton>
        {canUpdateOpportunity ? (
          <ErpButton
            type="button"
            size="sm"
            variant="outline"
            disabled={updating}
            onClick={() => void handleUpdate()}
          >
            {updating ? 'Updating…' : 'Update opportunity value'}
          </ErpButton>
        ) : null}
        <ErpButton type="button" size="sm" variant="secondary" onClick={onReviewPricing}>
          Review pricing
        </ErpButton>
      </div>
    </div>
  )
}
