import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess, hrScopeWhere } from '../hrms-scope.js'
import type {
  CreateLeaveTypeInput,
  CreatePolicyInput,
  ListBalancesQuery,
  UpdateLeaveTypeInput,
  UpdatePolicyInput,
  UpsertBalanceInput,
  AdjustBalanceInput,
} from './leave.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

export function dec(n: Prisma.Decimal | number | string): number {
  return Number(n)
}

export function availableOf(b: { opening: unknown; accrued: unknown; adjusted: unknown; pending: unknown; used: unknown }) {
  return (
    Math.round(
      (dec(b.opening as number) +
        dec(b.accrued as number) +
        dec(b.adjusted as number) -
        dec(b.pending as number) -
        dec(b.used as number)) *
        100,
    ) / 100
  )
}

export function mapBalance(row: {
  id: string
  employeeId: string
  leaveTypeId: string
  year: number
  opening: unknown
  accrued: unknown
  pending: unknown
  used: unknown
  adjusted: unknown
  employee?: { id: string; employeeCode: string; displayName: string } | null
  leaveType?: { id: string; code: string; name: string } | null
}) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employee: row.employee ?? null,
    leaveTypeId: row.leaveTypeId,
    leaveType: row.leaveType ?? null,
    year: row.year,
    opening: dec(row.opening as number),
    accrued: dec(row.accrued as number),
    pending: dec(row.pending as number),
    used: dec(row.used as number),
    adjusted: dec(row.adjusted as number),
    available: availableOf(row),
  }
}

// ─── Leave types ───────────────────────────────────────────────────────────

export async function listLeaveTypes(tenantId: string, query: { page?: number; limit?: number; search?: string; isActive?: boolean; legalEntityId?: string }) {
  const { page, limit, skip } = getPagination(query as never)
  const where: Prisma.HrLeaveTypeWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.legalEntityId ? { OR: [{ legalEntityId: query.legalEntityId }, { legalEntityId: null }] } : {}),
    ...(query.search
      ? { OR: [{ code: { contains: query.search } }, { name: { contains: query.search } }] }
      : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.hrLeaveType.count({ where }),
    prisma.hrLeaveType.findMany({ where, orderBy: { code: 'asc' }, skip, take: limit }),
  ])
  return {
    items: rows.map((r) => ({
      ...r,
      maxCarryForward: r.maxCarryForward != null ? dec(r.maxCarryForward) : null,
      accrualValue: r.accrualValue != null ? dec(r.accrualValue) : null,
    })),
    total,
    page,
    limit,
  }
}

export async function createLeaveType(tenantId: string, input: CreateLeaveTypeInput, audit?: AuditMeta) {
  const code = input.code.trim().toUpperCase()
  const clash = await prisma.hrLeaveType.findFirst({ where: { tenantId, code, deletedAt: null } })
  if (clash) throw new ConflictError(`Leave type ${code} already exists`)

  const row = await prisma.hrLeaveType.create({
    data: {
      tenantId,
      code,
      name: input.name.trim(),
      legalEntityId: input.legalEntityId ?? null,
      paid: input.paid ?? true,
      allowHalfDay: input.allowHalfDay ?? true,
      allowNegativeBalance: input.allowNegativeBalance ?? false,
      carryForwardAllowed: input.carryForwardAllowed ?? false,
      maxCarryForward: input.maxCarryForward ?? null,
      accrualType: input.accrualType ?? 'NONE',
      accrualValue: input.accrualValue ?? null,
      isActive: input.isActive ?? true,
      createdBy: audit?.userId,
      updatedBy: audit?.userId,
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrLeaveType',
    entityId: row.id,
    action: 'CREATE',
    newValues: { code: row.code },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return row
}

export async function updateLeaveType(
  tenantId: string,
  leaveTypeId: string,
  input: UpdateLeaveTypeInput,
  audit?: AuditMeta,
) {
  const existing = await prisma.hrLeaveType.findFirst({
    where: { id: leaveTypeId, tenantId, deletedAt: null },
  })
  if (!existing) throw new NotFoundError('Leave type not found')

  if (input.code) {
    const code = input.code.trim().toUpperCase()
    const clash = await prisma.hrLeaveType.findFirst({
      where: { tenantId, code, deletedAt: null, NOT: { id: leaveTypeId } },
    })
    if (clash) throw new ConflictError(`Leave type ${code} already exists`)
  }

  const row = await prisma.hrLeaveType.update({
    where: { id: leaveTypeId },
    data: {
      ...(input.code ? { code: input.code.trim().toUpperCase() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.legalEntityId !== undefined ? { legalEntityId: input.legalEntityId } : {}),
      ...(input.paid !== undefined ? { paid: input.paid } : {}),
      ...(input.allowHalfDay !== undefined ? { allowHalfDay: input.allowHalfDay } : {}),
      ...(input.allowNegativeBalance !== undefined
        ? { allowNegativeBalance: input.allowNegativeBalance }
        : {}),
      ...(input.carryForwardAllowed !== undefined
        ? { carryForwardAllowed: input.carryForwardAllowed }
        : {}),
      ...(input.maxCarryForward !== undefined ? { maxCarryForward: input.maxCarryForward } : {}),
      ...(input.accrualType !== undefined ? { accrualType: input.accrualType } : {}),
      ...(input.accrualValue !== undefined ? { accrualValue: input.accrualValue } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: audit?.userId,
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrLeaveType',
    entityId: row.id,
    action: 'UPDATE',
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return row
}

// ─── Policies ──────────────────────────────────────────────────────────────

export async function listPolicies(
  tenantId: string,
  scope: UserDataScope,
  query: { page?: number; limit?: number; search?: string; legalEntityId?: string; branchId?: string },
) {
  const { page, limit, skip } = getPagination(query as never)
  const where: Prisma.HrLeavePolicyWhereInput = {
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
    prisma.hrLeavePolicy.count({ where }),
    prisma.hrLeavePolicy.findMany({
      where,
      include: {
        legalEntity: { select: { id: true, code: true, displayName: true } },
        branch: { select: { id: true, code: true, name: true } },
        leaveTypes: { include: { leaveType: { select: { id: true, code: true, name: true } } } },
      },
      orderBy: { code: 'asc' },
      skip,
      take: limit,
    }),
  ])
  return {
    items: rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      legalEntityId: r.legalEntityId,
      legalEntity: r.legalEntity,
      branchId: r.branchId,
      branch: r.branch,
      workerCategory: r.workerCategory,
      excludeHolidays: r.excludeHolidays,
      excludeWeeklyOff: r.excludeWeeklyOff,
      allowNegativeBalance: r.allowNegativeBalance,
      isActive: r.isActive,
      leaveTypes: r.leaveTypes.map((x) => x.leaveType),
    })),
    total,
    page,
    limit,
  }
}

export async function createPolicy(
  tenantId: string,
  input: CreatePolicyInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  assertHrAccess(scope, { legalEntityId: input.legalEntityId, branchId: input.branchId })
  const code = input.code.trim().toUpperCase()
  const clash = await prisma.hrLeavePolicy.findFirst({ where: { tenantId, code, deletedAt: null } })
  if (clash) throw new ConflictError(`Leave policy ${code} already exists`)

  if (input.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: input.branchId, tenantId, isActive: true },
    })
    if (!branch || branch.legalEntityId !== input.legalEntityId) {
      throw new ValidationError('Branch does not belong to the selected legal entity')
    }
  }

  const row = await prisma.$transaction(async (tx) => {
    const policy = await tx.hrLeavePolicy.create({
      data: {
        tenantId,
        code,
        name: input.name.trim(),
        legalEntityId: input.legalEntityId,
        branchId: input.branchId ?? null,
        workerCategory: input.workerCategory ?? null,
        excludeHolidays: input.excludeHolidays ?? true,
        excludeWeeklyOff: input.excludeWeeklyOff ?? true,
        allowNegativeBalance: input.allowNegativeBalance ?? false,
        isActive: input.isActive ?? true,
        createdBy: audit?.userId,
        updatedBy: audit?.userId,
      },
    })
    if (input.leaveTypeIds?.length) {
      await tx.hrLeavePolicyLeaveType.createMany({
        data: input.leaveTypeIds.map((leaveTypeId) => ({
          tenantId,
          policyId: policy.id,
          leaveTypeId,
        })),
      })
    }
    return policy
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrLeavePolicy',
    entityId: row.id,
    action: 'CREATE',
    newValues: { code: row.code },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return row
}

export async function updatePolicy(
  tenantId: string,
  policyId: string,
  input: UpdatePolicyInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const existing = await prisma.hrLeavePolicy.findFirst({
    where: { id: policyId, tenantId, deletedAt: null },
  })
  if (!existing) throw new NotFoundError('Leave policy not found')
  assertHrAccess(scope, { legalEntityId: existing.legalEntityId, branchId: existing.branchId })

  await prisma.$transaction(async (tx) => {
    await tx.hrLeavePolicy.update({
      where: { id: policyId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        ...(input.workerCategory !== undefined ? { workerCategory: input.workerCategory } : {}),
        ...(input.excludeHolidays !== undefined ? { excludeHolidays: input.excludeHolidays } : {}),
        ...(input.excludeWeeklyOff !== undefined ? { excludeWeeklyOff: input.excludeWeeklyOff } : {}),
        ...(input.allowNegativeBalance !== undefined
          ? { allowNegativeBalance: input.allowNegativeBalance }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedBy: audit?.userId,
      },
    })
    if (input.leaveTypeIds) {
      await tx.hrLeavePolicyLeaveType.deleteMany({ where: { policyId } })
      if (input.leaveTypeIds.length) {
        await tx.hrLeavePolicyLeaveType.createMany({
          data: input.leaveTypeIds.map((leaveTypeId) => ({
            tenantId,
            policyId,
            leaveTypeId,
          })),
        })
      }
    }
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrLeavePolicy',
    entityId: policyId,
    action: 'UPDATE',
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return prisma.hrLeavePolicy.findFirst({
    where: { id: policyId },
    include: {
      leaveTypes: { include: { leaveType: { select: { id: true, code: true, name: true } } } },
    },
  })
}

// ─── Balances ──────────────────────────────────────────────────────────────

export async function listBalances(tenantId: string, scope: UserDataScope, query: ListBalancesQuery) {
  const { page, limit, skip } = getPagination(query)
  const year = query.year ?? new Date().getFullYear()
  const empScope = hrScopeWhere(scope)

  const where: Prisma.HrLeaveBalanceWhereInput = {
    tenantId,
    year,
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    ...(query.leaveTypeId ? { leaveTypeId: query.leaveTypeId } : {}),
    employee: {
      deletedAt: null,
      ...empScope,
      ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    },
  }

  const [total, rows] = await Promise.all([
    prisma.hrLeaveBalance.count({ where }),
    prisma.hrLeaveBalance.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeCode: true, displayName: true } },
        leaveType: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ employee: { displayName: 'asc' } }, { leaveType: { code: 'asc' } }],
      skip,
      take: limit,
    }),
  ])

  return { items: rows.map(mapBalance), total, page, limit }
}

export async function upsertBalance(
  tenantId: string,
  input: UpsertBalanceInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const employee = await prisma.hrEmployee.findFirst({
    where: { id: input.employeeId, tenantId, deletedAt: null },
  })
  if (!employee) throw new NotFoundError('Employee not found')
  assertHrAccess(scope, { legalEntityId: employee.legalEntityId, branchId: employee.branchId })

  const leaveType = await prisma.hrLeaveType.findFirst({
    where: { id: input.leaveTypeId, tenantId, deletedAt: null },
  })
  if (!leaveType) throw new ValidationError('Leave type is invalid')

  const row = await prisma.hrLeaveBalance.upsert({
    where: {
      tenantId_employeeId_leaveTypeId_year: {
        tenantId,
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        year: input.year,
      },
    },
    create: {
      tenantId,
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      year: input.year,
      opening: input.opening ?? 0,
      accrued: input.accrued ?? 0,
      createdBy: audit?.userId,
      updatedBy: audit?.userId,
    },
    update: {
      ...(input.opening !== undefined ? { opening: input.opening } : {}),
      ...(input.accrued !== undefined ? { accrued: input.accrued } : {}),
      updatedBy: audit?.userId,
    },
    include: {
      employee: { select: { id: true, employeeCode: true, displayName: true } },
      leaveType: { select: { id: true, code: true, name: true } },
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrLeaveBalance',
    entityId: row.id,
    action: 'UPSERT',
    newValues: { opening: input.opening, accrued: input.accrued, year: input.year },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapBalance(row)
}

export async function adjustBalance(
  tenantId: string,
  input: AdjustBalanceInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const employee = await prisma.hrEmployee.findFirst({
    where: { id: input.employeeId, tenantId, deletedAt: null },
  })
  if (!employee) throw new NotFoundError('Employee not found')
  assertHrAccess(scope, { legalEntityId: employee.legalEntityId, branchId: employee.branchId })

  const balance = await prisma.hrLeaveBalance.upsert({
    where: {
      tenantId_employeeId_leaveTypeId_year: {
        tenantId,
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        year: input.year,
      },
    },
    create: {
      tenantId,
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      year: input.year,
      adjusted: input.amount,
      createdBy: audit?.userId,
      updatedBy: audit?.userId,
    },
    update: {
      adjusted: { increment: input.amount },
      updatedBy: audit?.userId,
    },
  })

  await prisma.hrLeaveBalanceAdjustment.create({
    data: {
      tenantId,
      balanceId: balance.id,
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      year: input.year,
      amount: input.amount,
      reason: input.reason,
      effectiveDate: new Date(input.effectiveDate),
      createdBy: audit?.userId,
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrLeaveBalance',
    entityId: balance.id,
    action: 'ADJUST',
    newValues: { amount: input.amount, reason: input.reason, effectiveDate: input.effectiveDate },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  const refreshed = await prisma.hrLeaveBalance.findFirst({
    where: { id: balance.id },
    include: {
      employee: { select: { id: true, employeeCode: true, displayName: true } },
      leaveType: { select: { id: true, code: true, name: true } },
    },
  })
  return mapBalance(refreshed!)
}

/** V1 controlled accrual: post amount (or leave-type accrualValue) onto accrued. */
export async function postAccrual(
  tenantId: string,
  input: import('./leave.schemas.js').PostAccrualInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const employee = await prisma.hrEmployee.findFirst({
    where: { id: input.employeeId, tenantId, deletedAt: null },
  })
  if (!employee) throw new NotFoundError('Employee not found')
  assertHrAccess(scope, { legalEntityId: employee.legalEntityId, branchId: employee.branchId })

  const leaveType = await prisma.hrLeaveType.findFirst({
    where: { id: input.leaveTypeId, tenantId, deletedAt: null },
  })
  if (!leaveType) throw new ValidationError('Leave type is invalid')
  if (leaveType.accrualType === 'NONE' && input.amount == null) {
    throw new ValidationError('Leave type has accrualType NONE — provide amount explicitly')
  }

  const amount =
    input.amount ??
    (leaveType.accrualValue != null ? dec(leaveType.accrualValue) : null)
  if (amount == null || amount <= 0) {
    throw new ValidationError('Accrual amount is required')
  }

  const row = await prisma.hrLeaveBalance.upsert({
    where: {
      tenantId_employeeId_leaveTypeId_year: {
        tenantId,
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        year: input.year,
      },
    },
    create: {
      tenantId,
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      year: input.year,
      accrued: amount,
      createdBy: audit?.userId,
      updatedBy: audit?.userId,
    },
    update: {
      accrued: { increment: amount },
      updatedBy: audit?.userId,
    },
    include: {
      employee: { select: { id: true, employeeCode: true, displayName: true } },
      leaveType: { select: { id: true, code: true, name: true } },
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrLeaveBalance',
    entityId: row.id,
    action: 'ACCRUAL',
    newValues: {
      amount,
      accrualType: leaveType.accrualType,
      reason: input.reason ?? `Controlled ${leaveType.accrualType} accrual`,
    },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapBalance(row)
}
