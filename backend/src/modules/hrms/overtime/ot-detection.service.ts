import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { NotFoundError } from '../../../utils/errors.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess } from '../hrms-scope.js'
import { getEffectiveShift } from '../shared/effective-shift.service.js'
import { getHoliday } from '../shared/holiday-resolution.service.js'
import { shiftSpanMinutes, toDateOnly } from '../shared/shift-time.util.js'
import { applyEligibility, computeDetectedMinutes } from './ot-calc.util.js'
import { resolvePolicyForEmployee } from './ot-policy.service.js'

type DbClient = Prisma.TransactionClient | typeof prisma

interface AuditMeta {
  ipAddress?: string | null
  userAgent?: string | null
}

function dayBounds(date: Date): { start: Date; end: Date } {
  const d = toDateOnly(date)
  const start = new Date(d)
  const end = new Date(d)
  end.setUTCHours(23, 59, 59, 999)
  return { start, end }
}

export function parseFlags(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean)
}

function mergeFlags(existing: string[], additions: string[]): string[] {
  return [...new Set([...existing, ...additions])]
}

function serializeFlags(flags: string[]): string | null {
  return flags.length ? flags.join(',') : null
}

/** API-shape mapper — exceptionFlags is always parsed to a string[] for clients. */
export function mapOt(row: {
  id: string
  employeeId: string
  attendanceDate: Date
  attendanceDayId: string | null
  shiftId: string | null
  detectedMinutes: number
  eligibleMinutes: number
  approvedMinutes: number | null
  status: string
  reason: string | null
  requestedByUserId: string | null
  approvedByUserId: string | null
  approvedAt: Date | null
  rejectionReason: string | null
  source: string
  exceptionFlags: string | null
  firstInAt: Date | null
  lastOutAt: Date | null
  workedMinutes: number | null
  cancelledAt: Date | null
  cancelledByUserId: string | null
  cancellationReason: string | null
  correctsRecordId: string | null
  createdAt?: Date
  updatedAt?: Date
  employee?: {
    id: string
    employeeCode: string
    displayName: string
    department?: { name: string } | null
    branch?: { name: string } | null
  } | null
  shift?: { id: string; code: string; name: string } | null
}) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employee: row.employee
      ? {
          id: row.employee.id,
          employeeCode: row.employee.employeeCode,
          displayName: row.employee.displayName,
          department: row.employee.department?.name ?? null,
          branch: row.employee.branch?.name ?? null,
        }
      : null,
    attendanceDate: row.attendanceDate.toISOString().slice(0, 10),
    attendanceDayId: row.attendanceDayId,
    shiftId: row.shiftId,
    shift: row.shift ?? null,
    detectedMinutes: row.detectedMinutes,
    eligibleMinutes: row.eligibleMinutes,
    approvedMinutes: row.approvedMinutes,
    status: row.status,
    reason: row.reason,
    requestedByUserId: row.requestedByUserId,
    approvedByUserId: row.approvedByUserId,
    approvedAt: row.approvedAt,
    rejectionReason: row.rejectionReason,
    source: row.source,
    exceptionFlags: parseFlags(row.exceptionFlags),
    firstInAt: row.firstInAt,
    lastOutAt: row.lastOutAt,
    workedMinutes: row.workedMinutes,
    cancelledAt: row.cancelledAt,
    cancelledByUserId: row.cancelledByUserId,
    cancellationReason: row.cancellationReason,
    correctsRecordId: row.correctsRecordId,
  }
}

/**
 * Recompute firstIn/lastOut/workedMinutes/shiftId on the attendance day from raw punches.
 * Never deletes or mutates punches — read-model refresh only. No-op if the day doesn't exist yet.
 */
export async function refreshAttendanceWorkedTime(
  client: DbClient,
  tenantId: string,
  employeeId: string,
  dateInput: Date | string,
  userId?: string,
) {
  const date = toDateOnly(dateInput)
  const { start, end } = dayBounds(date)

  const day = await client.hrAttendanceDay.findFirst({
    where: { tenantId, employeeId, attendanceDate: date },
  })
  if (!day) return null

  const punches = await client.hrAttendancePunch.findMany({
    where: { tenantId, employeeId, punchedAt: { gte: start, lte: end } },
    orderBy: { punchedAt: 'asc' },
  })

  const ins = punches.filter((p) => p.punchType === 'IN')
  const outs = punches.filter((p) => p.punchType === 'OUT')
  const firstInAt = ins[0]?.punchedAt ?? null
  const lastOutAt = outs.length ? outs[outs.length - 1].punchedAt : null

  let workedMinutes: number | null = null
  if (firstInAt && lastOutAt && lastOutAt.getTime() > firstInAt.getTime()) {
    workedMinutes = Math.round((lastOutAt.getTime() - firstInAt.getTime()) / 60_000)
  }

  const eff = await getEffectiveShift(tenantId, employeeId, date)

  const updated = await client.hrAttendanceDay.update({
    where: { id: day.id },
    data: {
      shiftId: eff.shift?.id ?? null,
      firstInAt,
      lastOutAt,
      workedMinutes,
      updatedBy: userId,
    },
  })

  return { day: updated, effectiveShift: eff }
}

async function getMonthApprovedMinutes(
  client: DbClient,
  tenantId: string,
  employeeId: string,
  date: Date,
): Promise<number> {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
  const agg = await client.hrOvertimeRecord.aggregate({
    where: {
      tenantId,
      employeeId,
      status: 'APPROVED',
      deletedAt: null,
      attendanceDate: { gte: start, lte: end },
      NOT: { attendanceDate: date },
    },
    _sum: { approvedMinutes: true },
  })
  return agg._sum.approvedMinutes ?? 0
}

export type RegenerateOtStatus = 'CREATED' | 'UPDATED' | 'SKIPPED' | 'UNCHANGED'

export interface RegenerateOtResult {
  status: RegenerateOtStatus
  flags: string[]
  record: ReturnType<typeof mapOt> | null
}

/**
 * Recompute (or create) the PENDING OT candidate for an employee/date from the attendance
 * read model. Idempotent: safe to call after every punch or attendance finalize.
 *
 * Rules:
 *  - No attendance day            → SKIPPED, flag MISSING_ATTENDANCE (no row created)
 *  - Day not finalized yet        → flag ATTENDANCE_NOT_FINALIZED (candidate still produced)
 *  - No effective shift           → flag MISSING_SHIFT, detected/eligible forced to 0
 *  - Existing APPROVED/REJECTED   → minutes are frozen; if worked time drifted, flag
 *                                    ATTENDANCE_CHANGED_AFTER_OT_APPROVAL + audit, no overwrite
 *  - Existing PENDING/CANCELLED   → refreshed in place (CANCELLED revives to PENDING)
 *  - No existing row              → created as PENDING only when detected > 0 or flags exist
 */
export async function regenerateOtCandidate(
  tenantId: string,
  employeeId: string,
  dateInput: Date | string,
  userId?: string,
  client: DbClient = prisma,
): Promise<RegenerateOtResult> {
  const date = toDateOnly(dateInput)

  const attendanceDay = await client.hrAttendanceDay.findFirst({
    where: { tenantId, employeeId, attendanceDate: date },
  })

  if (!attendanceDay) {
    return { status: 'SKIPPED', flags: ['MISSING_ATTENDANCE'], record: null }
  }

  const flags: string[] = []
  if (!attendanceDay.isFinalized) {
    flags.push('ATTENDANCE_NOT_FINALIZED')
  }

  const eff = await getEffectiveShift(tenantId, employeeId, date)
  const holiday = await getHoliday(tenantId, employeeId, date)
  const isFullDayLeave = attendanceDay.status === 'LEAVE'
  const workedMinutes = attendanceDay.workedMinutes ?? 0

  let detected = 0
  const shiftId = eff.shift?.id ?? null
  if (!eff.shift) {
    flags.push('MISSING_SHIFT')
  } else {
    const span = shiftSpanMinutes(eff.shift.startTime, eff.shift.endTime, eff.shift.overnightShift)
    detected = computeDetectedMinutes(workedMinutes, span)
  }

  const policy = await resolvePolicyForEmployee(tenantId, employeeId, date)
  const monthApprovedSoFar = await getMonthApprovedMinutes(client, tenantId, employeeId, date)

  const eligibility = applyEligibility({
    detected,
    policy: policy
      ? {
          enabled: policy.enabled,
          minimumExtraMinutes: policy.minimumExtraMinutes,
          roundingMinutes: policy.roundingMinutes,
          maxOtMinutesPerDay: policy.maxOtMinutesPerDay,
          maxOtMinutesPerMonth: policy.maxOtMinutesPerMonth,
          weeklyOffOtAllowed: policy.weeklyOffOtAllowed,
          holidayOtAllowed: policy.holidayOtAllowed,
          leaveDayOtAllowed: policy.leaveDayOtAllowed,
        }
      : null,
    shiftOtEligible: eff.shift?.otEligible ?? false,
    isWeeklyOff: eff.isWeeklyOff,
    isHoliday: holiday.isHoliday,
    isFullDayLeave,
    monthApprovedSoFar,
  })

  const allFlags = mergeFlags(flags, eligibility.flags)

  const existing = await client.hrOvertimeRecord.findFirst({
    where: { tenantId, employeeId, attendanceDate: date, deletedAt: null },
  })

  if (existing && (existing.status === 'APPROVED' || existing.status === 'REJECTED')) {
    const changed = existing.workedMinutes !== workedMinutes || existing.detectedMinutes !== detected
    if (!changed) {
      return { status: 'UNCHANGED', flags: parseFlags(existing.exceptionFlags), record: mapOt(existing) }
    }
    const revisedFlags = mergeFlags(parseFlags(existing.exceptionFlags), ['ATTENDANCE_CHANGED_AFTER_OT_APPROVAL'])
    const updated = await client.hrOvertimeRecord.update({
      where: { id: existing.id },
      data: { exceptionFlags: serializeFlags(revisedFlags), updatedBy: userId },
    })
    await createAuditLog({
      tenantId,
      module: 'hrms',
      entity: 'HrOvertimeRecord',
      entityId: existing.id,
      action: 'ATTENDANCE_CHANGED_AFTER_APPROVAL',
      oldValues: { workedMinutes: existing.workedMinutes, detectedMinutes: existing.detectedMinutes },
      newValues: { workedMinutes, detectedMinutes: detected },
      userId,
    })
    return { status: 'UNCHANGED', flags: revisedFlags, record: mapOt(updated) }
  }

  if (existing && (existing.status === 'PENDING' || existing.status === 'CANCELLED')) {
    const updated = await client.hrOvertimeRecord.update({
      where: { id: existing.id },
      data: {
        status: 'PENDING',
        attendanceDayId: attendanceDay.id,
        shiftId,
        detectedMinutes: detected,
        eligibleMinutes: eligibility.eligible,
        source: 'ATTENDANCE',
        exceptionFlags: serializeFlags(allFlags),
        firstInAt: attendanceDay.firstInAt,
        lastOutAt: attendanceDay.lastOutAt,
        workedMinutes,
        approvedMinutes: null,
        approvedByUserId: null,
        approvedAt: null,
        rejectionReason: null,
        cancelledAt: null,
        cancelledByUserId: null,
        cancellationReason: null,
        updatedBy: userId,
      },
    })
    return { status: 'UPDATED', flags: allFlags, record: mapOt(updated) }
  }

  if (!existing && (detected > 0 || allFlags.length > 0)) {
    const created = await client.hrOvertimeRecord.create({
      data: {
        tenantId,
        employeeId,
        attendanceDate: date,
        attendanceDayId: attendanceDay.id,
        shiftId,
        detectedMinutes: detected,
        eligibleMinutes: eligibility.eligible,
        status: 'PENDING',
        source: 'ATTENDANCE',
        exceptionFlags: serializeFlags(allFlags),
        firstInAt: attendanceDay.firstInAt,
        lastOutAt: attendanceDay.lastOutAt,
        workedMinutes,
        createdBy: userId,
        updatedBy: userId,
      },
    })
    return { status: 'CREATED', flags: allFlags, record: mapOt(created) }
  }

  return { status: 'SKIPPED', flags: allFlags, record: null }
}

/** Finalize the attendance day (locks it for payroll/OT purposes) and regenerate its OT candidate. */
export async function finalizeAttendanceDay(
  tenantId: string,
  employeeId: string,
  dateInput: Date | string,
  scope: UserDataScope,
  userId?: string,
  audit?: AuditMeta,
) {
  const date = toDateOnly(dateInput)
  const employee = await prisma.hrEmployee.findFirst({ where: { id: employeeId, tenantId, deletedAt: null } })
  if (!employee) throw new NotFoundError('Employee not found')
  assertHrAccess(scope, { legalEntityId: employee.legalEntityId, branchId: employee.branchId })

  const result = await prisma.$transaction(async (tx) => {
    const existingDay = await tx.hrAttendanceDay.findFirst({ where: { tenantId, employeeId, attendanceDate: date } })
    if (!existingDay) {
      throw new NotFoundError('Attendance day not found — record a punch or leave first')
    }

    await refreshAttendanceWorkedTime(tx, tenantId, employeeId, date, userId)

    const finalized = await tx.hrAttendanceDay.update({
      where: { id: existingDay.id },
      data: { isFinalized: true, finalizedAt: new Date(), updatedBy: userId },
    })

    const overtime = await regenerateOtCandidate(tenantId, employeeId, date, userId, tx)

    return { attendanceDay: finalized, overtime }
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrAttendanceDay',
    entityId: result.attendanceDay.id,
    action: 'FINALIZE',
    newValues: {
      attendanceDate: date.toISOString().slice(0, 10),
      workedMinutes: result.attendanceDay.workedMinutes,
      otStatus: result.overtime.status,
    },
    userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return {
    attendanceDay: {
      ...result.attendanceDay,
      attendanceDate: result.attendanceDay.attendanceDate.toISOString().slice(0, 10),
    },
    overtime: result.overtime,
  }
}
