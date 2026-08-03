import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess } from '../hrms-scope.js'
import { validateShiftTimes } from '../shared/shift-time.util.js'
import type { CreateShiftInput, ListShiftsQuery, UpdateShiftInput } from './shift.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

function mapShift(row: {
  id: string
  tenantId: string
  legalEntityId: string | null
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
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  legalEntity?: { id: string; code: string; displayName: string } | null
}) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    legalEntityId: row.legalEntityId,
    legalEntity: row.legalEntity ?? null,
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
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listShifts(tenantId: string, query: ListShiftsQuery, scope: UserDataScope) {
  const { page, limit, skip } = getPagination(query)
  const where: Prisma.HrShiftTemplateWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.search
      ? {
          OR: [
            { code: { contains: query.search } },
            { name: { contains: query.search } },
          ],
        }
      : {}),
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  }

  if (!scope.unrestricted && scope.legalEntities.length > 0) {
    where.OR = [
      { legalEntityId: null },
      { legalEntityId: { in: scope.legalEntities.map((x) => x.legalEntityId) } },
    ]
  }

  const [total, rows] = await Promise.all([
    prisma.hrShiftTemplate.count({ where }),
    prisma.hrShiftTemplate.findMany({
      where,
      include: { legalEntity: { select: { id: true, code: true, displayName: true } } },
      orderBy: [{ code: 'asc' }],
      skip,
      take: limit,
    }),
  ])

  return { items: rows.map(mapShift), total, page, limit }
}

export async function getShift(tenantId: string, shiftId: string, scope: UserDataScope) {
  const row = await prisma.hrShiftTemplate.findFirst({
    where: { id: shiftId, tenantId, deletedAt: null },
    include: { legalEntity: { select: { id: true, code: true, displayName: true } } },
  })
  if (!row) throw new NotFoundError('Shift not found')
  if (row.legalEntityId) assertHrAccess(scope, { legalEntityId: row.legalEntityId })
  return mapShift(row)
}

export async function createShift(
  tenantId: string,
  input: CreateShiftInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  if (input.legalEntityId) assertHrAccess(scope, { legalEntityId: input.legalEntityId })

  if (input.legalEntityId) {
    const le = await prisma.legalEntity.findFirst({
      where: { id: input.legalEntityId, tenantId, isActive: true },
    })
    if (!le) throw new ValidationError('Legal entity is invalid')
  }

  const timing = validateShiftTimes({
    startTime: input.startTime,
    endTime: input.endTime,
    breakMinutes: input.breakMinutes ?? 0,
    fullDayMinimumMinutes: input.fullDayMinimumMinutes,
    halfDayMinimumMinutes: input.halfDayMinimumMinutes,
    overnightShift: input.overnightShift,
    graceInMinutes: input.graceInMinutes,
    graceOutMinutes: input.graceOutMinutes,
    otStartsAfterMinutes: input.otStartsAfterMinutes,
    weeklyOffDay: input.weeklyOffDay,
  })

  const code = input.code.trim().toUpperCase()
  const existing = await prisma.hrShiftTemplate.findFirst({
    where: { tenantId, code, deletedAt: null },
  })
  if (existing) throw new ConflictError(`Shift code ${code} already exists`)

  const row = await prisma.hrShiftTemplate.create({
    data: {
      tenantId,
      legalEntityId: input.legalEntityId ?? null,
      code,
      name: input.name.trim(),
      startTime: input.startTime,
      endTime: input.endTime,
      breakMinutes: input.breakMinutes ?? 0,
      graceInMinutes: input.graceInMinutes ?? 0,
      graceOutMinutes: input.graceOutMinutes ?? null,
      fullDayMinimumMinutes: input.fullDayMinimumMinutes,
      halfDayMinimumMinutes: input.halfDayMinimumMinutes,
      otEligible: input.otEligible ?? true,
      otStartsAfterMinutes: input.otStartsAfterMinutes ?? null,
      overnightShift: timing.overnightShift,
      weeklyOffDay: input.weeklyOffDay ?? null,
      isActive: input.isActive ?? true,
      createdBy: audit?.userId,
      updatedBy: audit?.userId,
    },
    include: { legalEntity: { select: { id: true, code: true, displayName: true } } },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrShiftTemplate',
    entityId: row.id,
    action: 'CREATE',
    newValues: { code: row.code, overnightShift: row.overnightShift },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapShift(row)
}

export async function updateShift(
  tenantId: string,
  shiftId: string,
  input: UpdateShiftInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const existing = await prisma.hrShiftTemplate.findFirst({
    where: { id: shiftId, tenantId, deletedAt: null },
  })
  if (!existing) throw new NotFoundError('Shift not found')
  if (existing.legalEntityId) assertHrAccess(scope, { legalEntityId: existing.legalEntityId })

  const nextLe = input.legalEntityId !== undefined ? input.legalEntityId : existing.legalEntityId
  if (nextLe) assertHrAccess(scope, { legalEntityId: nextLe })

  const startTime = input.startTime ?? existing.startTime
  const endTime = input.endTime ?? existing.endTime
  const timing = validateShiftTimes({
    startTime,
    endTime,
    breakMinutes: input.breakMinutes ?? existing.breakMinutes,
    fullDayMinimumMinutes: input.fullDayMinimumMinutes ?? existing.fullDayMinimumMinutes,
    halfDayMinimumMinutes: input.halfDayMinimumMinutes ?? existing.halfDayMinimumMinutes,
    overnightShift: input.overnightShift ?? existing.overnightShift,
    graceInMinutes: input.graceInMinutes ?? existing.graceInMinutes,
    graceOutMinutes:
      input.graceOutMinutes !== undefined ? input.graceOutMinutes : existing.graceOutMinutes,
    otStartsAfterMinutes:
      input.otStartsAfterMinutes !== undefined
        ? input.otStartsAfterMinutes
        : existing.otStartsAfterMinutes,
    weeklyOffDay: input.weeklyOffDay !== undefined ? input.weeklyOffDay : existing.weeklyOffDay,
  })

  if (input.code) {
    const code = input.code.trim().toUpperCase()
    const clash = await prisma.hrShiftTemplate.findFirst({
      where: { tenantId, code, deletedAt: null, NOT: { id: shiftId } },
    })
    if (clash) throw new ConflictError(`Shift code ${code} already exists`)
  }

  const row = await prisma.hrShiftTemplate.update({
    where: { id: shiftId },
    data: {
      ...(input.code ? { code: input.code.trim().toUpperCase() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.legalEntityId !== undefined ? { legalEntityId: input.legalEntityId } : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
      ...(input.breakMinutes !== undefined ? { breakMinutes: input.breakMinutes } : {}),
      ...(input.graceInMinutes !== undefined ? { graceInMinutes: input.graceInMinutes } : {}),
      ...(input.graceOutMinutes !== undefined ? { graceOutMinutes: input.graceOutMinutes } : {}),
      ...(input.fullDayMinimumMinutes !== undefined
        ? { fullDayMinimumMinutes: input.fullDayMinimumMinutes }
        : {}),
      ...(input.halfDayMinimumMinutes !== undefined
        ? { halfDayMinimumMinutes: input.halfDayMinimumMinutes }
        : {}),
      ...(input.otEligible !== undefined ? { otEligible: input.otEligible } : {}),
      ...(input.otStartsAfterMinutes !== undefined
        ? { otStartsAfterMinutes: input.otStartsAfterMinutes }
        : {}),
      overnightShift: timing.overnightShift,
      ...(input.weeklyOffDay !== undefined ? { weeklyOffDay: input.weeklyOffDay } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: audit?.userId,
    },
    include: { legalEntity: { select: { id: true, code: true, displayName: true } } },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrShiftTemplate',
    entityId: row.id,
    action: 'UPDATE',
    oldValues: { code: existing.code, overnightShift: existing.overnightShift },
    newValues: { code: row.code, overnightShift: row.overnightShift },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapShift(row)
}
