import type { Prisma, ProductionAssignmentStatus, ProductionOrderStage } from '@prisma/client'
import { Prisma as PrismaNS } from '@prisma/client'
import { InvalidStateError, ValidationError } from '../../../utils/errors.js'
import { toDecimal } from '../shared/quantity.service.js'

export const ACTIVE_ASSIGNMENT_STATUSES: ProductionAssignmentStatus[] = [
  'ASSIGNED',
  'ACCEPTED',
  'IN_PROGRESS',
  'PAUSED',
]

type DbClient = Prisma.TransactionClient

export function parseAssignmentDate(value: string | Date): Date {
  if (value instanceof Date) return value
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new ValidationError('Invalid assignmentDate')
  return d
}

export function computeStageRemainingQuantity(stage: Pick<
  ProductionOrderStage,
  'plannedQuantity' | 'goodQuantity' | 'reworkQuantity' | 'rejectedQuantity' | 'scrapQuantity'
>) {
  const planned = toDecimal(stage.plannedQuantity)
  const recorded = toDecimal(stage.goodQuantity)
    .plus(toDecimal(stage.reworkQuantity))
    .plus(toDecimal(stage.rejectedQuantity))
    .plus(toDecimal(stage.scrapQuantity))
  return planned.minus(recorded)
}

export async function validateAssignmentQuantity(
  client: DbClient,
  tenantId: string,
  stage: ProductionOrderStage,
  manufacturingProfileId: string,
  assignedQuantity: PrismaNS.Decimal | number | string,
) {
  const profile = await client.manufacturingProfile.findFirst({ where: { id: manufacturingProfileId, tenantId } })
  const overproductionTolerancePercent = toDecimal(profile?.overproductionTolerancePercent ?? 0)
  const remaining = computeStageRemainingQuantity(stage)
  const qty = toDecimal(assignedQuantity)
  const toleratedMax = toDecimal(stage.plannedQuantity).times(
    new PrismaNS.Decimal(1).plus(overproductionTolerancePercent.dividedBy(100)),
  )
  const recorded = toDecimal(stage.plannedQuantity).minus(remaining)
  if (recorded.plus(qty).greaterThan(toleratedMax)) {
    throw new ValidationError(
      `Assignment quantity (${qty.toString()}) exceeds remaining stage capacity (${remaining.toString()} remaining, tolerance max ${toleratedMax.toString()})`,
    )
  }
}

export async function assertNoDuplicateActiveAssignment(
  client: DbClient,
  tenantId: string,
  params: {
    userId: string
    stageId: string
    operationId?: string | null
    shiftCode?: string | null
    excludeId?: string
  },
) {
  const duplicate = await client.productionAssignment.findFirst({
    where: {
      tenantId,
      userId: params.userId,
      stageId: params.stageId,
      operationId: params.operationId ?? null,
      shiftCode: params.shiftCode ?? null,
      status: { in: ACTIVE_ASSIGNMENT_STATUSES },
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
  })
  if (duplicate) {
    throw new ValidationError('An active assignment already exists for this operator, stage, operation, and shift')
  }
}

export async function validateMachineForAssignment(
  client: DbClient,
  tenantId: string,
  machineId: string | null | undefined,
  allowInUse: boolean,
): Promise<string[]> {
  const warnings: string[] = []
  if (!machineId) return warnings

  const machine = await client.manufacturingMachine.findFirst({ where: { id: machineId, tenantId, deletedAt: null } })
  if (!machine) throw new ValidationError('Machine not found')
  if (!machine.isActive) throw new ValidationError('Machine is not active')

  if (machine.status === 'UNDER_MAINTENANCE' || machine.status === 'OUT_OF_SERVICE') {
    throw new InvalidStateError(`Machine is ${machine.status} and cannot be assigned`)
  }
  if (machine.status === 'IN_USE' && !allowInUse) {
    throw new InvalidStateError('Machine is already IN_USE')
  }
  if (machine.status === 'IN_USE' && allowInUse) {
    warnings.push('Machine is already IN_USE; assignment allowed with manage permission')
  }
  return warnings
}

export async function setMachineInUse(client: DbClient, _tenantId: string, machineId: string, userId: string) {
  await client.manufacturingMachine.update({
    where: { id: machineId },
    data: { status: 'IN_USE', updatedBy: userId },
  })
}

export async function releaseMachineIfIdle(client: DbClient, tenantId: string, machineId: string, userId: string) {
  const activeCount = await client.productionAssignment.count({
    where: {
      tenantId,
      machineId,
      status: { in: ACTIVE_ASSIGNMENT_STATUSES },
    },
  })
  if (activeCount === 0) {
    await client.manufacturingMachine.update({
      where: { id: machineId },
      data: { status: 'AVAILABLE', updatedBy: userId },
    })
  }
}

/** Refresh denormalised stage assignment indicators after assignment lifecycle changes. */
export async function syncStageAssignmentIndicators(client: DbClient, tenantId: string, stageId: string) {
  const active = await client.productionAssignment.findMany({
    where: { tenantId, stageId, status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
    orderBy: { updatedAt: 'desc' },
  })
  const inProgress = active.find((a) => a.status === 'IN_PROGRESS')
  const paused = active.find((a) => a.status === 'PAUSED')
  const primary = inProgress ?? paused ?? active[0]

  await client.productionOrderStage.update({
    where: { id: stageId },
    data: {
      assignedUserId: primary?.userId ?? null,
      assignedMachineId: primary?.machineId ?? null,
      activeAssignmentCount: active.length,
      pausedAt: paused?.pausedAt ?? null,
    },
  })
}
