import { usePurchaseStore } from '../../store/purchaseStore'
import { useMasterStore } from '../../store/masterStore'
import { SATURATION_TARGETS } from './demoSeedCatalog'

function deliveryOffset(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Top up manual PRs until saturation target */
export function seedDemoPurchaseRequisitions(): void {
  const master = useMasterStore.getState()
  const purchasable = master.items.filter((i) => i.isPurchasable && i.isActive)
  const warehouse = master.warehouses.find((w) => w.isActive && w.warehouseType === 'main')?.id ?? 'wh-rm-main'
  while (usePurchaseStore.getState().requisitions.length < SATURATION_TARGETS.purchaseRequisitions) {
    const n = usePurchaseStore.getState().requisitions.length
    const item = purchasable[n % purchasable.length]
    if (!item) break
    const result = usePurchaseStore.getState().createManualPr({
      source: 'manual',
      purpose: 'maintenance_parts',
      lines: [
        {
          itemId: item.id,
          warehouseId: warehouse,
          qty: 10 + (n % 15),
          requiredDate: deliveryOffset(7 + (n % 14)),
          salesOrderId: null,
          workOrderId: null,
          remarks: `Saturation line for ${item.itemCode}`,
        },
      ],
    })
    if (!result.ok) break
    const prId = result.prId!
    if (n % 3 === 0) {
      usePurchaseStore.getState().submitPr(prId)
      if (n % 2 === 0) usePurchaseStore.getState().approvePr(prId)
    }
  }
}

/** Seed RFQs, vendor quotes, POs, GRNs from approved PRs */
export function seedDemoPurchasePipeline(): void {
  const vendors = useMasterStore.getState().vendors.filter((v) => v.isActive)
  if (vendors.length < 2) return

  const approvedPrs = usePurchaseStore.getState().requisitions.filter((p) => p.status === 'approved').slice(0, 15)
  for (const pr of approvedPrs) {
    const store = usePurchaseStore.getState()
    if (store.rfqs.filter((r) => r.prId === pr.id).length > 0) continue
    if (store.rfqs.length >= SATURATION_TARGETS.rfqs) break
    const rfq = usePurchaseStore.getState().createRfqFromPr(pr.id, [vendors[0]!.id, vendors[1]!.id])
    if (!rfq.ok || !rfq.rfqId) continue
    usePurchaseStore.getState().sendRfq(rfq.rfqId)
    const rfqDoc = usePurchaseStore.getState().getRfq(rfq.rfqId)!
    for (const line of rfqDoc.lines.slice(0, 2)) {
      usePurchaseStore.getState().addRfqQuote(rfq.rfqId, vendors[0]!.id, line.itemId, { rate: 100 + Math.random() * 50, leadTimeDays: 7, freightAmount: 500, gstPct: 18 })
      usePurchaseStore.getState().addRfqQuote(rfq.rfqId, vendors[1]!.id, line.itemId, { rate: 110 + Math.random() * 40, leadTimeDays: 5, freightAmount: 300, gstPct: 18 })
    }
    if (usePurchaseStore.getState().purchaseOrders.length < SATURATION_TARGETS.purchaseOrders) {
      const po = usePurchaseStore.getState().createPoFromRfq(rfq.rfqId, vendors[0]!.id)
      if (po.ok && po.poId) {
        usePurchaseStore.getState().submitPo(po.poId)
        usePurchaseStore.getState().approvePo(po.poId)
        usePurchaseStore.getState().sendPo(po.poId)
      }
    }
  }

  const sentPos = usePurchaseStore.getState().purchaseOrders.filter((p) => ['sent', 'partial'].includes(p.status))
  for (const po of sentPos.slice(0, 20)) {
    if (usePurchaseStore.getState().grns.some((g) => g.poId === po.id)) continue
    if (usePurchaseStore.getState().grns.length >= SATURATION_TARGETS.grns) break
    const line = po.lines[0]
    if (!line) continue
    usePurchaseStore.getState().postGrn(po.id, [{ poLineId: line.id, receivedQty: Math.min(line.qty, line.qty - line.receivedQty) || line.qty }])
  }
}
