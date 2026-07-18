/**
 * CRM date/time policy — mirror of frontend/src/utils/validation/crmDatePolicy.ts
 *
 * Timezone contract:
 * - FE validates in the browser's local timezone for UX.
 * - API accepts dueDate (YYYY-MM-DD) + dueTime (HH:mm) as local wall-clock components.
 * - BE rejects past timestamps by interpreting those components as UTC wall-clock
 *   (defense in depth). Prefer FE local validation for TZ-accurate UX.
 */

import { ValidationError } from './errors.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/

export const FOLLOW_UP_PAST_MESSAGE = 'Follow-up date/time must be in the future'
export const FOLLOW_UP_INVALID_MESSAGE = 'Enter a valid follow-up date and time'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function normalizeDueTime(time?: string | null): string {
  if (time == null || !String(time).trim()) return '10:00'
  const m = String(time).trim().match(TIME_RE)
  if (!m) return String(time).trim()
  return `${pad2(Number(m[1]))}:${m[2]}`
}

function isValidCalendarDate(dueDate: string): boolean {
  if (!DATE_RE.test(dueDate)) return false
  const [y, mo, d] = dueDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

/** Combine dueDate + dueTime as a UTC instant (server defense-in-depth). */
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

function parseDateTimeValue(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const localMatch = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2}(?::\d{2})?)(?:\.\d+)?$/,
  )
  if (localMatch && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return combineFollowUpUtc(localMatch[1], localMatch[2])
  }

  if (DATE_RE.test(trimmed) && isValidCalendarDate(trimmed)) {
    return combineFollowUpUtc(trimmed, '00:00')
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function isFutureDateTime(
  value: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (value == null) return false
  const dt =
    value instanceof Date
      ? (Number.isNaN(value.getTime()) ? null : value)
      : parseDateTimeValue(String(value))
  if (!dt) return false
  return dt.getTime() > now.getTime()
}

export type FollowUpAtInput =
  | string
  | Date
  | { dueDate: string; dueTime?: string | null }
  | null
  | undefined

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
    const time =
      value.dueTime != null && String(value.dueTime).trim()
        ? String(value.dueTime).trim()
        : '10:00'
    if (!TIME_RE.test(normalizeDueTime(time))) return FOLLOW_UP_INVALID_MESSAGE
    dt = combineFollowUpUtc(value.dueDate.trim(), time)
  } else {
    dt = parseDateTimeValue(String(value))
  }

  if (!dt) return FOLLOW_UP_INVALID_MESSAGE
  if (dt.getTime() <= now.getTime()) return FOLLOW_UP_PAST_MESSAGE
  return null
}

/** Throw ValidationError (400) when follow-up due date/time is not in the future. */
export function assertFollowUpInFuture(
  dueDate: string,
  dueTime?: string | null,
  now: Date = new Date(),
): void {
  const message = validateFollowUpAt({ dueDate, dueTime }, now)
  if (message) {
    throw new ValidationError(message, [{ field: 'dueDate', message }])
  }
}
