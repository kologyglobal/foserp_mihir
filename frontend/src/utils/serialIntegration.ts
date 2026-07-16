/** Serial registry side-effects — called from QR workflow without changing core store logic */
import { useSerialStore } from '../store/serialStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useMrpStore } from '../store/mrpStore'
import { useMasterStore } from '../store/masterStore'
import type { QrRecord } from '../types/qrTraceability'

export function onGrnSerialsRegistered(grnId: string): string[] {
  return useSerialStore.getState().registerGrnLineSerials(grnId).serialIds
}

export function onFgSerialsRegistered(woId: string, qr: QrRecord | null): { ok: boolean; error?: string } {
  const wo = useWorkOrderStore.getState().getWorkOrder(woId)
  if (!wo) return { ok: false, error: 'Work order not found' }
  const master = useMasterStore.getState()
  const so = useMrpStore.getState().getSalesOrder(wo.salesOrderId)
  const customer = so ? master.customers.find((c) => c.id === so.customerId) : undefined
  const trailerNo = (qr?.metadata.trailerNo as string) ?? `TR-${new Date().getFullYear()}-${wo.woNo.replace('WO-', '')}`
  const chassisNo = (qr?.metadata.chassisNo as string) ?? `${trailerNo}-CH`

  return useSerialStore.getState().registerFgTrailer({
    trailerNo,
    chassisNo,
    workOrderId: wo.id,
    woNo: wo.woNo,
    salesOrderId: so?.id ?? null,
    salesOrderNo: so?.salesOrderNo ?? null,
    customerId: customer?.id ?? null,
    customerName: customer?.customerName ?? null,
    qrCode: qr?.qrCode ?? null,
  })
}

export function onDispatchSerialsConfirmed(trailerNo: string, chassisNo: string): void {
  useSerialStore.getState().markDispatched(trailerNo, chassisNo)
}
