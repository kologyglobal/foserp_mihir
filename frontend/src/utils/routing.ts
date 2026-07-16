import type { RoutingHeader, RoutingOperation, RoutingOperationEnriched } from '../types/routing'
import type { WorkCenter } from '../types/workcenter'
import type { WorkOrderProductionOperation } from '../types/workorder'
import { ROUTING_ELIGIBLE_STATUSES } from '../types/routing'

export function nextRoutingRevision(current: string): string {
  const letter = current.replace('Rev-', '')
  const next = String.fromCharCode(letter.charCodeAt(0) + 1)
  return `Rev-${next}`
}

export function getReleasedRoutingForProduct(
  headers: RoutingHeader[],
  productId: string,
): RoutingHeader | undefined {
  return headers
    .filter((h) => h.productId === productId && ROUTING_ELIGIBLE_STATUSES.includes(h.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
}

export function computeRoutingTotalHours(operations: RoutingOperation[]): number {
  return operations.reduce((sum, o) => sum + o.standardHours, 0)
}

export function enrichRoutingOperations(
  operations: RoutingOperation[],
  workCenters: WorkCenter[],
): RoutingOperationEnriched[] {
  const wcMap = new Map(workCenters.map((w) => [w.id, w]))
  return [...operations]
    .sort((a, b) => a.sequenceNo - b.sequenceNo)
    .map((op) => {
      const wc = wcMap.get(op.workCenterId)
      return {
        ...op,
        workCenterCode: wc?.workCenterCode ?? '—',
        workCenterName: wc?.workCenterName ?? '—',
      }
    })
}

export function buildProductionOperationsFromRouting(
  woId: string,
  woQty: number,
  operations: RoutingOperationEnriched[],
  genId: (prefix: string) => string,
): WorkOrderProductionOperation[] {
  const ts = new Date().toISOString()
  return operations.map((op) => ({
    id: genId('wop'),
    workOrderId: woId,
    routingOperationId: op.id,
    operationCode: op.operationCode,
    sequenceNo: op.sequenceNo,
    operationName: op.operationName,
    workCenterId: op.workCenterId,
    workCenterCode: op.workCenterCode,
    standardHours: op.standardHours * woQty,
    setupTimeHours: op.setupTimeHours,
    runTimeHours: op.runTimeHours * woQty,
    laborRequirement: op.laborRequirement,
    qcRequired: op.qcRequired,
    outsourced: op.outsourced,
    qcChecklist: op.qcChecklist ?? [],
    status: 'pending' as const,
    createdAt: ts,
  }))
}

export function hasInactiveWorkCenters(
  operations: RoutingOperation[],
  workCenters: WorkCenter[],
): boolean {
  const wcMap = new Map(workCenters.map((w) => [w.id, w]))
  return operations.some((op) => {
    const wc = wcMap.get(op.workCenterId)
    return !wc || !wc.isActive
  })
}
