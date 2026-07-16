import { EnterpriseStatusChip } from '../enterprise/EnterpriseStatusChip'

export type StatusBadgeTone =
  | 'open'
  | 'qualified'
  | 'converted'
  | 'lost'
  | 'closed'
  | 'hold'
  | 'live'
  | 'pending'
  | 'success'
  | 'warning'
  | 'critical'
  | 'neutral'

/** Standard CRM/Sales status badge — consistent size, radius, and colors. */
export function StatusBadge({ label, status }: { label: string; status?: string }) {
  return <EnterpriseStatusChip label={label} status={status} />
}
