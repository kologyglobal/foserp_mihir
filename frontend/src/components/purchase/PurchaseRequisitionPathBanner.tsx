import { cn } from '@/utils/cn'

type Props = {
  rfqRequired: boolean
  className?: string
}

/**
 * Visible process path for a purchase requisition.
 * Label must stay “RFQ Required?” elsewhere — never “Skip RFQ”.
 */
export function PurchaseRequisitionPathBanner({ rfqRequired, className }: Props) {
  return (
    <div
      role="status"
      className={cn(
        'rounded-md border px-3 py-2.5',
        rfqRequired
          ? 'border-sky-200 bg-sky-50/80'
          : 'border-emerald-200 bg-emerald-50/80',
        className,
      )}
    >
      <p className="text-[13px] font-semibold text-erp-text">
        {rfqRequired ? 'RFQ Purchase Path' : 'Direct Purchase Planning Path'}
      </p>
      <p className="mt-0.5 text-[12px] text-erp-muted">
        {rfqRequired
          ? 'RFQ is required to create PO'
          : 'Create Direct PO'}
      </p>
    </div>
  )
}
