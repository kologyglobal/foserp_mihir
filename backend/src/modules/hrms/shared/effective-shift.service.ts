import { prisma } from '../../../config/prisma.js'
import { NotFoundError } from '../../../utils/errors.js'
import { toDateOnly } from '../shared/shift-time.util.js'

export type EffectiveShiftSource = 'TEMPORARY' | 'ROSTER' | 'DEFAULT'

export interface EffectiveShiftResult {
  employeeId: string
  date: string
  source: EffectiveShiftSource | null
  shift: {
    id: string
    code: string
    name: string
    startTime: string
    endTime: string
    breakMinutes: number
    graceInMinutes: number
    graceOutMinutes: number | null
    fullDayMinimumMinutes: number
    halfDayMinimumMinutes: number
    otEligible: boolean
    otStartsAfterMinutes: number | null
    overnightShift: boolean
    weeklyOffDay: number | null
  } | null
  assignmentId: string | null
  effectiveFrom: string | null
  effectiveTo: string | null
  weeklyOffDay: number | null
  isWeeklyOff: boolean
}

function mapShift(row: {
  id: string
  code: string
  name: string
  startTime: string
  endTime: string
  breakMinutes: number
  graceInMinutes: number
  graceOutMinutes: number | null
  fullDayMinimumMinutes: number
  halfDayMinimumMinutes: number
  otEligible: boolean
  otStartsAfterMinutes: number | null
  overnightShift: boolean
  weeklyOffDay: number | null
}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    startTime: row.startTime,
    endTime: row.endTime,
    breakMinutes: row.breakMinutes,
    graceInMinutes: row.graceInMinutes,
    graceOutMinutes: row.graceOutMinutes,
    fullDayMinimumMinutes: row.fullDayMinimumMinutes,
    halfDayMinimumMinutes: row.halfDayMinimumMinutes,
    otEligible: row.otEligible,
    otStartsAfterMinutes: row.otStartsAfterMinutes,
    overnightShift: row.overnightShift,
    weeklyOffDay: row.weeklyOffDay,
  }
}

function coversDate(from: Date, to: Date | null, date: Date): boolean {
  if (from.getTime() > date.getTime()) return false
  if (to && to.getTime() < date.getTime()) return false
  return true
}

/**
 * Canonical effective-shift resolver for Attendance (Phase 3+) and roster UX.
 * Priority: TEMPORARY → ROSTER → employee.defaultShiftId
 */
export async function getEffectiveShift(
  tenantId: string,
  employeeId: string,
  dateInput: Date | string,
): Promise<EffectiveShiftResult> {
  const date = toDateOnly(dateInput)
  const dateIso = date.toISOString().slice(0, 10)

  const employee = await prisma.hrEmployee.findFirst({
    where: { id: employeeId, tenantId, deletedAt: null },
    include: {
      defaultShift: true,
    },
  })
  if (!employee) throw new NotFoundError('Employee not found')

  const assignments = await prisma.hrEmployeeShiftAssignment.findMany({
    where: {
      tenantId,
      employeeId,
      deletedAt: null,
      effectiveFrom: { lte: date },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      source: { in: ['TEMPORARY', 'ROSTER'] },
    },
    include: { shift: true },
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
  })

  const temporary = assignments.find(
    (a) => a.source === 'TEMPORARY' && coversDate(a.effectiveFrom, a.effectiveTo, date) && !a.shift.deletedAt,
  )
  if (temporary) {
    const weeklyOffDay = employee.weeklyOffDay ?? temporary.shift.weeklyOffDay
    return {
      employeeId,
      date: dateIso,
      source: 'TEMPORARY',
      shift: mapShift(temporary.shift),
      assignmentId: temporary.id,
      effectiveFrom: temporary.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: temporary.effectiveTo ? temporary.effectiveTo.toISOString().slice(0, 10) : null,
      weeklyOffDay,
      isWeeklyOff: weeklyOffDay != null && weeklyOffDay === date.getUTCDay(),
    }
  }

  const roster = assignments.find(
    (a) => a.source === 'ROSTER' && coversDate(a.effectiveFrom, a.effectiveTo, date) && !a.shift.deletedAt,
  )
  if (roster) {
    const weeklyOffDay = employee.weeklyOffDay ?? roster.shift.weeklyOffDay
    return {
      employeeId,
      date: dateIso,
      source: 'ROSTER',
      shift: mapShift(roster.shift),
      assignmentId: roster.id,
      effectiveFrom: roster.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: roster.effectiveTo ? roster.effectiveTo.toISOString().slice(0, 10) : null,
      weeklyOffDay,
      isWeeklyOff: weeklyOffDay != null && weeklyOffDay === date.getUTCDay(),
    }
  }

  if (employee.defaultShift && !employee.defaultShift.deletedAt && employee.defaultShift.isActive) {
    const weeklyOffDay = employee.weeklyOffDay ?? employee.defaultShift.weeklyOffDay
    return {
      employeeId,
      date: dateIso,
      source: 'DEFAULT',
      shift: mapShift(employee.defaultShift),
      assignmentId: null,
      effectiveFrom: null,
      effectiveTo: null,
      weeklyOffDay,
      isWeeklyOff: weeklyOffDay != null && weeklyOffDay === date.getUTCDay(),
    }
  }

  const weeklyOffDay = employee.weeklyOffDay
  return {
    employeeId,
    date: dateIso,
    source: null,
    shift: null,
    assignmentId: null,
    effectiveFrom: null,
    effectiveTo: null,
    weeklyOffDay,
    isWeeklyOff: weeklyOffDay != null && weeklyOffDay === date.getUTCDay(),
  }
}
