/**
 * CRM date/time policy — start with Follow-up date/time.
 *
 * Timezone contract:
 * - FE validates in the browser's local timezone (UX + picker `min`).
 * - Forms may use separate `dueDate` (YYYY-MM-DD) + `dueTime` (HH:mm) or a single
 *   `datetime-local` / ISO string; prefer local wall-clock for inputs.
 * - Send `dueDate` + `dueTime` to the API as today (local calendar components).
 *   Use `toFollowUpIso` when you need an absolute instant for comparisons.
 * - Backend rejects past timestamps using UTC wall-clock of the same components
 *   (defense in depth; FE is the timezone-accurate gate).
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/

export const FOLLOW_UP_PAST_MESSAGE = 'Follow-up date/time must be in the future'
export const FOLLOW_UP_INVALID_MESSAGE = 'Enter a valid follow-up date and time'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Normalize to `HH:mm` (default 10:00 when empty). */
export function normalizeDueTime(time?: string | null): string {
  if (time == null || !String(time).trim()) return '10:00'
  const m = String(time).trim().match(TIME_RE)
  if (!m) return String(time).trim()
  return `${pad2(Number(m[1]))}:${m[2]}`
}

function isValidCalendarDate(dueDate: string): boolean {
  if (!DATE_RE.test(dueDate)) return false
  const [y, mo, d] = dueDate.split('-').map(Number)
  const dt = new Date(y, mo - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d
}

/**
 * Parse dueDate + dueTime as a **local** Date (browser / Node local TZ).
 * Returns null when the pair is invalid.
 */
export function combineFollowUpLocal(
  dueDate: string,
  dueTime?: string | null,
): Date | null {
  const date = dueDate?.trim() ?? ''
  if (!isValidCalendarDate(date)) return null
  const time = normalizeDueTime(dueTime)
  if (!TIME_RE.test(time)) return null
  const [hh, mm] = time.split(':').map(Number)
  const [y, mo, d] = date.split('-').map(Number)
  const dt = new Date(y, mo - 1, d, hh, mm, 0, 0)
  if (Number.isNaN(dt.getTime())) return null
  return dt
}

/**
 * Absolute ISO instant from local dueDate + dueTime (for API / logging).
 */
export function toFollowUpIso(dueDate: string, dueTime?: string | null): string | null {
  const dt = combineFollowUpLocal(dueDate, dueTime)
  return dt ? dt.toISOString() : null
}

function parseDateTimeValue(value: string, interpretAs: 'local' | 'utc'): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  // datetime-local: YYYY-MM-DDTHH:mm[.ss]
  const localMatch = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2}(?::\d{2})?)(?:\.\d+)?$/,
  )
  if (localMatch && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return interpretAs === 'utc'
      ? combineFollowUpUtc(localMatch[1], localMatch[2])
      : combineFollowUpLocal(localMatch[1], localMatch[2])
  }

  // date-only
  if (DATE_RE.test(trimmed) && isValidCalendarDate(trimmed)) {
    return interpretAs === 'utc'
      ? combineFollowUpUtc(trimmed, '00:00')
      : combineFollowUpLocal(trimmed, '00:00')
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** UTC wall-clock combine — mirrors backend defense-in-depth parsing. */
export function combineFollowUpUtc(
  dueDate: string,
  dueTime?: string | null,
): Date | null {
  const date = dueDate?.trim() ?? ''
  if (!isValidCalendarDate(date)) return null
  const time = normalizeDueTime(dueTime)
  if (!TIME_RE.test(time)) return null
  const withSeconds = time.length === 5 ? `${time}:00` : time
  const dt = new Date(`${date}T${withSeconds}.000Z`)
  return Number.isNaN(dt.getTime()) ? null : dt
}

/**
 * True when the value is a valid instant strictly after `now`.
 * Accepts Date, ISO, datetime-local, or date-only (treated as local midnight).
 */
export function isFutureDateTime(
  value: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (value == null) return false
  const dt =
    value instanceof Date
      ? (Number.isNaN(value.getTime()) ? null : value)
      : parseDateTimeValue(String(value), 'local')
  if (!dt) return false
  return dt.getTime() > now.getTime()
}

export type FollowUpAtInput =
  | string
  | Date
  | { dueDate: string; dueTime?: string | null }
  | null
  | undefined

/**
 * Validate a follow-up scheduled instant.
 * @returns error message, or null when valid.
 */
export function validateFollowUpAt(
  value: FollowUpAtInput,
  now: Date = new Date(),
): string | null {
  if (value == null || value === '') {
    return 'Follow-up date/time is required'
  }

  let dt: Date | null = null

  if (value instanceof Date) {
    dt = Number.isNaN(value.getTime()) ? null : value
  } else if (typeof value === 'object' && 'dueDate' in value) {
    if (!value.dueDate?.trim()) return 'Follow-up date is required'
    if (!isValidCalendarDate(value.dueDate.trim())) return FOLLOW_UP_INVALID_MESSAGE
    const time = value.dueTime != null && String(value.dueTime).trim()
      ? String(value.dueTime).trim()
      : '10:00'
    if (!TIME_RE.test(normalizeDueTime(time))) return FOLLOW_UP_INVALID_MESSAGE
    dt = combineFollowUpLocal(value.dueDate.trim(), time)
  } else {
    dt = parseDateTimeValue(String(value), 'local')
  }

  if (!dt) return FOLLOW_UP_INVALID_MESSAGE
  if (dt.getTime() <= now.getTime()) return FOLLOW_UP_PAST_MESSAGE
  return null
}

/** `datetime-local` input `min` in local TZ (`YYYY-MM-DDTHH:mm`). */
export function getDatetimeLocalMin(now: Date = new Date()): string {
  return `${getDateInputMin(now)}T${pad2(now.getHours())}:${pad2(now.getMinutes())}`
}

/** `type="date"` input `min` in local TZ. */
export function getDateInputMin(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

/**
 * `type="time"` input `min` when the selected date is today (local).
 * Returns undefined for future dates (no hour/minute restriction).
 */
export function getTimeInputMin(
  dueDate: string,
  now: Date = new Date(),
): string | undefined {
  const today = getDateInputMin(now)
  if (!dueDate || dueDate !== today) return undefined
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
}

/**
 * Default create slot: at least ~1 hour ahead on a 15-minute boundary (local).
 */
export function suggestDefaultFollowUpSlot(now: Date = new Date()): {
  dueDate: string
  dueTime: string
} {
  const target = new Date(now.getTime() + 60 * 60 * 1000)
  const mins = target.getMinutes()
  const rounded = Math.ceil(mins / 15) * 15
  if (rounded === 60) {
    target.setHours(target.getHours() + 1, 0, 0, 0)
  } else {
    target.setMinutes(rounded, 0, 0)
  }
  return {
    dueDate: getDateInputMin(target),
    dueTime: `${pad2(target.getHours())}:${pad2(target.getMinutes())}`,
  }
}

/**
 * When only a calendar date is chosen (e.g. lead form), pick a dueTime that is
 * still in the future for that date.
 */
export function suggestFollowUpDueTime(
  dueDate: string,
  now: Date = new Date(),
): string {
  const today = getDateInputMin(now)
  if (dueDate > today) return '10:00'
  if (dueDate < today) return normalizeDueTime(getTimeInputMin(dueDate, now) ?? '23:59')
  const slot = suggestDefaultFollowUpSlot(now)
  return slot.dueDate === dueDate ? slot.dueTime : '23:45'
}
