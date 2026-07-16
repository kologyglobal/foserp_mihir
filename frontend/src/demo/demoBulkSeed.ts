/**
 * Expands demo dataset to 10–15 records per major module using store APIs only.
 */
import { buildEmptyParameterResults } from '../utils/qcPlanResolver'
import type { QcParameterResult } from '../types/qcParameters'
import { useMasterStore } from '../store/masterStore'
import { useMrpStore } from '../store/mrpStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { usePurchaseStore } from '../store/purchaseStore'
import { useQualityStore } from '../store/qualityStore'
import { useInventoryStore } from '../store/inventoryStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useInvoiceStore } from '../store/invoiceStore'
import { useEcoStore } from '../store/ecoStore'
import { useDmsStore } from '../store/dmsStore'
import { useQrStore } from '../store/qrStore'
import { useSerialStore } from '../store/serialStore'
import { ensureDemoBomRoutingForProducts } from './demoBomRoutingClone'
import { SATURATION_TARGETS } from './seeds/demoSeedCatalog'

function fillQcParams(results: QcParameterResult[], pass = true) {
  return results.map((r) =>
    r.parameterType === 'boolean'
      ? { ...r, actualValue: r.passFailRule === 'boolean_false' ? !pass : pass }
      : r.parameterType === 'photo_required'
        ? { ...r, attachmentRef: pass ? 'photo-ref.jpg' : '', actualValue: pass ? 'photo-ref.jpg' : '' }
        : r.parameterType === 'numeric' && r.minValue != null
          ? { ...r, actualValue: r.targetValue ?? r.minValue }
          : r.parameterType === 'text'
            ? { ...r, actualValue: pass ? 'OK' : '' }
            : r.parameterType === 'dropdown'
              ? { ...r, actualValue: pass ? (r.dropdownOptions?.[0] ?? 'Acceptable') : 'Reject' }
              : r,
  )
}

function qcParamsForInspection(inspectionId: string, pass = true) {
  const insp = useQualityStore.getState().getInspection(inspectionId)
  if (!insp) return undefined
  const base = insp.parameterResults.length > 0 ? insp.parameterResults : buildEmptyParameterResults(insp.parameterSnapshot)
  return base.length > 0 ? fillQcParams(base, pass) : undefined
}

function recordQcPass(inspectionId: string, inspector: string, remarks: string) {
  const params = qcParamsForInspection(inspectionId, true)
  return useQualityStore.getState().recordInspectionDecision(inspectionId, {
    inspector,
    result: 'pass',
    remarks,
    parameterResults: params,
    useAutoDecision: !!params?.length,
  })
}

function recordIncomingPass(inspectionId: string, inspector: string, remarks: string, acceptedQty: number) {
  const params = qcParamsForInspection(inspectionId, true)
  return useQualityStore.getState().recordIncomingQcDecision(inspectionId, {
    inspector,
    result: 'pass',
    remarks,
    acceptedQty,
    rejectedQty: 0,
    parameterResults: params,
    useAutoDecision: !!params?.length,
  })
}

function ensureStock(itemId: string, warehouseId: string, qty: number, ref: string) {
  const inv = useInventoryStore.getState()
  const free = inv.getFreeQty(itemId, warehouseId)
  if (free < qty) {
    inv.postInward({
      itemId,
      warehouseId,
      qty: qty - free + 5,
      referenceNo: ref,
      remarks: 'Demo bulk seed top-up',
    })
  }
}

function createPosFromPr(prId: string): string[] {
  const pr = usePurchaseStore.getState().getPr(prId)!
  const master = useMasterStore.getState()
  const vendorLines = new Map<string, string[]>()
  for (const line of pr.lines) {
    const maps = master.getVendorMapsForItem(line.itemId)
    const vendorId = maps.find((m) => m.isPreferred)?.vendorId ?? maps[0]?.vendorId ?? master.vendors[0]?.id
    if (!vendorId) continue
    const list = vendorLines.get(vendorId) ?? []
    list.push(line.id)
    vendorLines.set(vendorId, list)
  }
  const poIds: string[] = []
  for (const [vendorId, lineIds] of vendorLines) {
    const r = usePurchaseStore.getState().createPoFromPr(prId, vendorId, lineIds)
    if (!r.ok || !r.poId) continue
    usePurchaseStore.getState().submitPo(r.poId)
    usePurchaseStore.getState().approvePo(r.poId)
    usePurchaseStore.getState().sendPo(r.poId)
    poIds.push(r.poId)
  }
  return poIds
}

function postFullGrn(poId: string) {
  const po = usePurchaseStore.getState().getPo(poId)!
  const lines = po.lines.map((l) => ({ poLineId: l.id, receivedQty: l.qty - l.receivedQty }))
  const r = usePurchaseStore.getState().postGrn(poId, lines)
  if (!r.ok || !r.grnId) return
  const grn = usePurchaseStore.getState().getGrn(r.grnId)!
  if (grn.qcRequired && grn.incomingInspectionId) {
    const totalReceived = grn.lines.reduce((s, l) => s + l.receivedQty, 0)
    recordIncomingPass(grn.incomingInspectionId, 'QC Incoming Desk', 'Demo bulk GRN accepted', totalReceived)
  }
}

function completeSaWoSimple(woId: string) {
  const ws = useWorkOrderStore.getState()
  const qs = useQualityStore.getState()
  for (const op of ws.getProductionOperations(woId).filter((o) => !o.outsourced)) {
    const jc = ws.getJobCards(woId).find((j) => j.productionOperationId === op.id)
    if (!jc) continue
    ws.startJobCard(jc.id, { assignedTeam: 'Demo Crew', startTime: '08:00' })
    ws.completeJobCard(jc.id, {
      endTime: '16:00',
      actualHours: op.standardHours || 5,
      remarks: 'Demo bulk completion',
      qcChecks: jc.qcChecks.map((c) => ({ ...c, passed: true })),
    })
    if (op.qcRequired) {
      const insp = qs.getPendingInspections().find((i) => i.productionOperationId === op.id && i.status === 'pending')
      if (insp) recordQcPass(insp.id, 'Pradeep Singh', 'OK')
    }
  }
}

function processManufacturedSaWo(woId: string) {
  const ws = useWorkOrderStore.getState()
  const wo = ws.getWorkOrder(woId)
  if (!wo || wo.status === 'closed' || wo.status === 'completed') return
  ws.planWorkOrder(woId)
  ws.releaseWorkOrder(woId)
  for (const line of ws.getWoMaterials(woId)) {
    ensureStock(line.itemId, line.warehouseId, line.requiredQty, `BULK-${wo.woNo}`)
  }
  ws.reserveMaterials(woId)
  ws.issueAllReserved(woId)
  ws.startProduction(woId)
  completeSaWoSimple(woId)
  const complete = ws.completeWorkOrder(woId)
  if (!complete.ok) return
  ws.postSaReceipt(woId)
}

export function processFgWoToDispatchReady(fgWoId: string) {
  const ws = useWorkOrderStore.getState()
  const fgWo = ws.getWorkOrder(fgWoId)
  if (!fgWo || fgWo.woType !== 'finished_goods') return
  if (['fg_received', 'closed'].includes(fgWo.status)) return

  const childWos = ws.workOrders.filter(
    (w) => w.salesOrderId === fgWo.salesOrderId && w.id !== fgWoId && w.woType !== 'finished_goods',
  )
  for (const child of childWos) {
    if (child.woType === 'subcontract') {
      ws.planWorkOrder(child.id)
      ws.releaseWorkOrder(child.id)
      const line = ws.getWoMaterials(child.id)[0]
      if (line) {
        ensureStock(line.itemId, line.warehouseId, line.requiredQty, `SUB-${child.woNo}`)
        ws.reserveMaterials(child.id)
        ws.issueAllReserved(child.id)
        const vendor = useMasterStore.getState().vendors.find((v) => v.isActive)!
        ws.sendSubcontractMaterial(child.id, line.id, vendor.id, `JW-BULK-${child.woNo}`, line.requiredQty, '2026-07-20')
        const shipment = ws.getSubcontractShipments(child.id)[0]
        if (shipment) ws.receiveSubcontractMaterial(shipment.id, line.requiredQty, 0)
      }
    } else {
      processManufacturedSaWo(child.id)
    }
  }

  for (const line of ws.getWoMaterials(fgWoId)) {
    ensureStock(line.itemId, line.warehouseId, line.requiredQty, `FG-${fgWo.woNo}`)
  }
  ws.planWorkOrder(fgWoId)
  ws.releaseWorkOrder(fgWoId)
  ws.reserveMaterials(fgWoId)
  ws.issueAllReserved(fgWoId)
  ws.startProduction(fgWoId)
  completeSaWoSimple(fgWoId)
  const complete = ws.completeWorkOrder(fgWoId)
  if (!complete.ok) return
  const fgReceipt = ws.postFgReceipt(fgWoId)
  if (!fgReceipt.ok) return

  ensureFinalQcForFgWo(fgWoId)
}

function ensureAllPosReceived() {
  const ps = usePurchaseStore.getState()
  for (const po of ps.purchaseOrders) {
    if (po.status === 'draft') {
      ps.submitPo(po.id)
      ps.approvePo(po.id)
      ps.sendPo(po.id)
    } else if (po.status === 'submitted') {
      ps.approvePo(po.id)
      ps.sendPo(po.id)
    } else if (po.status === 'approved') {
      ps.sendPo(po.id)
    }
  }
  postAllPendingGrns()
}

function postAllPendingGrns() {
  for (const po of usePurchaseStore.getState().purchaseOrders) {
    const openLines = po.lines.filter((l) => l.receivedQty < l.qty)
    if (openLines.length === 0) continue
    const lines = openLines.map((l) => ({ poLineId: l.id, receivedQty: l.qty - l.receivedQty }))
    const r = usePurchaseStore.getState().postGrn(po.id, lines)
    if (!r.ok || !r.grnId) continue
    const grn = usePurchaseStore.getState().getGrn(r.grnId)!
    if (grn.qcRequired && grn.incomingInspectionId) {
      const totalReceived = grn.lines.reduce((s, l) => s + l.receivedQty, 0)
      recordIncomingPass(grn.incomingInspectionId, 'QC Incoming Desk', 'Demo bulk GRN accepted', totalReceived)
    }
  }
}

export function createDispatchInvoicePayment(fgWoId: string, idx: number) {
  const candidates = useDispatchStore.getState().getReadyCandidates()
  const candidate = candidates.find((c) => c.workOrderId === fgWoId)
  if (!candidate) return

  const dsp = useDispatchStore.getState().createDispatchPlan(candidate)
  if (!dsp.ok || !dsp.id) return
  const dispatchId = dsp.id

  useDispatchStore.getState().updateLogistics(dispatchId, {
    vehicleNo: `GJ-01-DM-${1000 + idx}`,
    lrNo: `LR-DEMO-${1000 + idx}`,
    transporter: 'Demo Transporters',
    driverName: `Driver ${idx}`,
    driverPhone: `98765${String(10000 + idx).slice(-5)}`,
  })
  useDispatchStore.getState().markLoading(dispatchId)
  for (const item of useDispatchStore.getState().getDispatch(dispatchId)!.checklist) {
    if (!item.systemGate) useDispatchStore.getState().toggleChecklistItem(dispatchId, item.id, true)
  }
  useDispatchStore.getState().addPhoto(dispatchId, 'Loading — demo', 'data:image/png;base64,iVBORw0KGgo=')
  useDispatchStore.getState().approveSecurityGate(dispatchId)
  useDispatchStore.getState().confirmDispatch(dispatchId)
  useDispatchStore.getState().markInTransit(dispatchId)
  useDispatchStore.getState().recordCustomerAck(dispatchId, {
    acknowledgedBy: 'Site Manager',
    designation: 'Plant',
    ackDate: new Date().toISOString().slice(0, 10),
    remarks: 'Received OK',
    signatureDataUrl: null,
    photoDataUrl: null,
  })

  const invCreate = useInvoiceStore.getState().createFromDispatch(dispatchId)
  if (!invCreate.ok || !invCreate.id) return
  useInvoiceStore.getState().postInvoice(invCreate.id)
  const invoice = useInvoiceStore.getState().getInvoice(invCreate.id)!
  useInvoiceStore.getState().recordPayment(invCreate.id, {
    amount: invoice.gst.grandTotal,
    paymentDate: new Date().toISOString().slice(0, 10),
    referenceNo: `UTR-DEMO-${1000 + idx}`,
    mode: 'neft',
    remarks: 'Demo payment',
  })
}

function expandMrpPurchaseAndProduction() {
  const mrp = useMrpStore.getState()
  const master = useMasterStore.getState()
  const vendorIds = master.vendors.slice(0, 5).map((v) => v.id)

  const eligibleSos = mrp.salesOrders.filter(
    (s) => s.salesOrderNo !== 'SO-0001' && !['closed', 'cancelled'].includes(s.status),
  )

  for (const so of eligibleSos) {
    if (so.status === 'open') mrp.confirmSalesOrder(so.id)
    let run = mrp.runs.find((r) => r.salesOrderIds.includes(so.id))
    if (!run) {
      const mrpRes = mrp.runMrpForOrder(so.id, undefined, { autoReserve: false })
      if (mrpRes.ok && mrpRes.runId) run = mrp.getRun(mrpRes.runId)
    }
    if (!run) continue

    const pr = usePurchaseStore.getState().requisitions.find((p) => p.mrpRunId === run!.id)
    if (pr) {
      if (pr.status === 'draft') {
        usePurchaseStore.getState().submitPr(pr.id)
        usePurchaseStore.getState().approvePr(pr.id)
      }
      const hasRfq = usePurchaseStore.getState().rfqs.some((r) => r.prId === pr.id)
      if (!hasRfq && vendorIds.length > 0) {
        usePurchaseStore.getState().createRfqFromPr(pr.id, vendorIds.slice(0, 3))
      }
      const existingPos = usePurchaseStore.getState().purchaseOrders.filter((p) => p.prId === pr.id)
      if (existingPos.length === 0) {
        const poIds = createPosFromPr(pr.id)
        for (const poId of poIds) postFullGrn(poId)
      }
    }

    const hasFgWo = useWorkOrderStore.getState().workOrders.some(
      (w) => w.salesOrderId === so.id && w.woType === 'finished_goods',
    )
    if (!hasFgWo) {
      useWorkOrderStore.getState().createFromMrpRun(run.id, so.id)
    }
  }
}

function completePendingDispatches() {
  const dispatchStore = useDispatchStore.getState()
  for (const dsp of dispatchStore.dispatches) {
    if (['cancelled', 'delivered', 'dispatched', 'in_transit'].includes(dsp.status)) continue
    const id = dsp.id
    if (!dsp.vehicleNo) {
      dispatchStore.updateLogistics(id, {
        vehicleNo: `GJ-01-FN-${dsp.dispatchNo.slice(-4)}`,
        lrNo: `LR-${dsp.dispatchNo}`,
        transporter: 'Factory Logistics',
        driverName: 'Demo Driver',
        driverPhone: '9876500000',
      })
    }
    if (dsp.status === 'ready' || dsp.status === 'planned') dispatchStore.markLoading(id)
    const plan = dispatchStore.getDispatch(id)!
    for (const item of plan.checklist) {
      if (!item.systemGate && !item.passed) dispatchStore.toggleChecklistItem(id, item.id, true)
    }
    if (plan.photos.length === 0) {
      dispatchStore.addPhoto(id, 'Loading — demo', 'data:image/png;base64,iVBORw0KGgo=')
    }
    dispatchStore.approveSecurityGate(id)
    dispatchStore.confirmDispatch(id)
    dispatchStore.markInTransit(id)
    dispatchStore.recordCustomerAck(id, {
      acknowledgedBy: 'Customer Rep',
      designation: 'Site',
      ackDate: new Date().toISOString().slice(0, 10),
      remarks: 'Delivered',
      signatureDataUrl: null,
      photoDataUrl: null,
    })
  }
}

function seedInvoicesAndPayments() {
  const dispatchStore = useDispatchStore.getState()
  const invoiceStore = useInvoiceStore.getState()
  let idx = 0
  for (const dsp of dispatchStore.dispatches) {
    if (!['delivered', 'in_transit', 'dispatched'].includes(dsp.status)) continue
    const hasInvoice = invoiceStore.invoices.some((inv) => inv.dispatchId === dsp.id)
    if (hasInvoice) continue
    const invCreate = invoiceStore.createFromDispatch(dsp.id)
    if (!invCreate.ok || !invCreate.id) continue
    invoiceStore.postInvoice(invCreate.id)
    const invoice = invoiceStore.getInvoice(invCreate.id)!
    invoiceStore.recordPayment(invCreate.id, {
      amount: invoice.gst.grandTotal,
      paymentDate: new Date().toISOString().slice(0, 10),
      referenceNo: `UTR-DEMO-PAY-${2000 + idx}`,
      mode: 'neft',
      remarks: 'Demo payment',
    })
    idx++
  }
}

function ensureFinalQcForFgWo(fgWoId: string) {
  const qs = useQualityStore.getState()
  if (qs.hasFinalQcPassed(fgWoId)) return

  let inspectionId = qs.inspections.find(
    (i) => i.category === 'final' && i.workOrderId === fgWoId && i.status === 'pending',
  )?.id

  if (!inspectionId) {
    const fqcCreate = qs.createFinalInspection(fgWoId)
    if (!fqcCreate.ok || !fqcCreate.inspectionId) return
    inspectionId = fqcCreate.inspectionId
  }

  const fqcParams = qcParamsForInspection(inspectionId, true)
  qs.recordFinalQcDecision(inspectionId, {
    inspector: 'Pradeep Singh',
    result: 'pass',
    remarks: 'Demo bulk final QC pass',
    parameterResults: fqcParams,
    useAutoDecision: !!fqcParams?.length,
    adminOverrideReason: fqcParams?.length ? undefined : 'Demo dataset — final QC plan not configured for product variant',
  })
}

function expandFgDispatchChains() {
  const ws = useWorkOrderStore.getState()
  const fgWos = ws.workOrders.filter(
    (w) => w.woType === 'finished_goods' && !['closed'].includes(w.status),
  )

  let idx = 0
  let fullRuns = 0
  const maxFullFgRuns = 35
  for (const fgWo of fgWos) {
    const so = useMrpStore.getState().getSalesOrder(fgWo.salesOrderId)
    if (!so || so.status === 'closed') continue
    if (fgWo.status !== 'fg_received' && fullRuns < maxFullFgRuns) {
      processFgWoToDispatchReady(fgWo.id)
      fullRuns++
    } else if (fgWo.status === 'fg_received') {
      ensureFinalQcForFgWo(fgWo.id)
    }
    createDispatchInvoicePayment(fgWo.id, idx++)
  }
}

function expandQrSerialEco() {
  const qr = useQrStore.getState()
  const serial = useSerialStore.getState()
  const eco = useEcoStore.getState()

  for (const wo of useWorkOrderStore.getState().workOrders) {
    if (!qr.records.some((r) => r.entityType === 'WORK_ORDER' && r.entityId === wo.id)) {
      qr.registerQr({
        entityType: 'WORK_ORDER',
        entityId: wo.id,
        displayCode: wo.woNo,
        payload: { wo: wo.woNo },
        metadata: { woId: wo.id },
      })
    }
  }

  for (const jc of useWorkOrderStore.getState().jobCards.slice(0, 40)) {
    if (!qr.records.some((r) => r.entityType === 'JOB_CARD' && r.entityId === jc.id)) {
      qr.registerQr({
        entityType: 'JOB_CARD',
        entityId: jc.id,
        displayCode: jc.jobCardNo,
        payload: { wo: jc.jobCardNo },
        metadata: { jobCardId: jc.id },
      })
    }
  }

  for (const grn of usePurchaseStore.getState().grns) {
    if (!qr.records.some((r) => r.entityType === 'MATERIAL_LOT' && r.entityId === grn.id)) {
      qr.registerQr({
        entityType: 'MATERIAL_LOT',
        entityId: grn.id,
        displayCode: grn.grnNo,
        payload: { grn: grn.grnNo },
        metadata: { grnId: grn.id },
      })
    }
  }

  for (const dsp of useDispatchStore.getState().dispatches) {
    if (!qr.records.some((r) => r.entityType === 'DISPATCH' && r.entityId === dsp.id)) {
      qr.registerQr({
        entityType: 'DISPATCH',
        entityId: dsp.id,
        displayCode: dsp.dispatchNo,
        payload: { trailer: dsp.dispatchNo },
        metadata: { dispatchId: dsp.id },
      })
    }
  }

  const items = ['item-fg-bulker', 'item-sa-chassis', 'item-bo-axl', 'item-bo-tyre']
  items.forEach((itemId, i) => {
    const serialNo = `DEMO-SN-${itemId.slice(-4)}-${i + 10}`
    if (!serial.serials.some((s) => s.serialNo === serialNo)) {
      serial.registerSerial({
        itemId,
        serialNo,
        serialType: i === 0 ? 'finished_trailer' : i === 1 ? 'chassis' : i === 2 ? 'axle' : 'tyre',
      })
    }
  })

  for (const ecoRow of eco.ecos.slice(0, 8)) {
    if (ecoRow.approvalStatus === 'draft') {
      eco.submitEcoForApproval(ecoRow.id)
      eco.approveEco(ecoRow.id)
    }
  }
}

function seedUatVolumeExtensions() {
  const serial = useSerialStore.getState()
  const items = useMasterStore.getState().items.filter((i) => i.isStockable).slice(0, 25)
  items.forEach((item, i) => {
    const serialNo = `UAT-SN-${item.itemCode.replace(/[^A-Z0-9]/gi, '')}-${String(i + 1).padStart(3, '0')}`
    if (!serial.serials.some((s) => s.serialNo === serialNo)) {
      serial.registerSerial({
        itemId: item.id,
        serialNo,
        serialType: item.itemType === 'finished_good' ? 'finished_trailer' : 'sub_assembly',
      })
    }
  })

  const dms = useDmsStore.getState()
  const products = useMasterStore.getState().products
  const docTarget = Math.max(0, 50 - dms.documents.length)
  for (let i = 0; i < docTarget; i++) {
    const p = products[i % products.length]
    dms.uploadDocument({
      title: `UAT Demo Document ${dms.documents.length + 1}`,
      fileName: `uat-doc-${dms.documents.length + 1}.pdf`,
      category: 'engineering_drawing',
      fileContent: 'data:application/pdf;base64,VUFE',
      entityLinks: [{ entityType: 'product', entityId: p.id, entityLabel: p.productName }],
    })
  }

  ensureAllPosReceived()
  postAllPendingGrns()
  for (const po of usePurchaseStore.getState().purchaseOrders) {
    for (const line of po.lines) {
      const remaining = line.qty - line.receivedQty
      if (remaining <= 0) continue
      const chunk = Math.max(1, Math.floor(remaining / 2))
      usePurchaseStore.getState().postGrn(po.id, [{ poLineId: line.id, receivedQty: chunk }])
    }
  }
  postAllPendingGrns()

  const dispatchStore = useDispatchStore.getState()
  const candidates = dispatchStore.getReadyCandidates()
  let chainIdx = 100
  for (const c of candidates) {
    if (dispatchStore.dispatches.length >= SATURATION_TARGETS.dispatches) break
    if (dispatchStore.dispatches.some((d) => d.lines.some((l) => l.workOrderId === c.workOrderId))) continue
    createDispatchInvoicePayment(c.workOrderId, chainIdx++)
  }

  const eligibleSos = useMrpStore.getState().salesOrders.filter((s) => !['closed', 'cancelled'].includes(s.status))
  for (const so of eligibleSos) {
    const subCount = useWorkOrderStore.getState().workOrders.filter((w) => w.woType === 'subcontract').length
    if (subCount >= 25) break
    const run = useMrpStore.getState().runs.find((r) => r.salesOrderIds.includes(so.id))
    if (run && !useWorkOrderStore.getState().workOrders.some((w) => w.salesOrderId === so.id && w.woType === 'subcontract')) {
      useWorkOrderStore.getState().createFromMrpRun(run.id, so.id)
    }
  }

  seedInvoicesAndPayments()
}

function seedFinalEetaSaturation() {
  const master = useMasterStore.getState()
  let i = master.customers.length
  while (useMasterStore.getState().customers.length < 30) {
    i++
    useMasterStore.getState().addCustomer({
      customerCode: `CUST-EETA-${String(i).padStart(3, '0')}`,
      customerName: `EETA Demo Customer ${i}`,
      customerType: 'corporate',
      addressLine1: 'Industrial Area',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      gstin: `27AABCE${String(1000 + i).slice(-4)}A1Z${i % 10}`,
      contactPerson: `Contact ${i}`,
      contactPhone: `+91 98220 ${String(10000 + i).slice(-5)}`,
      contactEmail: `customer${i}@eeta-demo.in`,
      creditDays: 30,
      salesTerritory: 'West',
      isActive: true,
    })
  }
  let v = master.vendors.length
  while (useMasterStore.getState().vendors.length < 30) {
    v++
    useMasterStore.getState().addVendor({
      vendorCode: `VEND-EETA-${String(v).padStart(3, '0')}`,
      vendorName: `EETA Demo Vendor ${v}`,
      vendorType: 'manufacturer',
      city: 'Pune',
      state: 'Maharashtra',
      gstin: `27AABCV${String(2000 + v).slice(-4)}B1Z${v % 10}`,
      contactPerson: `Vendor Contact ${v}`,
      contactPhone: `+91 98230 ${String(20000 + v).slice(-5)}`,
      paymentTermsDays: 30,
      defaultLeadTimeDays: 14,
      suppliedCategories: ['CAT-BO-RUN'],
      rating: 4,
      isActive: true,
    })
  }
  let it = master.items.length
  while (useMasterStore.getState().items.length < 120) {
    it++
    useMasterStore.getState().addItem({
      itemCode: `RM-EETA-${String(it).padStart(4, '0')}`,
      itemName: `EETA Demo Item ${it}`,
      itemDescription: 'Saturation demo item',
      categoryId: 'cat-rm-cons',
      baseUomId: 'uom-nos',
      itemType: 'consumable',
      materialGrade: 'Standard',
      hsnCode: '7318',
      reorderLevel: 10,
      reorderQty: 50,
      standardRate: 100 + it,
      isPurchasable: true,
      isStockable: true,
      isActive: true,
      subAssemblyRule: null,
    })
  }

  const docTarget = Math.max(0, 100 - useDmsStore.getState().documents.length)
  for (let d = 0; d < docTarget; d++) {
    const p = useMasterStore.getState().products[d % useMasterStore.getState().products.length]
    useDmsStore.getState().uploadDocument({
      title: `EETA Document ${useDmsStore.getState().documents.length + 1}`,
      fileName: `eeta-doc-${d + 1}.pdf`,
      category: 'engineering_drawing',
      fileContent: 'data:application/pdf;base64,VUFE',
      entityLinks: [{ entityType: 'product', entityId: p.id, entityLabel: p.productName }],
    })
  }

  const serial = useSerialStore.getState()
  const stockItems = useMasterStore.getState().items.filter((x) => x.isStockable)
  for (let s = serial.serials.length; s < 80; s++) {
    const item = stockItems[s % stockItems.length]
    const serialNo = `EETA-SN-${String(s + 1).padStart(4, '0')}`
    if (!serial.serials.some((x) => x.serialNo === serialNo)) {
      serial.registerSerial({ itemId: item.id, serialNo, serialType: 'sub_assembly' })
    }
  }

  ensureDemoBomRoutingForProducts(useMasterStore.getState().products.map((p) => p.id))

  for (const fgWo of useWorkOrderStore.getState().workOrders.filter((w) => w.woType === 'finished_goods')) {
    if (['closed', 'cancelled'].includes(fgWo.status)) continue
    try {
      if (fgWo.status !== 'fg_received') processFgWoToDispatchReady(fgWo.id)
      else ensureFinalQcForFgWo(fgWo.id)
    } catch {
      /* best-effort FG completion for dispatch saturation */
    }
  }

  let chainIdx = 200
  for (const fgWo of useWorkOrderStore.getState().workOrders.filter((w) => w.woType === 'finished_goods' && w.status === 'fg_received')) {
    if (useDispatchStore.getState().dispatches.length >= 30) break
    if (!useDispatchStore.getState().dispatches.some((d) => d.lines.some((l) => l.workOrderId === fgWo.id))) {
      createDispatchInvoicePayment(fgWo.id, chainIdx++)
    }
  }
  let dispatchRetry = 0
  while (useDispatchStore.getState().dispatches.length < SATURATION_TARGETS.dispatches && dispatchRetry < 40) {
    dispatchRetry++
    const candidates = useDispatchStore.getState().getReadyCandidates()
    if (candidates.length === 0) {
      const pendingFg = useWorkOrderStore.getState().workOrders.find(
        (w) => w.woType === 'finished_goods' && !['closed', 'fg_received', 'cancelled'].includes(w.status),
      )
      if (pendingFg) processFgWoToDispatchReady(pendingFg.id)
      else break
      continue
    }
    const c = candidates[0]
    if (useDispatchStore.getState().dispatches.some((d) => d.lines.some((l) => l.workOrderId === c.workOrderId))) break
    createDispatchInvoicePayment(c.workOrderId, chainIdx++)
  }

  while (useDispatchStore.getState().dispatches.length < SATURATION_TARGETS.dispatches) {
    const candidates = useDispatchStore.getState().getReadyCandidates()
    if (candidates.length === 0) break
    const c = candidates[0]
    if (useDispatchStore.getState().dispatches.some((d) => d.lines.some((l) => l.workOrderId === c.workOrderId))) break
    useDispatchStore.getState().createDispatchPlan(c)
  }

  const ecoStore = useEcoStore.getState()
  const products = useMasterStore.getState().products
  while (useEcoStore.getState().ecrs.length < 25) {
    const n = useEcoStore.getState().ecrs.length + 1
    const p = products[n % products.length]
    ecoStore.createEcr({
      changeType: 'bom',
      productId: p.id,
      reason: `EETA saturation ECR ${n}`,
      priority: 'medium',
    })
  }
  for (const ecr of [...useEcoStore.getState().ecrs]) {
    if (useEcoStore.getState().ecos.length >= 25) break
    if (ecr.status !== 'approved_for_eco' && ecr.status !== 'draft') continue
    if (ecr.status === 'draft') {
      ecoStore.submitEcr(ecr.id)
      ecoStore.startEngineeringReview(ecr.id)
      ecoStore.completeImpactAnalysis(ecr.id)
    }
    if (!useEcoStore.getState().ecos.some((e) => e.ecrId === ecr.id)) {
      ecoStore.approveEcrForEco(ecr.id)
    }
  }

  for (const so of useMrpStore.getState().salesOrders) {
    if (useWorkOrderStore.getState().workOrders.filter((w) => w.woType === 'subcontract').length >= 25) break
    const run = useMrpStore.getState().runs.find((r) => r.salesOrderIds.includes(so.id))
    if (run && !useWorkOrderStore.getState().workOrders.some((w) => w.salesOrderId === so.id && w.woType === 'subcontract')) {
      useWorkOrderStore.getState().createFromMrpRun(run.id, so.id)
    }
  }
}

export function runSaturationDispatchExpansion(): void {
  expandFgDispatchChains()
  completePendingDispatches()
  seedInvoicesAndPayments()
}

export function runDemoBulkSeed(): { warnings: string[] } {
  const warnings: string[] = []
  try {
    expandMrpPurchaseAndProduction()
    ensureAllPosReceived()
    postAllPendingGrns()
  } catch (e) {
    warnings.push(`Bulk MRP/purchase: ${e instanceof Error ? e.message : String(e)}`)
  }
  try {
    expandFgDispatchChains()
    completePendingDispatches()
    seedInvoicesAndPayments()
  } catch (e) {
    warnings.push(`Bulk FG/dispatch: ${e instanceof Error ? e.message : String(e)}`)
  }
  try {
    expandQrSerialEco()
    seedUatVolumeExtensions()
    seedFinalEetaSaturation()
  } catch (e) {
    warnings.push(`Bulk QR/serial/ECO/UAT/EETA: ${e instanceof Error ? e.message : String(e)}`)
  }
  return { warnings }
}
