import { ValidationError } from '../../../utils/errors.js'

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export function parseHhMm(value: string): number {
  if (!TIME_RE.test(value)) {
    throw new ValidationError(`Invalid time "${value}" — use HH:mm (24h)`)
  }
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

export function formatHhMm(totalMinutes: number): string {
  const mins = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Worked span in minutes from start→end, supporting overnight (22:00→06:00 = 480). */
export function shiftSpanMinutes(startTime: string, endTime: string, overnightShift: boolean): number {
  const start = parseHhMm(startTime)
  const end = parseHhMm(endTime)
  if (overnightShift || end <= start) {
    if (end === start && !overnightShift) {
      throw new ValidationError('Shift duration must be greater than zero')
    }
    return end <= start ? 24 * 60 - start + end : end - start
  }
  return end - start
}

export function validateShiftTimes(input: {
  startTime: string
  endTime: string
  breakMinutes: number
  fullDayMinimumMinutes: number
  halfDayMinimumMinutes: number
  overnightShift?: boolean
  graceInMinutes?: number
  graceOutMinutes?: number | null
  otStartsAfterMinutes?: number | null
  weeklyOffDay?: number | null
}): { overnightShift: boolean; spanMinutes: number } {
  const start = parseHhMm(input.startTime)
  const end = parseHhMm(input.endTime)
  const overnight = Boolean(input.overnightShift) || end <= start
  const span = shiftSpanMinutes(input.startTime, input.endTime, overnight)

  if (span <= 0) throw new ValidationError('Shift duration must be greater than zero')
  if (input.breakMinutes < 0) throw new ValidationError('Break minutes cannot be negative')
  if (input.breakMinutes >= span) {
    throw new ValidationError('Break minutes must be less than shift duration')
  }
  if (input.fullDayMinimumMinutes <= 0 || input.halfDayMinimumMinutes <= 0) {
    throw new ValidationError('Full-day and half-day minimums must be positive')
  }
  if (input.halfDayMinimumMinutes > input.fullDayMinimumMinutes) {
    throw new ValidationError('Half-day minimum cannot exceed full-day minimum')
  }
  if ((input.graceInMinutes ?? 0) < 0) throw new ValidationError('Grace in cannot be negative')
  if (input.graceOutMinutes != null && input.graceOutMinutes < 0) {
    throw new ValidationError('Grace out cannot be negative')
  }
  if (input.otStartsAfterMinutes != null && input.otStartsAfterMinutes < 0) {
    throw new ValidationError('OT starts-after minutes cannot be negative')
  }
  if (input.weeklyOffDay != null && (input.weeklyOffDay < 0 || input.weeklyOffDay > 6)) {
    throw new ValidationError('Weekly off day must be 0 (Sun) … 6 (Sat)')
  }

  return { overnightShift: overnight, spanMinutes: span }
}

export function toDateOnly(value: Date | string): Date {
  const d = typeof value === 'string' ? new Date(value) : new Date(value.getTime())
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export function datesOverlap(
  aFrom: Date,
  aTo: Date | null,
  bFrom: Date,
  bTo: Date | null,
): boolean {
  const aEnd = aTo ?? new Date('9999-12-31')
  const bEnd = bTo ?? new Date('9999-12-31')
  return aFrom.getTime() <= bEnd.getTime() && bFrom.getTime() <= aEnd.getTime()
}
