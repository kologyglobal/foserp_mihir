import { Badge } from '../ui/Badge'
import type { VoucherStatus } from '../../types/accounting'
import { VOUCHER_STATUS_LABELS } from '../../types/accounting'

const STATUS_COLOR: Record<VoucherStatus, 'gray' | 'blue' | 'yellow' | 'green' | 'red' | 'purple'> = {
  draft: 'gray',
  pending_approval: 'yellow',
  approved: 'blue',
  posted: 'green',
  rejected: 'red',
  reversed: 'purple',
}

export function AccountingStatusBadge({ status }: { status: VoucherStatus }) {
  return <Badge color={STATUS_COLOR[status]} dot>{VOUCHER_STATUS_LABELS[status]}</Badge>
}
