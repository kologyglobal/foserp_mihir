import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { InvalidStateError, ValidationError } from '../../../utils/errors.js'
import { assertNoDependencyCycle } from '../shared/manufacturing.helpers.js'
import * as repo from './routing.repository.js'
import type {
  CreateDependencyInput,
  CreateOperationInput,
  CreateRoutingInput,
  CreateRoutingVersionInput,
  CreateStageGroupInput,
  ListRoutingVersionsQuery,
  ListRoutingsQuery,
  UpdateOperationInput,
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
  operationCount: number
  stageGroupCount: number
}

export async function validateRoutingVersion(tenantId: string, versionId: string): Promise<RoutingValidationResult> {
  const { version, stageGroups, operations, dependencies } = await repo.getRoutingVersionFull(tenantId, versionId)
  const errors: string[] = []

  if (stageGroups.length === 0) {
    errors.push('Routing version must have at least one stage group')
  }
  if (operations.length === 0) {
    errors.push('Routing version must have at least one operation')
  }

  const seenSequences = new Set<number>()
  const operationIds = new Set(operations.map((op) => op.id))
  for (const op of operations) {
    if (seenSequences.has(op.sequence)) {
      errors.push(`Duplicate sequence ${op.sequence} in routing version`)
    }
    seenSequences.add(op.sequence)
    if (!stageGroups.some((sg) => sg.id === op.stageGroupId)) {
      errors.push(`Operation ${op.code}: stage group not found in this version`)
    }
  }

  for (const dep of dependencies) {
    if (!operationIds.has(dep.predecessorOperationId) || !operationIds.has(dep.successorOperationId)) {
      errors.push('Dependency references an operation outside this version')
    }
  }

  // Defense-in-depth cycle scan across full dependency graph.
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

export async function reviseRoutingVersion(req: Request, tenantId: string, versionId: string) {
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
        revisionNotes: `Revised from version ${source.versionNumber}`,
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
          runTimeValue: op.runTimeValue,
          runTimeBasis: op.runTimeBasis,
          workInstructions: op.workInstructions,
          drawingReference: op.drawingReference,
          inputType: op.inputType,
          outputType: op.outputType,
          outputItemId: op.outputItemId,
          qualityRequired: op.qualityRequired,
          qualityPlanRef: op.qualityPlanRef,
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
