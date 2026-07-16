import { useQrStore, ensureEntityQr } from '../store/qrStore'
import { usePurchaseStore } from '../store/purchaseStore'
import { useMasterStore } from '../store/masterStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useMrpStore } from '../store/mrpStore'
import type { QrRecord } from '../types/qrTraceability'
import { onFgSerialsRegistered, onGrnSerialsRegistered } from './serialIntegration'

/** After GRN posted — create material lot QR per received line + header GRN QR */
export function onGrnPosted(grnId: string): QrRecord[] {
  const grn = usePurchaseStore.getState().getGrn(grnId)
  if (!grn) return []
  const master = useMasterStore.getState()
  const store = useQrStore.getState()
  const created: QrRecord[] = []

  const headerStatus =
    grn.status === 'posted' ? ('IN_STOCK' as const) : grn.qcRequired ? ('CREATED' as const) : ('IN_STOCK' as const)
  const headerQr = ensureEntityQr({
    entityType: 'GRN_LINE',
    entityId: grnId,
    displayCode: grn.grnNo,
    status: headerStatus,
    metadata: { grnId: grn.id, grnNo: grn.grnNo },
    payload: { grn: grn.grnNo },
  })
  created.push(headerQr)

  for (const line of grn.lines) {
    if (line.receivedQty <= 0) continue
    const item = master.getItem(line.itemId)
    const wh = master.getWarehouse(line.warehouseId)
    const lotNo = `LOT-${grn.grnNo}-${line.id.slice(0, 6).toUpperCase()}`
    const qty = line.acceptedQty > 0 ? line.acceptedQty : line.receivedQty
    const lotStatus = line.acceptedQty > 0 ? ('IN_STOCK' as const) : grn.status === 'posted' ? ('IN_STOCK' as const) : ('CREATED' as const)

    const grnLineQr = store.registerQr({
      entityType: 'GRN_LINE',
      entityId: line.id,
      displayCode: `${grn.grnNo}-${item?.itemCode ?? line.itemId}`,
      status: 'IN_STOCK',
      metadata: { grnId: grn.id, grnNo: grn.grnNo, grnLineId: line.id, itemId: line.itemId, qty: line.acceptedQty },
      payload: { grn: grn.grnNo, item: item?.itemCode },
    })

    const qr = store.registerQr({
      entityType: 'MATERIAL_LOT',
      entityId: `${grn.id}-${line.id}`,
      displayCode: lotNo,
      status: lotStatus,
      metadata: {
        grnId: grn.id,
        grnNo: grn.grnNo,
        grnLineId: line.id,
        itemId: line.itemId,
        itemCode: item?.itemCode,
        itemName: item?.itemName,
        lotNo,
        qty,
        warehouseId: line.warehouseId,
        warehouseCode: wh?.warehouseCode,
        parentQrId: grnLineQr.qrId,
      },
      payload: { grn: grn.grnNo, item: item?.itemCode, batch: lotNo },
    })

    store.linkGenealogy(grnLineQr.qrId, qr.qrId, 'grn-to-lot')
    store.recordEvent({
      qrId: qr.qrId,
      eventType: 'stored',
      referenceNo: grn.grnNo,
      details: `Material lot ${lotNo} — qty ${qty}`,
    })
    created.push(qr)
  }
  onGrnSerialsRegistered(grnId)
  return created
}

/** After incoming QC accepts GRN material — move lot QR to IN_STOCK */
export function onGrnQcAccepted(grnId: string): void {
  const grn = usePurchaseStore.getState().getGrn(grnId)
  if (!grn) return
  const store = useQrStore.getState()
  for (const qr of store.records.filter(
    (r) => r.metadata.grnId === grnId && (r.entityType === 'MATERIAL_LOT' || r.entityId === grnId),
  )) {
    store.updateStatus(qr.qrId, 'IN_STOCK')
    store.recordEvent({
      qrId: qr.qrId,
      eventType: 'received',
      referenceNo: grn.grnNo,
      details: 'Incoming QC accepted — material released to stock',
    })
  }
}

/** Material lot + header QRs linked to a GRN */
export function getGrnMaterialQrs(grnId: string): QrRecord[] {
  return useQrStore
    .getState()
    .records.filter(
      (r) =>
        r.metadata.grnId === grnId &&
        (r.entityType === 'MATERIAL_LOT' || (r.entityType === 'GRN_LINE' && r.entityId === grnId)),
    )
}

/** After SA receipt posted */
export function onSaReceiptPosted(woId: string, _receiptId?: string): QrRecord | null {
  const wo = useWorkOrderStore.getState().getWorkOrder(woId)
  if (!wo) return null
  const master = useMasterStore.getState()
  const product = master.getProduct(wo.productId)
  const saNo = `SA-${wo.woNo}`
  const store = useQrStore.getState()
  const qr = ensureEntityQr({
    entityType: 'SUB_ASSEMBLY',
    entityId: woId,
    displayCode: saNo,
    status: 'IN_STOCK',
    metadata: {
      woId: wo.id,
      woNo: wo.woNo,
      productId: wo.productId,
      productCode: product?.productCode ?? wo.outputItemCode,
      itemCode: wo.outputItemCode,
      qty: wo.qty,
      stage: 'SA Receipt',
      parentEntityId: wo.parentWoId ?? undefined,
    },
    payload: { wo: wo.woNo, item: wo.outputItemCode },
  })
  store.recordEvent({
    qrId: qr.qrId,
    eventType: 'stored',
    referenceNo: wo.woNo,
    details: `Sub-assembly receipt for ${wo.outputItemCode}`,
    movementKind: 'QR_SA_RECEIPT',
  })
  if (wo.parentWoId) {
    const parentQr = store.getForEntity('WORK_ORDER', wo.parentWoId)[0]
    if (parentQr) store.linkGenealogy(parentQr.qrId, qr.qrId, 'wo-to-sa')
  }
  return qr
}

/** After FG receipt — finished trailer QR */
export function onFgReceiptPosted(woId: string): QrRecord | null {
  const wo = useWorkOrderStore.getState().getWorkOrder(woId)
  if (!wo) return null
  const master = useMasterStore.getState()
  const so = useMrpStore.getState().getSalesOrder(wo.salesOrderId)
  const customer = so ? master.customers.find((c) => c.id === so.customerId) : undefined
  const trailerNo = `TR-${new Date().getFullYear()}-${wo.woNo.replace('WO-', '')}`
  const chassisNo = `${trailerNo}-CH`
  const store = useQrStore.getState()

  const woQr = ensureEntityQr({
    entityType: 'WORK_ORDER',
    entityId: wo.id,
    displayCode: wo.woNo,
    status: 'IN_WIP',
    metadata: { woId: wo.id, woNo: wo.woNo, itemCode: wo.outputItemCode },
    payload: { wo: wo.woNo, item: wo.outputItemCode },
  })

  const qr = ensureEntityQr({
    entityType: 'FINISHED_TRAILER',
    entityId: woId,
    displayCode: trailerNo,
    status: 'IN_STOCK',
    metadata: {
      woId: wo.id,
      woNo: wo.woNo,
      itemCode: wo.outputItemCode,
      productCode: master.getProduct(wo.productId)?.productCode,
      trailerNo,
      chassisNo,
      customerId: customer?.id,
      customerName: customer?.customerName,
      qty: wo.qty,
    },
    payload: { wo: wo.woNo, item: wo.outputItemCode, trailer: trailerNo, chassis: chassisNo },
  })

  store.recordEvent({
    qrId: qr.qrId,
    eventType: 'stored',
    referenceNo: wo.woNo,
    details: `Finished trailer ${trailerNo}`,
  })
  store.linkGenealogy(woQr.qrId, qr.qrId, 'wo-to-trailer')
  onFgSerialsRegistered(woId, qr)
  return qr
}

/** Job work material send */
export function onJobWorkSent(input: {
  woId: string
  shipmentId: string
  challanNo: string
  vendorId: string
  itemCode: string
  qty: number
}): QrRecord {
  const wo = useWorkOrderStore.getState().getWorkOrder(input.woId)
  const vendor = useMasterStore.getState().getVendor(input.vendorId)
  const jwoNo = wo?.woNo ?? input.woId
  const store = useQrStore.getState()
  const qr = ensureEntityQr({
    entityType: 'JOB_WORK_ORDER',
    entityId: input.shipmentId,
    displayCode: `${jwoNo}-${input.challanNo}`,
    status: 'AT_VENDOR',
    metadata: {
      woId: input.woId,
      woNo: jwoNo,
      vendorId: input.vendorId,
      vendorName: vendor?.vendorName,
      shipmentId: input.shipmentId,
      challanNo: input.challanNo,
      itemCode: input.itemCode,
      qty: input.qty,
    },
    payload: { wo: jwoNo, vendor: vendor?.vendorCode, item: input.itemCode },
  })
  store.recordEvent({
    qrId: qr.qrId,
    eventType: 'subcontracted',
    referenceNo: input.challanNo,
    details: `Sent ${input.qty} × ${input.itemCode} to ${vendor?.vendorName ?? 'vendor'}`,
  })
  return qr
}

/** Job work receive status update */
export function onJobWorkReceived(shipmentId: string, receivedQty: number, rejectedQty: number): void {
  const qr = useQrStore.getState().getForEntity('JOB_WORK_ORDER', shipmentId)[0]
  if (!qr) return
  const store = useQrStore.getState()
  const shipment = useWorkOrderStore.getState().subcontractShipments.find((s) => s.id === shipmentId)
  let status: typeof qr.status = 'IN_STOCK'
  if (rejectedQty > 0 && receivedQty === 0) status = 'REJECTED'
  else if (shipment && shipment.receivedQty < shipment.sentQty) status = 'IN_WIP'
  else status = 'QC_PASSED'
  store.updateStatus(qr.qrId, status)
  store.recordEvent({
    qrId: qr.qrId,
    eventType: 'received',
    referenceNo: qr.metadata.challanNo ?? shipmentId,
    details: `Received ${receivedQty}, rejected ${rejectedQty}`,
  })
}

/** Dispatch plan created */
export function onDispatchPlanCreated(dispatchId: string): QrRecord | null {
  const plan = useDispatchStore.getState().getDispatch(dispatchId)
  if (!plan) return null
  const line = plan.lines[0]
  const store = useQrStore.getState()
  const trailerQr = line?.workOrderId
    ? store.getForEntity('FINISHED_TRAILER', line.workOrderId)[0]
    : undefined
  const qr = ensureEntityQr({
    entityType: 'DISPATCH',
    entityId: dispatchId,
    displayCode: plan.dispatchNo,
    status: 'CREATED',
    metadata: {
      dispatchId: plan.id,
      dispatchNo: plan.dispatchNo,
      customerId: plan.customerId,
      customerName: plan.customerName,
      woId: line?.workOrderId ?? undefined,
      trailerNo: line?.trailerNo,
      chassisNo: line?.chassisNo,
      parentQrId: trailerQr?.qrId,
    },
    payload: { wo: plan.dispatchNo, trailer: line?.trailerNo },
  })
  if (trailerQr) store.linkGenealogy(trailerQr.qrId, qr.qrId, 'trailer-to-dispatch')
  return qr
}

export function ensureJobCardQr(jobCardId: string): QrRecord | null {
  const jc = useWorkOrderStore.getState().jobCards.find((j) => j.id === jobCardId)
  if (!jc) return null
  return ensureEntityQr({
    entityType: 'JOB_CARD',
    entityId: jobCardId,
    displayCode: jc.jobCardNo,
    status: jc.status === 'completed' ? 'CONSUMED' : jc.status === 'in_progress' ? 'IN_WIP' : 'CREATED',
    metadata: {
      jobCardId: jc.id,
      jobCardNo: jc.jobCardNo,
      woId: jc.workOrderId,
      woNo: jc.woNo,
      stage: jc.operationName,
    },
    payload: { wo: jc.woNo, item: jc.jobCardNo },
  })
}

export function ensureWorkOrderQr(woId: string): QrRecord | null {
  const wo = useWorkOrderStore.getState().getWorkOrder(woId)
  if (!wo) return null
  return ensureEntityQr({
    entityType: 'WORK_ORDER',
    entityId: woId,
    displayCode: wo.woNo,
    status: 'IN_WIP',
    metadata: { woId: wo.id, woNo: wo.woNo, itemCode: wo.outputItemCode },
    payload: { wo: wo.woNo, item: wo.outputItemCode },
  })
}

export function onQcFailed(qrId: string, ncrId: string): void {
  const store = useQrStore.getState()
  store.updateStatus(qrId, 'QC_HOLD')
  store.recordEvent({
    qrId,
    eventType: 'inspected',
    referenceNo: ncrId,
    details: 'QC failed — NCR raised',
  })
}

export function onQcPassed(qrId: string, inspectionNo: string): void {
  const store = useQrStore.getState()
  store.updateStatus(qrId, 'QC_PASSED')
  store.recordEvent({
    qrId,
    eventType: 'inspected',
    referenceNo: inspectionNo,
    details: 'QC passed',
  })
}

/** Sync QR status after QC decision — does not alter inspection flow */
export function syncQrFromInspection(
  inspection: {
    category: string
    inspectionNo: string
    workOrderId?: string | null
    jobCardId?: string | null
    grnId?: string | null
    subcontractShipmentId?: string | null
  },
  result: 'pass' | 'reject' | 'rework',
  referenceNo?: string,
): void {
  const store = useQrStore.getState()
  let qr: QrRecord | undefined

  if (inspection.category === 'final' && inspection.workOrderId) {
    qr = store.getForEntity('FINISHED_TRAILER', inspection.workOrderId)[0]
    if (!qr) qr = store.getForEntity('WORK_ORDER', inspection.workOrderId)[0]
  } else if (inspection.subcontractShipmentId) {
    qr = store.getForEntity('JOB_WORK_ORDER', inspection.subcontractShipmentId)[0]
  } else if (inspection.grnId) {
    qr = store.records.find(
      (r) => r.entityType === 'MATERIAL_LOT' && r.metadata.grnId === inspection.grnId,
    )
  } else if (inspection.jobCardId) {
    qr = store.getForEntity('JOB_CARD', inspection.jobCardId)[0]
  } else if (inspection.workOrderId) {
    qr = store.getForEntity('WORK_ORDER', inspection.workOrderId)[0]
  }

  if (!qr) return
  if (result === 'pass') onQcPassed(qr.qrId, inspection.inspectionNo)
  else if (result === 'reject') onQcFailed(qr.qrId, referenceNo ?? inspection.inspectionNo)
  else store.updateStatus(qr.qrId, 'QC_HOLD')
}
