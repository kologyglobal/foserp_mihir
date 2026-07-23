import { createWorkOrderShortageRequisition } from '@/services/api/manufacturingApi'
import type { ProductionOrderMaterial, ShortageRequisitionResult } from '@/types/manufacturingProduction'

/** True when a WO material line has an actionable shortage for purchase requisition. */
export function materialLineHasShortage(
  line: Pick<ProductionOrderMaterial, 'status' | 'shortageQty' | 'hasShortage'>,
): boolean {
  if (line.status === 'SHORT') return true
  if (line.hasShortage) return true
  return Number(line.shortageQty) > 0
}

export function countWorkOrderShortageLines(materials: ProductionOrderMaterial[]): number {
  return materials.filter(materialLineHasShortage).length
}

export type ShortagePrGate = {
  enabled: boolean
  disabledReason?: string
}

/** Shared enablement for WO header + Materials-tab Shortage PR. */
export function getWorkOrderShortagePrGate(opts: {
  canCreate: boolean
  readOnly: boolean
  materialsLoading: boolean
  materialsLoaded: boolean
  shortageCount: number
  materialControlStatus?: string | null
}): ShortagePrGate {
  if (!opts.canCreate) {
    return { enabled: false, disabledReason: 'Missing permission to create shortage purchase requisitions' }
  }
  if (opts.readOnly) {
    return { enabled: false, disabledReason: 'Work order is completed, closed, or cancelled' }
  }
  if (opts.materialControlStatus === 'NOT_CONNECTED') {
    return { enabled: false, disabledReason: 'Connect inventory materials first' }
  }
  if (opts.materialsLoading || !opts.materialsLoaded) {
    return { enabled: false, disabledReason: 'Loading material shortages…' }
  }
  if (opts.shortageCount <= 0) {
    return { enabled: false, disabledReason: 'No material shortages on this work order' }
  }
  return { enabled: true }
}

export function formatShortagePrSuccess(result: ShortageRequisitionResult): {
  prId: string
  prNo: string
  message: string
} {
  const pr = result.requisition
  const prNo = pr.prNumber ?? pr.requisitionNumber ?? pr.id.slice(0, 8)
  const lineCount = pr.lines?.length ?? result.linkedMaterialIds.length
  return {
    prId: pr.id,
    prNo,
    message: `Shortage PR ${prNo} created with ${lineCount} line(s)`,
  }
}

/** Same backend path as Materials-tab Shortage PR / Issue Stock shortage PR. */
export async function createWorkOrderShortagePr(workOrderId: string) {
  const res = await createWorkOrderShortageRequisition(workOrderId, {
    idempotencyKey: `wo-shortage-pr:${workOrderId}:${crypto.randomUUID()}`,
    submit: false,
  })
  const formatted = formatShortagePrSuccess(res.data)
  return { ...formatted, materials: res.data.materials }
}
