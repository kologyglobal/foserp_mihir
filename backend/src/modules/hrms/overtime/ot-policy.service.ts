import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess, hrScopeWhere } from '../hrms-scope.js'
import { toDateOnly } from '../shared/shift-time.util.js'
import type { CreateOtPolicyInput, ListOtPoliciesQuery, UpdateOtPolicyInput } from './overtime.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

/** Policy shape resolved for a specific employee/date — feeds `applyEligibility`. */
export interface ResolvedOtPolicy {
  policyId: string
  code: string
  name: string
  enabled: boolean
  minimumExtraMinutes: number
  roundingMinutes: number
  maxOtMinutesPerDay: number | null
  maxOtMinutesPerMonth: number | null
  weeklyOffOtAllowed: boolean
  holidayOtAllowed: boolean
  leaveDayOtAllowed: boolean
  requireApproval: boolean
}

function mapPolicy(row: {
  id: string
  code: string
  name: string
  legalEntityId: string
  legalEntity?: { id: string; code: string; displayName: string } | null
  branchId: string | null
  branch?: { id: string; code: string; name: string } | null
  workerCategory: string | null
  enabled: boolean
  minimumExtraMinutes: number
  roundingMinutes: number
  maxOtMinutesPerDay: number | null
  maxOtMinutesPerMonth: number | null
  weeklyOffOtAllowed: boolean
  holidayOtAllowed: boolean
  leaveDayOtAllowed: boolean
  requireApproval: boolean
  effectiveFrom: Date
  effectiveTo: Date | null
  isActive: boolean
}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    legalEntityId: row.legalEntityId,
    legalEntity: row.legalEntity ?? null,
    branchId: row.branchId,
    branch: row.branch ?? null,
    workerCategory: row.workerCategory,
    enabled: row.enabled,
    minimumExtraMinutes: row.minimumExtraMinutes,
    roundingMinutes: row.roundingMinutes,
    maxOtMinutesPerDay: row.maxOtMinutesPerDay,
    maxOtMinutesPerMonth: row.maxOtMinutesPerMonth,
    weeklyOffOtAllowed: row.weeklyOffOtAllowed,
    holidayOtAllowed: row.holidayOtAllowed,
    leaveDayOtAllowed: row.leaveDayOtAllowed,
    requireApproval: row.requireApproval,
    effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
    effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString().slice(0, 10) : null,
    isActive: row.isActive,
  }
}

export async function listPolicies(
  tenantId: string,
  scope: UserDataScope,
  query: ListOtPoliciesQuery,
) {
  const { page, limit, skip } = getPagination(query)
  const where: Prisma.HrOvertimePolicyWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.search
      ? { OR: [{ code: { contains: query.search } }, { name: { contains: query.search } }] }
      : {}),
    ...hrScopeWhere(scope),
  }
  const [total, rows] = await Promise.all([
    prisma.hrOvertimePolicy.count({ where }),
    prisma.hrOvertimePolicy.findMany({
      where,
      include: {
        legalEntity: { select: { id: true, code: true, displayName: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
      orderBy: { code: 'asc' },
      skip,
      take: limit,
    }),
  ])
  return { items: rows.map(mapPolicy), total, page, limit }
}

export async function createPolicy(
  tenantId: string,
  input: CreateOtPolicyInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  assertHrAccess(scope, { legalEntityId: input.legalEntityId, branchId: input.branchId })
  const code = input.code.trim().toUpperCase()
  const clash = await prisma.hrOvertimePolicy.findFirst({ where: { tenantId, code, deletedAt: null } })
  if (clash) throw new ConflictError(`Overtime policy ${code} already exists`)

  if (input.branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: input.branchId, tenantId, isActive: true } })
    if (!branch || branch.legalEntityId !== input.legalEntityId) {
      throw new ValidationError('Branch does not belong to the selected legal entity')
    }
  }

  const effectiveFrom = toDateOnly(input.effectiveFrom)
  const effectiveTo = input.effectiveTo ? toDateOnly(input.effectiveTo) : null
  if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) {
    throw new ValidationError('effectiveTo must be on or after effectiveFrom')
  }

  const row = await prisma.hrOvertimePolicy.create({
    data: {
      tenantId,
      code,
      name: input.name.trim(),
      legalEntityId: input.legalEntityId,
      branchId: input.branchId ?? null,
      workerCategory: input.workerCategory ?? null,
      enabled: input.enabled ?? true,
      minimumExtraMinutes: input.minimumExtraMinutes ?? 30,
      roundingMinutes: input.roundingMinutes ?? 15,
      maxOtMinutesPerDay: input.maxOtMinutesPerDay ?? null,
      maxOtMinutesPerMonth: input.maxOtMinutesPerMonth ?? null,
      weeklyOffOtAllowed: input.weeklyOffOtAllowed ?? false,
      holidayOtAllowed: input.holidayOtAllowed ?? false,
      leaveDayOtAllowed: input.leaveDayOtAllowed ?? false,
      requireApproval: input.requireApproval ?? true,
      effectiveFrom,
      effectiveTo,
      isActive: input.isActive ?? true,
      createdBy: audit?.userId,
      updatedBy: audit?.userId,
    },
    include: {
      legalEntity: { select: { id: true, code: true, displayName: true } },
      branch: { select: { id: true, code: true, name: true } },
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrOvertimePolicy',
    entityId: row.id,
    action: 'CREATE',
    newValues: { code: row.code },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapPolicy(row)
}

export async function updatePolicy(
  tenantId: string,
  policyId: string,
  input: UpdateOtPolicyInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const existing = await prisma.hrOvertimePolicy.findFirst({ where: { id: policyId, tenantId, deletedAt: null } })
  if (!existing) throw new NotFoundError('Overtime policy not found')
  assertHrAccess(scope, { legalEntityId: existing.legalEntityId, branchId: existing.branchId })

  if (input.code) {
    const code = input.code.trim().toUpperCase()
    const clash = await prisma.hrOvertimePolicy.findFirst({
      where: { tenantId, code, deletedAt: null, NOT: { id: policyId } },
    })
    if (clash) throw new ConflictError(`Overtime policy ${code} already exists`)
  }

  const effectiveFrom = input.effectiveFrom ? toDateOnly(input.effectiveFrom) : existing.effectiveFrom
  const effectiveTo =
    input.effectiveTo !== undefined ? (input.effectiveTo ? toDateOnly(input.effectiveTo) : null) : existing.effectiveTo
  if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) {
    throw new ValidationError('effectiveTo must be on or after effectiveFrom')
  }

  const row = await prisma.hrOvertimePolicy.update({
    where: { id: policyId },
    data: {
      ...(input.code ? { code: input.code.trim().toUpperCase() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
      ...(input.workerCategory !== undefined ? { workerCategory: input.workerCategory } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.minimumExtraMinutes !== undefined ? { minimumExtraMinutes: input.minimumExtraMinutes } : {}),
      ...(input.roundingMinutes !== undefined ? { roundingMinutes: input.roundingMinutes } : {}),
      ...(input.maxOtMinutesPerDay !== undefined ? { maxOtMinutesPerDay: input.maxOtMinutesPerDay } : {}),
      ...(input.maxOtMinutesPerMonth !== undefined ? { maxOtMinutesPerMonth: input.maxOtMinutesPerMonth } : {}),
      ...(input.weeklyOffOtAllowed !== undefined ? { weeklyOffOtAllowed: input.weeklyOffOtAllowed } : {}),
      ...(input.holidayOtAllowed !== undefined ? { holidayOtAllowed: input.holidayOtAllowed } : {}),
      ...(input.leaveDayOtAllowed !== undefined ? { leaveDayOtAllowed: input.leaveDayOtAllowed } : {}),
      ...(input.requireApproval !== undefined ? { requireApproval: input.requireApproval } : {}),
      ...(input.effectiveFrom !== undefined ? { effectiveFrom } : {}),
      ...(input.effectiveTo !== undefined ? { effectiveTo } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: audit?.userId,
    },
    include: {
      legalEntity: { select: { id: true, code: true, displayName: true } },
      branch: { select: { id: true, code: true, name: true } },
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrOvertimePolicy',
    entityId: policyId,
    action: 'UPDATE',
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapPolicy(row)
}

/**
 * Resolve the applicable overtime policy for an employee/date.
 * Scoring mirrors `resolveLeavePolicyForEmployee`: branch+category match wins,
 * then branch-only, then LE+category, then LE-wide. Only policies whose
 * effective window covers `date` are considered.
 */
export async function resolvePolicyForEmployee(
  tenantId: string,
  employeeId: string,
  dateInput: Date | string,
): Promise<ResolvedOtPolicy | null> {
  const date = toDateOnly(dateInput)
  const employee = await prisma.hrEmployee.findFirst({ where: { id: employeeId, tenantId, deletedAt: null } })
  if (!employee) throw new ValidationError('Employee is invalid')

  const policies = await prisma.hrOvertimePolicy.findMany({
    where: {
      tenantId,
      deletedAt: null,
      isActive: true,
      legalEntityId: employee.legalEntityId,
      OR: [{ branchId: employee.branchId }, { branchId: null }],
      AND: [{ OR: [{ workerCategory: employee.workerCategory }, { workerCategory: null }] }],
      effectiveFrom: { lte: date },
    },
    orderBy: [{ branchId: 'desc' }, { workerCategory: 'desc' }, { createdAt: 'asc' }],
  })

  const active = policies.filter((p) => !p.effectiveTo || p.effectiveTo.getTime() >= date.getTime())

  const scored = active
    .map((p) => {
      let score = 0
      if (p.branchId === employee.branchId) score += 2
      if (p.workerCategory === employee.workerCategory) score += 1
      return { p, score }
    })
    .sort((a, b) => b.score - a.score)

  const chosen = scored[0]?.p
  if (!chosen) return null

  return {
    policyId: chosen.id,
    code: chosen.code,
    name: chosen.name,
    enabled: chosen.enabled,
    minimumExtraMinutes: chosen.minimumExtraMinutes,
    roundingMinutes: chosen.roundingMinutes,
    maxOtMinutesPerDay: chosen.maxOtMinutesPerDay,
    maxOtMinutesPerMonth: chosen.maxOtMinutesPerMonth,
    weeklyOffOtAllowed: chosen.weeklyOffOtAllowed,
    holidayOtAllowed: chosen.holidayOtAllowed,
    leaveDayOtAllowed: chosen.leaveDayOtAllowed,
    requireApproval: chosen.requireApproval,
  }
}
