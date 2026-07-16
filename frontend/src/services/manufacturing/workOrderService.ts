import type {
  CreateWorkOrderInput,
  MaterialConsumptionPreview,
  MaterialIssueLine,
  MaterialReservationPreview,
  MaterialReturnLine,
  ProductionCompletionPreview,
  ProductionCostPreview,
  ProductionHoldRequest,
  ProductionOutputEntry,
  ProductionQualityReview,
  ProductionRework,
  ProductionScrap,
  ProductionStartRequest,
  ProductionVariancePreview,
  ScrapReason,
  WorkOrder,
  WorkOrderActivity,
  WorkOrderClosingPreview,
  WorkOrderFilter,
  WorkOrderMaterial,
  WorkOrderSource,
  WorkOrderSourceDetails,
  WorkOrderSourceDocument,
} from '../../types/manufacturingWorkOrder'
import { seedManufacturingBoms } from '../../data/manufacturing/seed'
import {
  seedProductionOutputs,
  seedProductionReworks,
  seedProductionScraps,
  seedWorkOrderActivity,
  seedWorkOrderMaterials,
  seedWorkOrders,
  seedWorkOrderSourceDocuments,
} from '../../data/manufacturing/workOrderSeed'
import { getManufacturingSettings } from './manufacturingSettingsService'

const delay = (ms = 80) => new Promise((r) => setTimeout(r, ms))

let workOrders: WorkOrder[] = structuredClone(seedWorkOrders)
let materials: WorkOrderMaterial[] = structuredClone(seedWorkOrderMaterials)
let activities: WorkOrderActivity[] = structuredClone(seedWorkOrderActivity)
let outputs: ProductionOutputEntry[] = structuredClone(seedProductionOutputs)
let scraps: ProductionScrap[] = structuredClone(seedProductionScraps)
let reworks: ProductionRework[] = structuredClone(seedProductionReworks)
let qualityReviews: ProductionQualityReview[] = []
let woSeq = 50

interface WorkOrderRegisterSummary {
  open: number
  inProgress: number
  dueToday: number
  delayed: number
  materialShortage: number
  plannedQty: number
  producedQty: number
}

interface ProductionResumeRequest {
  workOrderId: string
  resumeAt: string
  resolutionNote?: string
}

function now() {
  return new Date().toISOString()
}

function today() {
  return now().slice(0, 10)
}

function pushActivity(
  workOrderId: string,
  action: string,
  opts?: { quantity?: number; comment?: string; relatedDocument?: string; userName?: string },
) {
  activities = [
    {
      id: `woa-${crypto.randomUUID().slice(0, 8)}`,
      workOrderId,
      action,
      userName: opts?.userName ?? 'Demo User',
      at: now(),
      quantity: opts?.quantity,
      comment: opts?.comment,
      relatedDocument: opts?.relatedDocument,
    },
    ...activities,
  ]
}

function recompute(wo: WorkOrder): WorkOrder {
  const remaining = Math.max(0, wo.plannedQty - wo.producedQty)
  const progress = wo.plannedQty > 0 ? Math.min(100, Math.round((wo.producedQty / wo.plannedQty) * 100)) : 0
  return { ...wo, remainingQty: remaining, progressPercent: progress, updatedAt: now() }
}

function isDelayed(wo: WorkOrder): boolean {
  if (wo.status === 'completed' || wo.status === 'closed' || wo.status === 'cancelled') return false
  return wo.dueDate < today()
}

function matchesFilter(wo: WorkOrder, filter?: WorkOrderFilter): boolean {
  if (!filter) return true
  const q = filter.search?.trim().toLowerCase()
  if (q) {
    const hay = `${wo.woNumber} ${wo.finishedItemCode} ${wo.finishedItemName} ${wo.sourceDocumentNo} ${wo.customerName ?? ''}`.toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (filter.finishedItem) {
    const f = filter.finishedItem.toLowerCase()
    if (!wo.finishedItemCode.toLowerCase().includes(f) && !wo.finishedItemName.toLowerCase().includes(f)) return false
  }
  if (filter.productionMethod && wo.productionMethod !== filter.productionMethod) return false
  if (filter.source && wo.source !== filter.source) return false
  if (filter.salesOrder && !(wo.salesOrderNo ?? '').toLowerCase().includes(filter.salesOrder.toLowerCase())) return false
  if (filter.customer && !(wo.customerName ?? '').toLowerCase().includes(filter.customer.toLowerCase())) return false
  if (filter.plant && !wo.plantName.toLowerCase().includes(filter.plant.toLowerCase())) return false
  if (filter.status && wo.status !== filter.status) return false
  if (filter.priority && wo.priority !== filter.priority) return false
  if (filter.materialStatus && wo.materialStatus !== filter.materialStatus) return false
  if (filter.dueDateFrom && wo.dueDate < filter.dueDateFrom) return false
  if (filter.dueDateTo && wo.dueDate > filter.dueDateTo) return false
  if (filter.startDateFrom && wo.startDate < filter.startDateFrom) return false
  if (filter.startDateTo && wo.startDate > filter.startDateTo) return false

  switch (filter.tab) {
    case 'draft':
      return wo.status === 'draft'
    case 'in_progress':
      return wo.status === 'in_progress'
    case 'on_hold':
      return wo.status === 'on_hold'
    case 'completed':
      return wo.status === 'completed'
    case 'closed':
      return wo.status === 'closed'
    case 'cancelled':
      return wo.status === 'cancelled'
    case 'material_shortage':
      return wo.materialStatus === 'shortage' || wo.materialStatus === 'partial'
    case 'delayed':
      return isDelayed(wo)
    case 'job_work':
      return wo.productionMethod === 'job_work' || wo.productionMethod === 'mixed'
    default:
      return true
  }
}

function materialsFor(woId: string) {
  return materials.filter((m) => m.workOrderId === woId)
}

function refreshMaterialStatus(woId: string) {
  const lines = materialsFor(woId)
  const idx = workOrders.findIndex((w) => w.id === woId)
  if (idx < 0) return
  let status: WorkOrder['materialStatus'] = 'available'
  if (lines.some((l) => l.shortageQty > 0 && l.availableQty === 0)) status = 'shortage'
  else if (lines.some((l) => l.shortageQty > 0 || l.status === 'partial')) status = 'partial'
  else if (lines.every((l) => l.status === 'consumed')) status = 'consumed'
  else if (lines.some((l) => l.reservedQty > 0)) status = 'reserved'
  workOrders[idx] = { ...workOrders[idx], materialStatus: status, updatedAt: now() }
}

function costPreview(wo: WorkOrder): ProductionCostPreview {
  const mats = materialsFor(wo.id)
  const materialCost = mats.reduce((s, m) => s + m.consumedQty * 100, 0) || mats.reduce((s, m) => s + m.requiredQty * 80, 0)
  const labourCost = wo.producedQty * 1200
  const machineCost = wo.producedQty * 800
  const jobWorkCost = wo.productionMethod === 'job_work' || wo.productionMethod === 'mixed' ? wo.producedQty * 4500 : 0
  const factoryOverhead = Math.round((materialCost + labourCost) * 0.08)
  const reworkCost = wo.reworkQty * 1500
  const scrapRecovery = wo.scrapQty * 200
  const total = materialCost + labourCost + machineCost + jobWorkCost + factoryOverhead + reworkCost - scrapRecovery
  const good = Math.max(1, wo.producedQty)
  return {
    materialCost,
    labourCost,
    machineCost,
    jobWorkCost,
    factoryOverhead,
    reworkCost,
    scrapRecovery,
    totalProductionCost: total,
    costPerGoodUnit: Math.round(total / good),
  }
}

function variancePreview(wo: WorkOrder): ProductionVariancePreview {
  const mats = materialsFor(wo.id)
  const plannedMaterial = mats.reduce((s, m) => s + m.requiredQty, 0)
  const consumedMaterial = mats.reduce((s, m) => s + m.consumedQty, 0)
  return {
    plannedMaterial,
    consumedMaterial,
    plannedOutput: wo.plannedQty,
    actualOutput: wo.producedQty,
    materialUsageDiff: consumedMaterial - plannedMaterial * (wo.producedQty / Math.max(1, wo.plannedQty)),
    scrapDiff: wo.scrapQty,
    yieldDiff: wo.producedQty - wo.plannedQty,
    reworkDiff: wo.reworkQty,
    costDiff: 0,
  }
}

export async function getWorkOrders(filter?: WorkOrderFilter): Promise<WorkOrder[]> {
  await delay()
  return workOrders.filter((w) => matchesFilter(w, filter)).map((w) => ({ ...w }))
}

export async function getWorkOrderById(id: string): Promise<WorkOrder | null> {
  await delay()
  return workOrders.find((w) => w.id === id) ?? null
}

export async function getWorkOrderRegisterSummary(): Promise<WorkOrderRegisterSummary> {
  await delay()
  const open = workOrders.filter((w) => ['draft', 'in_progress', 'on_hold'].includes(w.status))
  return {
    open: open.length,
    inProgress: workOrders.filter((w) => w.status === 'in_progress').length,
    dueToday: workOrders.filter((w) => w.dueDate === today() && !['completed', 'closed', 'cancelled'].includes(w.status)).length,
    delayed: workOrders.filter(isDelayed).length,
    materialShortage: workOrders.filter((w) => w.materialStatus === 'shortage' || w.materialStatus === 'partial').length,
    plannedQty: workOrders.reduce((s, w) => s + w.plannedQty, 0),
    producedQty: workOrders.reduce((s, w) => s + w.producedQty, 0),
  }
}

export async function getWorkOrderSourceDocuments(source?: WorkOrderSource): Promise<WorkOrderSourceDocument[]> {
  await delay()
  if (source === 'manual') return []
  return seedWorkOrderSourceDocuments.filter((d) => d.source !== 'manual' && (!source || d.source === source))
}

export async function getWorkOrderSourceDetails(
  source: WorkOrderSource,
  documentId: string | null,
  itemId?: string,
): Promise<WorkOrderSourceDetails | null> {
  await delay()
  if (source === 'manual' || !documentId) return null
  const doc = seedWorkOrderSourceDocuments.find((d) => d.id === documentId && d.source === source)
  const finishedItemId = itemId ?? doc?.finishedItemId
  if (!doc || !finishedItemId) return null
  const defaults = await getFinishedItemDefaults(finishedItemId)
  if (!defaults) return null
  return {
    ...defaults,
    customerName: doc.customerName ?? '',
    requiredQty: doc.quantity ?? defaults.requiredQty,
    requiredDate: doc.requiredDate ?? defaults.requiredDate,
    project: doc.project,
    deliveryLocation: doc.deliveryLocation,
    priority: doc.priority ?? 'normal',
  }
}

export async function getFinishedItemDefaults(itemId: string): Promise<WorkOrderSourceDetails | null> {
  await delay()
  const bom = seedManufacturingBoms.find((b) => b.finishedItemId === itemId && b.status === 'active')
    ?? seedManufacturingBoms.find((b) => b.finishedItemId === itemId)
  if (!bom) return null
  return {
    customerName: '',
    finishedItemId: bom.finishedItemId,
    finishedItemCode: bom.finishedItemCode,
    finishedItemName: bom.finishedItemName,
    requiredQty: 1,
    requiredDate: today(),
    priority: 'normal',
    bomId: bom.id,
    bomNumber: bom.bomNumber,
    bomVersion: bom.version,
    uom: bom.baseUom,
    productionMethod: bom.productionMethod,
    materialWarehouseId: bom.defaultMaterialWarehouseId,
    materialWarehouseName: bom.defaultMaterialWarehouseName,
    fgWarehouseId: bom.defaultFgWarehouseId,
    fgWarehouseName: bom.defaultFgWarehouseName,
    plantId: 'plant-chakan',
    plantName: 'Chakan',
    costCentre: 'CC-MFG',
    qualityRequired: bom.qualityRequired,
    batchRequired: bom.batchRequired,
    serialRequired: bom.serialRequired,
  }
}

function buildMaterialsFromBom(woId: string, bomId: string | null, qty: number): WorkOrderMaterial[] {
  const bom = seedManufacturingBoms.find((b) => b.id === bomId)
  if (!bom) return []
  return bom.lines.map((line) => {
    const requiredQty = line.requiredQuantity * qty * (1 + line.scrapPercent / 100)
    const shortageQty = Math.max(0, requiredQty - line.availableStock)
    let status: WorkOrderMaterial['status'] = 'available'
    if (shortageQty > 0 && line.availableStock === 0) status = 'shortage'
    else if (shortageQty > 0) status = 'partial'
    return {
      id: `wom-${woId}-${line.componentItemCode}`,
      workOrderId: woId,
      componentItemId: line.componentItemId,
      componentItemCode: line.componentItemCode,
      componentItemName: line.componentItemName,
      requiredQty,
      availableQty: line.availableStock,
      reservedQty: 0,
      consumedQty: 0,
      issuedQty: 0,
      returnedQty: 0,
      shortageQty,
      uom: line.uom,
      warehouseId: line.warehouseId,
      warehouseName: line.warehouseName,
      tracking: line.uom === 'KG' ? 'batch' : 'none',
      status,
    }
  })
}

export async function createWorkOrder(input: CreateWorkOrderInput): Promise<{ ok: boolean; workOrder?: WorkOrder; error?: string }> {
  await delay()
  const defaults = await getFinishedItemDefaults(input.finishedItemId)
  if (!defaults) return { ok: false, error: 'Active BOM not found for finished item' }
  woSeq += 1
  const id = `mfg-wo-${crypto.randomUUID().slice(0, 8)}`
  const wo: WorkOrder = recompute({
    id,
    woNumber: `WO-2026-${String(woSeq).padStart(4, '0')}`,
    finishedItemId: defaults.finishedItemId,
    finishedItemCode: defaults.finishedItemCode,
    finishedItemName: defaults.finishedItemName,
    uom: defaults.uom,
    plannedQty: input.plannedQty,
    producedQty: 0,
    rejectedQty: 0,
    scrapQty: 0,
    reworkQty: 0,
    remainingQty: input.plannedQty,
    startDate: input.startDate,
    dueDate: input.dueDate,
    source: input.source,
    sourceDocumentId: input.sourceDocumentId ?? null,
    sourceDocumentNo: input.sourceDocumentNo ?? (input.source === 'manual' ? 'MANUAL' : ''),
    customerId: null,
    customerName: input.customerName ?? '',
    salesOrderId: input.salesOrderId ?? null,
    salesOrderNo: input.salesOrderNo ?? '',
    project: input.project,
    deliveryLocation: input.deliveryLocation,
    productionMethod: input.productionMethod ?? defaults.productionMethod,
    plantId: input.plantId ?? defaults.plantId,
    plantName: input.plantName ?? defaults.plantName,
    materialWarehouseId: input.materialWarehouseId ?? defaults.materialWarehouseId,
    materialWarehouseName: input.materialWarehouseName ?? defaults.materialWarehouseName,
    fgWarehouseId: input.fgWarehouseId ?? defaults.fgWarehouseId,
    fgWarehouseName: input.fgWarehouseName ?? defaults.fgWarehouseName,
    costCentre: input.costCentre ?? defaults.costCentre,
    bomId: input.bomId ?? defaults.bomId ?? null,
    bomNumber: input.bomNumber ?? defaults.bomNumber ?? '',
    bomVersion: input.bomVersion ?? defaults.bomVersion ?? '',
    qualityRequired: input.qualityRequired ?? defaults.qualityRequired,
    batchRequired: input.batchRequired ?? defaults.batchRequired,
    serialRequired: input.serialRequired ?? defaults.serialRequired,
    materialStatus: 'not_checked',
    progressPercent: 0,
    status: 'draft',
    priority: input.priority ?? defaults.priority,
    consumptionMode: 'automatic',
    qualityHold: false,
    createdAt: now(),
    updatedAt: now(),
    createdBy: 'Demo User',
  })
  workOrders = [wo, ...workOrders]
  materials = [...buildMaterialsFromBom(id, wo.bomId, wo.plannedQty), ...materials]
  refreshMaterialStatus(id)
  pushActivity(id, 'Work Order Created', { relatedDocument: wo.sourceDocumentNo })
  return { ok: true, workOrder: workOrders.find((w) => w.id === id)! }
}

export async function updateWorkOrder(
  id: string,
  patch: Partial<CreateWorkOrderInput>,
): Promise<{ ok: boolean; workOrder?: WorkOrder; error?: string }> {
  await delay()
  const idx = workOrders.findIndex((w) => w.id === id)
  if (idx < 0) return { ok: false, error: 'Work order not found' }
  const existing = workOrders[idx]
  if (existing.status === 'closed' || existing.status === 'cancelled') return { ok: false, error: 'Work order is read-only' }
  if (existing.status !== 'draft' && patch.plannedQty != null && patch.plannedQty !== existing.plannedQty) {
    return { ok: false, error: 'Only draft work orders can change planned quantity' }
  }
  const next = recompute({ ...existing, ...patch, id, woNumber: existing.woNumber })
  workOrders[idx] = next
  if (patch.plannedQty && patch.plannedQty !== existing.plannedQty) {
    materials = materials.filter((m) => m.workOrderId !== id)
    materials = [...buildMaterialsFromBom(id, next.bomId, next.plannedQty), ...materials]
    refreshMaterialStatus(id)
  }
  pushActivity(id, 'Work Order Updated')
  return { ok: true, workOrder: workOrders[idx] }
}

export async function cancelWorkOrderDemo(
  id: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  await delay()
  const idx = workOrders.findIndex((w) => w.id === id)
  if (idx < 0) return { ok: false, error: 'Not found' }
  if (workOrders[idx].status === 'closed' || workOrders[idx].status === 'cancelled') return { ok: false, error: 'Read-only' }
  if (['completed', 'closed', 'cancelled'].includes(workOrders[idx].status)) {
    return { ok: false, error: 'Cannot cancel in current status' }
  }
  workOrders[idx] = { ...workOrders[idx], status: 'cancelled', updatedAt: now() }
  pushActivity(id, 'Work Order Cancelled', { comment: reason })
  return { ok: true }
}

export async function getWorkOrderMaterials(workOrderId: string): Promise<WorkOrderMaterial[]> {
  await delay()
  return materialsFor(workOrderId).map((m) => ({ ...m }))
}

export async function checkWorkOrderMaterialAvailability(
  workOrderId: string,
): Promise<{ ok: boolean; materials: WorkOrderMaterial[]; warnings: string[] }> {
  await delay()
  const lines = materialsFor(workOrderId).map((m) => {
    const shortageQty = Math.max(0, m.requiredQty - m.availableQty)
    let status: WorkOrderMaterial['status'] = 'available'
    if (shortageQty > 0 && m.availableQty === 0) status = 'shortage'
    else if (shortageQty > 0) status = 'partial'
    else if (m.reservedQty > 0) status = 'reserved'
    return { ...m, shortageQty, status }
  })
  materials = materials.map((m) => lines.find((l) => l.id === m.id) ?? m)
  refreshMaterialStatus(workOrderId)
  pushActivity(workOrderId, 'Materials Checked')
  const warnings = lines.filter((l) => l.shortageQty > 0).map((l) => `${l.componentItemCode}: short ${l.shortageQty}`)
  return { ok: true, materials: lines, warnings }
}

export async function reserveWorkOrderMaterialsDemo(
  workOrderId: string,
): Promise<{ ok: boolean; preview: MaterialReservationPreview; error?: string }> {
  await delay()
  const lines = materialsFor(workOrderId)
  const previewLines = lines.map((m) => {
    const reservableQty = Math.min(m.availableQty, m.requiredQty - m.reservedQty)
    return {
      componentItemCode: m.componentItemCode,
      required: m.requiredQty,
      available: m.availableQty,
      reservable: Math.max(0, reservableQty),
      shortage: Math.max(0, m.requiredQty - m.availableQty),
    }
  })
  materials = materials.map((m) => {
    if (m.workOrderId !== workOrderId) return m
    const reservable = Math.min(m.availableQty, m.requiredQty - m.reservedQty)
    if (reservable <= 0) return m
    return {
      ...m,
      reservedQty: m.reservedQty + reservable,
      status: m.shortageQty > 0 ? 'partial' : 'reserved',
    }
  })
  refreshMaterialStatus(workOrderId)
  pushActivity(workOrderId, 'Materials Reserved')
  return {
    ok: true,
    preview: {
      workOrderId,
      lines: previewLines,
      canReserveAll: previewLines.every((l) => l.shortage === 0),
      warnings: previewLines.filter((l) => l.shortage > 0).map((l) => `${l.componentItemCode} shortage`),
    },
  }
}

export async function releaseWorkOrderReservationsDemo(
  workOrderId: string,
): Promise<{ ok: boolean; error?: string }> {
  await delay()
  materials = materials.map((m) =>
    m.workOrderId === workOrderId
      ? { ...m, reservedQty: 0, status: m.shortageQty > 0 ? (m.availableQty > 0 ? 'partial' : 'shortage') : 'available' }
      : m,
  )
  refreshMaterialStatus(workOrderId)
  pushActivity(workOrderId, 'Reservations Released')
  return { ok: true }
}

export async function createPurchaseRequisitionFromShortageDemo(
  workOrderId: string,
): Promise<{ ok: boolean; prDraftNo?: string; error?: string }> {
  await delay()
  const short = materialsFor(workOrderId).filter((m) => m.shortageQty > 0)
  if (!short.length) return { ok: false, error: 'No shortages' }
  const prDraftNo = `PR-DRAFT-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
  pushActivity(workOrderId, 'Purchase Requisition Draft Created', { relatedDocument: prDraftNo })
  return { ok: true, prDraftNo }
}

export async function createTransferFromShortageDemo(
  workOrderId: string,
): Promise<{ ok: boolean; transferDraftNo?: string; error?: string }> {
  await delay()
  const transferDraftNo = `ST-DRAFT-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
  pushActivity(workOrderId, 'Stock Transfer Draft Created', { relatedDocument: transferDraftNo })
  return { ok: true, transferDraftNo }
}

export async function startWorkOrderDemo(
  req: ProductionStartRequest & { blockOnShortage?: boolean },
): Promise<{ ok: boolean; workOrder?: WorkOrder; warnings: string[]; error?: string }> {
  await delay()
  const idx = workOrders.findIndex((w) => w.id === req.workOrderId)
  if (idx < 0) return { ok: false, warnings: [], error: 'Not found' }
  const wo = workOrders[idx]
  if (wo.status !== 'draft') return { ok: false, warnings: [], error: 'Only draft work orders can start' }
  const warnings: string[] = []
  if (!wo.bomId) warnings.push('Missing active BOM')
  if (wo.materialStatus === 'shortage' || wo.materialStatus === 'partial') warnings.push('Material shortage')
  if (!wo.fgWarehouseId) warnings.push('No output warehouse')
  if (wo.qualityRequired && !wo.bomId) warnings.push('Quality configuration missing')
  const settings = await getManufacturingSettings()
  const blockOnShortage = req.blockOnShortage ?? settings.materialConsumption.blockStartOnShortage
  if (blockOnShortage && (wo.materialStatus === 'shortage' || wo.materialStatus === 'partial')) {
    return { ok: false, warnings, error: 'Material shortage blocks start (setup)' }
  }
  workOrders[idx] = {
    ...wo,
    status: 'in_progress',
    startedAt: req.startAt,
    supervisor: req.supervisor,
    shift: req.shift,
    workstation: req.workstation,
    updatedAt: now(),
  }
  pushActivity(req.workOrderId, 'Production Started', { comment: req.remarks, quantity: wo.plannedQty })
  return { ok: true, workOrder: workOrders[idx], warnings }
}

export async function holdWorkOrderDemo(
  req: ProductionHoldRequest,
): Promise<{ ok: boolean; error?: string }> {
  await delay()
  const idx = workOrders.findIndex((w) => w.id === req.workOrderId)
  if (idx < 0) return { ok: false, error: 'Not found' }
  if (workOrders[idx].status !== 'in_progress') return { ok: false, error: 'Only in-progress WOs can be held' }
  workOrders[idx] = {
    ...workOrders[idx],
    status: 'on_hold',
    holdReason: req.reason,
    expectedResumeDate: req.expectedResumeDate,
    updatedAt: now(),
  }
  pushActivity(req.workOrderId, 'Production Paused', { comment: `${req.reason}: ${req.remarks ?? ''}`.trim() })
  return { ok: true }
}

export async function resumeWorkOrderDemo(
  req: ProductionResumeRequest,
): Promise<{ ok: boolean; error?: string }> {
  await delay()
  const idx = workOrders.findIndex((w) => w.id === req.workOrderId)
  if (idx < 0) return { ok: false, error: 'Not found' }
  if (workOrders[idx].status !== 'on_hold') return { ok: false, error: 'Only on-hold WOs can resume' }
  workOrders[idx] = {
    ...workOrders[idx],
    status: 'in_progress',
    holdReason: undefined,
    expectedResumeDate: undefined,
    updatedAt: now(),
  }
  pushActivity(req.workOrderId, 'Production Resumed', { comment: req.resolutionNote })
  return { ok: true }
}

export async function getWorkOrderActivity(workOrderId: string): Promise<WorkOrderActivity[]> {
  await delay()
  return activities.filter((a) => a.workOrderId === workOrderId)
}

export async function getWorkOrderJobCardPreview(
  workOrderId: string,
): Promise<{ ok: boolean; preview: string; error?: string }> {
  await delay()
  const wo = workOrders.find((w) => w.id === workOrderId)
  if (!wo) return { ok: false, preview: '', error: 'Not found' }
  return {
    ok: true,
    preview: `Job Card Preview\n${wo.woNumber}\n${wo.finishedItemCode} × ${wo.plannedQty}\nStatus: ${wo.status}`,
  }
}

export async function getProductionCompletionPreview(
  workOrderId: string,
  goodQty = 0,
): Promise<ProductionCompletionPreview | null> {
  await delay()
  const wo = workOrders.find((w) => w.id === workOrderId)
  if (!wo) return null
  const cost = costPreview(wo)
  return {
    plannedQty: wo.plannedQty,
    previouslyProduced: wo.producedQty,
    remainingQty: wo.remainingQty,
    currentOutput: goodQty,
    fgWarehouseName: wo.fgWarehouseName,
    qualityRequired: wo.qualityRequired,
    estimatedCost: cost.costPerGoodUnit * Math.max(1, goodQty || wo.producedQty),
    materialConsumption: await getAutomaticConsumptionPreview(workOrderId, goodQty) ?? {
      lines: [],
      totalShortage: 0,
      warnings: [],
    },
    warnings: wo.materialStatus === 'shortage' ? ['Material shortage on some components'] : [],
    blockers: [],
  }
}

function applyConsumption(woId: string, outputQty: number) {
  const wo = workOrders.find((w) => w.id === woId)
  if (!wo || wo.consumptionMode !== 'automatic') return
  const factor = outputQty / Math.max(1, wo.plannedQty)
  materials = materials.map((m) => {
    if (m.workOrderId !== woId) return m
    const consume = Math.min(m.requiredQty - m.consumedQty, Math.round(m.requiredQty * factor * 1000) / 1000)
    const consumedQty = m.consumedQty + consume
    const issuedQty = Math.max(m.issuedQty, consumedQty)
    return {
      ...m,
      consumedQty,
      issuedQty,
      status: consumedQty >= m.requiredQty ? 'consumed' : m.status,
    }
  })
}

export async function getAutomaticConsumptionPreview(
  workOrderId: string,
  outputQty: number,
): Promise<MaterialConsumptionPreview | null> {
  await delay()
  const wo = workOrders.find((w) => w.id === workOrderId)
  if (!wo) return null
  const factor = outputQty / Math.max(1, wo.plannedQty)
  const lines = materialsFor(workOrderId).map((m) => {
    const requiredForOutput = Math.round(m.requiredQty * factor * 1000) / 1000
    return {
      componentItemCode: m.componentItemCode,
      componentItemName: m.componentItemName,
      requiredForOutput,
      available: m.availableQty + m.reservedQty,
      batchMethod: (m.tracking === 'batch' ? 'fifo' : 'manual') as 'fifo' | 'fefo' | 'manual',
      selectedBatches: m.tracking === 'batch' ? ['FIFO-AUTO'] : [],
      shortage: Math.max(0, requiredForOutput - m.availableQty - m.reservedQty),
      uom: m.uom,
    }
  })
  return {
    lines,
    totalShortage: lines.reduce((total, line) => total + line.shortage, 0),
    warnings: lines.filter((l) => l.shortage > 0).map((l) => `${l.componentItemCode} short for output`),
  }
}

export async function confirmAutomaticConsumptionDemo(workOrderId: string, outputQty: number) {
  await delay()
  applyConsumption(workOrderId, outputQty)
  pushActivity(workOrderId, 'Materials Consumed', { quantity: outputQty })
  return { ok: true as const }
}

export async function saveProductionProgressDemo(
  workOrderId: string,
  input: { goodQty: number; rejectedQty?: number; scrapQty?: number; reworkQty?: number; productionDate?: string; batchNo?: string; serialNos?: string[]; comment?: string },
): Promise<{ ok: boolean; error?: string }> {
  await delay()
  const idx = workOrders.findIndex((w) => w.id === workOrderId)
  if (idx < 0) return { ok: false, error: 'Not found' }
  const wo = workOrders[idx]
  if (['closed', 'cancelled'].includes(wo.status) || !['in_progress', 'on_hold'].includes(wo.status)) return { ok: false, error: 'Cannot record output' }
  if (input.goodQty <= 0) return { ok: false, error: 'Good quantity is required' }
  const entry: ProductionOutputEntry = {
    id: `out-${crypto.randomUUID().slice(0, 8)}`,
    workOrderId,
    at: now(),
    goodQty: input.goodQty,
    rejectedQty: input.rejectedQty ?? 0,
    scrapQty: input.scrapQty ?? 0,
    reworkQty: input.reworkQty ?? 0,
    batchNo: input.batchNo,
    serialNumbers: input.serialNos,
    productionDate: input.productionDate ?? today(),
    userName: 'Demo User',
    remark: input.comment,
  }
  outputs = [entry, ...outputs]
  const producedQty = wo.producedQty + input.goodQty
  workOrders[idx] = recompute({
    ...wo,
    producedQty,
    rejectedQty: wo.rejectedQty + (input.rejectedQty ?? 0),
    scrapQty: wo.scrapQty + (input.scrapQty ?? 0),
    reworkQty: wo.reworkQty + (input.reworkQty ?? 0),
  })
  if (wo.consumptionMode === 'automatic') applyConsumption(workOrderId, input.goodQty)
  if (wo.qualityRequired) {
    qualityReviews = [
      {
        id: `qr-${crypto.randomUUID().slice(0, 8)}`,
        workOrderId,
        outputEntryId: entry.id,
        finishedItemCode: wo.finishedItemCode,
        finishedItemName: wo.finishedItemName,
        batchNo: input.batchNo,
        serialNumbers: input.serialNos,
        producedQty: input.goodQty,
        acceptedQty: 0,
        rejectedQty: 0,
        reworkQty: 0,
        result: 'pending',
        at: now(),
      },
      ...qualityReviews,
    ]
    workOrders[idx] = { ...workOrders[idx], qualityHold: true }
  }
  pushActivity(workOrderId, 'Production Completed', { quantity: input.goodQty, comment: 'Progress saved' })
  return { ok: true }
}

export async function completeProductionQuantityDemo(
  workOrderId: string,
  input: Parameters<typeof saveProductionProgressDemo>[1] & { differenceReason?: string },
): Promise<{ ok: boolean; error?: string }> {
  await delay()
  const idx = workOrders.findIndex((w) => w.id === workOrderId)
  if (idx < 0) return { ok: false, error: 'Not found' }
  const wo = workOrders[idx]
  const newProduced = wo.producedQty + input.goodQty
  if (newProduced < wo.plannedQty && !input.differenceReason && newProduced + (input.rejectedQty ?? 0) + (input.scrapQty ?? 0) < wo.plannedQty) {
    // partial is allowed without reason
  }
  if (newProduced > wo.plannedQty && !input.differenceReason) {
    return { ok: false, error: 'Overproduction requires a difference reason' }
  }
  const saved = await saveProductionProgressDemo(workOrderId, input)
  if (!saved.ok) return saved
  const after = workOrders.find((w) => w.id === workOrderId)!
  if (after.producedQty >= after.plannedQty) {
    const i = workOrders.findIndex((w) => w.id === workOrderId)
    workOrders[i] = {
      ...workOrders[i],
      status: workOrders[i].qualityHold ? 'in_progress' : 'completed',
      completedAt: workOrders[i].qualityHold ? workOrders[i].completedAt : now(),
      updatedAt: now(),
    }
    if (!workOrders[i].qualityHold) {
      pushActivity(workOrderId, 'Work Order Completed', { quantity: after.producedQty })
    }
  }
  return { ok: true }
}

export async function completeAndCloseWorkOrderDemo(
  workOrderId: string,
  input: Parameters<typeof completeProductionQuantityDemo>[1],
): Promise<{ ok: boolean; error?: string }> {
  const completed = await completeProductionQuantityDemo(workOrderId, input)
  if (!completed.ok) return completed
  const wo = workOrders.find((w) => w.id === workOrderId)
  if (wo?.qualityHold) return { ok: false, error: 'Quality hold — complete inspection before close' }
  return closeWorkOrderDemo(workOrderId)
}

export async function getManualMaterialIssuePreview(workOrderId: string): Promise<MaterialIssueLine[]> {
  await delay()
  return materialsFor(workOrderId).map((m) => ({
    id: m.id,
    componentItemId: m.componentItemId,
    componentItemCode: m.componentItemCode,
    componentItemName: m.componentItemName,
    requiredQty: m.requiredQty,
    previouslyIssued: m.issuedQty,
    pendingQty: Math.max(0, m.requiredQty - m.issuedQty),
    availableQty: m.availableQty,
    issueQty: Math.max(0, Math.min(m.availableQty, m.requiredQty - m.issuedQty)),
    status: m.status,
    uom: m.uom,
  }))
}

export async function confirmManualMaterialIssueDemo(
  workOrderId: string,
  lines: Array<{ materialId: string; issueQty: number; batchOrSerial?: string }>,
): Promise<{ ok: boolean; error?: string }> {
  await delay()
  materials = materials.map((m) => {
    const line = lines.find((l) => l.materialId === m.id)
    if (!line || m.workOrderId !== workOrderId) return m
    return {
      ...m,
      issuedQty: m.issuedQty + line.issueQty,
      // Batch and serial selection is intentionally demo-only metadata.
      status: m.issuedQty + line.issueQty >= m.requiredQty ? 'reserved' : m.status,
    }
  })
  pushActivity(workOrderId, 'Material Issued', { comment: 'Manual issue demo' })
  return { ok: true }
}

export async function returnUnusedMaterialDemo(
  workOrderId: string,
  lines: Array<{ materialId: string; returnQty: number; reason?: string }>,
): Promise<{ ok: boolean; error?: string }> {
  await delay()
  materials = materials.map((m) => {
    const line = lines.find((l) => l.materialId === m.id)
    if (!line || m.workOrderId !== workOrderId) return m
    const returnable = Math.max(0, m.issuedQty - m.consumedQty - m.returnedQty)
    const returnQty = Math.min(returnable, line.returnQty)
    return { ...m, returnedQty: m.returnedQty + returnQty }
  })
  pushActivity(workOrderId, 'Material Returned')
  return { ok: true }
}

export async function getMaterialReturnPreview(workOrderId: string): Promise<MaterialReturnLine[]> {
  await delay()
  return materialsFor(workOrderId).map((m) => ({
    id: m.id,
    componentItemId: m.componentItemId,
    componentItemCode: m.componentItemCode,
    componentItemName: m.componentItemName,
    issuedQty: m.issuedQty,
    consumedQty: m.consumedQty,
    returnableQty: Math.max(0, m.issuedQty - m.consumedQty - m.returnedQty),
    returnQty: Math.max(0, m.issuedQty - m.consumedQty - m.returnedQty),
    warehouseName: m.warehouseName,
    uom: m.uom,
  }))
}

export async function getProductionQualityReview(workOrderId: string): Promise<ProductionQualityReview | null> {
  await delay()
  return qualityReviews.find((q) => q.workOrderId === workOrderId && q.result === 'pending')
    ?? qualityReviews.find((q) => q.workOrderId === workOrderId)
    ?? null
}

export async function updateProductionQualityResultDemo(
  workOrderId: string,
  patch: Partial<ProductionQualityReview>,
): Promise<{ ok: boolean; error?: string }> {
  await delay()
  const idx = qualityReviews.findIndex((q) => q.workOrderId === workOrderId && q.result === 'pending')
  if (idx < 0) return { ok: false, error: 'No pending quality review' }
  qualityReviews[idx] = { ...qualityReviews[idx], ...patch }
  const woIdx = workOrders.findIndex((w) => w.id === workOrderId)
  if (woIdx >= 0) {
    const result = qualityReviews[idx].result
    workOrders[woIdx] = {
      ...workOrders[woIdx],
      qualityHold: result === 'pending',
      rejectedQty: workOrders[woIdx].rejectedQty + (patch.rejectedQty ?? 0),
      reworkQty: workOrders[woIdx].reworkQty + (patch.reworkQty ?? 0),
      updatedAt: now(),
    }
    if (result !== 'pending' && workOrders[woIdx].producedQty >= workOrders[woIdx].plannedQty) {
      workOrders[woIdx] = { ...workOrders[woIdx], status: 'completed', completedAt: now(), qualityHold: false }
    }
  }
  pushActivity(workOrderId, 'Quality Review', { comment: patch.result })
  return { ok: true }
}

export async function recordProductionScrapDemo(
  workOrderId: string,
  input: { scrapQty: number; reason: ScrapReason; recoverableQty?: number; remarks?: string },
): Promise<{ ok: boolean; scrap?: ProductionScrap; error?: string }> {
  await delay()
  const wo = workOrders.find((w) => w.id === workOrderId)
  if (!wo) return { ok: false, error: 'Not found' }
  const scrap: ProductionScrap = {
    id: `scr-${crypto.randomUUID().slice(0, 8)}`,
    workOrderId,
    scrapQty: input.scrapQty,
    reason: input.reason,
    recoverableQty: input.recoverableQty ?? 0,
    scrapWarehouseName: 'Scrap Yard',
    scrapPercent: wo.plannedQty > 0 ? Math.round((input.scrapQty / wo.plannedQty) * 1000) / 10 : 0,
    estimatedValue: input.scrapQty * 200,
    remarks: input.remarks,
    at: now(),
    userName: 'Demo User',
  }
  scraps = [scrap, ...scraps]
  const idx = workOrders.findIndex((w) => w.id === workOrderId)
  workOrders[idx] = { ...workOrders[idx], scrapQty: workOrders[idx].scrapQty + input.scrapQty, updatedAt: now() }
  pushActivity(workOrderId, 'Scrap Recorded', { quantity: input.scrapQty, comment: input.reason })
  return { ok: true, scrap }
}

export async function createProductionReworkDemo(
  workOrderId: string,
  input: { reworkQty: number; reason: string; expectedCompletionDate?: string; workstation?: string; responsiblePerson?: string; remarks?: string },
): Promise<{ ok: boolean; rework?: ProductionRework; error?: string }> {
  await delay()
  const rework: ProductionRework = {
    id: `rw-${crypto.randomUUID().slice(0, 8)}`,
    workOrderId,
    reworkNo: `RW-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
    reworkQty: input.reworkQty,
    reason: input.reason,
    expectedCompletionDate: input.expectedCompletionDate ?? today(),
    workstation: input.workstation,
    responsiblePerson: input.responsiblePerson,
    status: 'open',
    remarks: input.remarks,
    at: now(),
    userName: 'Demo User',
  }
  reworks = [rework, ...reworks]
  const idx = workOrders.findIndex((w) => w.id === workOrderId)
  if (idx >= 0) {
    workOrders[idx] = { ...workOrders[idx], reworkQty: workOrders[idx].reworkQty + input.reworkQty, updatedAt: now() }
  }
  pushActivity(workOrderId, 'Rework Created', { quantity: input.reworkQty, relatedDocument: rework.reworkNo })
  return { ok: true, rework }
}

export async function updateProductionReworkDemo(
  reworkId: string,
  patch: Partial<ProductionRework>,
): Promise<{ ok: boolean; error?: string }> {
  await delay()
  const idx = reworks.findIndex((r) => r.id === reworkId)
  if (idx < 0) return { ok: false, error: 'Not found' }
  reworks[idx] = { ...reworks[idx], ...patch }
  pushActivity(reworks[idx].workOrderId, 'Rework Updated', { relatedDocument: reworks[idx].reworkNo })
  return { ok: true }
}

export async function getWorkOrderClosingPreview(workOrderId: string): Promise<WorkOrderClosingPreview | null> {
  await delay()
  const wo = workOrders.find((w) => w.id === workOrderId)
  if (!wo) return null
  const mats = materialsFor(workOrderId)
  const materialConsumed = mats.reduce((s, m) => s + m.consumedQty, 0)
  const materialReturned = mats.reduce((s, m) => s + m.returnedQty, 0)
  const materialRequired = mats.reduce((s, m) => s + m.requiredQty, 0)
  const openRework = reworks.filter((r) => r.workOrderId === workOrderId && ['open', 'in_progress'].includes(r.status)).length
  const blocking: string[] = []
  if (wo.qualityHold) blocking.push('Quality hold open')
  if (openRework > 0) blocking.push('Open rework exists')
  return {
    plannedQty: wo.plannedQty,
    goodQty: wo.producedQty,
    rejectedQty: wo.rejectedQty,
    scrapQty: wo.scrapQty,
    reworkQty: wo.reworkQty,
    materialConsumed,
    materialReturned,
    materialDifference: materialConsumed - materialRequired * (wo.producedQty / Math.max(1, wo.plannedQty)),
    qualityStatus: wo.qualityHold ? 'Hold' : wo.qualityRequired ? 'Complete' : 'Not required',
    openRework,
    openJobWork: wo.productionMethod === 'job_work' ? 1 : 0,
    cost: costPreview(wo),
    variance: variancePreview(wo),
    blockers: blocking,
    warnings: [],
  }
}

export async function closeWorkOrderDemo(workOrderId: string): Promise<{ ok: boolean; error?: string }> {
  await delay()
  const idx = workOrders.findIndex((w) => w.id === workOrderId)
  if (idx < 0) return { ok: false, error: 'Not found' }
  const wo = workOrders[idx]
  if (wo.status !== 'completed' && wo.producedQty < wo.plannedQty) {
    return { ok: false, error: 'Complete production before closing' }
  }
  if (wo.qualityHold) return { ok: false, error: 'Quality hold open' }
  workOrders[idx] = {
    ...wo,
    status: 'closed',
    closedAt: now(),
    completedAt: wo.completedAt ?? now(),
    updatedAt: now(),
  }
  pushActivity(workOrderId, 'Work Order Closed')
  return { ok: true }
}

export async function closeWorkOrderWithDifferenceDemo(
  workOrderId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  await delay()
  if (!reason.trim()) return { ok: false, error: 'Difference reason required' }
  const idx = workOrders.findIndex((w) => w.id === workOrderId)
  if (idx < 0) return { ok: false, error: 'Not found' }
  workOrders[idx] = {
    ...workOrders[idx],
    status: 'closed',
    closedAt: now(),
    completedAt: workOrders[idx].completedAt ?? now(),
    updatedAt: now(),
  }
  pushActivity(workOrderId, 'Work Order Closed', { comment: `Difference: ${reason}` })
  return { ok: true }
}

export async function reopenWorkOrderDemo(workOrderId: string): Promise<{ ok: boolean; error?: string }> {
  await delay()
  const idx = workOrders.findIndex((w) => w.id === workOrderId)
  if (idx < 0) return { ok: false, error: 'Not found' }
  if (workOrders[idx].status !== 'closed') return { ok: false, error: 'Only closed WOs can reopen' }
  workOrders[idx] = {
    ...workOrders[idx],
    status: 'in_progress',
    closedAt: undefined,
    updatedAt: now(),
  }
  pushActivity(workOrderId, 'Work Order Reopened')
  return { ok: true }
}

export async function getProductionCostPreview(workOrderId: string): Promise<ProductionCostPreview | null> {
  await delay()
  const wo = workOrders.find((w) => w.id === workOrderId)
  return wo ? costPreview(wo) : null
}

export async function getProductionVariancePreview(workOrderId: string): Promise<ProductionVariancePreview | null> {
  await delay()
  const wo = workOrders.find((w) => w.id === workOrderId)
  return wo ? variancePreview(wo) : null
}

export async function getProductionOutputs(workOrderId: string): Promise<ProductionOutputEntry[]> {
  await delay()
  return outputs.filter((o) => o.workOrderId === workOrderId)
}

export const getWorkOrderOutputs = getProductionOutputs

export async function getProductionReworks(workOrderId: string): Promise<ProductionRework[]> {
  await delay()
  return reworks.filter((r) => r.workOrderId === workOrderId)
}
