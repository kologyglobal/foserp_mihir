import type { Prisma, ProductionRuntimeChangeType } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { getPagination } from '../../../utils/pagination.js'
import { NotFoundError } from '../../../utils/errors.js'
import type { ListRuntimeChangesQuery } from './runtime-change.schemas.js'
import { RuntimeChangeNotFoundError } from './runtime-change.errors.js'

export const runtimeChangeInclude = {
  stage: true,
  operation: true,
  assignment: true,
  jobWorkOrder: true,
  approvalRule: true,
} satisfies Prisma.ProductionRuntimeChangeInclude

export type RuntimeChangeRow = Prisma.ProductionRuntimeChangeGetPayload<{ include: typeof runtimeChangeInclude }>

export async function getWorkOrderOrThrow(tenantId: string, workOrderId: string) {
  const order = await prisma.productionOrder.findFirst({ where: { id: workOrderId, ...tenantActiveFilter(tenantId) } })
  if (!order) throw new NotFoundError('Work order not found')
  return order
}

export async function findChange(tenantId: string, workOrderId: string, changeId: string): Promise<RuntimeChangeRow> {
  const row = await prisma.productionRuntimeChange.findFirst({
    where: { id: changeId, tenantId, productionOrderId: workOrderId, deletedAt: null },
    include: runtimeChangeInclude,
  })
  if (!row) throw new RuntimeChangeNotFoundError()
  return row
}

export async function findChangeByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<RuntimeChangeRow | null> {
  return prisma.productionRuntimeChange.findFirst({
    where: { tenantId, idempotencyKey, deletedAt: null },
    include: runtimeChangeInclude,
  })
}

function buildWhere(tenantId: string, workOrderId: string, query: ListRuntimeChangesQuery): Prisma.ProductionRuntimeChangeWhereInput {
  return {
    tenantId,
    productionOrderId: workOrderId,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.changeType ? { changeType: query.changeType } : {}),
    ...(query.riskLevel ? { riskLevel: query.riskLevel } : {}),
  }
}

export async function listChanges(tenantId: string, workOrderId: string, query: ListRuntimeChangesQuery) {
  const { skip, take } = getPagination(query)
  const where = buildWhere(tenantId, workOrderId, query)
  const [items, total] = await Promise.all([
    prisma.productionRuntimeChange.findMany({
      where,
      include: runtimeChangeInclude,
      skip,
      take,
      orderBy: { createdAt: query.sortOrder },
    }),
    prisma.productionRuntimeChange.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function findActiveRule(tenantId: string, changeType: ProductionRuntimeChangeType) {
  return prisma.manufacturingRuntimeChangeRule.findFirst({
    where: { tenantId, changeType, isActive: true },
    orderBy: { updatedAt: 'desc' },
  })
}

export { ensureDefaultRuntimeChangeRules } from './runtime-change-rules.seed.js'


/** Most recent APPLIED change of `changeType` for a given stage — used to restore prior state on resume. */
export async function findLastAppliedChangeForStage(
  tenantId: string,
  stageId: string,
  changeType: ProductionRuntimeChangeType,
) {
  return prisma.productionRuntimeChange.findFirst({
    where: { tenantId, stageId, changeType, status: 'APPLIED', deletedAt: null },
    orderBy: { appliedAt: 'desc' },
  })
}

/** Counts existing "<name> — Repeat N" operations for a given source operation name, to derive the next N. */
export async function countRepeatsOfOperation(tenantId: string, productionOrderId: string, sourceOperationName: string) {
  return prisma.productionOrderOperation.count({
    where: {
      tenantId,
      productionOrderId,
      name: { contains: `${sourceOperationName} — Repeat` },
    },
  })
}
