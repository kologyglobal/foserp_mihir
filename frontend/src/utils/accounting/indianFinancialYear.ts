/**
 * Indian financial year helpers (1 April – 31 March).
 * Keep FY logic out of page JSX.
 */

export type IndianFinancialYear = {
  /** e.g. 2026 for FY 2026–27 */
  startYear: number
  label: string
  startDate: string
  endDate: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toIsoDate(y: number, month1to12: number, day: number): string {
  return `${y}-${pad(month1to12)}-${pad(day)}`
}

/** Financial year containing the given date (local calendar). */
export function getIndianFinancialYear(date = new Date()): IndianFinancialYear {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const startYear = m >= 4 ? y : y - 1
  const endYear = startYear + 1
  return {
    startYear,
    label: `Financial Year ${startYear}–${String(endYear).slice(-2)}`,
    startDate: toIsoDate(startYear, 4, 1),
    endDate: toIsoDate(endYear, 3, 31),
  }
}

export function startOfLocalDay(d = new Date()): string {
  return toIsoDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return startOfLocalDay(d)
}

export function resolveLedgerDateRange(
  quick:
    | 'today'
    | 'this_week'
    | 'this_month'
    | 'previous_month'
    | 'this_quarter'
    | 'this_financial_year'
    | 'custom',
  customFrom?: string,
  customTo?: string,
  now = new Date(),
): { from: string; to: string; label: string; fy: IndianFinancialYear } {
  const fy = getIndianFinancialYear(now)
  const today = startOfLocalDay(now)

  if (quick === 'custom') {
    const from = customFrom || fy.startDate
    const to = customTo || today
    return { from, to, label: `${formatDisplayDate(from)} to ${formatDisplayDate(to)}`, fy }
  }

  if (quick === 'today') {
    return { from: today, to: today, label: `Today · ${formatDisplayDate(today)}`, fy }
  }

  if (quick === 'this_week') {
    const d = new Date(`${today}T12:00:00`)
    const day = d.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const from = addDays(today, mondayOffset)
    return { from, to: today, label: `This Week · ${formatDisplayDate(from)} to ${formatDisplayDate(today)}`, fy }
  }

  if (quick === 'this_month') {
    const from = toIsoDate(now.getFullYear(), now.getMonth() + 1, 1)
    return { from, to: today, label: `This Month · ${formatDisplayDate(from)} to ${formatDisplayDate(today)}`, fy }
  }

  if (quick === 'previous_month') {
    const firstThis = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastPrev = new Date(firstThis.getTime() - 86400000)
    const from = toIsoDate(lastPrev.getFullYear(), lastPrev.getMonth() + 1, 1)
    const to = toIsoDate(lastPrev.getFullYear(), lastPrev.getMonth() + 1, lastPrev.getDate())
    return { from, to, label: `Previous Month · ${formatDisplayDate(from)} to ${formatDisplayDate(to)}`, fy }
  }

  if (quick === 'this_quarter') {
    const m = now.getMonth() + 1
    const qStartMonth = m <= 3 ? 1 : m <= 6 ? 4 : m <= 9 ? 7 : 10
    const from = toIsoDate(now.getFullYear(), qStartMonth, 1)
    return { from, to: today, label: `This Quarter · ${formatDisplayDate(from)} to ${formatDisplayDate(today)}`, fy }
  }

  // this_financial_year
  return {
    from: fy.startDate,
    to: today < fy.endDate ? today : fy.endDate,
    label: `${fy.label} · ${formatDisplayDate(fy.startDate)} to ${formatDisplayDate(today < fy.endDate ? today : fy.endDate)}`,
    fy,
  }
}

export function formatDisplayDate(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${pad(d)} ${months[(m ?? 1) - 1]} ${y}`
}

/** Format signed mock balance with Dr/Cr context. */
export function formatBalanceWithSide(amount: number, side: 'Dr' | 'Cr', formatCurrency: (n: number) => string): string {
  return `${formatCurrency(Math.abs(amount))} ${side}`
}
