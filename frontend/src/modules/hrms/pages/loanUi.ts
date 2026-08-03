import type { HrLoanRecoverySchedule } from '@/services/api/hrmsApi'

export function money(n: number | null | undefined) {
  if (n == null) return '—'
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function monthYearLabel(month: number, year: number) {
  return `${MONTHS_SHORT[month - 1] ?? month} ${year}`
}

/** Best-effort "next recovery" label from schedules (if loaded) or recovery start fields. */
export function nextRecoveryLabel(loan: {
  schedules?: HrLoanRecoverySchedule[]
  recoveryStartYear: number | null
  recoveryStartMonth: number | null
  status: string
}): string {
  const nextPending = loan.schedules?.find((s) => s.status === 'PENDING')
  if (nextPending) return monthYearLabel(nextPending.month, nextPending.year)
  if ((loan.status === 'RECOVERING' || loan.status === 'DISBURSED') && loan.recoveryStartYear && loan.recoveryStartMonth) {
    return monthYearLabel(loan.recoveryStartMonth, loan.recoveryStartYear)
  }
  return '—'
}
