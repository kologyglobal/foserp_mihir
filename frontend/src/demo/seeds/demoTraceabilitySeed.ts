import { useQrStore } from '../../store/qrStore'
import { useSerialStore } from '../../store/serialStore'
import { useBarcodeStore } from '../../store/barcodeStore'
import { useMasterStore } from '../../store/masterStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useDispatchStore } from '../../store/dispatchStore'
import { SATURATION_TARGETS } from './demoSeedCatalog'

/** Register QR, serial, and barcode records linked to real entities */
export function seedDemoTraceability(): void {
  const qr = useQrStore.getState()
  const serial = useSerialStore.getState()
  const barcode = useBarcodeStore.getState()
  const master = useMasterStore.getState()

  for (const wo of useWorkOrderStore.getState().workOrders) {
    if (qr.records.length >= SATURATION_TARGETS.qrCodes) break
    if (qr.records.some((r) => r.entityType === 'WORK_ORDER' && r.entityId === wo.id)) continue
    qr.registerQr({
      entityType: 'WORK_ORDER',
      entityId: wo.id,
      displayCode: wo.woNo,
      payload: { wo: wo.woNo },
      metadata: { woId: wo.id },
    })
  }

  for (const jc of useWorkOrderStore.getState().jobCards) {
    if (qr.records.length >= SATURATION_TARGETS.qrCodes) break
    if (qr.records.some((r) => r.entityType === 'JOB_CARD' && r.entityId === jc.id)) continue
    qr.registerQr({
      entityType: 'JOB_CARD',
      entityId: jc.id,
      displayCode: jc.jobCardNo,
      payload: { wo: jc.jobCardNo },
      metadata: { jobCardId: jc.id },
    })
  }

  for (const grn of usePurchaseStore.getState().grns) {
    if (qr.records.length >= SATURATION_TARGETS.qrCodes) break
    if (qr.records.some((r) => r.entityType === 'MATERIAL_LOT' && r.entityId === grn.id)) continue
    qr.registerQr({
      entityType: 'MATERIAL_LOT',
      entityId: grn.id,
      displayCode: grn.grnNo,
      payload: { grn: grn.grnNo },
      metadata: { grnId: grn.id },
    })
  }

  for (const dsp of useDispatchStore.getState().dispatches) {
    if (qr.records.length >= SATURATION_TARGETS.qrCodes) break
    if (qr.records.some((r) => r.entityType === 'DISPATCH' && r.entityId === dsp.id)) continue
    qr.registerQr({
      entityType: 'DISPATCH',
      entityId: dsp.id,
      displayCode: dsp.dispatchNo,
      payload: { trailer: dsp.dispatchNo },
      metadata: { dispatchId: dsp.id },
    })
  }

  const stockItems = master.items.filter((i) => i.isStockable)
  for (let s = serial.serials.length; s < SATURATION_TARGETS.serialNumbers; s++) {
    const item = stockItems[s % stockItems.length]
    const serialNo = `SAT-SN-${String(s + 1).padStart(4, '0')}`
    if (!serial.serials.some((x) => x.serialNo === serialNo)) {
      serial.registerSerial({
        itemId: item.id,
        serialNo,
        serialType: item.itemType === 'finished_good' ? 'finished_trailer' : 'sub_assembly',
      })
    }
  }

  for (let b = barcode.barcodes.length; b < SATURATION_TARGETS.barcodes; b++) {
    const item = stockItems[b % stockItems.length]
    if (barcode.barcodes.filter((x) => x.entityId === item.id).length >= 3) continue
    barcode.generateBarcode({
      entityType: 'item',
      entityId: item.id,
      entityLabel: item.itemName,
    })
  }
}
