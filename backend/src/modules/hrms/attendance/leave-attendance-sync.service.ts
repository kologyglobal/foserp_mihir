import type { Prisma } from '@prisma/client'
import { toDateOnly } from '../shared/shift-time.util.js'
import { calculateLeaveDays, resolveLeavePolicyForEmployee } from '../leave/leave-day-calc.service.js'

type Tx = Prisma.TransactionClient

function dayBounds(date: Date): { start: Date; end: Date } {
  const d = toDateOnly(date)
  const start = new Date(d)
  const end = new Date(d)
  end.setUTCHours(23, 59, 59, 999)
  return { start, end }
}

async function punchesOnDate(tx: Tx, tenantId: string, employeeId: string, date: Date) {
  const { start, end } = dayBounds(date)
  return tx.hrAttendancePunch.findMany({
    where: {
      tenantId,
      employeeId,
      punchedAt: { gte: start, lte: end },
    },
    orderBy: { punchedAt: 'asc' },
  })
}

/**
 * Apply approved leave onto the attendance read model.
 * Never deletes punches; raises exception when punch exists on leave day.
 *
 * Note: day calculation uses the shared leave calculator (reads outside this tx).
 */
export async function syncAttendanceOnLeaveApprove(
  tx: Tx,
  args: {
    tenantId: string
    leaveRequestId: string
    employeeId: string
    leaveTypeCode: string
    fromDate: Date
    toDate: Date
    durationType: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'
    userId?: string
  },
) {
  const policy = await resolveLeavePolicyForEmployee(args.tenantId, args.employeeId)
  const calc = await calculateLeaveDays(
    args.tenantId,
    args.employeeId,
    args.fromDate,
    args.toDate,
    args.durationType,
    {
      excludeHolidays: policy.excludeHolidays,
      excludeWeeklyOff: policy.excludeWeeklyOff,
    },
  )

  const isHalf = args.durationType === 'FIRST_HALF' || args.durationType === 'SECOND_HALF'
  const results: Array<{ date: string; status: string; exception: boolean }> = []

  for (const row of calc.breakdown) {
    if (!row.counted) continue
    const attendanceDate = toDateOnly(row.date)
    const punches = await punchesOnDate(tx, args.tenantId, args.employeeId, attendanceDate)
    const hasPunch = punches.length > 0
    const status = isHalf ? 'HALF_DAY' : 'LEAVE'
    const exceptionType = isHalf ? 'PUNCH_ON_HALF_DAY_LEAVE' : 'PUNCH_ON_LEAVE'
    const exceptionReason = hasPunch
      ? `Biometric/manual punch retained on ${isHalf ? 'half-day ' : ''}approved leave`
      : null

    await tx.hrAttendanceDay.upsert({
      where: {
        tenantId_employeeId_attendanceDate: {
          tenantId: args.tenantId,
          employeeId: args.employeeId,
          attendanceDate,
        },
      },
      create: {
        tenantId: args.tenantId,
        employeeId: args.employeeId,
        attendanceDate,
        status,
        leaveRequestId: args.leaveRequestId,
        leaveDurationType: args.durationType,
        leaveTypeCode: args.leaveTypeCode,
        hasPunch,
        exceptionFlag: hasPunch,
        exceptionReason,
        source: 'LEAVE',
        createdBy: args.userId,
        updatedBy: args.userId,
      },
      update: {
        status,
        leaveRequestId: args.leaveRequestId,
        leaveDurationType: args.durationType,
        leaveTypeCode: args.leaveTypeCode,
        hasPunch,
        exceptionFlag: hasPunch,
        exceptionReason,
        source: 'LEAVE',
        updatedBy: args.userId,
      },
    })

    if (hasPunch) {
      await tx.hrAttendanceException.create({
        data: {
          tenantId: args.tenantId,
          employeeId: args.employeeId,
          attendanceDate,
          exceptionType,
          reason: exceptionReason!,
          leaveRequestId: args.leaveRequestId,
          punchId: punches[0]?.id ?? null,
          createdBy: args.userId,
        },
      })
    }

    if (!isHalf) {
      // Dynamic import avoids a static hrms/leave ↔ hrms/overtime module cycle.
      const { regenerateOtCandidate } = await import('../overtime/ot-detection.service.js')
      await regenerateOtCandidate(args.tenantId, args.employeeId, attendanceDate, args.userId, tx)
    }

    results.push({ date: row.date, status, exception: hasPunch })
  }

  return results
}

/**
 * Reverse leave impact on attendance. Punches stay; leave-sourced day is recalculated.
 */
export async function syncAttendanceOnLeaveCancel(
  tx: Tx,
  args: {
    tenantId: string
    leaveRequestId: string
    employeeId: string
    userId?: string
  },
) {
  const days = await tx.hrAttendanceDay.findMany({
    where: {
      tenantId: args.tenantId,
      employeeId: args.employeeId,
      leaveRequestId: args.leaveRequestId,
    },
  })

  for (const day of days) {
    const punches = await punchesOnDate(tx, args.tenantId, args.employeeId, day.attendanceDate)
    const hasPunch = punches.length > 0

    if (hasPunch) {
      await tx.hrAttendanceDay.update({
        where: { id: day.id },
        data: {
          status: 'PRESENT',
          leaveRequestId: null,
          leaveDurationType: null,
          leaveTypeCode: null,
          hasPunch: true,
          exceptionFlag: false,
          exceptionReason: null,
          source: 'RECALC',
          updatedBy: args.userId,
          note: 'Leave cancelled; punch retained',
        },
      })
    } else {
      await tx.hrAttendanceDay.delete({ where: { id: day.id } })
    }
  }

  await tx.hrAttendanceException.updateMany({
    where: {
      tenantId: args.tenantId,
      leaveRequestId: args.leaveRequestId,
      resolved: false,
    },
    data: {
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy: args.userId ?? null,
    },
  })
}
