/**
 * Minimal 5-field cron matcher for bank connector scheduleCron.
 * Supports *, step forms (every N), ranges A-B, and comma lists. No seconds field.
 */
export type CronParts = {
  minute: string
  hour: string
  dayOfMonth: string
  month: string
  dayOfWeek: string
}

const CRON_RE =
  /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/

export function parseScheduleCron(expr: string): CronParts | null {
  const trimmed = expr.trim()
  if (!trimmed) return null
  const m = CRON_RE.exec(trimmed)
  if (!m) return null
  return {
    minute: m[1],
    hour: m[2],
    dayOfMonth: m[3],
    month: m[4],
    dayOfWeek: m[5],
  }
}

export function isValidScheduleCron(expr: string | null | undefined): boolean {
  if (expr == null || expr.trim() === '') return true
  return parseScheduleCron(expr) != null
}

function matchField(field: string, value: number, min: number, max: number): boolean {
  if (field === '*') return true
  for (const part of field.split(',')) {
    const stepMatch = /^\*\/(\d+)$/.exec(part)
    if (stepMatch) {
      const step = Number(stepMatch[1])
      if (step <= 0) return false
      if (value % step === 0) return true
      continue
    }
    const rangeMatch = /^(\d+)-(\d+)(?:\/(\d+))?$/.exec(part)
    if (rangeMatch) {
      const start = Number(rangeMatch[1])
      const end = Number(rangeMatch[2])
      const step = rangeMatch[3] ? Number(rangeMatch[3]) : 1
      if (start < min || end > max || step <= 0) continue
      for (let i = start; i <= end; i += step) {
        if (i === value) return true
      }
      continue
    }
    const n = Number(part)
    if (Number.isInteger(n) && n === value && n >= min && n <= max) return true
  }
  return false
}

/** True when `at` falls on a cron tick (minute resolution). */
export function cronMatchesAt(expr: string, at: Date = new Date()): boolean {
  const parts = parseScheduleCron(expr)
  if (!parts) return false
  const minute = at.getMinutes()
  const hour = at.getHours()
  const dayOfMonth = at.getDate()
  const month = at.getMonth() + 1
  // JS: 0=Sun … 6=Sat; cron often uses 7 as Sunday — normalize to 0.
  const dayOfWeek = at.getDay()
  const dowField = parts.dayOfWeek.replace(/\b7\b/g, '0')
  return (
    matchField(parts.minute, minute, 0, 59) &&
    matchField(parts.hour, hour, 0, 23) &&
    matchField(parts.dayOfMonth, dayOfMonth, 1, 31) &&
    matchField(parts.month, month, 1, 12) &&
    matchField(dowField, dayOfWeek, 0, 6)
  )
}

/**
 * Due when cron matches this minute and we have not already synced in this minute window.
 */
export function isConnectorDueForCron(params: {
  scheduleCron: string
  lastSyncAt: Date | null
  now?: Date
}): boolean {
  const now = params.now ?? new Date()
  if (!cronMatchesAt(params.scheduleCron, now)) return false
  if (!params.lastSyncAt) return true
  const windowStart = new Date(now)
  windowStart.setSeconds(0, 0)
  return params.lastSyncAt.getTime() < windowStart.getTime()
}
