import { prisma } from '../../../config/prisma.js'
import { NotFoundError } from '../../../utils/errors.js'
import { toDateOnly } from '../shared/shift-time.util.js'

export interface HolidayResolution {
  employeeId: string
  date: string
  isHoliday: boolean
  holidayName: string | null
  holidayType: string | null
  optionalHoliday: boolean
  calendarId: string | null
  calendarName: string | null
  calendarScope: 'BRANCH' | 'LEGAL_ENTITY' | null
}

/**
 * Resolve holiday for an employee on a date.
 * Prefers active branch calendar, then legal-entity-wide calendar for that year.
 */
export async function getHoliday(
  tenantId: string,
  employeeId: string,
  dateInput: Date | string,
): Promise<HolidayResolution> {
  const date = toDateOnly(dateInput)
  const dateIso = date.toISOString().slice(0, 10)
  const year = date.getUTCFullYear()

  const employee = await prisma.hrEmployee.findFirst({
    where: { id: employeeId, tenantId, deletedAt: null },
    select: { id: true, legalEntityId: true, branchId: true },
  })
  if (!employee) throw new NotFoundError('Employee not found')

  const calendars = await prisma.hrHolidayCalendar.findMany({
    where: {
      tenantId,
      deletedAt: null,
      isActive: true,
      legalEntityId: employee.legalEntityId,
      year,
      OR: [{ branchId: employee.branchId }, { branchId: null }],
    },
    include: {
      days: {
        where: {
          deletedAt: null,
          isActive: true,
          holidayDate: date,
        },
      },
    },
    orderBy: { branchId: 'desc' },
  })

  const branchCal = calendars.find((c) => c.branchId === employee.branchId)
  const leCal = calendars.find((c) => c.branchId == null)
  const chosen = branchCal?.days[0] ? branchCal : leCal?.days[0] ? leCal : null
  const day = chosen?.days[0]

  if (!day || !chosen) {
    return {
      employeeId,
      date: dateIso,
      isHoliday: false,
      holidayName: null,
      holidayType: null,
      optionalHoliday: false,
      calendarId: null,
      calendarName: null,
      calendarScope: null,
    }
  }

  return {
    employeeId,
    date: dateIso,
    isHoliday: true,
    holidayName: day.name,
    holidayType: day.holidayType,
    optionalHoliday: day.optionalHoliday,
    calendarId: chosen.id,
    calendarName: chosen.name,
    calendarScope: chosen.branchId ? 'BRANCH' : 'LEGAL_ENTITY',
  }
}
