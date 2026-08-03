export function money(n: number | null | undefined) {
  if (n == null) return '—'
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export const EXIT_TYPE_LABELS: Record<string, string> = {
  RESIGNATION: 'Resignation',
  TERMINATION: 'Termination',
  RETIREMENT: 'Retirement',
  CONTRACT_END: 'Contract End',
  ABSCONDING: 'Absconding',
  OTHER: 'Other',
}

export const EXIT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  CLEARANCE_PENDING: 'Clearance Pending',
  READY_FOR_SETTLEMENT: 'Ready for Settlement',
  SETTLED: 'Settled',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
}

/** Best-effort clearance summary derived from exit status alone (list view has no line counts). */
export function clearanceSummaryFromExitStatus(status: string): string {
  switch (status) {
    case 'CLEARANCE_PENDING':
      return 'In Progress'
    case 'READY_FOR_SETTLEMENT':
    case 'SETTLED':
    case 'CLOSED':
      return 'Cleared'
    default:
      return '—'
  }
}
