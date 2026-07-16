import type { WorkOrder, WorkOrderMaterialLine, WorkOrderProductionOperation } from '../types/workorder'
import type { WorkCenter } from '../types/workcenter'
import {
  buildDynamicWipFlowSteps,
  getWipFlowStepIndex,
  resolveDynamicWipStepId,
  toWipRoutingOpsFromProduction,
  type WipFlowStepDynamic,
} from './wipRouting'

export type { WipFlowStepDynamic as WipFlowStep }

export function resolveWipFlowStep(
  wo: WorkOrder,
  materials: WorkOrderMaterialLine[],
  operations: WorkOrderProductionOperation[],
  workCenters: WorkCenter[],
): string {
  const routingOps = toWipRoutingOpsFromProduction(operations)
  return resolveDynamicWipStepId(wo, materials, routingOps, workCenters)
}

export function buildWipFlowStepsForWo(
  operations: WorkOrderProductionOperation[],
  workCenters: WorkCenter[],
): WipFlowStepDynamic[] {
  return buildDynamicWipFlowSteps(toWipRoutingOpsFromProduction(operations), workCenters)
}

export { getWipFlowStepIndex }

export function isOperationShopFloorDone(op: WorkOrderProductionOperation): boolean {
  return op.status === 'completed' || op.status === 'qc_hold'
}
