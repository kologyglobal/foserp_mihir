import type {
  DueDateBucket,
  InvoiceAgeBucket,
} from './receivable-reporting.types.js'

const MS_PER_DAY = 86_400_000

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  const dt = parseDateOnly(date)
  dt.setUTCDate(dt.getUTCDate() + days)
  return formatDateOnly(dt)
}

export function daysBetween(fromDate: string, toDate: string): number {
  const from = parseDateOnly(fromDate).getTime()
  const to = parseDateOnly(toDate).getTime()
  return Math.max(0, Math.floor((to - from) / MS_PER_DAY))
}

export function getTodayInTimezone(timezone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function compareDateOnly(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

export function computeDaysOverdue(reportDate: string, dueDate: string | null | undefined): number | null {
  if (!dueDate) return null
  return daysBetween(dueDate, reportDate)
}

export function computeDaysOutstanding(reportDate: string, postingDate: string | null | undefined): number {
  if (!postingDate) return 0
  return daysBetween(postingDate, reportDate)
}

export function classifyDueDateBucket(reportDate: string, dueDate: string | null | undefined): DueDateBucket {
  if (!dueDate) return 'NO_DUE_DATE'
  const overdue = computeDaysOverdue(reportDate, dueDate) ?? 0
  if (overdue === 0) return 'CURRENT'
  if (overdue <= 30) return 'OVERDUE_1_30'
  if (overdue <= 60) return 'OVERDUE_31_60'
  if (overdue <= 90) return 'OVERDUE_61_90'
  if (overdue <= 120) return 'OVERDUE_91_120'
  return 'OVERDUE_ABOVE_120'
}

export function classifyInvoiceAgeBucket(reportDate: string, postingDate: string | null | undefined): InvoiceAgeBucket {
  const age = computeDaysOutstanding(reportDate, postingDate)
  if (age <= 30) return 'AGE_0_30'
  if (age <= 60) return 'AGE_31_60'
  if (age <= 90) return 'AGE_61_90'
  if (age <= 120) return 'AGE_91_120'
  return 'AGE_ABOVE_120'
}

export function isDueDateBucket(value: string): value is DueDateBucket {
  return [
    'CURRENT',
    'OVERDUE_1_30',
    'OVERDUE_31_60',
    'OVERDUE_61_90',
    'OVERDUE_91_120',
    'OVERDUE_ABOVE_120',
    'NO_DUE_DATE',
  ].includes(value)
}

export function isInvoiceAgeBucket(value: string): value is InvoiceAgeBucket {
  return ['AGE_0_30', 'AGE_31_60', 'AGE_61_90', 'AGE_91_120', 'AGE_ABOVE_120'].includes(value)
}

export function dueDateFilterForBucket(bucket: DueDateBucket, reportDate: string) {
  switch (bucket) {
    case 'NO_DUE_DATE':
      return { dueDate: null as null }
    case 'CURRENT':
      return { dueDate: { gte: parseDateOnly(reportDate) } }
    case 'OVERDUE_1_30':
      return {
        dueDate: {
          gte: parseDateOnly(addDays(reportDate, -30)),
          lte: parseDateOnly(addDays(reportDate, -1)),
        },
      }
    case 'OVERDUE_31_60':
      return {
        dueDate: {
          gte: parseDateOnly(addDays(reportDate, -60)),
          lte: parseDateOnly(addDays(reportDate, -31)),
        },
      }
    case 'OVERDUE_61_90':
      return {
        dueDate: {
          gte: parseDateOnly(addDays(reportDate, -90)),
          lte: parseDateOnly(addDays(reportDate, -61)),
        },
      }
    case 'OVERDUE_91_120':
      return {
        dueDate: {
          gte: parseDateOnly(addDays(reportDate, -120)),
          lte: parseDateOnly(addDays(reportDate, -91)),
        },
      }
    case 'OVERDUE_ABOVE_120':
      return { dueDate: { lte: parseDateOnly(addDays(reportDate, -121)) } }
    default:
      return {}
  }
}

export function invoiceAgeFilterForBucket(bucket: InvoiceAgeBucket, reportDate: string) {
  const postingDateFilter = (fromDaysAgo: number, toDaysAgo?: number) => {
    const lte = parseDateOnly(addDays(reportDate, -fromDaysAgo))
    if (toDaysAgo == null) {
      return { lte }
    }
    const gte = parseDateOnly(addDays(reportDate, -toDaysAgo))
    return { gte, lte }
  }

  switch (bucket) {
    case 'AGE_0_30':
      return { postingDate: postingDateFilter(0, 30), invoiceDate: postingDateFilter(0, 30) }
    case 'AGE_31_60':
      return { postingDate: postingDateFilter(31, 60), invoiceDate: postingDateFilter(31, 60) }
    case 'AGE_61_90':
      return { postingDate: postingDateFilter(61, 90), invoiceDate: postingDateFilter(61, 90) }
    case 'AGE_91_120':
      return { postingDate: postingDateFilter(91, 120), invoiceDate: postingDateFilter(91, 120) }
    case 'AGE_ABOVE_120':
      return { postingDate: { lte: parseDateOnly(addDays(reportDate, -121)) }, invoiceDate: { lte: parseDateOnly(addDays(reportDate, -121)) } }
    default:
      return {}
  }
}

export const ALL_DUE_DATE_BUCKETS: DueDateBucket[] = [
  'CURRENT',
  'OVERDUE_1_30',
  'OVERDUE_31_60',
  'OVERDUE_61_90',
  'OVERDUE_91_120',
  'OVERDUE_ABOVE_120',
  'NO_DUE_DATE',
]

export const ALL_INVOICE_AGE_BUCKETS: InvoiceAgeBucket[] = [
  'AGE_0_30',
  'AGE_31_60',
  'AGE_61_90',
  'AGE_91_120',
  'AGE_ABOVE_120',
]
