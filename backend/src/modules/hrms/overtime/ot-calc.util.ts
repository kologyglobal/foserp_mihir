/**
 * Pure overtime calculation helpers — no I/O. Kept side-effect free so the
 * eligibility rules can be unit tested without a database.
 */

/** Floor `minutes` to the nearest lower multiple of `roundingMinutes` (never negative). */
export function roundDownTo(minutes: number, roundingMinutes: number): number {
  const safeMinutes = Math.max(0, minutes)
  if (!roundingMinutes || roundingMinutes <= 0) return Math.floor(safeMinutes)
  return Math.floor(safeMinutes / roundingMinutes) * roundingMinutes
}

/** Extra minutes worked beyond the shift span (never negative). */
export function computeDetectedMinutes(workedMinutes: number, shiftSpanMinutes: number): number {
  return Math.max(0, (workedMinutes || 0) - (shiftSpanMinutes || 0))
}

export interface OtEligibilityPolicy {
  enabled: boolean
  minimumExtraMinutes: number
  roundingMinutes: number
  maxOtMinutesPerDay: number | null
  maxOtMinutesPerMonth: number | null
  weeklyOffOtAllowed: boolean
  holidayOtAllowed: boolean
  leaveDayOtAllowed: boolean
}

export interface ApplyEligibilityInput {
  detected: number
  policy: OtEligibilityPolicy | null
  shiftOtEligible: boolean
  isWeeklyOff: boolean
  isHoliday: boolean
  isFullDayLeave: boolean
  /** Sum of already-approved OT minutes for the same employee/month, excluding the day being evaluated. */
  monthApprovedSoFar: number
}

export interface ApplyEligibilityResult {
  eligible: number
  flags: string[]
}

/**
 * Sequentially applies policy gates to a detected OT minute count.
 * Order matters — the first disqualifying gate short-circuits to 0 eligible minutes.
 */
export function applyEligibility(input: ApplyEligibilityInput): ApplyEligibilityResult {
  const { policy } = input

  if (!policy || !policy.enabled || !input.shiftOtEligible) {
    return { eligible: 0, flags: ['OT_NOT_ELIGIBLE'] }
  }

  if (input.isFullDayLeave && !policy.leaveDayOtAllowed) {
    return { eligible: 0, flags: ['LEAVE_CONFLICT'] }
  }

  if (input.isWeeklyOff && !policy.weeklyOffOtAllowed) {
    return { eligible: 0, flags: ['WEEKLY_OFF_OT'] }
  }

  if (input.isHoliday && !policy.holidayOtAllowed) {
    return { eligible: 0, flags: ['HOLIDAY_OT'] }
  }

  if (input.detected < policy.minimumExtraMinutes) {
    return { eligible: 0, flags: ['BELOW_MINIMUM'] }
  }

  const flags: string[] = []
  let eligible = roundDownTo(input.detected, policy.roundingMinutes)

  if (policy.maxOtMinutesPerDay != null && eligible > policy.maxOtMinutesPerDay) {
    eligible = policy.maxOtMinutesPerDay
    flags.push('DAILY_LIMIT')
  }

  if (policy.maxOtMinutesPerMonth != null) {
    const remaining = Math.max(0, policy.maxOtMinutesPerMonth - Math.max(0, input.monthApprovedSoFar))
    if (eligible > remaining) {
      eligible = remaining
      flags.push('MONTHLY_LIMIT')
    }
  }

  return { eligible: Math.max(0, eligible), flags }
}
