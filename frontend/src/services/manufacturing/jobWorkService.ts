import type {
  JobWorkCostPreview,
  JobWorkDispatch,
  JobWorkFilter,
  JobWorkInvoiceLink,
  JobWorkMaterial,
  JobWorkOrder,
  JobWorkReceipt,
  JobWorkReconciliation,
  JobWorkRegisterSummary,
  JobWorkStatus,
} from '../../types/manufacturingJobWork'
import {
  seedJobWorkMaterials,
  seedJobWorkOrders,
} from '../../data/manufacturing/jobWorkSeed'

const delay = (ms = 80) => new Promise((r) => setTimeout(r, ms))

let orders: JobWorkOrder[] = structuredClone(seedJobWorkOrders)
let materials: JobWorkMaterial[] = structuredClone(seedJobWorkMaterials)
let dispatches: JobWorkDispatch[] = []
let receipts: JobWorkReceipt[] = []
let jwSeq = 20

function now() {
  return new Date().toISOString()
}

function today() {
  return now().slice(0, 10)
}

function pushAct(jw: JobWorkOrder, action: string, opts?: { quantity?: number; comment?: string }) {
  jw.activity = [
    {
      id: `jwa-${crypto.randomUUID().slice(0, 8)}`,
      action,
      userName: 'Demo User',
      at: now(),
      quantity: opts?.quantity,
      comment: opts?.comment,
    },
    ...jw.activity,
  ]
}

function mats(jwId: string) {
  return materials.filter((m) => m.jobWorkId === jwId)
}

function recomputeBalance(jwId: string) {
  materials = materials.map((m) => {
    if (m.jobWorkId !== jwId) return m
    const balance =
      m.sentQty + m.additionalSentQty - m.consumedQty - m.returnedQty - m.scrapReturnedQty
    return { ...m, balanceWithVendor: balance }
  })
  const idx = orders.findIndex((o) => o.id === jwId)
  if (idx >= 0) {
    orders[idx] = {
      ...orders[idx],
      materialBalance: mats(jwId).reduce((s, m) => s + m.balanceWithVendor, 0),
      pendingQty: Math.max(0, orders[idx].orderedQty - orders[idx].receivedQty),
      updatedAt: now(),
    }
  }
}

function isOverdue(o: JobWorkOrder) {
  if (['closed', 'cancelled', 'received'].includes(o.status)) return false
  return o.expectedReturnDate < today()
}

function matches(o: JobWorkOrder, filter?: JobWorkFilter) {
  if (!filter) return true
  const q = filter.search?.trim().toLowerCase()
  if (q) {
    const hay = `${o.jwNumber} ${o.workOrderNo} ${o.vendorName} ${o.itemCode} ${o.process}`.toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (filter.workOrder && !o.workOrderNo.toLowerCase().includes(filter.workOrder.toLowerCase())) return false
  if (filter.vendor && !o.vendorName.toLowerCase().includes(filter.vendor.toLowerCase())) return false
  if (filter.process && !o.process.toLowerCase().includes(filter.process.toLowerCase())) return false
  if (filter.item) {
    const f = filter.item.toLowerCase()
    if (!o.itemCode.toLowerCase().includes(f) && !o.itemName.toLowerCase().includes(f)) return false
  }
  if (filter.status && o.status !== filter.status) return false
  if (filter.invoiceStatus && o.invoiceStatus !== filter.invoiceStatus) return false
  if (filter.expectedReturnFrom && o.expectedReturnDate < filter.expectedReturnFrom) return false
  if (filter.expectedReturnTo && o.expectedReturnDate > filter.expectedReturnTo) return false
  switch (filter.tab) {
    case 'draft':
      return o.status === 'draft'
    case 'material_sent':
      return o.status === 'material_sent'
    case 'partially_received':
      return o.status === 'partially_received'
    case 'received':
      return o.status === 'received'
    case 'reconciliation_pending':
      return o.status === 'reconciliation_pending'
    case 'closed':
      return o.status === 'closed'
    case 'cancelled':
      return o.status === 'cancelled'
    case 'overdue':
      return isOverdue(o)
    default:
      return true
  }
}

export async function getJobWorkOrders(filter?: JobWorkFilter): Promise<JobWorkOrder[]> {
  await delay()
  return orders.filter((o) => matches(o, filter)).map((o) => ({ ...o, activity: [...o.activity] }))
}

export async function getJobWorkOrderById(id: string): Promise<JobWorkOrder | null> {
  await delay()
  const o = orders.find((x) => x.id === id)
  return o ? { ...o, activity: [...o.activity] } : null
}

export async function getJobWorkRegisterSummary(): Promise<JobWorkRegisterSummary> {
  await delay()
  const openStatuses: JobWorkStatus[] = ['draft', 'material_sent', 'partially_received', 'reconciliation_pending']
  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)
  return {
    open: orders.filter((o) => openStatuses.includes(o.status)).length,
    materialWithVendors: orders.filter((o) => o.materialBalance > 0 && o.status !== 'closed').length,
    dueThisWeek: orders.filter(
      (o) => o.expectedReturnDate >= today() && o.expectedReturnDate <= weekEndStr && !['closed', 'cancelled'].includes(o.status),
    ).length,
    overdue: orders.filter(isOverdue).length,
    reconciliationDifference: orders.filter((o) => o.status === 'reconciliation_pending' && !o.differenceApproved).length,
    vendorInvoicePending: orders.filter((o) => o.invoiceStatus === 'pending' || (o.invoiceStatus === 'none' && o.status === 'reconciliation_pending')).length,
  }
}

export async function createJobWorkOrder(
  input: Partial<JobWorkOrder> & {
    workOrderId: string
    workOrderNo: string
    vendorId: string
    vendorName: string
    process: string
    quantity: number
    rate: number
    expectedReturnDate: string
    itemId: string
    itemCode: string
    itemName: string
    materialToSend?: string
    remarks?: string
  },
): Promise<{ ok: boolean; jobWork?: JobWorkOrder; error?: string }> {
  await delay()
  jwSeq += 1
  const id = `mfg-jw-${crypto.randomUUID().slice(0, 8)}`
  const materialLabel = input.materialToSend?.trim() || 'Job work material'
  const jw: JobWorkOrder = {
    id,
    jwNumber: `JW-2026-${String(jwSeq).padStart(4, '0')}`,
    workOrderId: input.workOrderId,
    workOrderNo: input.workOrderNo,
    vendorId: input.vendorId,
    vendorName: input.vendorName,
    vendorAddress: input.vendorAddress,
    process: input.process,
    itemId: input.itemId,
    itemCode: input.itemCode,
    itemName: input.itemName,
    uom: input.uom ?? 'NOS',
    orderedQty: input.quantity,
    sentQty: 0,
    receivedQty: 0,
    acceptedQty: 0,
    rejectedQty: 0,
    reworkQty: 0,
    pendingQty: input.quantity,
    materialBalance: 0,
    rate: input.rate,
    rateBasis: input.rateBasis ?? 'per_piece',
    expectedCost: input.rateBasis === 'fixed' ? input.rate : input.rate * input.quantity,
    expectedReturnDate: input.expectedReturnDate,
    status: 'draft',
    invoiceStatus: 'none',
    materialToSend: materialLabel,
    remarks: input.remarks,
    plantId: input.plantId ?? 'plant-chakan',
    plantName: input.plantName ?? 'Chakan',
    materialWarehouseId: input.materialWarehouseId ?? 'wh-rm',
    materialWarehouseName: input.materialWarehouseName ?? 'RM Stores',
    receiptWarehouseId: input.receiptWarehouseId ?? 'wh-fg',
    receiptWarehouseName: input.receiptWarehouseName ?? 'FG Stores',
    bomId: input.bomId,
    bomNumber: input.bomNumber,
    bomVersion: input.bomVersion,
    costCentre: input.costCentre ?? 'CC-MFG',
    qualityRequired: input.qualityRequired ?? true,
    readOnly: false,
    activity: [],
    createdAt: now(),
    updatedAt: now(),
    createdBy: 'Demo User',
  }
  pushAct(jw, 'Job Work Created', { comment: input.remarks })
  orders = [jw, ...orders]
  materials = [
    {
      id: `jwm-${id}-RM`,
      jobWorkId: id,
      materialItemId: 'item-rm-jw',
      materialCode: materialLabel.slice(0, 24).toUpperCase().replace(/\s+/g, '-') || 'JW-MAT',
      materialName: materialLabel,
      requiredQty: input.quantity,
      availableQty: Math.max(input.quantity * 2, 10),
      sentQty: 0,
      additionalSentQty: 0,
      consumedQty: 0,
      returnedQty: 0,
      scrapReturnedQty: 0,
      balanceWithVendor: 0,
      uom: input.uom ?? 'NOS',
      status: 'pending',
      tracking: 'none',
    },
    ...materials,
  ]
  return { ok: true, jobWork: jw }
}

export async function updateJobWorkOrder(
  id: string,
  patch: Partial<JobWorkOrder>,
): Promise<{ ok: boolean; jobWork?: JobWorkOrder; error?: string }> {
  await delay()
  const idx = orders.findIndex((o) => o.id === id)
  if (idx < 0) return { ok: false, error: 'Not found' }
  if (orders[idx].readOnly) return { ok: false, error: 'Read-only' }
  if (orders[idx].status !== 'draft') return { ok: false, error: 'Only draft can be edited' }
  orders[idx] = { ...orders[idx], ...patch, id, jwNumber: orders[idx].jwNumber, updatedAt: now() }
  pushAct(orders[idx], 'Job Work Updated')
  return { ok: true, jobWork: orders[idx] }
}

export async function getJobWorkMaterials(jobWorkId: string): Promise<JobWorkMaterial[]> {
  await delay()
  return mats(jobWorkId).map((m) => ({ ...m }))
}

export async function getJobWorkDispatches(jobWorkId: string): Promise<JobWorkDispatch[]> {
  await delay()
  return dispatches.filter((d) => d.jobWorkId === jobWorkId).map((d) => ({ ...d, lines: [...d.lines] }))
}

export async function getJobWorkReceipts(jobWorkId: string): Promise<JobWorkReceipt[]> {
  await delay()
  return receipts.filter((r) => r.jobWorkId === jobWorkId).map((r) => ({ ...r }))
}

export async function dispatchJobWorkMaterialDemo(
  jobWorkId: string,
  input: {
    lines: Array<{ materialId: string; qty: number; batchOrSerial?: string }>
    dispatchAt?: string
    vendorChallan?: string
    vehicle?: string
    transporter?: string
    remarks?: string
  },
): Promise<{ ok: boolean; error?: string }> {
  await delay()
  const idx = orders.findIndex((o) => o.id === jobWorkId)
  if (idx < 0) return { ok: false, error: 'Not found' }
  const jw = orders[idx]
  if (jw.readOnly) return { ok: false, error: 'Read-only' }
  for (const line of input.lines) {
    const m = materials.find((x) => x.id === line.materialId)
    if (!m) continue
    if (m.qualityHold || m.blocked) return { ok: false, error: `${m.materialCode} is blocked or on quality hold` }
    if (line.qty > m.availableQty - m.sentQty) {
      // warn but allow partial up to available in demo
    }
  }
  materials = materials.map((m) => {
    const line = input.lines.find((l) => l.materialId === m.id)
    if (!line || m.jobWorkId !== jobWorkId) return m
    const isAdditional = m.sentQty >= m.requiredQty
    return {
      ...m,
      sentQty: isAdditional ? m.sentQty : m.sentQty + line.qty,
      additionalSentQty: isAdditional ? m.additionalSentQty + line.qty : m.additionalSentQty,
      status: 'sent' as const,
    }
  })
  const sentTotal = input.lines.reduce((s, l) => s + l.qty, 0)
  dispatches = [
    {
      id: `jwd-${crypto.randomUUID().slice(0, 8)}`,
      jobWorkId,
      dispatchAt: input.dispatchAt ?? now(),
      lines: input.lines,
      vendorChallan: input.vendorChallan,
      vehicle: input.vehicle,
      transporter: input.transporter,
      remarks: input.remarks,
      userName: 'Demo User',
    },
    ...dispatches,
  ]
  const dispatchAt = input.dispatchAt ?? now()
  orders[idx] = {
    ...jw,
    sentQty: jw.status === 'draft' ? jw.orderedQty : Math.max(jw.sentQty, 1),
    materialSentDate: jw.materialSentDate ?? dispatchAt.slice(0, 10),
    status: jw.status === 'draft' ? 'material_sent' : jw.status,
    vendorChallan: input.vendorChallan ?? jw.vendorChallan,
    vehicle: input.vehicle ?? jw.vehicle,
    transporter: input.transporter ?? jw.transporter,
    updatedAt: now(),
  }
  recomputeBalance(jobWorkId)
  pushAct(orders[idx], 'Material Dispatched', { quantity: sentTotal, comment: input.remarks })
  return { ok: true }
}

export async function receiveJobWorkDemo(
  jobWorkId: string,
  input: {
    receivedQty: number
    acceptedQty: number
    rejectedQty?: number
    reworkQty?: number
    vendorChallan?: string
    batchOrSerial?: string
    scrapReturned?: number
    unusedReturned?: number
    reconcileAfter?: boolean
  },
): Promise<{ ok: boolean; error?: string }> {
  await delay()
  const idx = orders.findIndex((o) => o.id === jobWorkId)
  if (idx < 0) return { ok: false, error: 'Not found' }
  const jw = orders[idx]
  if (jw.readOnly) return { ok: false, error: 'Read-only' }
  if (input.receivedQty <= 0) return { ok: false, error: 'Received quantity required' }
  receipts = [
    {
      id: `jwr-${crypto.randomUUID().slice(0, 8)}`,
      jobWorkId,
      receivedAt: now(),
      receivedQty: input.receivedQty,
      acceptedQty: input.acceptedQty,
      rejectedQty: input.rejectedQty ?? 0,
      reworkQty: input.reworkQty ?? 0,
      scrapReturned: input.scrapReturned,
      unusedReturned: input.unusedReturned,
      vendorChallan: input.vendorChallan,
      batchOrSerial: input.batchOrSerial,
      userName: 'Demo User',
    },
    ...receipts,
  ]
  const receivedQty = jw.receivedQty + input.receivedQty
  const acceptedQty = jw.acceptedQty + input.acceptedQty
  let status: JobWorkStatus = 'partially_received'
  if (receivedQty >= jw.orderedQty) status = input.reconcileAfter ? 'reconciliation_pending' : 'received'
  materials = materials.map((m) => {
    if (m.jobWorkId !== jobWorkId) return m
    const consumed = Math.min(m.sentQty, m.requiredQty)
    return {
      ...m,
      consumedQty: consumed,
      returnedQty: m.returnedQty + (input.unusedReturned ?? 0),
      scrapReturnedQty: m.scrapReturnedQty + (input.scrapReturned ?? 0),
    }
  })
  orders[idx] = {
    ...jw,
    receivedQty,
    acceptedQty,
    rejectedQty: jw.rejectedQty + (input.rejectedQty ?? 0),
    reworkQty: jw.reworkQty + (input.reworkQty ?? 0),
    pendingQty: Math.max(0, jw.orderedQty - receivedQty),
    status,
    vendorChallan: input.vendorChallan ?? jw.vendorChallan,
    invoiceStatus: status === 'reconciliation_pending' ? 'pending' : jw.invoiceStatus,
    updatedAt: now(),
  }
  recomputeBalance(jobWorkId)
  pushAct(orders[idx], 'Receipt Confirmed', { quantity: input.receivedQty })
  return { ok: true }
}

export async function returnJobWorkMaterialDemo(
  jobWorkId: string,
  lines: Array<{ materialId: string; returnQty: number }>,
): Promise<{ ok: boolean; error?: string }> {
  await delay()
  materials = materials.map((m) => {
    const line = lines.find((l) => l.materialId === m.id)
    if (!line || m.jobWorkId !== jobWorkId) return m
    return { ...m, returnedQty: m.returnedQty + line.returnQty }
  })
  recomputeBalance(jobWorkId)
  const idx = orders.findIndex((o) => o.id === jobWorkId)
  if (idx >= 0) pushAct(orders[idx], 'Material Returned')
  return { ok: true }
}

export async function getJobWorkReconciliation(jobWorkId: string): Promise<JobWorkReconciliation | null> {
  await delay()
  const jw = orders.find((o) => o.id === jobWorkId)
  if (!jw) return null
  const lines = mats(jobWorkId).map((m) => {
    const expectedBalance = m.sentQty + m.additionalSentQty - m.consumedQty - m.returnedQty - m.scrapReturnedQty
    const actualBalance = m.balanceWithVendor
    const difference = actualBalance - expectedBalance
    let status: JobWorkReconciliation['lines'][0]['status'] = 'reconciled'
    if (Math.abs(difference) > 0.01) status = 'difference'
    else if (actualBalance > 0) status = 'material_with_vendor'
    return {
      materialId: m.id,
      materialCode: m.materialCode,
      sent: m.sentQty,
      additionalSent: m.additionalSentQty,
      consumed: m.consumedQty,
      returned: m.returnedQty,
      scrapReturned: m.scrapReturnedQty,
      processLoss: 0,
      expectedBalance,
      actualBalance,
      difference,
      status,
    }
  })
  const unexplained = lines.reduce((s, l) => s + Math.abs(l.difference), 0) + lines.reduce((s, l) => s + Math.max(0, l.actualBalance), 0)
  return {
    jobWorkId,
    lines,
    unexplainedDifference: unexplained,
    canClose: unexplained <= 0.01 || Boolean(jw.differenceApproved),
    warnings: unexplained > 0 && !jw.differenceApproved ? ['Unexplained material balance with vendor'] : [],
  }
}

export async function approveJobWorkDifferenceDemo(
  jobWorkId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  await delay()
  if (!reason.trim()) return { ok: false, error: 'Reason required' }
  const idx = orders.findIndex((o) => o.id === jobWorkId)
  if (idx < 0) return { ok: false, error: 'Not found' }
  orders[idx] = {
    ...orders[idx],
    differenceApproved: true,
    differenceReason: reason,
    status: 'reconciliation_pending',
    updatedAt: now(),
  }
  pushAct(orders[idx], 'Difference Approved', { comment: reason })
  return { ok: true }
}

export async function linkJobWorkVendorInvoiceDemo(
  jobWorkId: string,
  invoice: { invoiceId: string; invoiceNo: string; invoiceAmount: number },
): Promise<{ ok: boolean; link?: JobWorkInvoiceLink; error?: string }> {
  await delay()
  const idx = orders.findIndex((o) => o.id === jobWorkId)
  if (idx < 0) return { ok: false, error: 'Not found' }
  const jw = orders[idx]
  orders[idx] = {
    ...jw,
    invoiceId: invoice.invoiceId,
    invoiceNo: invoice.invoiceNo,
    invoiceAmount: invoice.invoiceAmount,
    invoiceStatus: 'linked',
    updatedAt: now(),
  }
  pushAct(orders[idx], 'Vendor Invoice Linked', { comment: invoice.invoiceNo })
  if (orders[idx].activity[0]) {
    orders[idx].activity[0] = {
      ...orders[idx].activity[0],
      relatedDocument: invoice.invoiceNo,
    }
  }
  const expected = jw.rateBasis === 'fixed' ? jw.rate : jw.rate * jw.acceptedQty
  return {
    ok: true,
    link: {
      jobWorkId,
      vendorId: jw.vendorId,
      vendorName: jw.vendorName,
      processQty: jw.acceptedQty,
      agreedRate: jw.rate,
      expectedServiceAmount: expected,
      acceptedQty: jw.acceptedQty,
      expectedJobWorkCost: expected,
      invoiceId: invoice.invoiceId,
      invoiceNo: invoice.invoiceNo,
      invoiceAmount: invoice.invoiceAmount,
      difference: invoice.invoiceAmount - expected,
      gstPreview: Math.round(invoice.invoiceAmount * 0.18),
      tdsPreview: Math.round(invoice.invoiceAmount * 0.01),
      matchStatus: Math.abs(invoice.invoiceAmount - expected) < 1 ? 'matched' : 'variance',
    },
  }
}

export async function removeJobWorkInvoiceLinkDemo(jobWorkId: string): Promise<{ ok: boolean; error?: string }> {
  await delay()
  const idx = orders.findIndex((o) => o.id === jobWorkId)
  if (idx < 0) return { ok: false, error: 'Not found' }
  orders[idx] = {
    ...orders[idx],
    invoiceId: undefined,
    invoiceNo: undefined,
    invoiceAmount: undefined,
    invoiceStatus: 'pending',
    updatedAt: now(),
  }
  pushAct(orders[idx], 'Invoice Link Removed')
  return { ok: true }
}

export async function getJobWorkCostPreview(jobWorkId: string): Promise<JobWorkCostPreview | null> {
  await delay()
  const jw = orders.find((o) => o.id === jobWorkId)
  if (!jw) return null
  const serviceCost = jw.rateBasis === 'fixed' ? jw.rate : jw.rate * Math.max(1, jw.acceptedQty || jw.orderedQty)
  const freight = 1500
  const materialLoss = mats(jobWorkId).reduce((s, m) => s + m.scrapReturnedQty * 50, 0)
  const reworkCost = jw.reworkQty * 2000
  const rejectionCost = jw.rejectedQty * jw.rate
  const scrapRecovery = mats(jobWorkId).reduce((s, m) => s + m.scrapReturnedQty * 30, 0)
  const total = serviceCost + freight + materialLoss + reworkCost + rejectionCost - scrapRecovery
  return {
    serviceCost,
    freight,
    materialLoss,
    reworkCost,
    rejectionCost,
    scrapRecovery,
    totalJobWorkCost: total,
    costPerAcceptedUnit: Math.round(total / Math.max(1, jw.acceptedQty || jw.orderedQty)),
  }
}

export async function closeJobWorkOrderDemo(jobWorkId: string): Promise<{ ok: boolean; error?: string }> {
  await delay()
  const idx = orders.findIndex((o) => o.id === jobWorkId)
  if (idx < 0) return { ok: false, error: 'Not found' }
  const recon = await getJobWorkReconciliation(jobWorkId)
  if (recon && !recon.canClose) {
    return { ok: false, error: 'Unexplained material remains — approve difference first' }
  }
  orders[idx] = { ...orders[idx], status: 'closed', readOnly: true, updatedAt: now() }
  pushAct(orders[idx], 'Job Work Closed')
  return { ok: true }
}

export async function cancelJobWorkOrderDemo(jobWorkId: string, reason?: string): Promise<{ ok: boolean; error?: string }> {
  await delay()
  const idx = orders.findIndex((o) => o.id === jobWorkId)
  if (idx < 0) return { ok: false, error: 'Not found' }
  if (orders[idx].readOnly) return { ok: false, error: 'Read-only' }
  orders[idx] = { ...orders[idx], status: 'cancelled', updatedAt: now() }
  pushAct(orders[idx], 'Job Work Cancelled', { comment: reason })
  return { ok: true }
}

export async function getJobWorkInvoiceLink(jobWorkId: string): Promise<JobWorkInvoiceLink | null> {
  await delay()
  const jw = orders.find((o) => o.id === jobWorkId)
  if (!jw) return null
  const expected = jw.rateBasis === 'fixed' ? jw.rate : jw.rate * Math.max(1, jw.acceptedQty || jw.orderedQty)
  return {
    jobWorkId,
    vendorId: jw.vendorId,
    vendorName: jw.vendorName,
    processQty: jw.acceptedQty || jw.orderedQty,
    agreedRate: jw.rate,
    expectedServiceAmount: expected,
    acceptedQty: jw.acceptedQty,
    expectedJobWorkCost: expected,
    invoiceId: jw.invoiceId,
    invoiceNo: jw.invoiceNo,
    invoiceAmount: jw.invoiceAmount,
    difference: (jw.invoiceAmount ?? 0) - expected,
    gstPreview: Math.round((jw.invoiceAmount ?? expected) * 0.18),
    tdsPreview: Math.round((jw.invoiceAmount ?? expected) * 0.01),
    matchStatus: !jw.invoiceId ? 'unlinked' : Math.abs((jw.invoiceAmount ?? 0) - expected) < 1 ? 'matched' : 'variance',
  }
}
