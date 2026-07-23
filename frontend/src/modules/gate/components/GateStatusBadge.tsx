import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { resolveGateStatusMeta } from '../utils/gateStatus'

export function GateStatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = resolveGateStatusMeta(status)
  return <ErpStatusChip label={meta.label} tone={meta.tone} className={className} />
}
