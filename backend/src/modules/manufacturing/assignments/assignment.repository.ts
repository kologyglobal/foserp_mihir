import type { Prisma, ProductionAssignmentStatus } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import { ACTIVE_ASSIGNMENT_STATUSES } from './assignment.helpers.js'
import type { ListAssignmentsQuery } from './assignment.schemas.js'

const assignmentInclude = {
  stage: { select: { id: true, code: true, name: true, status: true } },
  operation: { select: { id: true, code: true, name: true } },
  machine: { select: { id: true, code: true, name: true, status: true } },
  workCentre: { select: { id: true, code: true, name: true } },
  productionOrder: { select: { id: true, orderNumber: true, status: true } },
} satisfies Prisma.ProductionAssignmentInclude

export async function getAssignment(tenantId: string, id: string) {
  const row = await prisma.productionAssignment.findFirst({ where: { id, tenantId }, include: assignmentInclude })
  if (!row) throw new NotFoundError('Assignment not found')
  return row
}

export async function listAssignments(tenantId: string, query: ListAssignmentsQuery) {
  const { skip, take, page, limit } = getPagination(query)
  const where: Prisma.ProductionAssignmentWhereInput = {
    tenantId,
    ...(query.workOrderId ? { productionOrderId: query.workOrderId } : {}),
    ...(query.workCentreId ? { workCentreId: query.workCentreId } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.machineId ? { machineId: query.machineId } : {}),
    ...(query.stageId ? { stageId: query.stageId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.shiftCode ? { shiftCode: query.shiftCode } : {}),
    ...(query.assignmentDate ? { assignmentDate: new Date(query.assignmentDate) } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.productionAssignment.findMany({
      where,
      include: assignmentInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.productionAssignment.count({ where }),
  ])

  return { items, total, page, limit }
}

export async function listAssignmentHistory(tenantId: string, assignmentId: string) {
  const root = await getAssignment(tenantId, assignmentId)
  const chain: string[] = [root.id]
  let cursor = root.reassignedFromId
  while (cursor) {
    const prev = await prisma.productionAssignment.findFirst({ where: { id: cursor, tenantId } })
    if (!prev) break
    chain.unshift(prev.id)
    cursor = prev.reassignedFromId
  }

  const items = await prisma.productionAssignment.findMany({
    where: { tenantId, id: { in: chain } },
    include: assignmentInclude,
    orderBy: { createdAt: 'asc' },
  })
  return items
}

export async function countActiveAssignmentsForStage(tenantId: string, stageId: string) {
  return prisma.productionAssignment.count({
    where: { tenantId, stageId, status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
  })
}

export type AssignmentCreateData = Prisma.ProductionAssignmentUncheckedCreateInput

export async function createAssignmentRecord(data: AssignmentCreateData) {
  return prisma.productionAssignment.create({ data, include: assignmentInclude })
}

export async function updateAssignmentRecord(
  _tenantId: string,
  id: string,
  data: Prisma.ProductionAssignmentUpdateInput,
  status?: ProductionAssignmentStatus,
) {
  return prisma.productionAssignment.update({
    where: { id },
    data: { ...data, ...(status ? { status } : {}) },
    include: assignmentInclude,
  })
}
