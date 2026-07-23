import { Prisma, type ManufacturingTimeUnit } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { getPagination } from '../../../utils/pagination.js'
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { assertItem, assertMachine, assertVendor, assertWorkCentre } from '../shared/manufacturing.helpers.js'
import type {
  CreateDependencyInput,
  CreateOperationInput,
  CreateRoutingInput,
  CreateRoutingVersionInput,
  CreateStageGroupInput,
  ListRoutingVersionsQuery,
  ListRoutingsQuery,
  UpdateOperationInput,
  UpdateRoutingInput,
  UpdateRoutingVersionInput,
  UpdateStageGroupInput,
} from './routing.schemas.js'

function timeValueToMinutes(value: number, unit: ManufacturingTimeUnit): number {
  switch (unit) {
    case 'SECOND':
      return value / 60
    case 'MINUTE':
      return value
    case 'HOUR':
      return value * 60
    case 'DAY':
      return value * 60 * 24
    case 'WEEK':
      return value * 60 * 24 * 7
    default:
      return value
  }
}

function resolveSetupTimeMinutes(input: {
  setupTimeMinutes?: number
  setupTimeValue?: number
  setupTimeUnit: ManufacturingTimeUnit
}): number {
  if (input.setupTimeValue !== undefined) {
    return timeValueToMinutes(input.setupTimeValue, input.setupTimeUnit)
  }
  return input.setupTimeMinutes ?? 0
}

async function ensureDefaultStageGroup(tenantId: string, userId: string, routingVersionId: string) {
  const existing = await prisma.manufacturingStageGroup.findFirst({
    where: { routingVersionId, tenantId, code: 'MAIN', deletedAt: null },
  })
  if (existing) return existing

  try {
    return await prisma.manufacturingStageGroup.create({
      data: {
        tenantId,
        routingVersionId,
        code: 'MAIN',
        name: 'Operations',
        displayOrder: 10,
        isOptional: false,
        parallelAllowed: false,
        qualityRequired: false,
        completionRule: 'ALL_OPERATIONS',
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const retry = await prisma.manufacturingStageGroup.findFirst({
        where: { routingVersionId, tenantId, code: 'MAIN', deletedAt: null },
      })
      if (retry) return retry
    }
    throw err
  }
}

function buildRoutingWhere(tenantId: string, query: ListRoutingsQuery) {
  const where: Prisma.ManufacturingRoutingWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.productItemId ? { productItemId: query.productItemId } : {}),
  }
  if (query.search) {
    where.OR = [{ code: { contains: query.search } }, { name: { contains: query.search } }]
  }
  return where
}

export async function listRoutings(tenantId: string, query: ListRoutingsQuery) {
  const { skip, take } = getPagination(query)
  const where = buildRoutingWhere(tenantId, query)
  const sortField = query.sortBy === 'code' || query.sortBy === 'name' ? query.sortBy : 'createdAt'
  const [items, total] = await Promise.all([
    prisma.manufacturingRouting.findMany({
      where,
      skip,
      take,
      orderBy: { [sortField]: query.sortOrder },
      include: { productItem: { select: { id: true, code: true, name: true } } },
    }),
    prisma.manufacturingRouting.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getRouting(tenantId: string, routingId: string) {
  const routing = await prisma.manufacturingRouting.findFirst({
    where: { id: routingId, ...tenantActiveFilter(tenantId) },
  })
  if (!routing) throw new NotFoundError('Routing not found')
  return routing
}

export async function createRouting(tenantId: string, userId: string, input: CreateRoutingInput) {
  if (input.productItemId) await assertItem(tenantId, input.productItemId)
  const code = input.code ?? (await nextCode(tenantId, 'MANUFACTURING_ROUTING'))
  try {
    return await prisma.manufacturingRouting.create({
      data: {
        tenantId,
        code,
        name: input.name,
        productItemId: input.productItemId ?? null,
        description: input.description ?? null,
        productionFlowType: input.productionFlowType ?? 'SERIAL',
        isActive: input.isActive ?? true,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate routing code in tenant')
    }
    throw err
  }
}

export async function updateRouting(
  tenantId: string,
  userId: string,
  routingId: string,
  input: UpdateRoutingInput,
) {
  await getRouting(tenantId, routingId)
  if (input.productItemId) await assertItem(tenantId, input.productItemId)
  return prisma.manufacturingRouting.update({
    where: { id: routingId, tenantId },
    data: { ...input, updatedBy: userId },
  })
}

// ─── Routing versions ───────────────────────────────────────────────────────

export async function listRoutingVersions(tenantId: string, routingId: string, query: ListRoutingVersionsQuery) {
  await getRouting(tenantId, routingId)
  const { skip, take } = getPagination(query)
  const where: Prisma.ManufacturingRoutingVersionWhereInput = {
    ...tenantActiveFilter(tenantId),
    routingId,
    ...(query.status ? { status: query.status } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.manufacturingRoutingVersion.findMany({ where, skip, take, orderBy: { versionNumber: 'desc' } }),
    prisma.manufacturingRoutingVersion.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getRoutingVersion(tenantId: string, versionId: string) {
  const version = await prisma.manufacturingRoutingVersion.findFirst({
    where: { id: versionId, ...tenantActiveFilter(tenantId) },
    include: { routing: true },
  })
  if (!version) throw new NotFoundError('Routing version not found')
  return version
}

export async function createRoutingVersion(
  tenantId: string,
  userId: string,
  routingId: string,
  input: CreateRoutingVersionInput,
) {
  await getRouting(tenantId, routingId)
  const maxVersion = await prisma.manufacturingRoutingVersion.aggregate({
    where: { tenantId, routingId },
    _max: { versionNumber: true },
  })
  const versionNumber = (maxVersion._max.versionNumber ?? 0) + 1
  try {
    return await prisma.manufacturingRoutingVersion.create({
      data: {
        tenantId,
        routingId,
        versionNumber,
        revisionCode: input.revisionCode,
        status: 'DRAFT',
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        revisionNotes: input.revisionNotes ?? null,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate routing version number')
    }
    throw err
  }
}

function assertDraft(version: { status: string }): void {
  if (version.status !== 'DRAFT') {
    throw new InvalidStateError('Routing version must be in DRAFT status for this operation')
  }
}

export async function updateRoutingVersionMeta(
  tenantId: string,
  versionId: string,
  userId: string,
  input: UpdateRoutingVersionInput,
) {
  const version = await getRoutingVersion(tenantId, versionId)
  assertDraft(version)
  return prisma.manufacturingRoutingVersion.update({
    where: { id: versionId, tenantId },
    data: { ...input, updatedBy: userId },
  })
}

// ─── Stage groups ───────────────────────────────────────────────────────────

export async function listStageGroups(tenantId: string, routingVersionId: string) {
  return prisma.manufacturingStageGroup.findMany({
    where: { routingVersionId, ...tenantActiveFilter(tenantId) },
    orderBy: { displayOrder: 'asc' },
  })
}

export async function getStageGroup(tenantId: string, stageGroupId: string) {
  const stageGroup = await prisma.manufacturingStageGroup.findFirst({
    where: { id: stageGroupId, ...tenantActiveFilter(tenantId) },
  })
  if (!stageGroup) throw new NotFoundError('Stage group not found')
  return stageGroup
}

export async function createStageGroup(
  tenantId: string,
  userId: string,
  routingVersionId: string,
  input: CreateStageGroupInput,
) {
  const version = await getRoutingVersion(tenantId, routingVersionId)
  assertDraft(version)
  if (input.defaultWorkCentreId) await assertWorkCentre(tenantId, input.defaultWorkCentreId)
  try {
    return await prisma.manufacturingStageGroup.create({
      data: {
        tenantId,
        routingVersionId,
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        displayOrder: input.displayOrder,
        defaultWorkCentreId: input.defaultWorkCentreId ?? null,
        isOptional: input.isOptional,
        parallelAllowed: input.parallelAllowed,
        qualityRequired: input.qualityRequired,
        completionRule: input.completionRule,
        isActive: input.isActive,
        sourceBomLineId: input.sourceBomLineId ?? null,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate stage group code in this routing version')
    }
    throw err
  }
}

export async function updateStageGroup(
  tenantId: string,
  userId: string,
  stageGroupId: string,
  input: UpdateStageGroupInput,
) {
  const stageGroup = await getStageGroup(tenantId, stageGroupId)
  const version = await getRoutingVersion(tenantId, stageGroup.routingVersionId)
  assertDraft(version)
  if (input.defaultWorkCentreId) await assertWorkCentre(tenantId, input.defaultWorkCentreId)
  return prisma.manufacturingStageGroup.update({
    where: { id: stageGroupId, tenantId },
    data: { ...input, updatedBy: userId },
  })
}

export async function deleteStageGroup(tenantId: string, stageGroupId: string) {
  const stageGroup = await getStageGroup(tenantId, stageGroupId)
  const version = await getRoutingVersion(tenantId, stageGroup.routingVersionId)
  assertDraft(version)

  const operationCount = await prisma.manufacturingRoutingOperation.count({
    where: { stageGroupId, ...tenantActiveFilter(tenantId) },
  })
  if (operationCount > 0) {
    throw new InvalidStateError('Cannot delete a stage group that has operations — delete operations first')
  }

  return prisma.manufacturingStageGroup.update({
    where: { id: stageGroupId, tenantId },
    data: { deletedAt: new Date() },
  })
}

/** Soft-delete all stage groups, operations, and dependencies for a draft version (BOM generate replace). */
export async function clearRoutingVersionStructure(tenantId: string, routingVersionId: string) {
  const version = await getRoutingVersion(tenantId, routingVersionId)
  assertDraft(version)
  const now = new Date()
  await prisma.$transaction([
    prisma.manufacturingOperationDependency.updateMany({
      where: { routingVersionId, tenantId, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.manufacturingRoutingOperation.updateMany({
      where: { routingVersionId, tenantId, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.manufacturingStageGroup.updateMany({
      where: { routingVersionId, tenantId, deletedAt: null },
      data: { deletedAt: now },
    }),
  ])
}

// ─── Operations ─────────────────────────────────────────────────────────────

export async function listOperations(tenantId: string, routingVersionId: string) {
  return prisma.manufacturingRoutingOperation.findMany({
    where: { routingVersionId, ...tenantActiveFilter(tenantId) },
    orderBy: { sequence: 'asc' },
  })
}

export async function getOperation(tenantId: string, operationId: string) {
  const operation = await prisma.manufacturingRoutingOperation.findFirst({
    where: { id: operationId, ...tenantActiveFilter(tenantId) },
  })
  if (!operation) throw new NotFoundError('Routing operation not found')
  return operation
}

async function assertOperationRefs(
  tenantId: string,
  input: {
    workCentreId?: string | null
    defaultMachineId?: string | null
    outputItemId?: string | null
    defaultVendorId?: string | null
    qcTestGroupId?: string | null
  },
) {
  if (input.workCentreId) await assertWorkCentre(tenantId, input.workCentreId)
  if (input.outputItemId) await assertItem(tenantId, input.outputItemId)
  if (input.defaultVendorId) await assertVendor(tenantId, input.defaultVendorId)
  if (input.qcTestGroupId) {
    const plan = await prisma.qualityInspectionPlan.findFirst({
      where: { id: input.qcTestGroupId, tenantId, deletedAt: null },
    })
    if (!plan) throw new ValidationError('qcTestGroupId must reference an existing quality inspection plan')
  }
  if (input.defaultMachineId) {
    const machine = await assertMachine(tenantId, input.defaultMachineId)
    if (input.workCentreId && machine.workCentreId !== input.workCentreId) {
      throw new ValidationError('defaultMachineId must belong to the same work centre as the operation')
    }
  }
}

export async function createOperation(
  tenantId: string,
  userId: string,
  routingVersionId: string,
  input: CreateOperationInput,
) {
  const version = await getRoutingVersion(tenantId, routingVersionId)
  assertDraft(version)

  if (!input.workCentreId) {
    throw new ValidationError('workCentreId is required')
  }

  let stageGroupId = input.stageGroupId
  if (stageGroupId) {
    const stageGroup = await getStageGroup(tenantId, stageGroupId)
    if (stageGroup.routingVersionId !== routingVersionId) {
      throw new ValidationError('stageGroupId must belong to the same routing version')
    }
  } else {
    const defaultStage = await ensureDefaultStageGroup(tenantId, userId, routingVersionId)
    stageGroupId = defaultStage.id
  }

  const qcTestGroupId = input.qualityRequired ? (input.qcTestGroupId ?? null) : null
  await assertOperationRefs(tenantId, { ...input, qcTestGroupId })

  const setupTimeMinutes = resolveSetupTimeMinutes(input)

  try {
    return await prisma.manufacturingRoutingOperation.create({
      data: {
        tenantId,
        routingVersionId,
        stageGroupId,
        code: input.code,
        name: input.name,
        sequence: input.sequence,
        description: input.description ?? null,
        workCentreId: input.workCentreId,
        defaultMachineId: input.defaultMachineId ?? null,
        setupTimeMinutes,
        setupTimeUnit: input.setupTimeUnit,
        runTimeValue: input.runTimeValue,
        runTimeUnit: input.runTimeUnit,
        runTimeBasis: input.runTimeBasis,
        workInstructions: input.workInstructions ?? null,
        drawingReference: input.drawingReference ?? null,
        inputType: input.inputType,
        outputType: input.outputType,
        outputItemId: input.outputItemId ?? null,
        qualityRequired: input.qualityRequired,
        qualityPlanRef: input.qualityPlanRef ?? null,
        qcTestGroupId,
        outsourced: input.outsourced,
        defaultVendorId: input.defaultVendorId ?? null,
        isOptional: input.isOptional,
        isConditional: input.isConditional,
        conditionExpression: input.conditionExpression ?? null,
        reworkAllowed: input.reworkAllowed,
        isActive: input.isActive,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate operation code in this routing version')
    }
    throw err
  }
}

export async function updateOperation(
  tenantId: string,
  userId: string,
  operationId: string,
  input: UpdateOperationInput,
) {
  const operation = await getOperation(tenantId, operationId)
  const version = await getRoutingVersion(tenantId, operation.routingVersionId)
  assertDraft(version)

  if (input.stageGroupId) {
    const stageGroup = await getStageGroup(tenantId, input.stageGroupId)
    if (stageGroup.routingVersionId !== operation.routingVersionId) {
      throw new ValidationError('stageGroupId must belong to the same routing version')
    }
  }

  const workCentreId = input.workCentreId ?? operation.workCentreId
  const qualityRequired = input.qualityRequired ?? operation.qualityRequired
  const qcTestGroupId = qualityRequired
    ? input.qcTestGroupId !== undefined
      ? input.qcTestGroupId
      : operation.qcTestGroupId
    : null

  let defaultMachineId = input.defaultMachineId !== undefined ? input.defaultMachineId : operation.defaultMachineId
  if (input.workCentreId !== undefined && input.workCentreId !== operation.workCentreId) {
    if (defaultMachineId) {
      const machine = await prisma.manufacturingMachine.findFirst({
        where: { id: defaultMachineId, tenantId, deletedAt: null },
      })
      if (!machine || machine.workCentreId !== workCentreId) {
        defaultMachineId = null
      }
    }
  }

  await assertOperationRefs(tenantId, {
    workCentreId,
    defaultMachineId,
    outputItemId: input.outputItemId,
    defaultVendorId: input.defaultVendorId,
    qcTestGroupId,
  })

  const setupTimeMinutes =
    input.setupTimeValue !== undefined || input.setupTimeMinutes !== undefined || input.setupTimeUnit !== undefined
      ? resolveSetupTimeMinutes({
          setupTimeMinutes: input.setupTimeMinutes ?? Number(operation.setupTimeMinutes),
          setupTimeValue: input.setupTimeValue,
          setupTimeUnit: input.setupTimeUnit ?? operation.setupTimeUnit,
        })
      : undefined

  const { setupTimeValue: _setupTimeValue, setupTimeMinutes: _setupTimeMinutes, ...restInput } = input

  return prisma.manufacturingRoutingOperation.update({
    where: { id: operationId, tenantId },
    data: {
      ...restInput,
      ...(setupTimeMinutes !== undefined ? { setupTimeMinutes } : {}),
      ...(input.workCentreId !== undefined ? { workCentreId: input.workCentreId } : {}),
      defaultMachineId,
      qcTestGroupId,
      updatedBy: userId,
    },
  })
}

export async function deleteOperation(tenantId: string, operationId: string) {
  const operation = await getOperation(tenantId, operationId)
  const version = await getRoutingVersion(tenantId, operation.routingVersionId)
  assertDraft(version)

  const depCount = await prisma.manufacturingOperationDependency.count({
    where: {
      ...tenantActiveFilter(tenantId),
      OR: [{ predecessorOperationId: operationId }, { successorOperationId: operationId }],
    },
  })
  if (depCount > 0) {
    throw new InvalidStateError('Cannot delete an operation that has dependencies — remove dependencies first')
  }

  return prisma.manufacturingRoutingOperation.update({
    where: { id: operationId, tenantId },
    data: { deletedAt: new Date() },
  })
}

// ─── Dependencies ───────────────────────────────────────────────────────────

export async function listDependencies(tenantId: string, routingVersionId: string) {
  return prisma.manufacturingOperationDependency.findMany({
    where: { routingVersionId, ...tenantActiveFilter(tenantId) },
    orderBy: { createdAt: 'asc' },
  })
}

export async function getDependency(tenantId: string, dependencyId: string) {
  const dependency = await prisma.manufacturingOperationDependency.findFirst({
    where: { id: dependencyId, ...tenantActiveFilter(tenantId) },
  })
  if (!dependency) throw new NotFoundError('Operation dependency not found')
  return dependency
}

export async function createDependency(
  tenantId: string,
  userId: string,
  routingVersionId: string,
  input: CreateDependencyInput,
) {
  const version = await getRoutingVersion(tenantId, routingVersionId)
  assertDraft(version)

  const [predecessor, successor] = await Promise.all([
    getOperation(tenantId, input.predecessorOperationId),
    getOperation(tenantId, input.successorOperationId),
  ])
  if (predecessor.routingVersionId !== routingVersionId || successor.routingVersionId !== routingVersionId) {
    throw new ValidationError('Both operations must belong to the same routing version')
  }

  try {
    return await prisma.manufacturingOperationDependency.create({
      data: {
        tenantId,
        routingVersionId,
        predecessorOperationId: input.predecessorOperationId,
        successorOperationId: input.successorOperationId,
        dependencyType: input.dependencyType,
        minimumCompletionPercent: input.minimumCompletionPercent,
        isMandatory: input.isMandatory,
        allowParallel: input.allowParallel,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate dependency between these operations')
    }
    throw err
  }
}

export async function deleteDependency(tenantId: string, dependencyId: string) {
  const dependency = await getDependency(tenantId, dependencyId)
  const version = await getRoutingVersion(tenantId, dependency.routingVersionId)
  assertDraft(version)

  return prisma.manufacturingOperationDependency.update({
    where: { id: dependencyId, tenantId },
    data: { deletedAt: new Date() },
  })
}

export async function getRoutingVersionFull(tenantId: string, versionId: string) {
  const version = await getRoutingVersion(tenantId, versionId)
  const [stageGroups, operations, dependencies] = await Promise.all([
    listStageGroups(tenantId, versionId),
    listOperations(tenantId, versionId),
    listDependencies(tenantId, versionId),
  ])
  return { version, stageGroups, operations, dependencies }
}
