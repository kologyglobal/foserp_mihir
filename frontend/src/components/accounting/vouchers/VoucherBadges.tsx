import { Badge } from '@/components/ui/Badge'
import type { VoucherDocumentType, VoucherLifecycleStatus } from '@/types/vouchers'
import { VOUCHER_DOCUMENT_TYPE_LABELS, VOUCHER_LIFECYCLE_LABELS } from '@/types/vouchers'

const STATUS_COLOR: Record<
  VoucherLifecycleStatus,
  'gray' | 'blue' | 'yellow' | 'green' | 'red' | 'purple' | 'orange'
> = {
  draft: 'gray',
  pending_approval: 'yellow',
  approved: 'blue',
  posted: 'green',
  rejected: 'red',
  sent_back: 'orange',
  reversed: 'purple',
  cancelled: 'gray',
}

export function VoucherStatusBadge({ status }: { status: VoucherLifecycleStatus }) {
  return (
    <Badge color={STATUS_COLOR[status]} dot>
      {VOUCHER_LIFECYCLE_LABELS[status]}
    </Badge>
  )
}

export function VoucherTypeBadge({ type }: { type: VoucherDocumentType }) {
  return <Badge color="blue">{VOUCHER_DOCUMENT_TYPE_LABELS[type]}</Badge>
}
