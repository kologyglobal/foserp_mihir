/**
 * Lightweight business-hours / timezone helpers for SLA clocks.
 * Uses tenant timezone (IANA). Full holiday calendars are deferred.
 */

export function resolveTimezone(tenantTz?: string | null, override?: string | null): string {
  return override?.trim() || tenantTz?.trim() || 'Asia/Kolkata'
}

/** Wall-clock parts in a given IANA timezone. */
export function zonedParts(date: Date, timeZone: string): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: number
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === '24' ? '0' : parts.hour),
    minute: Number(parts.minute),
    weekday: weekdayMap[parts.weekday ?? 'Mon'] ?? 1,
  }
}

/**
 * Approximate business hours elapsed between `from` and `to` (inclusive window).
 * Counts only Mon–Fri and hours between startHour (inclusive) and endHour (exclusive).
 */
export function businessHoursBetween(
  from: Date,
  to: Date,
  opts: {
    timeZone: string
    startHour: number
    endHour: number
  },
): number {
  if (to <= from) return 0
  const startH = Math.max(0, Math.min(23, opts.startHour))
  const endH = Math.max(startH + 1, Math.min(24, opts.endHour))
  let cursor = new Date(from.getTime())
  let hours = 0
  // Cap scan to 90 calendar days to avoid runaway loops
  const hardStop = Math.min(to.getTime(), from.getTime() + 90 * 24 * 60 * 60 * 1000)

  while (cursor.getTime() < hardStop) {
    const p = zonedParts(cursor, opts.timeZone)
    const isWeekend = p.weekday === 0 || p.weekday === 6
    const next = new Date(cursor.getTime() + 60 * 60 * 1000)
    if (!isWeekend && p.hour >= startH && p.hour < endH) {
      const sliceEnd = Math.min(next.getTime(), to.getTime(), hardStop)
      hours += (sliceEnd - cursor.getTime()) / (60 * 60 * 1000)
    }
    cursor = next
  }
  return Math.max(0, hours)
}

export function localDateKey(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}
