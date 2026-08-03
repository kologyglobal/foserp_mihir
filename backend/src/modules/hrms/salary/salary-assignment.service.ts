import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess, hrScopeWhere } from '../hrms-scope.js'
import { datesOverlap, toDateOnly } from '../shared/shift-time.util.js'
import { decSalaryAmount } from './salary-component.service.js'
import type {
  CreateAssignmentInput,
  ListAssignmentsQuery,
  ReviseAssignmentInput,
} from './salary.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function dayBefore(d: Date): Date {
  const r = new Date(d.getTime())
  r.setUTCDate(r.getUTCDate() - 1)
  return r
}

function assignmentWithinVersion(
  assignFrom: Date,
  assignTo: Date | null,
  versionFrom: Date,
  versionTo: Date | null,
): boolean {
  if (assignFrom.getTime() < versionFrom.getTime()) return false
  if (versionTo && assignFrom.getTime() > versionTo.getTime()) return false
  if (assignTo && versionTo && assignTo.getTime() > versionTo.getTime()) return false
  return true
}

function mapAssignment(row: {
  id: string
  employeeId: string
  salaryStructureVersionId: string
  effectiveFrom: Date
  effectiveTo: Date | null
  annualCtc: Prisma.Decimal | null
  monthlyGross: Prisma.Decimal | null
  remarks: string | null
  status: string
  createdAt: Date
  updatedAt: Date
  employee?: { id: string; employeeCode: string; displayName: string } | null
  version?: {
    id: string
    versionNo: number
    status: string
    structure?: { id: string; code: string; name: string } | null
  } | null
}) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employee: row.employee ?? null,
    salaryStructureVersionId: row.salaryStructureVersionId,
    version: row.version
      ? {
          id: row.version.id,
          versionNo: row.version.versionNo,
          status: row.version.status,
          structure: row.version.structure ?? null,
        }
      : null,
    effectiveFrom: formatDateOnly(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? formatDateOnly(row.effectiveTo) : null,
    annualCtc: decSalaryAmount(row.annualCtc),
    monthlyGross: decSalaryAmount(row.monthlyGross),
    remarks: row.remarks,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function loadEmployeeForAssignment(tenantId: string, employeeId: string, scope: UserDataScope) {
  const employee = await prisma.hrEmployee.findFirst({
    where: { id: employeeId, tenantId, deletedAt: null, ...hrScopeWhere(scope) },
    select: { id: true, employeeCode: true, displayName: true, legalEntityId: true, branchId: true },
  })
  if (!employee) throw new NotFoundError('Employee not found')
  assertHrAccess(scope, { legalEntityId: employee.legalEntityId, branchId: employee.branchId })
  return employee
}

async function assertActiveVersion(tenantId: string, versionId: string) {
  const version = await prisma.hrSalaryStructureVersion.findFirst({
    where: { id: versionId, tenantId, deletedAt: null, status: 'ACTIVE' },
    include: { structure: { select: { id: true, code: true, name: true, legalEntityId: true } } },
  })
  if (!version) {
    throw new ValidationError('Salary structure version must be ACTIVE')
  }
  return version
}

async function assertNoOverlappingAssignment(
  tenantId: string,
  employeeId: string,
  effectiveFrom: Date,
  effectiveTo: Date | null,
  excludeId?: string,
) {
  const existing = await prisma.hrEmployeeSalaryAssignment.findMany({
    where: {
      tenantId,
      employeeId,
      status: 'ACTIVE',
      deletedAt: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  })
  for (const row of existing) {
    if (datesOverlap(effectiveFrom, effectiveTo, row.effectiveFrom, row.effectiveTo)) {
      throw new ConflictError('Employee already has an ACTIVE salary assignment overlapping this date range')
    }
  }
}

export async function listAssignments(
  tenantId: string,
  scope: UserDataScope,
  query: ListAssignmentsQuery,
) {
  const { page, limit, skip } = getPagination(query)
  const where: Prisma.HrEmployeeSalaryAssignmentWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    ...(query.status ? { status: query.status } : {}),
    employee: hrScopeWhere(scope).AND?.length ? hrScopeWhere(scope) : undefined,
  }
  const [total, rows] = await Promise.all([
    prisma.hrEmployeeSalaryAssignment.count({ where }),
    prisma.hrEmployeeSalaryAssignment.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeCode: true, displayName: true } },
        version: {
          select: {
            id: true,
            versionNo: true,
            status: true,
            structure: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: [{ effectiveFrom: 'desc' }],
      skip,
      take: limit,
    }),
  ])
  return { items: rows.map(mapAssignment), total, page, limit }
}

export async function createAssignment(
  tenantId: string,
  input: CreateAssignmentInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  await loadEmployeeForAssignment(tenantId, input.employeeId, scope)
  const version = await assertActiveVersion(tenantId, input.salaryStructureVersionId)

  const effectiveFrom = toDateOnly(input.effectiveFrom)
  const effectiveTo = input.effectiveTo ? toDateOnly(input.effectiveTo) : null
  if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) {
    throw new ValidationError('effectiveTo must be on or after effectiveFrom')
  }

  const status = input.status ?? 'ACTIVE'
  if (status === 'ACTIVE') {
    await assertNoOverlappingAssignment(tenantId, input.employeeId, effectiveFrom, effectiveTo)
  }

  if (!assignmentWithinVersion(effectiveFrom, effectiveTo, version.effectiveFrom, version.effectiveTo)) {
    throw new ValidationError('Assignment effective dates must fall within the structure version effective range')
  }

  const row = await prisma.hrEmployeeSalaryAssignment.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      salaryStructureVersionId: input.salaryStructureVersionId,
      effectiveFrom,
      effectiveTo,
      annualCtc: input.annualCtc ?? null,
      monthlyGross: input.monthlyGross ?? null,
      remarks: input.remarks?.trim() ?? null,
      status,
      createdBy: audit?.userId,
      updatedBy: audit?.userId,
    },
    include: {
      employee: { select: { id: true, employeeCode: true, displayName: true } },
      version: {
        select: {
          id: true,
          versionNo: true,
          status: true,
          structure: { select: { id: true, code: true, name: true } },
        },
      },
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeSalaryAssignment',
    entityId: row.id,
    action: 'CREATE',
    newValues: {
      employeeId: row.employeeId,
      versionId: row.salaryStructureVersionId,
      effectiveFrom: input.effectiveFrom,
    },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapAssignment(row)
}

export async function reviseAssignment(
  tenantId: string,
  assignmentId: string,
  input: ReviseAssignmentInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const existing = await prisma.hrEmployeeSalaryAssignment.findFirst({
    where: { id: assignmentId, tenantId, deletedAt: null },
  })
  if (!existing) throw new NotFoundError('Salary assignment not found')
  if (existing.status !== 'ACTIVE') {
    throw new ValidationError('Only ACTIVE assignments can be revised')
  }

  await loadEmployeeForAssignment(tenantId, existing.employeeId, scope)
  const version = await assertActiveVersion(tenantId, input.salaryStructureVersionId)

  const effectiveFrom = toDateOnly(input.effectiveFrom)
  const effectiveTo = input.effectiveTo ? toDateOnly(input.effectiveTo) : null
  if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) {
    throw new ValidationError('effectiveTo must be on or after effectiveFrom')
  }
  if (effectiveFrom.getTime() <= existing.effectiveFrom.getTime()) {
    throw new ValidationError('Revision effectiveFrom must be after the current assignment effectiveFrom')
  }

  if (!assignmentWithinVersion(effectiveFrom, effectiveTo, version.effectiveFrom, version.effectiveTo)) {
    throw new ValidationError('Assignment effective dates must fall within the structure version effective range')
  }

  await assertNoOverlappingAssignment(
    tenantId,
    existing.employeeId,
    effectiveFrom,
    effectiveTo,
    existing.id,
  )

  const closeDate = dayBefore(effectiveFrom)

  const row = await prisma.$transaction(async (tx) => {
    await tx.hrEmployeeSalaryAssignment.update({
      where: { id: assignmentId },
      data: {
        effectiveTo: closeDate,
        status: 'CLOSED',
        updatedBy: audit?.userId,
      },
    })

    return tx.hrEmployeeSalaryAssignment.create({
      data: {
        tenantId,
        employeeId: existing.employeeId,
        salaryStructureVersionId: input.salaryStructureVersionId,
        effectiveFrom,
        effectiveTo,
        annualCtc: input.annualCtc ?? existing.annualCtc,
        monthlyGross: input.monthlyGross ?? existing.monthlyGross,
        remarks: input.remarks?.trim() ?? existing.remarks,
        status: 'ACTIVE',
        createdBy: audit?.userId,
        updatedBy: audit?.userId,
      },
      include: {
        employee: { select: { id: true, employeeCode: true, displayName: true } },
        version: {
          select: {
            id: true,
            versionNo: true,
            status: true,
            structure: { select: { id: true, code: true, name: true } },
          },
        },
      },
    })
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeSalaryAssignment',
    entityId: row.id,
    action: 'REVISE',
    oldValues: { priorAssignmentId: assignmentId },
    newValues: {
      effectiveFrom: input.effectiveFrom,
      salaryStructureVersionId: input.salaryStructureVersionId,
    },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapAssignment(row)
}
