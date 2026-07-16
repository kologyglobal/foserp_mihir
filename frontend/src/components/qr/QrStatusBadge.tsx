import { Badge, statusColor, formatStatus } from '../ui/Badge'
import type { QrStatus } from '../../types/qrTraceability'

const STATUS_COLOR: Record<QrStatus, ReturnType<typeof statusColor>> = {
  CREATED: 'gray',
  IN_STOCK: 'green',
  ISSUED: 'blue',
  IN_WIP: 'purple',
  AT_VENDOR: 'orange',
  QC_HOLD: 'red',
  QC_PASSED: 'green',
  REJECTED: 'red',
  CONSUMED: 'yellow',
  DISPATCHED: 'green',
  CLOSED: 'gray',
}

export function QrStatusBadge({ status }: { status: QrStatus }) {
  return <Badge color={STATUS_COLOR[status] ?? 'gray'}>{formatStatus(status)}</Badge>
}
