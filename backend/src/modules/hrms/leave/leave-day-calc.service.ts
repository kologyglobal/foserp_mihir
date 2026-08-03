import { prisma } from '../../../config/prisma.js'
import { ValidationError } from '../../../utils/errors.js'
import { getEffectiveShift } from '../shared/effective-shift.service.js'
import { getHoliday } from '../shared/holiday-resolution.service.js'
import { toDateOnly } from '../shared/shift-time.util.js'

export type LeaveDurationType = 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'

export interface LeaveDayCalcPolicy {
  excludeHolidays: boolean
  excludeWeeklyOff: boolean
}

export interface LeaveDayBreakdown {
  date: string
  counted: boolean
  days: number
  reason: 'COUNTED' | 'WEEKLY_OFF' | 'HOLIDAY' | 'SKIPPED'
  holidayName?: string | null
}

export interface LeaveDayCalculation {
  requestedDays: number
  breakdown: LeaveDayBreakdown[]
}

function eachDateInclusive(from: Date, to: Date): Date[] {
  const out: Date[] = []
  for (let t = from.getTime(); t <= to.getTime(); t += 86_400_000) {
    out.push(new Date(t))
  }
  return out
}

/**
 * Backend leave-day calculator using Phase 2 effective shift + holiday resolver.
 */
export async function calculateLeaveDays(
  tenantId: string,
  employeeId: string,
  fromInput: Date | string,
  toInput: Date | string,
  durationType: LeaveDurationType,
  policy: LeaveDayCalcPolicy,
): Promise<LeaveDayCalculation> {
  const from = toDateOnly(fromInput)
  const to = toDateOnly(toInput)
  if (to.getTime() < from.getTime()) {
    throw new ValidationError('toDate must be on or after fromDate')
  }

  const isHalf = durationType === 'FIRST_HALF' || durationType === 'SECOND_HALF'
  if (isHalf && from.getTime() !== to.getTime()) {
    throw new ValidationError('Half-day leave must be for a single date')
  }

  const dates = eachDateInclusive(from, to)
  if (dates.length > 90) {
    throw new ValidationError('Leave range cannot exceed 90 days')
  }

  const dayUnit = isHalf ? 0.5 : 1
  const breakdown: LeaveDayBreakdown[] = []
  let requestedDays = 0

  for (const date of dates) {
    const iso = date.toISOString().slice(0, 10)
    const eff = await getEffectiveShift(tenantId, employeeId, date)
    const holiday = await getHoliday(tenantId, employeeId, date)

    if (policy.excludeWeeklyOff && eff.isWeeklyOff) {
      breakdown.push({ date: iso, counted: false, days: 0, reason: 'WEEKLY_OFF' })
      continue
    }
    if (policy.excludeHolidays && holiday.isHoliday) {
      breakdown.push({
        date: iso,
        counted: false,
        days: 0,
        reason: 'HOLIDAY',
        holidayName: holiday.holidayName,
      })
      continue
    }

    breakdown.push({ date: iso, counted: true, days: dayUnit, reason: 'COUNTED' })
    requestedDays += dayUnit
  }

  // Round to 2 dp to avoid float noise
  requestedDays = Math.round(requestedDays * 100) / 100
  return { requestedDays, breakdown }
}

export async function resolveLeavePolicyForEmployee(tenantId: string, employeeId: string) {
  const employee = await prisma.hrEmployee.findFirst({
    where: { id: employeeId, tenantId, deletedAt: null },
  })
  if (!employee) throw new ValidationError('Employee is invalid')

  const policies = await prisma.hrLeavePolicy.findMany({
    where: {
      tenantId,
      deletedAt: null,
      isActive: true,
      legalEntityId: employee.legalEntityId,
      OR: [{ branchId: employee.branchId }, { branchId: null }],
      AND: [
        {
          OR: [{ workerCategory: employee.workerCategory }, { workerCategory: null }],
        },
      ],
    },
    include: { leaveTypes: true },
    orderBy: [{ branchId: 'desc' }, { workerCategory: 'desc' }, { createdAt: 'asc' }],
  })

  // Prefer branch+category match, then branch, then LE+category, then LE-wide
  const scored = policies
    .map((p) => {
      let score = 0
      if (p.branchId === employee.branchId) score += 2
      if (p.workerCategory === employee.workerCategory) score += 1
      return { p, score }
    })
    .sort((a, b) => b.score - a.score)

  const chosen = scored[0]?.p
  if (!chosen) {
    return {
      policyId: null as string | null,
      excludeHolidays: true,
      excludeWeeklyOff: true,
      allowNegativeBalance: false,
      leaveTypeIds: null as string[] | null,
    }
  }

  const linked = chosen.leaveTypes.map((x) => x.leaveTypeId)
  return {
    policyId: chosen.id,
    excludeHolidays: chosen.excludeHolidays,
    excludeWeeklyOff: chosen.excludeWeeklyOff,
    allowNegativeBalance: chosen.allowNegativeBalance,
    // Empty link set = all active types allowed (V1 simplicity)
    leaveTypeIds: linked.length > 0 ? linked : null,
  }
}
