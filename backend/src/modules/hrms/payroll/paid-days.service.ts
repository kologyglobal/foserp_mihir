import { prisma } from '../../../config/prisma.js'
import { getEffectiveShift } from '../shared/effective-shift.service.js'
import { getHoliday } from '../shared/holiday-resolution.service.js'
import { toDateOnly } from '../shared/shift-time.util.js'

/** Employee statuses that keep an employee "still employed" for the whole period (no exit clamp). */
const STILL_EMPLOYED_STATUSES = new Set(['ACTIVE', 'ON_NOTICE'])
/** Employee statuses whose last-working-day is resolved from employment history (STATUS change). */
const EXITED_STATUSES = new Set(['EXITED', 'INACTIVE'])

export interface PaidDayEntry {
  date: string
  present: number
  paidLeave: number
  unpaidLeave: number
  lop: number
  weeklyOff: number
  holiday: number
  payable: number
  note: string | null
}

export interface PaidDaysTotals {
  present: number
  paidLeave: number
  unpaidLeave: number
  lop: number
  weeklyOff: number
  holiday: number
  payableDays: number
}

export interface PaidDaysWarning {
  code: string
  message: string
  date?: string
}

export interface PaidDaysBreakdown {
  employeeId: string
  periodStart: string
  periodEnd: string
  basisDays: number
  eligibilityStart: string | null
  eligibilityEnd: string | null
  totals: PaidDaysTotals
  days: PaidDayEntry[]
  warnings: PaidDaysWarning[]
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function calendarDaysInclusive(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
}

function eachDateInclusive(from: Date, to: Date): Date[] {
  const out: Date[] = []
  for (let t = from.getTime(); t <= to.getTime(); t += 86_400_000) {
    out.push(new Date(t))
  }
  return out
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Last-working-day for a non-active employee, resolved from the employment-history
 * STATUS trail (HrEmployee has no dedicated exitDate/lastWorkingDate column).
 * Returns null when no such transition is recorded (treated as "cannot determine — exclude").
 */
export async function resolveExitDate(
  tenantId: string,
  employeeId: string,
  status: string,
): Promise<Date | null> {
  if (!EXITED_STATUSES.has(status)) return null
  const history = await prisma.hrEmployeeEmploymentHistory.findFirst({
    where: {
      tenantId,
      employeeId,
      field: 'STATUS',
      newValue: { in: [...EXITED_STATUSES] },
    },
    orderBy: { effectiveFrom: 'desc' },
  })
  return history ? toDateOnly(history.effectiveFrom) : null
}

export interface EligibilityWindow {
  /** Clamped eligibility start (null when the employee has no overlap with the period). */
  start: Date | null
  end: Date | null
  exitDate: Date | null
}

/**
 * Clamp [periodStart, periodEnd] to the employee's join..exit window.
 * ACTIVE / ON_NOTICE → clamp to joinDate only (still employed through period end).
 * EXITED / INACTIVE → additionally clamp to the resolved last-working-day; no history ⇒ excluded.
 */
export async function computeEligibilityWindow(
  tenantId: string,
  employee: { id: string; joinDate: Date; status: string },
  periodStart: Date,
  periodEnd: Date,
): Promise<EligibilityWindow> {
  const joinDate = toDateOnly(employee.joinDate)
  let exitDate: Date | null = null

  if (EXITED_STATUSES.has(employee.status)) {
    exitDate = await resolveExitDate(tenantId, employee.id, employee.status)
    if (!exitDate) {
      return { start: null, end: null, exitDate: null }
    }
  } else if (!STILL_EMPLOYED_STATUSES.has(employee.status)) {
    // DRAFT or any other non-working status — not payroll-eligible.
    return { start: null, end: null, exitDate: null }
  }

  const start = joinDate.getTime() > periodStart.getTime() ? joinDate : periodStart
  const end = exitDate && exitDate.getTime() < periodEnd.getTime() ? exitDate : periodEnd

  if (start.getTime() > end.getTime()) {
    return { start: null, end: null, exitDate }
  }
  return { start, end, exitDate }
}

/** True if the employee overlaps the payroll period at all (used for run eligibility selection). */
export async function isEmployeeEligibleForPeriod(
  tenantId: string,
  employee: { id: string; joinDate: Date; status: string },
  periodStart: Date,
  periodEnd: Date,
): Promise<boolean> {
  const window = await computeEligibilityWindow(tenantId, employee, periodStart, periodEnd)
  return window.start !== null && window.end !== null
}

/**
 * Derive the paid-days breakdown for an employee across a payroll period.
 * Resolution order per date: holiday → weekly off → attendance day (present/leave/absent).
 */
export async function computePaidDaysBreakdown(
  tenantId: string,
  employeeId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<PaidDaysBreakdown> {
  const employee = await prisma.hrEmployee.findFirst({
    where: { id: employeeId, tenantId, deletedAt: null },
    select: { id: true, joinDate: true, status: true },
  })

  const basisDays = calendarDaysInclusive(periodStart, periodEnd)
  const totals: PaidDaysTotals = {
    present: 0,
    paidLeave: 0,
    unpaidLeave: 0,
    lop: 0,
    weeklyOff: 0,
    holiday: 0,
    payableDays: 0,
  }
  const warnings: PaidDaysWarning[] = []

  if (!employee) {
    warnings.push({ code: 'EMPLOYEE_NOT_FOUND', message: 'Employee not found for paid-days calculation' })
    return {
      employeeId,
      periodStart: isoDate(periodStart),
      periodEnd: isoDate(periodEnd),
      basisDays,
      eligibilityStart: null,
      eligibilityEnd: null,
      totals,
      days: [],
      warnings,
    }
  }

  const window = await computeEligibilityWindow(tenantId, employee, periodStart, periodEnd)
  if (!window.start || !window.end) {
    warnings.push({
      code: 'NOT_ELIGIBLE_IN_PERIOD',
      message: 'Employee has no eligible days within the payroll period (join/exit clamp)',
    })
    return {
      employeeId,
      periodStart: isoDate(periodStart),
      periodEnd: isoDate(periodEnd),
      basisDays,
      eligibilityStart: null,
      eligibilityEnd: null,
      totals,
      days: [],
      warnings,
    }
  }

  const dates = eachDateInclusive(window.start, window.end)
  const days: PaidDayEntry[] = []
  let missingAttendanceCount = 0
  let unknownLeaveTypeCount = 0

  for (const date of dates) {
    const dateIso = isoDate(date)
    const entry: PaidDayEntry = {
      date: dateIso,
      present: 0,
      paidLeave: 0,
      unpaidLeave: 0,
      lop: 0,
      weeklyOff: 0,
      holiday: 0,
      payable: 0,
      note: null,
    }

    const holiday = await getHoliday(tenantId, employeeId, date)
    if (holiday.isHoliday) {
      entry.holiday = 1
      entry.payable = 1
      days.push(entry)
      continue
    }

    const eff = await getEffectiveShift(tenantId, employeeId, date)
    if (eff.isWeeklyOff) {
      entry.weeklyOff = 1
      entry.payable = 1
      days.push(entry)
      continue
    }

    const attendanceDay = await prisma.hrAttendanceDay.findFirst({
      where: { tenantId, employeeId, attendanceDate: date },
    })

    if (!attendanceDay) {
      entry.lop = 1
      entry.note = 'MISSING_ATTENDANCE'
      missingAttendanceCount += 1
      days.push(entry)
      continue
    }

    if (attendanceDay.status === 'PRESENT' || attendanceDay.status === 'ON_DUTY') {
      entry.present = 1
      entry.payable = 1
    } else if (attendanceDay.status === 'HOLIDAY') {
      entry.holiday = 1
      entry.payable = 1
    } else if (attendanceDay.status === 'WEEKLY_OFF') {
      entry.weeklyOff = 1
      entry.payable = 1
    } else if (attendanceDay.status === 'ABSENT') {
      entry.lop = 1
    } else if (attendanceDay.status === 'LEAVE') {
      const leaveType = attendanceDay.leaveTypeCode
        ? await prisma.hrLeaveType.findFirst({
            where: { tenantId, code: attendanceDay.leaveTypeCode, deletedAt: null },
            select: { paid: true },
          })
        : null
      if (!leaveType) unknownLeaveTypeCount += 1
      const paid = leaveType?.paid ?? false
      if (paid) {
        entry.paidLeave = 1
        entry.payable = 1
      } else {
        entry.unpaidLeave = 1
        entry.lop = 1
      }
    } else if (attendanceDay.status === 'HALF_DAY') {
      const leaveType = attendanceDay.leaveTypeCode
        ? await prisma.hrLeaveType.findFirst({
            where: { tenantId, code: attendanceDay.leaveTypeCode, deletedAt: null },
            select: { paid: true },
          })
        : null
      if (!leaveType) unknownLeaveTypeCount += 1
      const paid = leaveType?.paid ?? false
      if (paid) {
        entry.paidLeave = 0.5
        entry.payable += 0.5
      } else {
        entry.unpaidLeave = 0.5
        entry.lop += 0.5
      }
      if (attendanceDay.hasPunch) {
        entry.present = 0.5
        entry.payable += 0.5
      } else {
        entry.lop += 0.5
      }
    } else {
      entry.lop = 1
    }

    days.push(entry)
  }

  for (const d of days) {
    totals.present = round2(totals.present + d.present)
    totals.paidLeave = round2(totals.paidLeave + d.paidLeave)
    totals.unpaidLeave = round2(totals.unpaidLeave + d.unpaidLeave)
    totals.lop = round2(totals.lop + d.lop)
    totals.weeklyOff = totals.weeklyOff + d.weeklyOff
    totals.holiday = totals.holiday + d.holiday
    totals.payableDays = round2(totals.payableDays + d.payable)
  }

  if (missingAttendanceCount > 0) {
    warnings.push({
      code: 'MISSING_ATTENDANCE',
      message: `${missingAttendanceCount} working day(s) have no attendance record — treated as LOP`,
    })
  }
  if (unknownLeaveTypeCount > 0) {
    warnings.push({
      code: 'UNKNOWN_LEAVE_TYPE',
      message: `${unknownLeaveTypeCount} leave day(s) reference an unrecognised leave type — treated as unpaid`,
    })
  }

  return {
    employeeId,
    periodStart: isoDate(periodStart),
    periodEnd: isoDate(periodEnd),
    basisDays,
    eligibilityStart: isoDate(window.start),
    eligibilityEnd: isoDate(window.end),
    totals,
    days,
    warnings,
  }
}

/** Sum of `payable` units across days whose date falls within [from, to] (inclusive) — used to prorate salary segments. */
export function sumPayableInRange(days: PaidDayEntry[], from: Date, to: Date): number {
  const fromIso = isoDate(from)
  const toIso = isoDate(to)
  return round2(
    days
      .filter((d) => d.date >= fromIso && d.date <= toIso)
      .reduce((sum, d) => sum + d.payable, 0),
  )
}
