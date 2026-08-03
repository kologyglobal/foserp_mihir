import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { ConflictError, InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess } from '../hrms-scope.js'
import type { CreatePeriodInput, ListPeriodsQuery } from './payroll.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

/** Runs that still hold an open (recalculable) editing lifecycle for the period. */
const OPEN_RUN_STATUSES = ['DRAFT', 'CALCULATED', 'REVIEWED'] as const

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** HrPayrollPeriod has no branchId column — filter by legal entity scope only (unlike hrScopeWhere). */
function periodScopeWhere(scope: UserDataScope): { legalEntityId?: { in: string[] } } {
  if (scope.unrestricted || scope.legalEntities.length === 0) return {}
  return { legalEntityId: { in: scope.legalEntities.map((x) => x.legalEntityId) } }
}

function monthBounds(year: number, month: number): { startDate: Date; endDate: Date } {
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0))
  return { startDate, endDate }
}

function mapPeriod(row: {
  id: string
  legalEntityId: string
  year: number
  month: number
  startDate: Date
  endDate: Date
  status: string
  createdAt: Date
  updatedAt: Date
  runs?: Array<{ status: string }>
}) {
  const runsByStatus = (row.runs ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    year: row.year,
    month: row.month,
    startDate: isoDate(row.startDate),
    endDate: isoDate(row.endDate),
    status: row.status,
    runCount: row.runs?.length ?? undefined,
    runsByStatus: row.runs ? runsByStatus : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listPeriods(tenantId: string, scope: UserDataScope, query: ListPeriodsQuery) {
  const { page, limit, skip } = getPagination(query)
  const where: Prisma.HrPayrollPeriodWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.year ? { year: query.year } : {}),
    ...(query.month ? { month: query.month } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...periodScopeWhere(scope),
  }

  const [total, rows] = await Promise.all([
    prisma.hrPayrollPeriod.count({ where }),
    prisma.hrPayrollPeriod.findMany({
      where,
      include: { runs: { where: { deletedAt: null }, select: { status: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      skip,
      take: limit,
    }),
  ])

  return { items: rows.map(mapPeriod), total, page, limit }
}

export async function getPeriod(tenantId: string, periodId: string, scope: UserDataScope) {
  const period = await prisma.hrPayrollPeriod.findFirst({
    where: { id: periodId, tenantId, deletedAt: null },
    include: { runs: { where: { deletedAt: null }, select: { status: true } } },
  })
  if (!period) throw new NotFoundError('Payroll period not found')
  assertHrAccess(scope, { legalEntityId: period.legalEntityId })
  return mapPeriod(period)
}

export async function createPeriod(
  tenantId: string,
  input: CreatePeriodInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  assertHrAccess(scope, { legalEntityId: input.legalEntityId })

  const existing = await prisma.hrPayrollPeriod.findFirst({
    where: { tenantId, legalEntityId: input.legalEntityId, year: input.year, month: input.month, deletedAt: null },
  })
  if (existing) {
    throw new ConflictError(
      `A payroll period already exists for ${input.year}-${String(input.month).padStart(2, '0')} in this legal entity`,
    )
  }

  const { startDate, endDate } = monthBounds(input.year, input.month)

  const row = await prisma.hrPayrollPeriod.create({
    data: {
      tenantId,
      legalEntityId: input.legalEntityId,
      year: input.year,
      month: input.month,
      startDate,
      endDate,
      status: 'OPEN',
      createdBy: audit?.userId,
      updatedBy: audit?.userId,
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrPayrollPeriod',
    entityId: row.id,
    action: 'CREATE',
    newValues: { legalEntityId: row.legalEntityId, year: row.year, month: row.month },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapPeriod({ ...row, runs: [] })
}

export async function closePeriod(tenantId: string, periodId: string, scope: UserDataScope, audit?: AuditMeta) {
  const period = await prisma.hrPayrollPeriod.findFirst({ where: { id: periodId, tenantId, deletedAt: null } })
  if (!period) throw new NotFoundError('Payroll period not found')
  assertHrAccess(scope, { legalEntityId: period.legalEntityId })

  if (period.status === 'CLOSED') {
    throw new InvalidStateError('Payroll period is already closed')
  }

  const openRunCount = await prisma.hrPayrollRun.count({
    where: { tenantId, payrollPeriodId: periodId, deletedAt: null, status: { in: [...OPEN_RUN_STATUSES] } },
  })
  if (openRunCount > 0) {
    throw new InvalidStateError(
      `Cannot close period — ${openRunCount} run(s) are still DRAFT/CALCULATED/REVIEWED. Finalize or cancel them first.`,
    )
  }

  const row = await prisma.hrPayrollPeriod.update({
    where: { id: periodId },
    data: { status: 'CLOSED', updatedBy: audit?.userId },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrPayrollPeriod',
    entityId: row.id,
    action: 'CLOSE',
    newValues: { status: 'CLOSED' },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return getPeriod(tenantId, periodId, scope)
}
