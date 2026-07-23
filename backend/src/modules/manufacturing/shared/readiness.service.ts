import type { ProductionStageStatus } from '@prisma/client'

export interface ReadinessOperation {
  id: string
  stageId: string
  isOptional: boolean
  status: ProductionStageStatus
}

export interface ReadinessDependency {
  predecessorOperationId: string
  successorOperationId: string
  isMandatory: boolean
}

/**
 * An operation is READY at release time when it has no mandatory predecessor
 * (dependency where it is the successor); everything else starts NOT_STARTED
 * until its predecessors complete.
 */
export function computeInitialOperationStatus(
  operationId: string,
  dependencies: ReadinessDependency[],
): 'READY' | 'NOT_STARTED' {
  const hasMandatoryPredecessor = dependencies.some(
    (dep) => dep.successorOperationId === operationId && dep.isMandatory,
  )
  return hasMandatoryPredecessor ? 'NOT_STARTED' : 'READY'
}

/**
 * Stage status derived from its operations: IN_PROGRESS if any op is running,
 * COMPLETED if every mandatory op is COMPLETED/SKIPPED, READY if any op is READY,
 * otherwise NOT_STARTED.
 */
export function deriveStageStatusFromOperations(operations: ReadinessOperation[]): ProductionStageStatus {
  // Empty-op stages are still executable shopfloor steps in flexible routing.
  if (operations.length === 0) return 'READY'
  if (operations.some((op) => op.status === 'IN_PROGRESS')) return 'IN_PROGRESS'
  if (operations.some((op) => op.status === 'ON_HOLD')) return 'ON_HOLD'
  if (operations.some((op) => op.status === 'BLOCKED')) return 'BLOCKED'

  const mandatoryOps = operations.filter((op) => !op.isOptional)
  const relevantOps = mandatoryOps.length > 0 ? mandatoryOps : operations
  const allDone = relevantOps.every((op) => op.status === 'COMPLETED' || op.status === 'SKIPPED')
  if (allDone) return 'COMPLETED'

  if (operations.some((op) => op.status === 'READY')) return 'READY'
  return 'NOT_STARTED'
}

/**
 * After `completedOperationId` finishes, find which NOT_STARTED successor operations
 * now have every mandatory predecessor COMPLETED and should flip to READY.
 */
export function findOperationsToPromote(
  completedOperationId: string,
  allOperations: Array<{ id: string; status: ProductionStageStatus }>,
  dependencies: ReadinessDependency[],
): string[] {
  const successorIds = new Set(
    dependencies
      .filter((dep) => dep.predecessorOperationId === completedOperationId)
      .map((dep) => dep.successorOperationId),
  )
  const statusById = new Map(allOperations.map((op) => [op.id, op.status]))
  const promotable: string[] = []

  for (const successorId of successorIds) {
    if (statusById.get(successorId) !== 'NOT_STARTED') continue
    const mandatoryPredecessors = dependencies.filter(
      (dep) => dep.successorOperationId === successorId && dep.isMandatory,
    )
    const allPredecessorsDone = mandatoryPredecessors.every((dep) => {
      const predStatus = statusById.get(dep.predecessorOperationId)
      return predStatus === 'COMPLETED' || predStatus === 'SKIPPED'
    })
    if (allPredecessorsDone) promotable.push(successorId)
  }

  return promotable
}
