/**
 * QR workflow wrappers — call existing ERP stores, then register QR side-effects.
 * Does not modify core store logic.
 */
import { usePurchaseStore } from '../store/purchaseStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useJobWorkExecutionStore } from '../store/jobWorkExecutionStore'
import {
  onDispatchPlanCreated,
  onFgReceiptPosted,
  onGrnPosted,
  onJobWorkReceived,
  onJobWorkSent,
  onSaReceiptPosted,
} from './qrIntegration'
import { qrConfirmDispatch, qrValidateDispatchReady } from './qrEngine'

export function workflowPostGrn(
  poId: string,
  receiptLines: { poLineId: string; receivedQty: number; acceptedQty?: number; rejectedQty?: number }[],
) {
  const r = usePurchaseStore.getState().postGrn(poId, receiptLines)
  if (r.ok && r.grnId) {
    const qrs = onGrnPosted(r.grnId)
    return { ...r, qrCount: qrs.length }
  }
  return r
}

export function workflowPostSaReceipt(woId: string, qty?: number) {
  const r = useWorkOrderStore.getState().postSaReceipt(woId, qty)
  if (r.ok) onSaReceiptPosted(woId, r.receiptId)
  return r
}

export function workflowPostFgReceipt(woId: string, qty?: number) {
  const r = useWorkOrderStore.getState().postFgReceipt(woId, qty)
  if (r.ok) onFgReceiptPosted(woId)
  return r
}

export function workflowCreateDispatchPlan(
  candidate: Parameters<ReturnType<typeof useDispatchStore.getState>['createDispatchPlan']>[0],
  plannedDate?: string,
) {
  const r = useDispatchStore.getState().createDispatchPlan(candidate, plannedDate)
  if (r.ok && r.id) onDispatchPlanCreated(r.id)
  return r
}

export function workflowConfirmDispatch(dispatchId: string, trailerQrScan?: string) {
  const gate = qrValidateDispatchReady(dispatchId)
  if (!gate.ok) return gate
  if (!trailerQrScan?.trim()) {
    return { ok: false, error: 'Finished trailer QR scan required before dispatch confirmation' }
  }
  return qrConfirmDispatch({ scan: trailerQrScan, dispatchId })
}

export function workflowSendJobWork(input: Parameters<ReturnType<typeof useJobWorkExecutionStore.getState>['sendJobWorkMaterial']>[0]) {
  const r = useJobWorkExecutionStore.getState().sendJobWorkMaterial(input)
  if (r.ok && r.shipmentId) {
    const line = useWorkOrderStore.getState().getWoMaterials(input.woId).find((l) => l.id === input.lineId)
    onJobWorkSent({
      woId: input.woId,
      shipmentId: r.shipmentId,
      challanNo: input.challanNo,
      vendorId: input.vendorId,
      itemCode: line?.itemCode ?? '',
      qty: input.qty,
    })
  }
  return r
}

export function workflowReceiveJobWork(
  input: Parameters<ReturnType<typeof useJobWorkExecutionStore.getState>['receiveJobWorkMaterial']>[0],
) {
  const r = useJobWorkExecutionStore.getState().receiveJobWorkMaterial(input)
  if (r.ok) onJobWorkReceived(input.shipmentId, input.acceptedQty, input.rejectedQty)
  return r
}
