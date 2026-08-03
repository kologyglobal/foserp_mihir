import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess } from '../hrms-scope.js'
import { getHoliday } from '../shared/holiday-resolution.service.js'
import { toDateOnly } from '../shared/shift-time.util.js'
import type {
  CreateCalendarInput,
  CreateHolidayDayInput,
  ListCalendarsQuery,
  UpdateCalendarInput,
  UpdateHolidayDayInput,
} from './holiday.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

function mapDay(d: {
  id: string
  holidayDate: Date
  name: string
  holidayType: string
  optionalHoliday: boolean
  isActive: boolean
}) {
  return {
    id: d.id,
    holidayDate: d.holidayDate.toISOString().slice(0, 10),
    name: d.name,
    holidayType: d.holidayType,
    optionalHoliday: d.optionalHoliday,
    isActive: d.isActive,
  }
}

function mapCalendar(row: {
  id: string
  tenantId: string
  legalEntityId: string
  branchId: string | null
  code: string
  name: string
  year: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  legalEntity?: { id: string; code: string; displayName: string }
  branch?: { id: string; code: string; name: string } | null
  days?: Array<{
    id: string
    holidayDate: Date
    name: string
    holidayType: string
    optionalHoliday: boolean
    isActive: boolean
    deletedAt: Date | null
  }>
}) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    legalEntityId: row.legalEntityId,
    legalEntity: row.legalEntity ?? null,
    branchId: row.branchId,
    branch: row.branch ?? null,
    code: row.code,
    name: row.name,
    year: row.year,
    isActive: row.isActive,
    days: (row.days ?? []).filter((d) => !d.deletedAt).map(mapDay),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listCalendars(tenantId: string, query: ListCalendarsQuery, scope: UserDataScope) {
  const { page, limit, skip } = getPagination(query)
  const where: Prisma.HrHolidayCalendarWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.search
      ? { OR: [{ code: { contains: query.search } }, { name: { contains: query.search } }] }
      : {}),
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.year ? { year: query.year } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  }

  if (!scope.unrestricted) {
    const and: Prisma.HrHolidayCalendarWhereInput[] = []
    if (scope.legalEntities.length > 0) {
      and.push({ legalEntityId: { in: scope.legalEntities.map((x) => x.legalEntityId) } })
    }
    if (scope.branches.length > 0) {
      and.push({
        OR: [{ branchId: null }, { branchId: { in: scope.branches.map((x) => x.branchId) } }],
      })
    }
    if (and.length) where.AND = and
  }

  const [total, rows] = await Promise.all([
    prisma.hrHolidayCalendar.count({ where }),
    prisma.hrHolidayCalendar.findMany({
      where,
      include: {
        legalEntity: { select: { id: true, code: true, displayName: true } },
        branch: { select: { id: true, code: true, name: true } },
        days: { where: { deletedAt: null }, orderBy: { holidayDate: 'asc' } },
      },
      orderBy: [{ year: 'desc' }, { code: 'asc' }],
      skip,
      take: limit,
    }),
  ])

  return { items: rows.map(mapCalendar), total, page, limit }
}

export async function getCalendar(tenantId: string, calendarId: string, scope: UserDataScope) {
  const row = await prisma.hrHolidayCalendar.findFirst({
    where: { id: calendarId, tenantId, deletedAt: null },
    include: {
      legalEntity: { select: { id: true, code: true, displayName: true } },
      branch: { select: { id: true, code: true, name: true } },
      days: { where: { deletedAt: null }, orderBy: { holidayDate: 'asc' } },
    },
  })
  if (!row) throw new NotFoundError('Holiday calendar not found')
  assertHrAccess(scope, { legalEntityId: row.legalEntityId, branchId: row.branchId })
  return mapCalendar(row)
}

export async function createCalendar(
  tenantId: string,
  input: CreateCalendarInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  assertHrAccess(scope, { legalEntityId: input.legalEntityId, branchId: input.branchId })

  const le = await prisma.legalEntity.findFirst({
    where: { id: input.legalEntityId, tenantId, isActive: true },
  })
  if (!le) throw new ValidationError('Legal entity is invalid')

  if (input.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: input.branchId, tenantId, isActive: true },
    })
    if (!branch) throw new ValidationError('Branch is invalid')
    if (branch.legalEntityId !== input.legalEntityId) {
      throw new ValidationError('Branch does not belong to the selected legal entity')
    }
  }

  const code = input.code.trim().toUpperCase()
  const clash = await prisma.hrHolidayCalendar.findFirst({
    where: { tenantId, code, deletedAt: null },
  })
  if (clash) throw new ConflictError(`Calendar code ${code} already exists`)

  const row = await prisma.hrHolidayCalendar.create({
    data: {
      tenantId,
      legalEntityId: input.legalEntityId,
      branchId: input.branchId ?? null,
      code,
      name: input.name.trim(),
      year: input.year,
      isActive: input.isActive ?? true,
      createdBy: audit?.userId,
      updatedBy: audit?.userId,
    },
    include: {
      legalEntity: { select: { id: true, code: true, displayName: true } },
      branch: { select: { id: true, code: true, name: true } },
      days: true,
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrHolidayCalendar',
    entityId: row.id,
    action: 'CREATE',
    newValues: { code: row.code, year: row.year },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapCalendar(row)
}

export async function updateCalendar(
  tenantId: string,
  calendarId: string,
  input: UpdateCalendarInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const existing = await prisma.hrHolidayCalendar.findFirst({
    where: { id: calendarId, tenantId, deletedAt: null },
  })
  if (!existing) throw new NotFoundError('Holiday calendar not found')
  assertHrAccess(scope, { legalEntityId: existing.legalEntityId, branchId: existing.branchId })

  const nextBranch = input.branchId !== undefined ? input.branchId : existing.branchId
  if (nextBranch) {
    const branch = await prisma.branch.findFirst({
      where: { id: nextBranch, tenantId, isActive: true },
    })
    if (!branch) throw new ValidationError('Branch is invalid')
    if (branch.legalEntityId !== existing.legalEntityId) {
      throw new ValidationError('Branch does not belong to the calendar legal entity')
    }
  }
  assertHrAccess(scope, { legalEntityId: existing.legalEntityId, branchId: nextBranch })

  const row = await prisma.hrHolidayCalendar.update({
    where: { id: calendarId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
      ...(input.year !== undefined ? { year: input.year } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: audit?.userId,
    },
    include: {
      legalEntity: { select: { id: true, code: true, displayName: true } },
      branch: { select: { id: true, code: true, name: true } },
      days: { where: { deletedAt: null }, orderBy: { holidayDate: 'asc' } },
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrHolidayCalendar',
    entityId: row.id,
    action: 'UPDATE',
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapCalendar(row)
}

export async function addHolidayDay(
  tenantId: string,
  calendarId: string,
  input: CreateHolidayDayInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const calendar = await prisma.hrHolidayCalendar.findFirst({
    where: { id: calendarId, tenantId, deletedAt: null },
  })
  if (!calendar) throw new NotFoundError('Holiday calendar not found')
  assertHrAccess(scope, { legalEntityId: calendar.legalEntityId, branchId: calendar.branchId })

  const holidayDate = toDateOnly(input.holidayDate)
  const clash = await prisma.hrHolidayCalendarDay.findFirst({
    where: { calendarId, holidayDate, deletedAt: null },
  })
  if (clash) throw new ConflictError('A holiday already exists on this date for the calendar')

  const day = await prisma.hrHolidayCalendarDay.create({
    data: {
      tenantId,
      calendarId,
      holidayDate,
      name: input.name.trim(),
      holidayType: input.holidayType,
      optionalHoliday: input.optionalHoliday ?? input.holidayType === 'OPTIONAL',
      isActive: input.isActive ?? true,
      createdBy: audit?.userId,
      updatedBy: audit?.userId,
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrHolidayCalendarDay',
    entityId: day.id,
    action: 'CREATE',
    newValues: { calendarId, holidayDate: input.holidayDate, name: day.name },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapDay(day)
}

export async function updateHolidayDay(
  tenantId: string,
  calendarId: string,
  dayId: string,
  input: UpdateHolidayDayInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const calendar = await prisma.hrHolidayCalendar.findFirst({
    where: { id: calendarId, tenantId, deletedAt: null },
  })
  if (!calendar) throw new NotFoundError('Holiday calendar not found')
  assertHrAccess(scope, { legalEntityId: calendar.legalEntityId, branchId: calendar.branchId })

  const existing = await prisma.hrHolidayCalendarDay.findFirst({
    where: { id: dayId, calendarId, tenantId, deletedAt: null },
  })
  if (!existing) throw new NotFoundError('Holiday day not found')

  if (input.holidayDate) {
    const holidayDate = toDateOnly(input.holidayDate)
    const clash = await prisma.hrHolidayCalendarDay.findFirst({
      where: { calendarId, holidayDate, deletedAt: null, NOT: { id: dayId } },
    })
    if (clash) throw new ConflictError('A holiday already exists on this date for the calendar')
  }

  const day = await prisma.hrHolidayCalendarDay.update({
    where: { id: dayId },
    data: {
      ...(input.holidayDate ? { holidayDate: toDateOnly(input.holidayDate) } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.holidayType !== undefined ? { holidayType: input.holidayType } : {}),
      ...(input.optionalHoliday !== undefined ? { optionalHoliday: input.optionalHoliday } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: audit?.userId,
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrHolidayCalendarDay',
    entityId: day.id,
    action: 'UPDATE',
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapDay(day)
}

export async function removeHolidayDay(
  tenantId: string,
  calendarId: string,
  dayId: string,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const calendar = await prisma.hrHolidayCalendar.findFirst({
    where: { id: calendarId, tenantId, deletedAt: null },
  })
  if (!calendar) throw new NotFoundError('Holiday calendar not found')
  assertHrAccess(scope, { legalEntityId: calendar.legalEntityId, branchId: calendar.branchId })

  const existing = await prisma.hrHolidayCalendarDay.findFirst({
    where: { id: dayId, calendarId, tenantId, deletedAt: null },
  })
  if (!existing) throw new NotFoundError('Holiday day not found')

  await prisma.hrHolidayCalendarDay.update({
    where: { id: dayId },
    data: { deletedAt: new Date(), updatedBy: audit?.userId },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrHolidayCalendarDay',
    entityId: dayId,
    action: 'DELETE',
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return { id: dayId, deleted: true }
}

export async function resolveHolidayForEmployee(
  tenantId: string,
  employeeId: string,
  date: string,
  scope: UserDataScope,
) {
  const employee = await prisma.hrEmployee.findFirst({
    where: { id: employeeId, tenantId, deletedAt: null },
    select: { legalEntityId: true, branchId: true },
  })
  if (!employee) throw new NotFoundError('Employee not found')
  assertHrAccess(scope, { legalEntityId: employee.legalEntityId, branchId: employee.branchId })
  return getHoliday(tenantId, employeeId, date)
}
