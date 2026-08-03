import type { HrShiftAssignmentSource, Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess, hrScopeWhere } from '../hrms-scope.js'
import { getEffectiveShift } from '../shared/effective-shift.service.js'
import { datesOverlap, toDateOnly } from '../shared/shift-time.util.js'
import type {
  BulkAssignInput,
  ClearOverrideInput,
  CopyAssignmentInput,
  CreateAssignmentInput,
  RosterGridQuery,
} from './roster.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

async function assertNoOverlap(
  tenantId: string,
  employeeId: string,
  effectiveFrom: Date,
  effectiveTo: Date | null,
  source: HrShiftAssignmentSource,
  excludeId?: string,
) {
  const existing = await prisma.hrEmployeeShiftAssignment.findMany({
    where: {
      tenantId,
      employeeId,
      deletedAt: null,
      source: { in: ['ROSTER', 'TEMPORARY'] },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  })

  for (const row of existing) {
    // Same-source overlaps are blocked; TEMPORARY may sit over ROSTER (priority handles it),
    // but overlapping TEMPORARY ranges or overlapping ROSTER ranges are rejected.
    if (row.source !== source) continue
    if (datesOverlap(effectiveFrom, effectiveTo, row.effectiveFrom, row.effectiveTo)) {
      throw new ConflictError(
        `Overlapping ${source.toLowerCase()} shift assignment exists for this employee`,
      )
    }
  }
}

async function loadEmployeeScoped(tenantId: string, employeeId: string, scope: UserDataScope) {
  const employee = await prisma.hrEmployee.findFirst({
    where: { id: employeeId, tenantId, deletedAt: null },
  })
  if (!employee) throw new NotFoundError('Employee not found')
  assertHrAccess(scope, { legalEntityId: employee.legalEntityId, branchId: employee.branchId })
  return employee
}

async function loadShift(tenantId: string, shiftId: string) {
  const shift = await prisma.hrShiftTemplate.findFirst({
    where: { id: shiftId, tenantId, deletedAt: null, isActive: true },
  })
  if (!shift) throw new ValidationError('Shift is invalid or inactive')
  return shift
}

export async function getRosterGrid(tenantId: string, query: RosterGridQuery, scope: UserDataScope) {
  const from = toDateOnly(query.from)
  const to = toDateOnly(query.to)
  if (from.getTime() > to.getTime()) throw new ValidationError('from must be on or before to')
  const dayCount = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
  if (dayCount > 31) throw new ValidationError('Date range cannot exceed 31 days')

  const scopeFrag = hrScopeWhere(scope)
  const where: Prisma.HrEmployeeWhereInput = {
    tenantId,
    deletedAt: null,
    status: { in: ['DRAFT', 'ACTIVE', 'ON_NOTICE'] },
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.workCentreId ? { primaryWorkCentreId: query.workCentreId } : {}),
    ...(query.search
      ? {
          OR: [
            { employeeCode: { contains: query.search } },
            { displayName: { contains: query.search } },
            { firstName: { contains: query.search } },
            { lastName: { contains: query.search } },
          ],
        }
      : {}),
    ...scopeFrag,
  }

  const employees = await prisma.hrEmployee.findMany({
    where,
    include: {
      department: { select: { id: true, code: true, name: true } },
      designation: { select: { id: true, code: true, name: true } },
      defaultShift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } },
      primaryWorkCentre: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ displayName: 'asc' }],
    take: 200,
  })

  const dates: string[] = []
  for (let t = from.getTime(); t <= to.getTime(); t += 86_400_000) {
    dates.push(new Date(t).toISOString().slice(0, 10))
  }

  const rows = []
  for (const emp of employees) {
    const days = []
    for (const d of dates) {
      const eff = await getEffectiveShift(tenantId, emp.id, d)
      days.push({
        date: d,
        source: eff.source,
        shiftId: eff.shift?.id ?? null,
        shiftCode: eff.shift?.code ?? null,
        shiftName: eff.shift?.name ?? null,
        startTime: eff.shift?.startTime ?? null,
        endTime: eff.shift?.endTime ?? null,
        assignmentId: eff.assignmentId,
        isWeeklyOff: eff.isWeeklyOff,
      })
    }
    rows.push({
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      displayName: emp.displayName,
      department: emp.department,
      designation: emp.designation,
      workCentre: emp.primaryWorkCentre,
      defaultShift: emp.defaultShift,
      weeklyOffDay: emp.weeklyOffDay,
      days,
    })
  }

  return { from: query.from, to: query.to, dates, employees: rows }
}

export async function createAssignment(
  tenantId: string,
  input: CreateAssignmentInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  await loadEmployeeScoped(tenantId, input.employeeId, scope)
  await loadShift(tenantId, input.shiftId)

  const effectiveFrom = toDateOnly(input.effectiveFrom)
  const effectiveTo = input.effectiveTo ? toDateOnly(input.effectiveTo) : null
  if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) {
    throw new ValidationError('effectiveTo must be on or after effectiveFrom')
  }

  const source = input.source ?? 'ROSTER'
  await assertNoOverlap(tenantId, input.employeeId, effectiveFrom, effectiveTo, source)

  const row = await prisma.hrEmployeeShiftAssignment.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      shiftId: input.shiftId,
      effectiveFrom,
      effectiveTo,
      source,
      note: input.note ?? null,
      createdBy: audit?.userId,
      updatedBy: audit?.userId,
    },
    include: {
      shift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } },
      employee: { select: { id: true, employeeCode: true, displayName: true } },
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeShiftAssignment',
    entityId: row.id,
    action: 'CREATE',
    newValues: {
      employeeId: row.employeeId,
      shiftId: row.shiftId,
      source: row.source,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo ?? null,
    },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return {
    id: row.id,
    employeeId: row.employeeId,
    employee: row.employee,
    shiftId: row.shiftId,
    shift: row.shift,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    source: row.source,
    note: row.note,
  }
}

export async function bulkAssign(
  tenantId: string,
  input: BulkAssignInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const results = []
  for (const employeeId of input.employeeIds) {
    results.push(
      await createAssignment(
        tenantId,
        {
          employeeId,
          shiftId: input.shiftId,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo,
          source: input.source,
          note: input.note,
        },
        scope,
        audit,
      ),
    )
  }
  return { created: results.length, items: results }
}

export async function copyAssignment(
  tenantId: string,
  input: CopyAssignmentInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const sourceEff = await getEffectiveShift(tenantId, input.employeeId, input.fromDate)
  if (!sourceEff.shift) throw new ValidationError('No shift to copy on the source date')
  await loadEmployeeScoped(tenantId, input.employeeId, scope)

  const created = []
  for (const d of input.toDates) {
    created.push(
      await createAssignment(
        tenantId,
        {
          employeeId: input.employeeId,
          shiftId: sourceEff.shift.id,
          effectiveFrom: d,
          effectiveTo: d,
          source: input.source ?? 'ROSTER',
          note: `Copied from ${input.fromDate}`,
        },
        scope,
        audit,
      ),
    )
  }
  return { created: created.length, items: created }
}

export async function clearOverrides(
  tenantId: string,
  input: ClearOverrideInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  await loadEmployeeScoped(tenantId, input.employeeId, scope)
  const from = toDateOnly(input.from)
  const to = toDateOnly(input.to)

  const rows = await prisma.hrEmployeeShiftAssignment.findMany({
    where: {
      tenantId,
      employeeId: input.employeeId,
      deletedAt: null,
      source: input.source ? input.source : { in: ['ROSTER', 'TEMPORARY'] },
    },
  })

  const toClear = rows.filter((r) => datesOverlap(from, to, r.effectiveFrom, r.effectiveTo))
  for (const row of toClear) {
    await prisma.hrEmployeeShiftAssignment.update({
      where: { id: row.id },
      data: { deletedAt: new Date(), updatedBy: audit?.userId },
    })
  }

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeShiftAssignment',
    entityId: input.employeeId,
    action: 'CLEAR_OVERRIDES',
    newValues: { from: input.from, to: input.to, cleared: toClear.length },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return { cleared: toClear.length }
}

export async function resolveEffectiveShift(
  tenantId: string,
  employeeId: string,
  date: string,
  scope: UserDataScope,
) {
  await loadEmployeeScoped(tenantId, employeeId, scope)
  return getEffectiveShift(tenantId, employeeId, date)
}
