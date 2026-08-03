import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { buildPaginationMeta, getPagination } from '../../../utils/pagination.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess, hrScopeWhere } from '../hrms-scope.js'
import type { CreateEmployeeInput, ListEmployeesQuery, UpdateEmployeeInput } from './employee.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

const ACTIVE_ISH_STATUSES = ['DRAFT', 'ACTIVE', 'ON_NOTICE'] as const

const employeeInclude = {
  legalEntity: { select: { id: true, code: true, displayName: true } },
  branch: { select: { id: true, code: true, name: true } },
  department: { select: { id: true, code: true, name: true } },
  designation: { select: { id: true, code: true, name: true } },
  primaryWorkCentre: { select: { id: true, code: true, name: true } },
  defaultShift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } },
  reportingManager: { select: { id: true, employeeCode: true, displayName: true } },
  user: { select: { id: true, email: true, status: true } },
  statutoryDetail: { select: { id: true } },
  _count: { select: { bankDetails: { where: { deletedAt: null } }, documents: { where: { deletedAt: null } } } },
} satisfies Prisma.HrEmployeeInclude

type EmployeeRow = Prisma.HrEmployeeGetPayload<{ include: typeof employeeInclude }>

export function mapEmployee(row: EmployeeRow) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    employeeCode: row.employeeCode,
    userId: row.userId,
    user: row.user,
    legalEntityId: row.legalEntityId,
    legalEntity: row.legalEntity,
    branchId: row.branchId,
    branch: row.branch,
    departmentId: row.departmentId,
    department: row.department,
    designationId: row.designationId,
    designation: row.designation,
    primaryWorkCentreId: row.primaryWorkCentreId,
    primaryWorkCentre: row.primaryWorkCentre,
    defaultShiftId: row.defaultShiftId,
    defaultShift: row.defaultShift,
    weeklyOffDay: row.weeklyOffDay,
    firstName: row.firstName,
    middleName: row.middleName,
    lastName: row.lastName,
    displayName: row.displayName,
    mobile: row.mobile,
    email: row.email,
    dateOfBirth: row.dateOfBirth,
    gender: row.gender,
    addressLine: row.addressLine,
    city: row.city,
    state: row.state,
    pin: row.pin,
    country: row.country,
    joinDate: row.joinDate,
    employmentType: row.employmentType,
    workerCategory: row.workerCategory,
    reportingManagerEmployeeId: row.reportingManagerEmployeeId,
    reportingManager: row.reportingManager,
    status: row.status,
    hasStatutoryDetail: Boolean(row.statutoryDetail),
    bankDetailCount: row._count.bankDetails,
    documentCount: row._count.documents,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function findEmployeeOrThrow(tenantId: string, employeeId: string) {
  const row = await prisma.hrEmployee.findFirst({
    where: { id: employeeId, tenantId, deletedAt: null },
    include: employeeInclude,
  })
  if (!row) throw new NotFoundError('Employee not found')
  return row
}

async function validateOrgRefs(
  tenantId: string,
  refs: {
    legalEntityId: string
    branchId: string
    departmentId: string
    designationId: string
    primaryWorkCentreId?: string | null
  },
): Promise<void> {
  const legalEntity = await prisma.legalEntity.findFirst({
    where: { id: refs.legalEntityId, tenantId, isActive: true },
  })
  if (!legalEntity) throw new ValidationError('Legal entity is invalid')

  const branch = await prisma.branch.findFirst({ where: { id: refs.branchId, tenantId, isActive: true } })
  if (!branch) throw new ValidationError('Branch is invalid')
  if (branch.legalEntityId !== refs.legalEntityId) {
    throw new ValidationError('Branch does not belong to the selected legal entity')
  }

  const department = await prisma.department.findFirst({
    where: { id: refs.departmentId, tenantId, deletedAt: null },
  })
  if (!department) throw new ValidationError('Department is invalid')

  const designation = await prisma.hrDesignation.findFirst({
    where: { id: refs.designationId, tenantId, deletedAt: null },
  })
  if (!designation) throw new ValidationError('Designation is invalid')
  if (designation.legalEntityId && designation.legalEntityId !== refs.legalEntityId) {
    throw new ValidationError('Designation is scoped to a different legal entity')
  }

  if (refs.primaryWorkCentreId) {
    const workCentre = await prisma.manufacturingWorkCentre.findFirst({
      where: { id: refs.primaryWorkCentreId, tenantId, deletedAt: null },
    })
    if (!workCentre) throw new ValidationError('Work centre is invalid')
  }
}

async function assertNoManagerCycle(tenantId: string, employeeId: string, candidateManagerId: string): Promise<void> {
  if (candidateManagerId === employeeId) {
    throw new ValidationError('An employee cannot report to themselves')
  }
  const manager = await prisma.hrEmployee.findFirst({
    where: { id: candidateManagerId, tenantId, deletedAt: null },
    select: { id: true, reportingManagerEmployeeId: true },
  })
  if (!manager) throw new ValidationError('Reporting manager is invalid')

  let currentId: string | null = manager.reportingManagerEmployeeId
  const visited = new Set<string>([candidateManagerId])
  for (let depth = 0; depth < 20 && currentId; depth += 1) {
    if (currentId === employeeId) {
      throw new ValidationError('Reporting manager assignment would create a management cycle')
    }
    if (visited.has(currentId)) break
    visited.add(currentId)
    const next = await prisma.hrEmployee.findFirst({
      where: { id: currentId, tenantId },
      select: { reportingManagerEmployeeId: true },
    })
    currentId = next?.reportingManagerEmployeeId ?? null
  }
}

async function assertUserLinkAvailable(
  tenantId: string,
  userId: string,
  status: string,
  excludeEmployeeId?: string,
): Promise<void> {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId, deletedAt: null } })
  if (!user) throw new ValidationError('User is invalid')

  if (!(ACTIVE_ISH_STATUSES as readonly string[]).includes(status)) return

  const conflict = await prisma.hrEmployee.findFirst({
    where: {
      tenantId,
      userId,
      deletedAt: null,
      status: { in: [...ACTIVE_ISH_STATUSES] },
      ...(excludeEmployeeId ? { id: { not: excludeEmployeeId } } : {}),
    },
  })
  if (conflict) {
    throw new ConflictError('This user is already linked to another active employee record')
  }
}

export async function listEmployees(tenantId: string, scope: UserDataScope, query: ListEmployeesQuery) {
  const { skip, take } = getPagination(query)
  const where: Prisma.HrEmployeeWhereInput = {
    tenantId,
    deletedAt: null,
    ...hrScopeWhere(scope),
    ...(query.status ? { status: query.status } : {}),
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.designationId ? { designationId: query.designationId } : {}),
    ...(query.employmentType ? { employmentType: query.employmentType } : {}),
    ...(query.workerCategory ? { workerCategory: query.workerCategory } : {}),
    ...(query.search
      ? {
          OR: [
            { employeeCode: { contains: query.search } },
            { firstName: { contains: query.search } },
            { lastName: { contains: query.search } },
            { displayName: { contains: query.search } },
            { email: { contains: query.search } },
            { mobile: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.hrEmployee.findMany({
      where,
      skip,
      take,
      include: employeeInclude,
      orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder },
    }),
    prisma.hrEmployee.count({ where }),
  ])

  return { items: items.map(mapEmployee), meta: buildPaginationMeta(total, query.page, query.limit) }
}

export async function getEmployee(tenantId: string, scope: UserDataScope, employeeId: string) {
  const row = await findEmployeeOrThrow(tenantId, employeeId)
  assertHrAccess(scope, { legalEntityId: row.legalEntityId, branchId: row.branchId })
  return mapEmployee(row)
}

/** Internal helper for sibling services (bank/statutory/documents) that need the raw row + scope check. */
export async function assertEmployeeAccessible(tenantId: string, scope: UserDataScope, employeeId: string) {
  const row = await prisma.hrEmployee.findFirst({ where: { id: employeeId, tenantId, deletedAt: null } })
  if (!row) throw new NotFoundError('Employee not found')
  assertHrAccess(scope, { legalEntityId: row.legalEntityId, branchId: row.branchId })
  return row
}

export async function createEmployee(
  tenantId: string,
  scope: UserDataScope,
  input: CreateEmployeeInput,
  audit?: AuditMeta,
) {
  assertHrAccess(scope, { legalEntityId: input.legalEntityId, branchId: input.branchId })
  await validateOrgRefs(tenantId, input)

  if (input.reportingManagerEmployeeId) {
    const manager = await prisma.hrEmployee.findFirst({
      where: { id: input.reportingManagerEmployeeId, tenantId, deletedAt: null },
    })
    if (!manager) throw new ValidationError('Reporting manager is invalid')
  }

  const status = input.status ?? 'DRAFT'
  if (input.userId) {
    await assertUserLinkAvailable(tenantId, input.userId, status)
  }

  if (input.defaultShiftId) {
    const shift = await prisma.hrShiftTemplate.findFirst({
      where: { id: input.defaultShiftId, tenantId, deletedAt: null, isActive: true },
    })
    if (!shift) throw new ValidationError('Default shift is invalid')
  }

  const displayName = input.displayName?.trim() || `${input.firstName} ${input.lastName}`.trim()

  const created = await prisma.$transaction(async (tx) => {
    const employeeCode = await nextCode(tenantId, 'EMPLOYEE', tx)
    const row = await tx.hrEmployee.create({
      data: {
        tenantId,
        employeeCode,
        userId: input.userId ?? null,
        legalEntityId: input.legalEntityId,
        branchId: input.branchId,
        departmentId: input.departmentId,
        designationId: input.designationId,
        primaryWorkCentreId: input.primaryWorkCentreId ?? null,
        defaultShiftId: input.defaultShiftId ?? null,
        weeklyOffDay: input.weeklyOffDay ?? null,
        firstName: input.firstName,
        middleName: input.middleName ?? null,
        lastName: input.lastName,
        displayName,
        mobile: input.mobile ?? null,
        email: input.email ?? null,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        gender: input.gender ?? null,
        addressLine: input.addressLine ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        pin: input.pin ?? null,
        country: input.country ?? null,
        joinDate: new Date(input.joinDate),
        employmentType: input.employmentType,
        workerCategory: input.workerCategory,
        reportingManagerEmployeeId: input.reportingManagerEmployeeId ?? null,
        status,
        createdBy: audit?.userId,
      },
      include: employeeInclude,
    })

    await tx.hrEmployeeEmploymentHistory.create({
      data: {
        tenantId,
        employeeId: row.id,
        field: 'STATUS',
        oldValue: null,
        newValue: row.status,
        effectiveFrom: new Date(),
        changedBy: audit?.userId,
        reason: 'Employee created',
      },
    })

    return row
  })

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'hrms',
    entity: 'HrEmployee',
    entityId: created.id,
    action: 'CREATE',
    newValues: { employeeCode: created.employeeCode, status: created.status },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapEmployee(created)
}

type HistoryFieldChange = {
  field:
    | 'LEGAL_ENTITY'
    | 'BRANCH'
    | 'DEPARTMENT'
    | 'DESIGNATION'
    | 'REPORTING_MANAGER'
    | 'WORK_CENTRE'
    | 'EMPLOYMENT_TYPE'
    | 'STATUS'
    | 'USER_LINK'
    | 'DEFAULT_SHIFT'
  oldValue: string | null
  newValue: string | null
}

export async function updateEmployee(
  tenantId: string,
  scope: UserDataScope,
  employeeId: string,
  input: UpdateEmployeeInput,
  audit?: AuditMeta,
) {
  const existing = await prisma.hrEmployee.findFirst({ where: { id: employeeId, tenantId, deletedAt: null } })
  if (!existing) throw new NotFoundError('Employee not found')
  assertHrAccess(scope, { legalEntityId: existing.legalEntityId, branchId: existing.branchId })

  const nextLegalEntityId = input.legalEntityId ?? existing.legalEntityId
  const nextBranchId = input.branchId ?? existing.branchId
  const nextDepartmentId = input.departmentId ?? existing.departmentId
  const nextDesignationId = input.designationId ?? existing.designationId
  const nextWorkCentreId =
    input.primaryWorkCentreId !== undefined ? input.primaryWorkCentreId : existing.primaryWorkCentreId

  const orgRefsChanged =
    nextLegalEntityId !== existing.legalEntityId ||
    nextBranchId !== existing.branchId ||
    nextDepartmentId !== existing.departmentId ||
    nextDesignationId !== existing.designationId ||
    nextWorkCentreId !== existing.primaryWorkCentreId

  if (orgRefsChanged) {
    assertHrAccess(scope, { legalEntityId: nextLegalEntityId, branchId: nextBranchId })
    await validateOrgRefs(tenantId, {
      legalEntityId: nextLegalEntityId,
      branchId: nextBranchId,
      departmentId: nextDepartmentId,
      designationId: nextDesignationId,
      primaryWorkCentreId: nextWorkCentreId,
    })
  }

  const nextManagerId =
    input.reportingManagerEmployeeId !== undefined
      ? input.reportingManagerEmployeeId
      : existing.reportingManagerEmployeeId
  if (nextManagerId && nextManagerId !== existing.reportingManagerEmployeeId) {
    await assertNoManagerCycle(tenantId, employeeId, nextManagerId)
  }

  const nextStatus = input.status ?? existing.status
  const nextUserId = input.userId !== undefined ? input.userId : existing.userId
  const userLinkChanged = nextUserId !== existing.userId
  if (nextUserId && (userLinkChanged || nextStatus !== existing.status)) {
    await assertUserLinkAvailable(tenantId, nextUserId, nextStatus, employeeId)
  }

  const historyChanges: HistoryFieldChange[] = []
  if (nextLegalEntityId !== existing.legalEntityId) {
    historyChanges.push({ field: 'LEGAL_ENTITY', oldValue: existing.legalEntityId, newValue: nextLegalEntityId })
  }
  if (nextBranchId !== existing.branchId) {
    historyChanges.push({ field: 'BRANCH', oldValue: existing.branchId, newValue: nextBranchId })
  }
  if (nextDepartmentId !== existing.departmentId) {
    historyChanges.push({ field: 'DEPARTMENT', oldValue: existing.departmentId, newValue: nextDepartmentId })
  }
  if (nextDesignationId !== existing.designationId) {
    historyChanges.push({ field: 'DESIGNATION', oldValue: existing.designationId, newValue: nextDesignationId })
  }
  if (nextWorkCentreId !== existing.primaryWorkCentreId) {
    historyChanges.push({
      field: 'WORK_CENTRE',
      oldValue: existing.primaryWorkCentreId,
      newValue: nextWorkCentreId ?? null,
    })
  }
  if (nextManagerId !== existing.reportingManagerEmployeeId) {
    historyChanges.push({
      field: 'REPORTING_MANAGER',
      oldValue: existing.reportingManagerEmployeeId,
      newValue: nextManagerId ?? null,
    })
  }
  if (input.employmentType && input.employmentType !== existing.employmentType) {
    historyChanges.push({ field: 'EMPLOYMENT_TYPE', oldValue: existing.employmentType, newValue: input.employmentType })
  }
  if (nextStatus !== existing.status) {
    historyChanges.push({ field: 'STATUS', oldValue: existing.status, newValue: nextStatus })
  }
  if (userLinkChanged) {
    historyChanges.push({ field: 'USER_LINK', oldValue: existing.userId, newValue: nextUserId ?? null })
  }

  const nextDefaultShiftId =
    input.defaultShiftId !== undefined ? input.defaultShiftId : existing.defaultShiftId
  if (nextDefaultShiftId && nextDefaultShiftId !== existing.defaultShiftId) {
    const shift = await prisma.hrShiftTemplate.findFirst({
      where: { id: nextDefaultShiftId, tenantId, deletedAt: null, isActive: true },
    })
    if (!shift) throw new ValidationError('Default shift is invalid')
  }
  if (nextDefaultShiftId !== existing.defaultShiftId) {
    historyChanges.push({
      field: 'DEFAULT_SHIFT',
      oldValue: existing.defaultShiftId,
      newValue: nextDefaultShiftId ?? null,
    })
  }

  const displayName =
    input.displayName?.trim() ||
    (input.firstName || input.lastName
      ? `${input.firstName ?? existing.firstName} ${input.lastName ?? existing.lastName}`.trim()
      : undefined)

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.hrEmployee.update({
      where: { id: employeeId },
      data: {
        legalEntityId: nextLegalEntityId,
        branchId: nextBranchId,
        departmentId: nextDepartmentId,
        designationId: nextDesignationId,
        primaryWorkCentreId: nextWorkCentreId,
        reportingManagerEmployeeId: nextManagerId,
        userId: nextUserId,
        status: nextStatus,
        defaultShiftId: nextDefaultShiftId,
        ...(input.weeklyOffDay !== undefined ? { weeklyOffDay: input.weeklyOffDay } : {}),
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.middleName !== undefined ? { middleName: input.middleName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(displayName !== undefined ? { displayName } : {}),
        ...(input.mobile !== undefined ? { mobile: input.mobile } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.dateOfBirth !== undefined
          ? { dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null }
          : {}),
        ...(input.gender !== undefined ? { gender: input.gender } : {}),
        ...(input.addressLine !== undefined ? { addressLine: input.addressLine } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
        ...(input.pin !== undefined ? { pin: input.pin } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.joinDate !== undefined ? { joinDate: new Date(input.joinDate) } : {}),
        ...(input.employmentType !== undefined ? { employmentType: input.employmentType } : {}),
        ...(input.workerCategory !== undefined ? { workerCategory: input.workerCategory } : {}),
        updatedBy: audit?.userId,
      },
      include: employeeInclude,
    })

    if (historyChanges.length > 0) {
      await tx.hrEmployeeEmploymentHistory.createMany({
        data: historyChanges.map((change) => ({
          tenantId,
          employeeId,
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          effectiveFrom: new Date(),
          changedBy: audit?.userId,
          reason: input.reason,
        })),
      })
    }

    return row
  })

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'hrms',
    entity: 'HrEmployee',
    entityId: employeeId,
    action: 'UPDATE',
    oldValues: existing,
    newValues: { changes: historyChanges },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapEmployee(updated)
}

export async function getEmployeeHistory(tenantId: string, scope: UserDataScope, employeeId: string) {
  await assertEmployeeAccessible(tenantId, scope, employeeId)
  return prisma.hrEmployeeEmploymentHistory.findMany({
    where: { tenantId, employeeId },
    orderBy: { effectiveFrom: 'desc' },
  })
}
