/**
 * Canonical document/workflow status → semantic tone.
 * Used by StatusDot chips and Badge.statusColor so colors stay consistent app-wide.
 *
 * success/green — Active, Approved, Completed, Paid, …
 * warning/amber — Pending, Submitted, Partial, …
 * danger/red    — Rejected, Cancelled, Overdue, …
 * info/blue     — Open, Sent, In Progress, …
 * neutral/gray  — Draft, Inactive, Planned, …
 */
export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

function normalizeStatus(status: string): string {
  return status.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

const EXACT_TONE: Record<string, StatusTone> = {
  active: 'success',
  approved: 'success',
  available: 'success',
  closed: 'success',
  'closed won': 'success',
  completed: 'success',
  converted: 'success',
  delivered: 'success',
  dispatched: 'success',
  'fg received': 'success',
  'fully issued': 'success',
  'fully received': 'success',
  implemented: 'success',
  invoiced: 'success',
  issued: 'success',
  paid: 'success',
  passed: 'success',
  posted: 'success',
  ready: 'success',
  'ready dispatch': 'success',
  received: 'success',
  resolved: 'success',
  won: 'success',
  success: 'success',

  investigating: 'warning',
  loading: 'warning',
  partial: 'warning',
  'partial received': 'warning',
  'partially issued': 'warning',
  'partially received': 'warning',
  'partially reserved': 'warning',
  pending: 'warning',
  'pending approval': 'warning',
  'qc pending': 'warning',
  quoted: 'warning',
  submitted: 'warning',
  unpaid: 'warning',
  'under review': 'warning',
  warning: 'warning',

  cancelled: 'danger',
  canceled: 'danger',
  'closed lost': 'danger',
  critical: 'danger',
  failed: 'danger',
  lost: 'danger',
  'low stock': 'danger',
  'on hold': 'danger',
  'out of stock': 'danger',
  overdue: 'danger',
  rejected: 'danger',
  danger: 'danger',

  confirmed: 'info',
  engineering: 'info',
  'in progress': 'info',
  'in production': 'info',
  'in transit': 'info',
  open: 'info',
  released: 'info',
  reserved: 'info',
  'material reserved': 'info',
  sent: 'info',
  info: 'info',

  archived: 'neutral',
  draft: 'neutral',
  inactive: 'neutral',
  obsolete: 'neutral',
  planned: 'neutral',
  gray: 'neutral',
  grey: 'neutral',
  neutral: 'neutral',
}

export function statusToneFromLabel(status: string): StatusTone {
  const s = normalizeStatus(status)
  if (EXACT_TONE[s]) return EXACT_TONE[s]

  if (/\b(lost|rejected|failed|cancel+ed|overdue|critical|out of stock|low stock|on hold)\b/.test(s)) {
    return 'danger'
  }
  if (
    /\b(active|approved|completed|paid|passed|posted|delivered|dispatched|received|converted|won|ready|available|resolved|invoiced)\b/.test(
      s,
    )
  ) {
    return 'success'
  }
  if (/\b(pending|submitted|partial|unpaid|loading|quoted|investigating|under review|qc)\b/.test(s)) {
    return 'warning'
  }
  if (/\b(open|sent|confirmed|in progress|in production|in transit|released|reserved)\b/.test(s)) {
    return 'info'
  }
  if (/\b(draft|planned|inactive|archived|obsolete)\b/.test(s)) {
    return 'neutral'
  }
  return 'neutral'
}
