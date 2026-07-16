import type { WorkOrderProductionOperation } from '../types/workorder'
import type { WorkCenter } from '../types/workcenter'
import type { SaReceipt, WorkOrderMaterialLine } from '../types/workorder'
import {
  getInHouseOps,
  getWorkCenterWarehouseMapping,
  toWipRoutingOpsFromProduction,
} from './wipRouting'

const DEFAULT_SA_RECEIPT_WAREHOUSE = 'WIP_ASSEMBLY'

export function resolveSaReceiptWarehouseCode(
  productionOps: WorkOrderProductionOperation[],
  workCenters: WorkCenter[],
): string {
  const routingOps = toWipRoutingOpsFromProduction(productionOps)
  const inHouse = getInHouseOps(routingOps)
  const completed = inHouse
    .filter((o) => o.status === 'completed')
    .sort((a, b) => b.sequenceNo - a.sequenceNo)

  const lastCompleted = completed[0]
  if (lastCompleted) {
    const mapping = getWorkCenterWarehouseMapping(lastCompleted.workCenterId, workCenters)
    if (mapping) {
      return mapping.outputWarehouseCode === 'FG_YARD'
        ? mapping.wipWarehouseCode
        : mapping.outputWarehouseCode
    }
  }

  return DEFAULT_SA_RECEIPT_WAREHOUSE
}

export function getChildWorkOrders(
  parentWoId: string,
  workOrders: Array<{ id: string; parentWoId: string | null; woType: string }>,
) {
  return workOrders.filter((w) => w.parentWoId === parentWoId)
}

export function getSaReceiptForSourceWo(sourceWoId: string, saReceipts: SaReceipt[]) {
  return saReceipts.find((r) => r.sourceWoId === sourceWoId && r.status === 'posted')
}

export function assertSaSubAssembliesReceivedForFg(input: {
  fgWoId: string
  workOrders: Array<{ id: string; parentWoId: string | null; woType: string; outputItemCode: string; woNo: string }>
  materialLines: WorkOrderMaterialLine[]
  saReceipts: SaReceipt[]
}): { ok: boolean; error?: string } {
  const saLines = input.materialLines.filter(
    (l) => l.workOrderId === input.fgWoId && l.sourceWoId,
  )

  for (const line of saLines) {
    const childWo = input.workOrders.find((w) => w.id === line.sourceWoId)
    if (!childWo) continue

    if (childWo.woType === 'manufactured_sub_assembly') {
      const receipt = getSaReceiptForSourceWo(childWo.id, input.saReceipts)
      if (!receipt) {
        return {
          ok: false,
          error: `Semi-finished receipt not posted for ${childWo.outputItemCode} (${childWo.woNo})`,
        }
      }
    }
  }

  return { ok: true }
}

export function assertFgSubAssemblyStockAvailable(input: {
  fgWoId: string
  materialLines: WorkOrderMaterialLine[]
  workOrders: Array<{ id: string; woType: string }>
  getOnHand: (itemId: string, warehouseId: string) => number
}): { ok: boolean; error?: string } {
  const saLines = input.materialLines.filter((l) => l.workOrderId === input.fgWoId && l.sourceWoId)

  for (const line of saLines) {
    const childWo = input.workOrders.find((w) => w.id === line.sourceWoId)
    if (childWo?.woType !== 'manufactured_sub_assembly') continue

    const onHand = input.getOnHand(line.itemId, line.warehouseId)
    if (onHand < line.requiredQty) {
      return {
        ok: false,
        error: `Insufficient ${line.itemCode} in receipt warehouse — on hand ${onHand}, required ${line.requiredQty}`,
      }
    }
  }

  return { ok: true }
}
