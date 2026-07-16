import { useMrpStore } from '../../store/mrpStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useDispatchStore } from '../../store/dispatchStore'
import { useEcoStore } from '../../store/ecoStore'
import { useSerialStore } from '../../store/serialStore'
import { useQrStore } from '../../store/qrStore'
import { useMasterStore } from '../../store/masterStore'

/** Run additional demo scenarios after ABC Cement closed-loop (Scenario 1). */
export function runDemoScenarioExtensions(): { warnings: string[] } {
  const warnings: string[] = []

  const so2 = useMrpStore.getState().salesOrders.find((s) => s.salesOrderNo === 'SO-2026-0002')
  if (so2) {
    useMrpStore.getState().confirmSalesOrder(so2.id)
    const mrp2 = useMrpStore.getState().runMrpForOrder(so2.id, undefined, { autoReserve: false })
    if (mrp2.ok && mrp2.runId) {
      const wo2 = useWorkOrderStore.getState().createFromMrpRun(mrp2.runId, so2.id)
      if (wo2.ok) {
        const wo = useWorkOrderStore.getState().workOrders.find((w) => w.salesOrderId === so2.id)
        if (wo) {
          useWorkOrderStore.getState().planWorkOrder(wo.id)
          useWorkOrderStore.getState().releaseWorkOrder(wo.id)
          useWorkOrderStore.getState().startProduction(wo.id)
        }
      }
    } else if (mrp2.error) warnings.push(`Scenario 2: ${mrp2.error}`)
  }

  const so3 = useMrpStore.getState().salesOrders.find((s) => s.salesOrderNo === 'SO-2026-0003')
  if (so3) {
    useMrpStore.getState().confirmSalesOrder(so3.id)
    const mrp3 = useMrpStore.getState().runMrpForOrder(so3.id)
    if (mrp3.ok) {
      const pr = usePurchaseStore.getState().requisitions.find((p) => p.salesOrderId === so3.id)
      if (pr) {
        usePurchaseStore.getState().submitPr(pr.id)
        usePurchaseStore.getState().approvePr(pr.id)
      }
    }
  }

  const so5 = useMrpStore.getState().salesOrders.find((s) => s.salesOrderNo === 'SO-2026-0005')
  if (so5) {
    useMrpStore.getState().confirmSalesOrder(so5.id)
    const mrp5 = useMrpStore.getState().runMrpForOrder(so5.id)
    if (mrp5.ok && mrp5.runId) {
      useWorkOrderStore.getState().createFromMrpRun(mrp5.runId, so5.id)
      const paintWo = useWorkOrderStore.getState().workOrders.find(
        (w) => w.salesOrderId === so5.id && w.woType === 'subcontract',
      )
      if (paintWo) {
        useWorkOrderStore.getState().planWorkOrder(paintWo.id)
        useWorkOrderStore.getState().releaseWorkOrder(paintWo.id)
        const line = useWorkOrderStore.getState().getWoMaterials(paintWo.id)[0]
        const vendor = useMasterStore.getState().vendors.find((v) => v.id === 'vend-bharat-paints') ?? useMasterStore.getState().vendors[0]
        if (line && vendor) {
          useWorkOrderStore.getState().sendSubcontractMaterial(
            paintWo.id,
            line.id,
            vendor.id,
            'JW-DEMO-001',
            Math.max(1, line.requiredQty * 0.5),
            '2026-07-15',
          )
        }
      }
    }
  }

  const so4 = useMrpStore.getState().salesOrders.find((s) => s.salesOrderNo === 'SO-2026-0004')
  if (so4) {
    const candidates = useDispatchStore.getState().getReadyCandidates()
    const patelCandidate = candidates.find((c) => c.salesOrderId === so4.id) ?? candidates[0]
    if (patelCandidate) {
      const dsp = useDispatchStore.getState().createDispatchPlan(patelCandidate)
      if (dsp.ok && dsp.id) {
        useDispatchStore.getState().updateLogistics(dsp.id, {
          vehicleNo: 'GJ-01-AB-1234',
          lrNo: 'LR-PATEL-001',
          transporter: 'Patel Logistics',
          driverName: 'Hitesh Patel',
          driverPhone: '9876543210',
        })
        useDispatchStore.getState().markLoading(dsp.id)
      }
    }
  }

  seedDemoEcoRecords()
  seedDemoSerialRecords()
  seedDemoQrRecords()

  return { warnings }
}

function seedDemoEcoRecords() {
  const eco = useEcoStore.getState()
  const products = useMasterStore.getState().products.slice(0, 5)
  for (let i = 0; i < 10; i++) {
    const product = products[i % products.length]
    const ecr = eco.createEcr({
      changeType: i % 2 === 0 ? 'bom' : 'routing',
      productId: product.id,
      reason: `Demo ECR ${i + 1} — ${product.productName} design change`,
      priority: i % 3 === 0 ? 'high' : 'medium',
    })
    if (ecr.ok && ecr.ecrId) {
      eco.submitEcr(ecr.ecrId)
      eco.startEngineeringReview(ecr.ecrId, 'Demo engineering review')
      eco.completeImpactAnalysis(ecr.ecrId)
      eco.approveEcrForEco(ecr.ecrId)
    }
  }
}

function seedDemoSerialRecords() {
  const serial = useSerialStore.getState()
  const wo = useWorkOrderStore.getState().workOrders[0]
  const rows = [
    { itemId: 'item-fg-bulker', serialType: 'finished_trailer' as const, serialNo: 'TRL-DEMO-0001' },
    { itemId: 'item-sa-chassis', serialType: 'chassis' as const, serialNo: 'CHS-DEMO-0001' },
    { itemId: 'item-sa-tank-asm', serialType: 'tank' as const, serialNo: 'TNK-DEMO-0001' },
    { itemId: 'item-bo-axl', serialType: 'axle' as const, serialNo: 'AXL-DEMO-0001' },
    { itemId: 'item-bo-abs-kit', serialType: 'abs_ebs_kit' as const, serialNo: 'ABS-DEMO-0001' },
    { itemId: 'item-bo-tyre', serialType: 'tyre' as const, serialNo: 'TYR-DEMO-0001' },
    { itemId: 'item-bo-compressor', serialType: 'compressor' as const, serialNo: 'CMP-DEMO-0001' },
  ]
  for (const row of rows) {
    serial.registerSerial({
      itemId: row.itemId,
      serialNo: row.serialNo,
      serialType: row.serialType,
      customerId: 'cust-abc',
      workOrderId: wo?.id,
    })
  }
}

function seedDemoQrRecords() {
  const qr = useQrStore.getState()
  const wo = useWorkOrderStore.getState().workOrders[0]
  if (wo) {
    qr.registerQr({
      entityType: 'WORK_ORDER',
      entityId: wo.id,
      displayCode: wo.woNo,
      payload: { wo: wo.woNo },
      metadata: { woId: wo.id, woNo: wo.woNo },
    })
  }
  const grn = usePurchaseStore.getState().grns[0]
  if (grn) {
    qr.registerQr({
      entityType: 'MATERIAL_LOT',
      entityId: grn.id,
      displayCode: grn.grnNo,
      payload: { grn: grn.grnNo },
      metadata: { grnId: grn.id },
    })
  }
}
