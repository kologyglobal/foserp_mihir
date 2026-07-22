import { prisma } from '../../config/database.js'

/**
 * `luxon`/`dayjs`/`date-fns-tz` are not in backend/package.json (checked before writing this
 * file). Node ships with full ICU by default (Node >= 13), so `Intl.DateTimeFormat` can resolve
 * a timezone's wall-clock offset for any instant without adding a dependency. This module wraps
 * that technique behind small helpers so callers never touch `Intl` directly.
 */

export const DEFAULT_TENANT_TIMEZONE = 'Asia/Kolkata'

export async function resolveTenantTimezone(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } })
  return tenant?.timezone?.trim() || DEFAULT_TENANT_TIMEZONE
}

/** Minutes to ADD to a UTC instant to get the wall-clock time in `timeZone` at that instant. */
function getTimezoneOffsetMinutes(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(instant)
  const map: Record<string, string> = {}
  for (const part of parts) map[part.type] = part.value
  const asIfUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  )
  return (asIfUtc - instant.getTime()) / 60000
}

/** Converts a `YYYY-MM-DDTHH:mm:ss` wall-clock string in `timeZone` to the equivalent UTC Date. */
export function zonedWallTimeToUtc(localDateTimeStr: string, timeZone: string): Date {
  const guessUtc = new Date(`${localDateTimeStr}Z`)
  const offsetMinutes = getTimezoneOffsetMinutes(guessUtc, timeZone)
  return new Date(guessUtc.getTime() - offsetMinutes * 60000)
}

/** [start, end) UTC instants covering one local calendar day (`YYYY-MM-DD`) in `timeZone`. */
export function localDayBoundsUtc(dateStr: string, timeZone: string): { start: Date; end: Date } {
  const start = zonedWallTimeToUtc(`${dateStr}T00:00:00`, timeZone)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

export function formatLocalDate(instant: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  return dtf.format(instant)
}

/** Resolves an inclusive `[dateFrom, dateTo]` UTC range from filter strings (YYYY-MM-DD), in tenant tz. */
export function resolveFilterDateRangeUtc(
  filters: { dateFrom?: string; dateTo?: string },
  timeZone: string,
  fallbackDays = 30,
): { start: Date; end: Date; usedDefault: boolean } {
  if (filters.dateFrom || filters.dateTo) {
    const fromStr = filters.dateFrom ?? filters.dateTo!
    const toStr = filters.dateTo ?? filters.dateFrom!
    const start = localDayBoundsUtc(fromStr, timeZone).start
    const end = localDayBoundsUtc(toStr, timeZone).end
    return { start, end, usedDefault: false }
  }
  const now = new Date()
  const todayStr = formatLocalDate(now, timeZone)
  const end = localDayBoundsUtc(todayStr, timeZone).end
  const start = new Date(end.getTime() - fallbackDays * 24 * 60 * 60 * 1000)
  return { start, end, usedDefault: true }
}
