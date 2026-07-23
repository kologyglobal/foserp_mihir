import { cn } from '@/utils/cn'

type Props = {
  rfqRequired: boolean
  className?: string
}

/**
 * Compact process-path hint for a purchase requisition.
 * Label must stay “RFQ Required?” elsewhere — never “Skip RFQ”.
 */
export function PurchaseRequisitionPathBanner({ rfqRequired, className }: Props) {
  return (
    <div
      role="status"
      className={cn(
        'rounded-md border border-erp-border bg-erp-surface px-3 py-2',
        className,
      )}
    >
      <p className="text-[13px] font-semibold text-erp-text">
        {rfqRequired ? 'RFQ Purchase Path' : 'Direct Purchase Planning Path'}
      </p>
      <p className="mt-0.5 text-[12px] text-erp-muted">
        {rfqRequired ? 'RFQ is required to create PO' : 'Create Direct PO'}
      </p>
    </div>
  )
}
