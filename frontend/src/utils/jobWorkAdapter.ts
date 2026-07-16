import type { JobWorkMeta, JobWorkOrderView, JwoQcStatus, JwoStatus } from '../types/jobWork'
import type { SubcontractShipment, WorkOrder } from '../types/workorder'
import type { QcInspection } from '../types/quality'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useMasterStore } from '../store/masterStore'
import { useQualityStore } from '../store/qualityStore'
import { useJobWorkExecutionStore } from '../store/jobWorkExecutionStore'

export function shipmentBalance(sh: SubcontractShipment): number {
  return Math.max(0, sh.sentQty - sh.receivedQty - sh.rejectedQty - (sh.reworkQty ?? 0))
}

export function deriveJwoStatus(
  wo: WorkOrder,
  shipments: SubcontractShipment[],
  meta: JobWorkMeta | undefined,
  inspections: QcInspection[],
): JwoStatus {
  if (meta?.closedAt || wo.status === 'closed') return 'closed'

  const pendingSubQc = inspections.some(
    (i) =>
      i.workOrderId === wo.id &&
      i.category === 'subcontract_return' &&
      i.status === 'pending',
  )
  if (pendingSubQc) return 'qc_pending'

  const hasSent = shipments.some((s) => s.sentQty > 0)
  const totalSent = shipments.reduce((s, sh) => s + sh.sentQty, 0)
  const totalReceived = shipments.reduce((s, sh) => s + sh.receivedQty, 0)
  const totalRejected = shipments.reduce((s, sh) => s + sh.rejectedQty, 0)
  const totalBalance = shipments.reduce((s, sh) => s + shipmentBalance(sh), 0)

  if (totalSent > 0 && totalBalance === 0 && totalReceived + totalRejected >= totalSent) {
    return 'received'
  }
  if (totalReceived > 0 || totalRejected > 0) return 'partially_received'
  if (hasSent) return 'in_process'
  if (meta?.approvedAt) return 'approved'
  if (['planned', 'released', 'draft'].includes(wo.status)) return 'draft'
  return 'draft'
}

export function deriveJwoQcStatus(woId: string, shipments: SubcontractShipment[], inspections: QcInspection[]): JwoQcStatus {
  const pending = inspections.some(
    (i) => i.workOrderId === woId && i.category === 'subcontract_return' && i.status === 'pending',
  )
  if (pending) return 'pending'
  const failed = inspections.some(
    (i) => i.workOrderId === woId && i.category === 'subcontract_return' && i.result === 'reject',
  )
  if (failed) return 'fail'
  const passed = inspections.some(
    (i) => i.workOrderId === woId && i.category === 'subcontract_return' && i.result === 'pass',
  )
  if (passed) return 'pass'
  if (shipments.some((s) => s.qcRequired)) return 'none'
  return 'none'
}

export function toJobWorkOrderView(
  wo: WorkOrder,
  shipments: SubcontractShipment[],
  meta: JobWorkMeta | undefined,
  vendorName: string,
  inspections: QcInspection[],
  materialItemCode: string | null,
  rate: number,
): JobWorkOrderView {
  const sentQty = shipments.reduce((s, sh) => s + sh.sentQty, 0)
  const receivedQty = shipments.reduce((s, sh) => s + sh.receivedQty, 0)
  const rejectedQty = shipments.reduce((s, sh) => s + sh.rejectedQty, 0)
  const reworkQty = shipments.reduce((s, sh) => s + (sh.reworkQty ?? 0), 0)
  const balanceQty = shipments.reduce((s, sh) => s + shipmentBalance(sh), 0)
  const expectedReturnDate = shipments.find((s) => s.expectedReturnDate)?.expectedReturnDate ?? null
  const actualReturnDate = shipments.find((s) => s.receivedAt)?.receivedAt?.slice(0, 10) ?? null
  const jwoRate = meta?.rate ?? rate
  const amount = receivedQty * jwoRate

  return {
    id: wo.id,
    jwoNo: `JWO-${wo.woNo}`,
    workOrderId: wo.id,
    sourceWoNo: wo.woNo,
    parentSoNo: wo.salesOrderNo,
    parentSoId: wo.salesOrderId,
    vendorId: wo.vendorId,
    vendorName,
    process: wo.outputItemCode,
    outputItemCode: wo.outputItemCode,
    materialSentItemCode: materialItemCode,
    sentQty,
    receivedQty,
    rejectedQty,
    reworkQty,
    balanceQty,
    expectedReturnDate,
    actualReturnDate,
    status: deriveJwoStatus(wo, shipments, meta, inspections),
    qcStatus: deriveJwoQcStatus(wo.id, shipments, inspections),
    rate: jwoRate,
    amount,
    shipmentIds: shipments.map((s) => s.id),
    challanNos: shipments.map((s) => s.challanNo),
  }
}

export function listJobWorkOrdersFromState(): JobWorkOrderView[] {
  const woState = useWorkOrderStore.getState()
  const inspections = useQualityStore.getState().inspections
  const metaMap = useJobWorkExecutionStore.getState().metaByWoId

  return woState.workOrders
    .filter((w) => w.woType === 'subcontract')
    .map((wo) => {
      const shipments = woState.subcontractShipments.filter((s) => s.workOrderId === wo.id)
      const meta = metaMap[wo.id]
      const vendorName = wo.vendorId ? useMasterStore.getState().getVendor(wo.vendorId)?.vendorName ?? '—' : '—'
      const matLine = woState.materialLines.find((l) => l.workOrderId === wo.id)
      const item = matLine ? useMasterStore.getState().getItem(matLine.itemId) : null
      const rate = item?.standardRate ?? 0
      return toJobWorkOrderView(wo, shipments, meta, vendorName, inspections, matLine?.itemCode ?? null, rate)
    })
    .sort((a, b) => b.jwoNo.localeCompare(a.jwoNo))
}
