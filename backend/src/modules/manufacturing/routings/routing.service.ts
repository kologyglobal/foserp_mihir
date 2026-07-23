import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { InvalidStateError, ValidationError } from '../../../utils/errors.js'
import * as bomRepo from '../boms/bom.repository.js'
import { assertNoDependencyCycle } from '../shared/manufacturing.helpers.js'
import * as repo from './routing.repository.js'
import type {
  CloseRoutingVersionInput,
  CreateDependencyInput,
  CreateOperationInput,
  CreateRoutingInput,
  CreateRoutingVersionInput,
  CreateStageGroupInput,
  GenerateStagesFromBomInput,
  ListRoutingVersionsQuery,
  ListRoutingsQuery,
  ReviseRoutingVersionInput,
  UpdateOperationInput,
  UpdateRoutingInput,
  UpdateRoutingVersionInput,
  UpdateStageGroupInput,
} from './routing.schemas.js'

async function audit(
  req: Request,
  tenantId: string,
  entity: string,
  entityId: string,
  action: string,
  oldValues: unknown,
  newValues: unknown,
) {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'manufacturing',
    entity,
    entityId,
    action,
    oldValues,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

export async function listRoutings(tenantId: string, query: ListRoutingsQuery) {
  return repo.listRoutings(tenantId, query)
}

export async function getRouting(tenantId: string, routingId: string) {
  const routing = await repo.getRouting(tenantId, routingId)
  const versions = await prisma.manufacturingRoutingVersion.findMany({
    where: { routingId, tenantId, deletedAt: null },
    orderBy: { versionNumber: 'desc' },
  })
  return { routing, versions }
}

export async function createRouting(req: Request, tenantId: string, input: CreateRoutingInput) {
  const userId = req.context?.userId ?? ''
  const record = await repo.createRouting(tenantId, userId, input)
  await audit(req, tenantId, 'manufacturingRouting', record.id, 'CREATE', undefined, record)
  return record
}

export async function updateRouting(req: Request, tenantId: string, routingId: string, input: UpdateRoutingInput) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getRouting(tenantId, routingId)
  const record = await repo.updateRouting(tenantId, userId, routingId, input)
  await audit(req, tenantId, 'manufacturingRouting', routingId, 'UPDATE', before, record)
  return record
}

export async function softDeleteRouting(req: Request, tenantId: string, routingId: string) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getRouting(tenantId, routingId)
  const record = await repo.softDeleteRouting(tenantId, userId, routingId)
  await audit(req, tenantId, 'manufacturingRouting', routingId, 'DELETE', before, record)
  return record
}

export async function listRoutingVersions(tenantId: string, routingId: string, query: ListRoutingVersionsQuery) {
  return repo.listRoutingVersions(tenantId, routingId, query)
}

export async function createRoutingVersion(
  req: Request,
  tenantId: string,
  routingId: string,
  input: CreateRoutingVersionInput,
) {
  const userId = req.context?.userId ?? ''
  const record = await repo.createRoutingVersion(tenantId, userId, routingId, input)
  await audit(req, tenantId, 'manufacturingRoutingVersion', record.id, 'CREATE', undefined, record)
  return record
}

export async function getRoutingVersion(tenantId: string, versionId: string) {
  return repo.getRoutingVersionFull(tenantId, versionId)
}

export async function updateRoutingVersionMeta(
  req: Request,
  tenantId: string,
  versionId: string,
  input: UpdateRoutingVersionInput,
) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getRoutingVersion(tenantId, versionId)
  const record = await repo.updateRoutingVersionMeta(tenantId, versionId, userId, input)
  await audit(req, tenantId, 'manufacturingRoutingVersion', versionId, 'UPDATE', before, record)
  return record
}

export async function createStageGroup(
  req: Request,
  tenantId: string,
  versionId: string,
  input: CreateStageGroupInput,
) {
  const userId = req.context?.userId ?? ''
  const record = await repo.createStageGroup(tenantId, userId, versionId, input)
  await audit(req, tenantId, 'manufacturingStageGroup', record.id, 'CREATE', undefined, record)
  return record
}

export async function updateStageGroup(req: Request, tenantId: string, stageGroupId: string, input: UpdateStageGroupInput) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getStageGroup(tenantId, stageGroupId)
  const record = await repo.updateStageGroup(tenantId, userId, stageGroupId, input)
  await audit(req, tenantId, 'manufacturingStageGroup', stageGroupId, 'UPDATE', before, record)
  return record
}

export async function deleteStageGroup(req: Request, tenantId: string, stageGroupId: string) {
  const before = await repo.getStageGroup(tenantId, stageGroupId)
  const record = await repo.deleteStageGroup(tenantId, stageGroupId)
  await audit(req, tenantId, 'manufacturingStageGroup', stageGroupId, 'DELETE', before, record)
  return record
}

export async function createOperation(req: Request, tenantId: string, versionId: string, input: CreateOperationInput) {
  const userId = req.context?.userId ?? ''
  const record = await repo.createOperation(tenantId, userId, versionId, input)
  await audit(req, tenantId, 'manufacturingRoutingOperation', record.id, 'CREATE', undefined, record)
  return record
}

export async function updateOperation(req: Request, tenantId: string, operationId: string, input: UpdateOperationInput) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getOperation(tenantId, operationId)
  const record = await repo.updateOperation(tenantId, userId, operationId, input)
  await audit(req, tenantId, 'manufacturingRoutingOperation', operationId, 'UPDATE', before, record)
  return record
}

export async function deleteOperation(req: Request, tenantId: string, operationId: string) {
  const before = await repo.getOperation(tenantId, operationId)
  const record = await repo.deleteOperation(tenantId, operationId)
  await audit(req, tenantId, 'manufacturingRoutingOperation', operationId, 'DELETE', before, record)
  return record
}

export async function createDependency(
  req: Request,
  tenantId: string,
  versionId: string,
  input: CreateDependencyInput,
) {
  const existing = await repo.listDependencies(tenantId, versionId)
  assertNoDependencyCycle(input.predecessorOperationId, input.successorOperationId, existing)

  const userId = req.context?.userId ?? ''
  const record = await repo.createDependency(tenantId, userId, versionId, input)
  await audit(req, tenantId, 'manufacturingOperationDependency', record.id, 'CREATE', undefined, record)
  return record
}

export async function deleteDependency(req: Request, tenantId: string, dependencyId: string) {
  const before = await repo.getDependency(tenantId, dependencyId)
  const record = await repo.deleteDependency(tenantId, dependencyId)
  await audit(req, tenantId, 'manufacturingOperationDependency', dependencyId, 'DELETE', before, record)
  return record
}

export interface RoutingValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
  operationCount: number
  stageGroupCount: number
}

const OPEN_PRODUCTION_ORDER_STATUSES = ['DRAFT', 'READY', 'IN_PROGRESS', 'ON_HOLD'] as const

export async function validateRoutingVersion(tenantId: string, versionId: string): Promise<RoutingValidationResult> {
  const { version, stageGroups, operations, dependencies } = await repo.getRoutingVersionFull(tenantId, versionId)
  const routing = await repo.getRouting(tenantId, version.routingId)
  const errors: string[] = []
  const warnings: string[] = []

  if (!routing.name?.trim()) {
    errors.push('Routing header must have a name')
  }
  if (operations.length === 0) {
    errors.push('Routing version must have at least one operation')
  }

  const seenSequences = new Set<number>()
  const operationIds = new Set(operations.map((op) => op.id))

  const workCentreIds = [...new Set(operations.map((op) => op.workCentreId).filter(Boolean))] as string[]
  const machineIds = [...new Set(operations.map((op) => op.defaultMachineId).filter(Boolean))] as string[]
  const qcTestGroupIds = [...new Set(operations.map((op) => op.qcTestGroupId).filter(Boolean))] as string[]

  const [workCentres, machines, qcPlans] = await Promise.all([
    workCentreIds.length
      ? prisma.manufacturingWorkCentre.findMany({
          where: { id: { in: workCentreIds }, tenantId, deletedAt: null },
        })
      : [],
    machineIds.length
      ? prisma.manufacturingMachine.findMany({
          where: { id: { in: machineIds }, tenantId, deletedAt: null },
        })
      : [],
    qcTestGroupIds.length
      ? prisma.qualityInspectionPlan.findMany({
          where: { id: { in: qcTestGroupIds }, tenantId, deletedAt: null },
        })
      : [],
  ])

  const workCentreById = new Map(workCentres.map((wc) => [wc.id, wc]))
  const machineById = new Map(machines.map((m) => [m.id, m]))
  const qcPlanIds = new Set(qcPlans.map((p) => p.id))

  for (const op of operations) {
    if (seenSequences.has(op.sequence)) {
      errors.push(`Duplicate sequence ${op.sequence} in routing version`)
    }
    seenSequences.add(op.sequence)

    if (!op.workCentreId) {
      errors.push(`Operation ${op.code}: work centre is required`)
    } else {
      const wc = workCentreById.get(op.workCentreId)
      if (!wc) {
        errors.push(`Operation ${op.code}: work centre not found`)
      } else if (!wc.isActive) {
        errors.push(`Operation ${op.code}: work centre ${wc.code} is inactive`)
      }
    }

    if (op.defaultMachineId) {
      const machine = machineById.get(op.defaultMachineId)
      if (!machine) {
        errors.push(`Operation ${op.code}: default machine not found`)
      } else if (op.workCentreId && machine.workCentreId !== op.workCentreId) {
        errors.push(`Operation ${op.code}: default machine does not belong to the assigned work centre`)
      } else if (machine.status === 'OUT_OF_SERVICE') {
        warnings.push(`Operation ${op.code}: default machine ${machine.code} is out of service`)
      }
    }

    if (op.qualityRequired && !op.qcTestGroupId) {
      errors.push(`Operation ${op.code}: QC test group is required when quality is required`)
    }
    if (op.qcTestGroupId && !qcPlanIds.has(op.qcTestGroupId)) {
      errors.push(`Operation ${op.code}: QC test group not found for tenant`)
    }

    if (op.stageGroupId && !stageGroups.some((sg) => sg.id === op.stageGroupId)) {
      errors.push(`Operation ${op.code}: stage group not found in this version`)
    }
  }

  for (const dep of dependencies) {
    if (!operationIds.has(dep.predecessorOperationId) || !operationIds.has(dep.successorOperationId)) {
      errors.push('Dependency references an operation outside this version')
    }
  }

  const adjacency = new Map<string, string[]>()
  for (const dep of dependencies) {
    const list = adjacency.get(dep.predecessorOperationId) ?? []
    list.push(dep.successorOperationId)
    adjacency.set(dep.predecessorOperationId, list)
  }
  for (const startId of operationIds) {
    const stack = [...(adjacency.get(startId) ?? [])]
    const visited = new Set<string>()
    while (stack.length > 0) {
      const current = stack.pop() as string
      if (current === startId) {
        errors.push('Circular routing operation dependency detected')
        break
      }
      if (visited.has(current)) continue
      visited.add(current)
      stack.push(...(adjacency.get(current) ?? []))
    }
  }

  if (version.status !== 'DRAFT') {
    errors.push('Only DRAFT versions can be validated for activation')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
    operationCount: operations.length,
    stageGroupCount: stageGroups.length,
  }
}

export async function activateRoutingVersion(req: Request, tenantId: string, versionId: string) {
  const { version } = await repo.getRoutingVersionFull(tenantId, versionId)
  if (version.status !== 'DRAFT') {
    throw new InvalidStateError('Only DRAFT routing versions can be activated')
  }
  const result = await validateRoutingVersion(tenantId, versionId)
  if (!result.valid) {
    throw new ValidationError(
      'Routing version failed validation',
      result.errors.map((message) => ({ field: 'operations', message })),
    )
  }

  const userId = req.context?.userId ?? ''
  const now = new Date()

  const updated = await prisma.$transaction(async (tx) => {
    await tx.manufacturingRoutingVersion.updateMany({
      where: { tenantId, routingId: version.routingId, status: 'ACTIVE', id: { not: versionId } },
      data: { status: 'SUPERSEDED', updatedBy: userId },
    })
    return tx.manufacturingRoutingVersion.update({
      where: { id: versionId, tenantId },
      data: { status: 'ACTIVE', activatedBy: userId, activatedAt: now, updatedBy: userId },
    })
  })

  await audit(req, tenantId, 'manufacturingRoutingVersion', versionId, 'ACTIVATE', version, updated)
  return updated
}

export async function certifyRoutingVersion(req: Request, tenantId: string, versionId: string) {
  const { version } = await repo.getRoutingVersionFull(tenantId, versionId)
  if (version.status !== 'DRAFT') {
    throw new InvalidStateError('Only DRAFT routing versions can be certified')
  }
  const result = await validateRoutingVersion(tenantId, versionId)
  if (!result.valid) {
    throw new ValidationError(
      'Routing version failed validation',
      result.errors.map((message) => ({ field: 'operations', message })),
    )
  }

  const userId = req.context?.userId ?? ''
  const now = new Date()

  const updated = await prisma.$transaction(async (tx) => {
    await tx.manufacturingRoutingVersion.updateMany({
      where: { tenantId, routingId: version.routingId, status: 'ACTIVE', id: { not: versionId } },
      data: { status: 'SUPERSEDED', updatedBy: userId },
    })
    return tx.manufacturingRoutingVersion.update({
      where: { id: versionId, tenantId },
      data: {
        status: 'ACTIVE',
        approvedBy: userId,
        approvedAt: now,
        activatedBy: userId,
        activatedAt: now,
        updatedBy: userId,
      },
    })
  })

  await audit(req, tenantId, 'manufacturingRoutingVersion', versionId, 'CERTIFY', version, updated)
  return updated
}

export async function closeRoutingVersion(
  req: Request,
  tenantId: string,
  versionId: string,
  input: CloseRoutingVersionInput,
) {
  const version = await repo.getRoutingVersion(tenantId, versionId)
  if (version.status !== 'ACTIVE' && version.status !== 'SUPERSEDED') {
    throw new InvalidStateError('Only ACTIVE or SUPERSEDED routing versions can be closed')
  }

  const profiles = await prisma.manufacturingProfile.findMany({
    where: {
      tenantId,
      defaultRoutingVersionId: versionId,
      deletedAt: null,
    },
    select: { id: true, code: true, name: true },
  })

  if (profiles.length > 0) {
    const codes = profiles.map((p) => p.code).join(', ')
    throw new ValidationError(
      `Cannot close routing version — referenced as default by profile(s): ${codes}`,
      profiles.map((p) => ({
        field: 'defaultRoutingVersionId',
        message: `Profile ${p.code} (${p.name}) uses this version`,
      })),
    )
  }

  const userId = req.context?.userId ?? ''
  const closeNote = `[Closed ${new Date().toISOString()}] ${input.reason}`
  const revisionNotes = version.revisionNotes ? `${version.revisionNotes}\n${closeNote}` : closeNote

  const updated = await prisma.manufacturingRoutingVersion.update({
    where: { id: versionId, tenantId },
    data: {
      status: 'ARCHIVED',
      revisionNotes,
      updatedBy: userId,
    },
  })

  await audit(req, tenantId, 'manufacturingRoutingVersion', versionId, 'CLOSE', version, updated)
  return updated
}

export async function getRoutingWhereUsed(tenantId: string, versionId: string) {
  const version = await repo.getRoutingVersion(tenantId, versionId)
  const versionIds = (
    await prisma.manufacturingRoutingVersion.findMany({
      where: { tenantId, routingId: version.routingId, deletedAt: null },
      select: { id: true },
    })
  ).map((v) => v.id)

  const [profiles, productionOrders] = await Promise.all([
    prisma.manufacturingProfile.findMany({
      where: {
        tenantId,
        defaultRoutingVersionId: { in: versionIds },
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
        name: true,
        defaultRoutingVersionId: true,
        isActive: true,
      },
    }),
    prisma.productionOrder.findMany({
      where: {
        tenantId,
        routingVersionId: versionId,
        status: { in: [...OPEN_PRODUCTION_ORDER_STATUSES] },
        deletedAt: null,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        routingVersionId: true,
      },
    }),
  ])

  return { profiles, openProductionOrders: productionOrders }
}

export async function reviseRoutingVersion(
  req: Request,
  tenantId: string,
  versionId: string,
  input: ReviseRoutingVersionInput,
) {
  const { version: source, stageGroups, operations, dependencies } = await repo.getRoutingVersionFull(tenantId, versionId)
  const userId = req.context?.userId ?? ''

  const maxVersion = await prisma.manufacturingRoutingVersion.aggregate({
    where: { tenantId, routingId: source.routingId },
    _max: { versionNumber: true },
  })
  const versionNumber = (maxVersion._max.versionNumber ?? 0) + 1

  const created = await prisma.$transaction(async (tx) => {
    const newVersion = await tx.manufacturingRoutingVersion.create({
      data: {
        tenantId,
        routingId: source.routingId,
        versionNumber,
        revisionCode: `${source.revisionCode}-REV${versionNumber}`,
        status: 'DRAFT',
        effectiveFrom: new Date(),
        effectiveTo: null,
        revisionNotes: input.revisionNotes,
        createdBy: userId,
        updatedBy: userId,
      },
    })

    const stageGroupRemap = new Map<string, string>()
    for (const sg of stageGroups) {
      const newSg = await tx.manufacturingStageGroup.create({
        data: {
          tenantId,
          routingVersionId: newVersion.id,
          code: sg.code,
          name: sg.name,
          description: sg.description,
          displayOrder: sg.displayOrder,
          defaultWorkCentreId: sg.defaultWorkCentreId,
          isOptional: sg.isOptional,
          parallelAllowed: sg.parallelAllowed,
          qualityRequired: sg.qualityRequired,
          completionRule: sg.completionRule,
          isActive: sg.isActive,
          sourceBomLineId: sg.sourceBomLineId,
          createdBy: userId,
          updatedBy: userId,
        },
      })
      stageGroupRemap.set(sg.id, newSg.id)
    }

    const operationRemap = new Map<string, string>()
    for (const op of operations) {
      const newOp = await tx.manufacturingRoutingOperation.create({
        data: {
          tenantId,
          routingVersionId: newVersion.id,
          stageGroupId: stageGroupRemap.get(op.stageGroupId) as string,
          code: op.code,
          name: op.name,
          sequence: op.sequence,
          description: op.description,
          workCentreId: op.workCentreId,
          defaultMachineId: op.defaultMachineId,
          setupTimeMinutes: op.setupTimeMinutes,
          setupTimeUnit: op.setupTimeUnit,
          runTimeValue: op.runTimeValue,
          runTimeUnit: op.runTimeUnit,
          runTimeBasis: op.runTimeBasis,
          workInstructions: op.workInstructions,
          drawingReference: op.drawingReference,
          inputType: op.inputType,
          outputType: op.outputType,
          outputItemId: op.outputItemId,
          qualityRequired: op.qualityRequired,
          qualityPlanRef: op.qualityPlanRef,
          qcTestGroupId: op.qcTestGroupId,
          outsourced: op.outsourced,
          defaultVendorId: op.defaultVendorId,
          isOptional: op.isOptional,
          isConditional: op.isConditional,
          conditionExpression: op.conditionExpression,
          reworkAllowed: op.reworkAllowed,
          isActive: op.isActive,
          createdBy: userId,
          updatedBy: userId,
        },
      })
      operationRemap.set(op.id, newOp.id)
    }

    for (const dep of dependencies) {
      await tx.manufacturingOperationDependency.create({
        data: {
          tenantId,
          routingVersionId: newVersion.id,
          predecessorOperationId: operationRemap.get(dep.predecessorOperationId) as string,
          successorOperationId: operationRemap.get(dep.successorOperationId) as string,
          dependencyType: dep.dependencyType,
          minimumCompletionPercent: dep.minimumCompletionPercent,
          isMandatory: dep.isMandatory,
          allowParallel: dep.allowParallel,
          createdBy: userId,
          updatedBy: userId,
        },
      })
    }

    return newVersion
  })

  await audit(req, tenantId, 'manufacturingRoutingVersion', created.id, 'REVISE', source, created)
  return created
}

export async function compareRoutingVersions(tenantId: string, fromVersionId: string, toVersionId: string) {
  const [fromFull, toFull] = await Promise.all([
    repo.getRoutingVersionFull(tenantId, fromVersionId),
    repo.getRoutingVersionFull(tenantId, toVersionId),
  ])

  const byCode = (ops: typeof fromFull.operations) => new Map(ops.map((op) => [op.code, op]))
  const fromMap = byCode(fromFull.operations)
  const toMap = byCode(toFull.operations)
  const allCodes = new Set([...fromMap.keys(), ...toMap.keys()])

  const added: string[] = []
  const removed: string[] = []
  const changed: string[] = []
  const summaries: string[] = []
  for (const code of allCodes) {
    const f = fromMap.get(code)
    const t = toMap.get(code)
    if (!f && t) {
      added.push(code)
      summaries.push(`Added operation ${t.code} — ${t.name} (sequence ${t.sequence}).`)
    } else if (f && !t) {
      removed.push(code)
      summaries.push(`Removed operation ${f.code} — ${f.name}.`)
    } else if (f && t) {
      const fSnap = {
        sequence: f.sequence,
        workCentreId: f.workCentreId,
        runTimeValue: f.runTimeValue.toString(),
        setupTimeMinutes: f.setupTimeMinutes.toString(),
      }
      const tSnap = {
        sequence: t.sequence,
        workCentreId: t.workCentreId,
        runTimeValue: t.runTimeValue.toString(),
        setupTimeMinutes: t.setupTimeMinutes.toString(),
      }
      if (JSON.stringify(fSnap) !== JSON.stringify(tSnap)) {
        changed.push(code)
        const parts: string[] = []
        if (fSnap.runTimeValue !== tSnap.runTimeValue) {
          parts.push(`run time changed from ${fSnap.runTimeValue} to ${tSnap.runTimeValue}`)
        }
        if (fSnap.setupTimeMinutes !== tSnap.setupTimeMinutes) {
          parts.push(`setup time changed from ${fSnap.setupTimeMinutes} to ${tSnap.setupTimeMinutes} minutes`)
        }
        if (fSnap.sequence !== tSnap.sequence) {
          parts.push(`sequence changed from ${fSnap.sequence} to ${tSnap.sequence}`)
        }
        if (fSnap.workCentreId !== tSnap.workCentreId) {
          parts.push('work centre changed')
        }
        summaries.push(`Operation ${f.code} (${f.name}) ${parts.join('; ') || 'updated'}.`)
      }
    }
  }

  return {
    from: { id: fromFull.version.id, versionNumber: fromFull.version.versionNumber, status: fromFull.version.status },
    to: { id: toFull.version.id, versionNumber: toFull.version.versionNumber, status: toFull.version.status },
    addedOperations: added,
    removedOperations: removed,
    changedOperations: changed,
    summaries,
  }
}

// ─── BOM alignment (context + generate stages) ──────────────────────────────

type BomTreeNode = {
  id: string
  itemId: string
  lineType: string
  makeOrBuy: string
  phantomAssembly: boolean
  descriptionOverride: string | null
  item?: { code: string; name: string } | null
  children: BomTreeNode[]
}

function mapBomContextTreeNode(node: unknown): BomTreeNode {
  const typed = node as BomTreeNode & {
    item?: { code: string; name: string } | null
    children?: unknown[]
  }
  return {
    id: typed.id,
    itemId: typed.itemId,
    lineType: typed.lineType,
    makeOrBuy: typed.makeOrBuy,
    phantomAssembly: Boolean(typed.phantomAssembly),
    descriptionOverride: typed.descriptionOverride ?? null,
    item: typed.item ?? null,
    children: (typed.children ?? []).map(mapBomContextTreeNode),
  }
}

async function resolveBomVersionForProduct(tenantId: string, productItemId: string) {
  const profile = await prisma.manufacturingProfile.findFirst({
    where: { tenantId, productItemId, isActive: true, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  })
  if (profile?.defaultBomVersionId) {
    const version = await prisma.manufacturingBomVersion.findFirst({
      where: {
        id: profile.defaultBomVersionId,
        tenantId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: { bom: true },
    })
    if (version) return { version, unresolvedReason: null as string | null }
  }

  const bom = await prisma.manufacturingBom.findFirst({
    where: { tenantId, productItemId, isActive: true, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  })
  if (!bom) {
    return { version: null, unresolvedReason: 'NO_BOM' as const }
  }
  const version = await prisma.manufacturingBomVersion.findFirst({
    where: { tenantId, bomId: bom.id, status: 'ACTIVE', deletedAt: null },
    orderBy: { versionNumber: 'desc' },
    include: { bom: true },
  })
  if (!version) {
    return { version: null, unresolvedReason: 'NO_ACTIVE_BOM_VERSION' as const }
  }
  return { version, unresolvedReason: null as string | null }
}

export async function getRoutingBomContext(tenantId: string, versionId: string) {
  const { version } = await repo.getRoutingVersionFull(tenantId, versionId)
  const routing = await repo.getRouting(tenantId, version.routingId)

  // BC-style: routes are not item-bound. Prefer profile that uses this routing version (or any version of this routing).
  let productItemId = routing.productItemId
  if (!productItemId) {
    const versionIds = (
      await prisma.manufacturingRoutingVersion.findMany({
        where: { tenantId, routingId: routing.id, deletedAt: null },
        select: { id: true },
      })
    ).map((v) => v.id)
    const profile = await prisma.manufacturingProfile.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        OR: [
          { defaultRoutingVersionId: versionId },
          ...(versionIds.length ? [{ defaultRoutingVersionId: { in: versionIds } }] : []),
        ],
      },
      select: { productItemId: true },
      orderBy: { updatedAt: 'desc' },
    })
    productItemId = profile?.productItemId ?? null
  }

  if (!productItemId) {
    return {
      productItemId: null,
      bomVersion: null,
      tree: [] as BomTreeNode[],
      unresolvedReason: 'NO_PRODUCT_ITEM' as const,
    }
  }

  const resolved = await resolveBomVersionForProduct(tenantId, productItemId)
  if (!resolved.version) {
    return {
      productItemId,
      bomVersion: null,
      tree: [] as BomTreeNode[],
      unresolvedReason: resolved.unresolvedReason,
    }
  }

  const lines = await bomRepo.listBomLines(tenantId, resolved.version.id)
  const tree = bomRepo.buildBomTree(lines).map(mapBomContextTreeNode)
  const bom = resolved.version.bom

  return {
    productItemId,
    bomVersion: {
      id: resolved.version.id,
      bomId: resolved.version.bomId,
      bomCode: bom.code,
      bomName: bom.name,
      versionNumber: resolved.version.versionNumber,
      revisionCode: resolved.version.revisionCode,
      status: resolved.version.status,
    },
    tree,
    unresolvedReason: null,
  }
}

function sanitizeStageCode(raw: string, used: Set<string>): string {
  let base = raw
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 28)
  if (!base) base = 'STAGE'
  let code = base
  let n = 2
  while (used.has(code)) {
    const suffix = `-${n}`
    code = `${base.slice(0, Math.max(1, 32 - suffix.length))}${suffix}`
    n += 1
  }
  used.add(code)
  return code
}

function collectMakeStagesFromTree(
  nodes: BomTreeNode[],
  out: Array<{ lineId: string; itemId: string; codeHint: string; name: string }>,
) {
  for (const node of nodes) {
    const isMakeStage =
      (node.lineType === 'SUBASSEMBLY' || node.lineType === 'MANUFACTURED_COMPONENT') &&
      node.makeOrBuy === 'MAKE' &&
      !node.phantomAssembly
    if (isMakeStage) {
      const itemCode = node.item?.code ?? node.itemId.slice(0, 8)
      const itemName = node.descriptionOverride?.trim() || node.item?.name || itemCode
      out.push({
        lineId: node.id,
        itemId: node.itemId,
        codeHint: itemCode,
        name: itemName.slice(0, 200),
      })
    }
    if (node.children?.length) collectMakeStagesFromTree(node.children, out)
  }
}

export async function generateStagesFromBom(
  req: Request,
  tenantId: string,
  versionId: string,
  input: GenerateStagesFromBomInput,
) {
  const userId = req.context?.userId ?? ''
  const { version, stageGroups } = await repo.getRoutingVersionFull(tenantId, versionId)
  if (version.status !== 'DRAFT') {
    throw new InvalidStateError('Stages can only be generated on a DRAFT routing version')
  }
  if (stageGroups.length > 0 && !input.replaceExisting) {
    throw new ValidationError('Stage groups already exist — set replaceExisting to replace them')
  }

  const context = await getRoutingBomContext(tenantId, versionId)
  if (!context.productItemId) {
    throw new ValidationError(
      'No finished item found for this route. Assign the certified route on a Manufacturing Profile (with item + BOM), then generate stages.',
    )
  }
  if (!context.bomVersion || context.unresolvedReason) {
    throw new ValidationError(
      context.unresolvedReason === 'NO_BOM'
        ? 'No BOM found for this item'
        : 'No ACTIVE BOM version found for this item',
    )
  }

  if (stageGroups.length > 0 && input.replaceExisting) {
    await repo.clearRoutingVersionStructure(tenantId, versionId)
  }

  const candidates: Array<{ lineId: string; itemId: string; codeHint: string; name: string }> = []
  collectMakeStagesFromTree(context.tree, candidates)

  const product = await prisma.masterItem.findFirst({
    where: { id: context.productItemId, tenantId, deletedAt: null },
    select: { id: true, code: true, name: true },
  })
  const productName = product?.name ?? 'Finished good'
  const coversProduct = candidates.some((c) => c.itemId === context.productItemId)

  const usedCodes = new Set<string>()
  const created = []
  let displayOrder = 10
  for (const c of candidates) {
    const code = sanitizeStageCode(c.codeHint, usedCodes)
    const row = await repo.createStageGroup(tenantId, userId, versionId, {
      code,
      name: c.name,
      displayOrder,
      isOptional: false,
      parallelAllowed: false,
      qualityRequired: false,
      completionRule: 'ALL_OPERATIONS',
      isActive: true,
      sourceBomLineId: c.lineId,
    })
    created.push(row)
    displayOrder += 10
  }

  if (!coversProduct) {
    const code = sanitizeStageCode('FINAL', usedCodes)
    const row = await repo.createStageGroup(tenantId, userId, versionId, {
      code,
      name: `Final assembly — ${productName}`.slice(0, 200),
      displayOrder,
      isOptional: false,
      parallelAllowed: false,
      qualityRequired: false,
      completionRule: 'ALL_OPERATIONS',
      isActive: true,
      sourceBomLineId: null,
    })
    created.push(row)
  }

  await audit(req, tenantId, 'manufacturingRoutingVersion', versionId, 'GENERATE_STAGES_FROM_BOM', undefined, {
    stageCount: created.length,
    bomVersionId: context.bomVersion.id,
    replaceExisting: input.replaceExisting,
  })

  return { stageGroups: created, bomVersionId: context.bomVersion.id }
}
