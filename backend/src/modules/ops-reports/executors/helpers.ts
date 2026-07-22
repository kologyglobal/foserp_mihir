import type { Prisma } from '@prisma/client'
import { localDayBoundsUtc } from '../timezone.js'
import type { ReportChartData, ReportRow } from '../types.js'

export function toNum(value: unknown): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'object' && typeof (value as { toNumber?: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber()
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function percent(numerator: number, denominator: number): number {
  if (!denominator) return 0
  return round2((numerator / denominator) * 100)
}

/** Applies an inclusive date-range filter (in tenant tz) to a Prisma where clause for `field`. */
export function applyDateRangeFilter(
  where: Record<string, unknown>,
  field: string,
  filters: { dateFrom?: string; dateTo?: string },
  timezone: string,
): void {
  if (!filters.dateFrom && !filters.dateTo) return
  const fromStr = filters.dateFrom ?? filters.dateTo!
  const toStr = filters.dateTo ?? filters.dateFrom!
  const start = localDayBoundsUtc(fromStr, timezone).start
  const end = localDayBoundsUtc(toStr, timezone).end
  where[field] = { gte: start, lt: end }
}

export function normalizeStatusFilterList(status: unknown): string[] | undefined {
  if (!status) return undefined
  return Array.isArray(status) ? (status as string[]) : [status as string]
}

export const AGE_BUCKETS = ['0-1', '2-3', '4-7', '8-15', '16-30', '30+'] as const
export type AgeBucket = (typeof AGE_BUCKETS)[number]

export function ageDaysToBucket(ageDays: number): AgeBucket {
  if (ageDays <= 1) return '0-1'
  if (ageDays <= 3) return '2-3'
  if (ageDays <= 7) return '4-7'
  if (ageDays <= 15) return '8-15'
  if (ageDays <= 30) return '16-30'
  return '30+'
}

export function ageInDays(from: Date | null | undefined, now = new Date()): number {
  if (!from) return 0
  const ms = now.getTime() - from.getTime()
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)))
}

export function buildAgeBucketChart(rows: Array<{ ageBucket: string }>): ReportChartData {
  const counts = new Map<string, number>(AGE_BUCKETS.map((b) => [b, 0]))
  for (const r of rows) counts.set(r.ageBucket, (counts.get(r.ageBucket) ?? 0) + 1)
  return {
    type: 'bar',
    title: 'Age Buckets (days)',
    series: AGE_BUCKETS.map((b) => ({ label: b, value: counts.get(b) ?? 0 })),
  }
}

export function countBy<T extends ReportRow>(rows: T[], key: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    const k = String(r[key] ?? 'UNKNOWN')
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

export function chartFromCounts(title: string, type: ReportChartData['type'], counts: Record<string, number>): ReportChartData {
  return { type, title, series: Object.entries(counts).map(([label, value]) => ({ label, value })) }
}

export type Where = Prisma.InputJsonValue | Record<string, unknown>
