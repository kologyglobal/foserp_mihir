import type { WorkOrder } from '../types/workorder'

export type IntegritySeverity = 'error' | 'warning'

export interface IntegrityIssue {
  severity: IntegritySeverity
  code:
    | 'WO_ORPHAN_BOM'
    | 'WO_ORPHAN_ROUTING'
    | 'ROUTING_ORPHAN_WORK_CENTER'
    | 'PRODUCTION_OP_ORPHAN_WORK_CENTER'
    | 'PRODUCTION_OP_ORPHAN_ROUTING_TEMPLATE'
  message: string
  entityType: 'WorkOrder' | 'RoutingOperation' | 'WorkOrderProductionOperation'
  entityId: string
  referenceId: string
}

export interface IntegrityReport {
  ok: boolean
  errorCount: number
  warningCount: number
  issues: IntegrityIssue[]
  checkedAt: string
}

export interface IntegrityInput {
  workOrders: WorkOrder[]
  bomHeaderIds: Set<string>
  routingHeaderIds: Set<string>
  workCenterIds: Set<string>
  routingOperationIds: Set<string>
  productionOperations: Array<{
    id: string
    workOrderId: string
    workCenterId: string
    routingOperationId: string
  }>
}

export function validateManufacturingIntegrity(input: IntegrityInput): IntegrityReport {
  const issues: IntegrityIssue[] = []

  for (const wo of input.workOrders) {
    if (wo.bomHeaderId && !input.bomHeaderIds.has(wo.bomHeaderId)) {
      issues.push({
        severity: 'error',
        code: 'WO_ORPHAN_BOM',
        message: `Work order ${wo.woNo} references missing BOM ${wo.bomHeaderId} (${wo.bomRevision})`,
        entityType: 'WorkOrder',
        entityId: wo.id,
        referenceId: wo.bomHeaderId,
      })
    }
    if (wo.routingHeaderId && !input.routingHeaderIds.has(wo.routingHeaderId)) {
      issues.push({
        severity: 'error',
        code: 'WO_ORPHAN_ROUTING',
        message: `Work order ${wo.woNo} references missing routing ${wo.routingHeaderId} (${wo.routingRevision ?? '—'})`,
        entityType: 'WorkOrder',
        entityId: wo.id,
        referenceId: wo.routingHeaderId,
      })
    }
  }

  for (const op of input.productionOperations) {
    if (!input.workCenterIds.has(op.workCenterId)) {
      issues.push({
        severity: 'error',
        code: 'PRODUCTION_OP_ORPHAN_WORK_CENTER',
        message: `Production operation ${op.id} on WO ${op.workOrderId} references missing work center ${op.workCenterId}`,
        entityType: 'WorkOrderProductionOperation',
        entityId: op.id,
        referenceId: op.workCenterId,
      })
    }
    if (!input.routingOperationIds.has(op.routingOperationId)) {
      issues.push({
        severity: 'warning',
        code: 'PRODUCTION_OP_ORPHAN_ROUTING_TEMPLATE',
        message: `Production operation ${op.id} references missing routing template op ${op.routingOperationId}`,
        entityType: 'WorkOrderProductionOperation',
        entityId: op.id,
        referenceId: op.routingOperationId,
      })
    }
  }

  return {
    ok: issues.filter((i) => i.severity === 'error').length === 0,
    errorCount: issues.filter((i) => i.severity === 'error').length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
    issues,
    checkedAt: new Date().toISOString(),
  }
}

export function validateRoutingWorkCenters(
  routingOperations: Array<{ id: string; routingHeaderId: string; workCenterId: string; operationCode: string }>,
  workCenterIds: Set<string>,
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = []
  for (const op of routingOperations) {
    if (!workCenterIds.has(op.workCenterId)) {
      issues.push({
        severity: 'error',
        code: 'ROUTING_ORPHAN_WORK_CENTER',
        message: `Routing operation ${op.operationCode} (${op.id}) references missing work center ${op.workCenterId}`,
        entityType: 'RoutingOperation',
        entityId: op.id,
        referenceId: op.workCenterId,
      })
    }
  }
  return issues
}

export function mergeIntegrityReports(...reports: IntegrityReport[]): IntegrityReport {
  const issues = reports.flatMap((r) => r.issues)
  return {
    ok: issues.filter((i) => i.severity === 'error').length === 0,
    errorCount: issues.filter((i) => i.severity === 'error').length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
    issues,
    checkedAt: new Date().toISOString(),
  }
}
