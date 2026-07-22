import type {
  BillOfMaterial,
  BomCostPreview,
  BomLine,
  BomStatus,
  BomWhereUsedRow,
  ManufacturingAuditEntry,
  ManufacturingDashboard,
  ManufacturingFilter,
  ProductionMethod,
  ProductionPlan,
  ProductionPlanLine,
  ProductionPlanSource,
  ProductionPlanStatus,
} from '../../types/manufacturing'
import {
  calcRequiredProductionQty,
  seedManufacturingAudit,
  seedManufacturingBoms,
  seedManufacturingDashboard,
  seedProductionPlans,
} from '../../data/manufacturing/seed'
import { buildProductionPlanAiInsights } from '../../utils/manufacturing/insights'
import { isApiMode } from '../../config/apiConfig'
import * as planApi from '../api/manufacturingApi'
import { mapApiProductionPlan, planSourceToApi } from './productionPlanApiMapper'

const delay = (ms = 80) => new Promise((r) => setTimeout(r, ms))

function apiErr(e: unknown): string {
  return e instanceof Error ? e.message : 'Request failed'
}

let boms: BillOfMaterial[] = structuredClone(seedManufacturingBoms)
let plans: ProductionPlan[] = structuredClone(seedProductionPlans)
let audit: ManufacturingAuditEntry[] = structuredClone(seedManufacturingAudit)
let woDraftSeq = 100

function nextPlanNo(): string {
  const n = plans.length + 1
  return `PP-2026-${String(n).padStart(4, '0')}`
}

function enrichLine(line: ProductionPlanLine): ProductionPlanLine {
  const requiredProductionQuantity = calcRequiredProductionQty(
    line.demandQuantity,
    line.safetyStock,
    line.availableFinishedStock,
    line.openWorkOrderQuantity,
  )
  const shortageQty = Math.max(0, line.demandQuantity - line.availableFinishedStock)
  return {
    ...line,
    requiredProductionQuantity: line.woCreated ? 0 : requiredProductionQuantity,
    shortageQty,
  }
}

function recomputePlan(plan: ProductionPlan): ProductionPlan {
  const lines = plan.lines.map(enrichLine)
  const active = lines.filter((l) => !l.ignored)
  return {
    ...plan,
    lines,
    totalItems: active.length,
    plannedQty: active.reduce((s, l) => s + (l.woCreated ? l.openWorkOrderQuantity || l.demandQuantity : l.requiredProductionQuantity || l.demandQuantity), 0),
    wosCreated: active.filter((l) => l.woCreated).length,
    updatedAt: new Date().toISOString(),
  }
}

function findLine(planLineId: string): { planIdx: number; lineIdx: number; line: ProductionPlanLine } | null {
  for (let planIdx = 0; planIdx < plans.length; planIdx++) {
    const lineIdx = plans[planIdx].lines.findIndex((l) => l.id === planLineId)
    if (lineIdx >= 0) return { planIdx, lineIdx, line: plans[planIdx].lines[lineIdx] }
  }
  return null
}

function allPlanLines(): ProductionPlanLine[] {
  return plans.flatMap((p) => p.lines.map(enrichLine))
}

function nextBomNumber(): string {
  const n = boms.length + 1
  return `BOM-MFG-${String(n).padStart(4, '0')}`
}

function pushAudit(entry: Omit<ManufacturingAuditEntry, 'id' | 'at'>): void {
  audit = [
    {
      id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      at: new Date().toISOString(),
      ...entry,
    },
    ...audit,
  ]
}

function recomputeLineCount(bom: BillOfMaterial): BillOfMaterial {
  const estimatedCost = bom.lines.reduce((s, l) => s + l.estimatedCost, 0)
  return {
    ...bom,
    componentCount: bom.lines.length,
    estimatedCost,
    updatedAt: new Date().toISOString(),
  }
}

function matchesFilter(bom: BillOfMaterial, filter?: ManufacturingFilter): boolean {
  if (!filter) return true
  const q = filter.search?.trim().toLowerCase()
  if (q) {
    const hay = `${bom.bomNumber} ${bom.finishedItemCode} ${bom.finishedItemName} ${bom.itemCategory}`.toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (filter.bomNumber && !bom.bomNumber.toLowerCase().includes(filter.bomNumber.toLowerCase())) return false
  if (filter.finishedItem) {
    const f = filter.finishedItem.toLowerCase()
    if (!bom.finishedItemCode.toLowerCase().includes(f) && !bom.finishedItemName.toLowerCase().includes(f)) return false
  }
  if (filter.itemCategory && bom.itemCategory !== filter.itemCategory) return false
  if (filter.version && bom.version !== filter.version) return false
  if (filter.productionMethod && bom.productionMethod !== filter.productionMethod) return false
  if (filter.status && bom.status !== filter.status) return false
  if (filter.effectiveFrom && bom.effectiveFrom < filter.effectiveFrom) return false
  if (filter.effectiveTo && bom.effectiveFrom > filter.effectiveTo) return false

  switch (filter.tab) {
    case 'draft':
      return bom.status === 'draft'
    case 'active':
      return bom.status === 'active'
    case 'inactive':
      return bom.status === 'inactive'
    case 'in_house':
      return bom.productionMethod === 'in_house'
    case 'job_work':
      return bom.productionMethod === 'job_work'
    case 'mixed':
      return bom.productionMethod === 'mixed'
    default:
      return true
  }
}

export async function getManufacturingDashboard(): Promise<ManufacturingDashboard> {
  await delay()
  return structuredClone(seedManufacturingDashboard)
}

export async function getBoms(filter?: ManufacturingFilter): Promise<BillOfMaterial[]> {
  await delay()
  return boms.filter((b) => matchesFilter(b, filter)).map((b) => structuredClone(b))
}

export async function getBomById(id: string): Promise<BillOfMaterial | null> {
  await delay()
  const bom = boms.find((b) => b.id === id)
  return bom ? structuredClone(bom) : null
}

export type CreateBomInput = {
  finishedItemId: string
  finishedItemCode: string
  finishedItemName: string
  itemCategory?: string
  productionQuantity: number
  productionMethod: ProductionMethod
  baseUom?: string
  version?: string
  effectiveFrom?: string
  effectiveTo?: string | null
  defaultMaterialWarehouseId?: string
  defaultMaterialWarehouseName?: string
  defaultFgWarehouseId?: string
  defaultFgWarehouseName?: string
  qualityRequired?: boolean
  autoConsumption?: boolean
  lines: Omit<BomLine, 'id' | 'lineNo'>[]
}

function normalizeLine(l: Omit<BomLine, 'id' | 'lineNo'> | BomLine, i: number): BomLine {
  const issueMethod = l.issueMethod ?? (l.supplyMethod === 'vendor_supplied' ? 'manual' : 'auto')
  const supplyMethod =
    l.supplyMethod
    ?? (issueMethod === 'manual' ? 'vendor_supplied' : 'inventory')
  return {
    ...l,
    id: 'id' in l && typeof (l as BomLine).id === 'string'
      ? (l as BomLine).id
      : `mfg-bom-line-${crypto.randomUUID().slice(0, 8)}`,
    lineNo: i + 1,
    issueMethod,
    supplyMethod,
    remarks: l.remarks ?? '',
  }
}

function validateBomPayload(
  finishedItemId: string,
  productionQuantity: number,
  lines: { componentItemId: string; requiredQuantity: number }[],
  effectiveFrom: string,
  effectiveTo: string | null | undefined,
): string | null {
  if (!finishedItemId.trim()) return 'Finished Item is required'
  if (!(productionQuantity > 0)) return 'Production Quantity must be greater than zero'
  if (lines.length === 0) return 'At least one material line is required'
  if (lines.some((l) => l.componentItemId === finishedItemId)) {
    return 'Finished Item cannot be used as its own component'
  }
  const seen = new Set<string>()
  for (const l of lines) {
    if (!(l.requiredQuantity > 0)) return 'Material quantity must be greater than zero'
    if (seen.has(l.componentItemId)) return 'Duplicate component lines are not allowed'
    seen.add(l.componentItemId)
  }
  if (effectiveTo && effectiveTo < effectiveFrom) return 'Effective To must be on or after Effective From'
  return null
}

export async function createBom(input: CreateBomInput): Promise<{ ok: true; bom: BillOfMaterial } | { ok: false; error: string }> {
  await delay()
  const effectiveFrom = input.effectiveFrom ?? new Date().toISOString().slice(0, 10)
  const err = validateBomPayload(
    input.finishedItemId,
    input.productionQuantity,
    input.lines,
    effectiveFrom,
    input.effectiveTo,
  )
  if (err) return { ok: false, error: err }

  const lines: BomLine[] = input.lines.map((l, i) => normalizeLine(l, i))

  let bom: BillOfMaterial = {
    id: `mfg-bom-${crypto.randomUUID().slice(0, 8)}`,
    bomNumber: nextBomNumber(),
    finishedItemId: input.finishedItemId,
    finishedItemCode: input.finishedItemCode,
    finishedItemName: input.finishedItemName,
    itemCategory: input.itemCategory ?? 'Finished Goods',
    productionQuantity: input.productionQuantity,
    baseUom: input.baseUom ?? 'NOS',
    version: input.version?.trim() || 'V1',
    effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    productionMethod: input.productionMethod,
    defaultMaterialWarehouseId: input.defaultMaterialWarehouseId ?? 'wh-rm',
    defaultMaterialWarehouseName: input.defaultMaterialWarehouseName ?? 'RM Stores',
    defaultFgWarehouseId: input.defaultFgWarehouseId ?? 'wh-fg',
    defaultFgWarehouseName: input.defaultFgWarehouseName ?? 'FG Stores',
    status: 'draft',
    componentCount: lines.length,
    estimatedCost: 0,
    standardCost: 0,
    qualityRequired: input.qualityRequired ?? true,
    autoConsumption: input.autoConsumption ?? true,
    batchRequired: false,
    serialRequired: false,
    lines,
    previousVersionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'Demo User',
  }
  bom = recomputeLineCount(bom)
  boms = [bom, ...boms]
  pushAudit({ entityType: 'bom', entityId: bom.id, action: 'Created', userName: 'Demo User' })
  return { ok: true, bom: structuredClone(bom) }
}

export async function updateBom(
  id: string,
  patch: Partial<CreateBomInput> & { status?: BomStatus },
): Promise<{ ok: true; bom: BillOfMaterial } | { ok: false; error: string }> {
  await delay()
  const idx = boms.findIndex((b) => b.id === id)
  if (idx < 0) return { ok: false, error: 'BOM not found' }
  const current = boms[idx]

  const linesInput = patch.lines
    ? patch.lines.map((l, i) => normalizeLine(l, i))
    : current.lines

  const finishedItemId = patch.finishedItemId ?? current.finishedItemId
  const productionQuantity = patch.productionQuantity ?? current.productionQuantity
  const effectiveFrom = patch.effectiveFrom ?? current.effectiveFrom
  const effectiveTo = patch.effectiveTo !== undefined ? patch.effectiveTo : current.effectiveTo

  const err = validateBomPayload(finishedItemId, productionQuantity, linesInput, effectiveFrom, effectiveTo)
  if (err) return { ok: false, error: err }

  let next: BillOfMaterial = {
    ...current,
    finishedItemId,
    finishedItemCode: patch.finishedItemCode ?? current.finishedItemCode,
    finishedItemName: patch.finishedItemName ?? current.finishedItemName,
    itemCategory: patch.itemCategory ?? current.itemCategory,
    productionQuantity,
    productionMethod: patch.productionMethod ?? current.productionMethod,
    baseUom: patch.baseUom ?? current.baseUom,
    version: patch.version ?? current.version,
    effectiveFrom,
    effectiveTo: effectiveTo ?? null,
    defaultMaterialWarehouseId: patch.defaultMaterialWarehouseId ?? current.defaultMaterialWarehouseId,
    defaultMaterialWarehouseName: patch.defaultMaterialWarehouseName ?? current.defaultMaterialWarehouseName,
    defaultFgWarehouseId: patch.defaultFgWarehouseId ?? current.defaultFgWarehouseId,
    defaultFgWarehouseName: patch.defaultFgWarehouseName ?? current.defaultFgWarehouseName,
    qualityRequired: patch.qualityRequired ?? current.qualityRequired,
    autoConsumption: patch.autoConsumption ?? current.autoConsumption,
    lines: linesInput,
    status: patch.status ?? current.status,
  }
  next = recomputeLineCount(next)
  boms[idx] = next
  pushAudit({ entityType: 'bom', entityId: id, action: 'Updated', userName: 'Demo User' })
  return { ok: true, bom: structuredClone(next) }
}

export async function duplicateBom(id: string): Promise<{ ok: true; bom: BillOfMaterial } | { ok: false; error: string }> {
  await delay()
  const src = boms.find((b) => b.id === id)
  if (!src) return { ok: false, error: 'BOM not found' }
  const copy: BillOfMaterial = recomputeLineCount({
    ...structuredClone(src),
    id: `mfg-bom-${crypto.randomUUID().slice(0, 8)}`,
    bomNumber: nextBomNumber(),
    version: 'V1',
    status: 'draft',
    previousVersionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'Demo User',
    lines: src.lines.map((l) => ({
      ...l,
      id: `mfg-bom-line-${crypto.randomUUID().slice(0, 8)}`,
    })),
  })
  boms = [copy, ...boms]
  pushAudit({ entityType: 'bom', entityId: copy.id, action: 'Duplicated', userName: 'Demo User', remarks: `From ${src.bomNumber}` })
  return { ok: true, bom: structuredClone(copy) }
}

export async function createBomVersion(id: string): Promise<{ ok: true; bom: BillOfMaterial } | { ok: false; error: string }> {
  await delay()
  const src = boms.find((b) => b.id === id)
  if (!src) return { ok: false, error: 'BOM not found' }
  const verNum = Number(src.version.replace(/\D/g, '')) || 1
  const nextVer = `V${verNum + 1}`
  const copy: BillOfMaterial = recomputeLineCount({
    ...structuredClone(src),
    id: `mfg-bom-${crypto.randomUUID().slice(0, 8)}`,
    bomNumber: nextBomNumber(),
    version: nextVer,
    status: 'draft',
    previousVersionId: src.id,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'Demo User',
    lines: src.lines.map((l) => ({
      ...l,
      id: `mfg-bom-line-${crypto.randomUUID().slice(0, 8)}`,
    })),
  })
  boms = [copy, ...boms]
  pushAudit({ entityType: 'bom', entityId: copy.id, action: 'New version', userName: 'Demo User', remarks: `${src.version} → ${nextVer}` })
  return { ok: true, bom: structuredClone(copy) }
}

export async function activateBom(id: string): Promise<{ ok: true; bom: BillOfMaterial } | { ok: false; error: string }> {
  await delay()
  const idx = boms.findIndex((b) => b.id === id)
  if (idx < 0) return { ok: false, error: 'BOM not found' }
  const bom = boms[idx]
  // Deactivate other active versions for same finished item overlapping date
  boms = boms.map((b) => {
    if (b.id === id) return b
    if (b.finishedItemId === bom.finishedItemId && b.status === 'active') {
      return { ...b, status: 'inactive' as BomStatus, updatedAt: new Date().toISOString() }
    }
    return b
  })
  const next = { ...bom, status: 'active' as BomStatus, updatedAt: new Date().toISOString() }
  boms[idx] = next
  pushAudit({ entityType: 'bom', entityId: id, action: 'Activated', userName: 'Demo User' })
  return { ok: true, bom: structuredClone(next) }
}

export async function deactivateBom(id: string): Promise<{ ok: true; bom: BillOfMaterial } | { ok: false; error: string }> {
  await delay()
  const idx = boms.findIndex((b) => b.id === id)
  if (idx < 0) return { ok: false, error: 'BOM not found' }
  const next = { ...boms[idx], status: 'inactive' as BomStatus, updatedAt: new Date().toISOString() }
  boms[idx] = next
  pushAudit({ entityType: 'bom', entityId: id, action: 'Deactivated', userName: 'Demo User' })
  return { ok: true, bom: structuredClone(next) }
}

export async function getBomCostPreview(id: string): Promise<BomCostPreview | null> {
  await delay()
  const bom = boms.find((b) => b.id === id)
  if (!bom) return null
  return estimateBomCost(bom.lines, bom.productionQuantity, bom.productionMethod)
}

export function estimateBomCost(
  lines: Pick<BomLine, 'estimatedCost' | 'scrapPercent' | 'supplyMethod' | 'issueMethod'>[],
  productionQuantity: number,
  productionMethod: ProductionMethod,
): BomCostPreview {
  const materialCost = lines.reduce((s, l) => s + l.estimatedCost, 0)
  const estimatedLabourCost = productionMethod === 'job_work' ? 0 : materialCost * 0.12
  const estimatedMachineCost = productionMethod === 'job_work' ? 0 : materialCost * 0.05
  const jobWorkCost = productionMethod === 'in_house'
    ? 0
    : lines
      .filter((l) => l.supplyMethod === 'vendor_supplied' || l.issueMethod === 'manual')
      .reduce((s, l) => s + l.estimatedCost, 0) * 0.1
  const overhead = materialCost * 0.08
  const scrapRecovery = lines.reduce((s, l) => s + (l.estimatedCost * l.scrapPercent) / 100 / 4, 0)
  const totalEstimatedCost = materialCost + estimatedLabourCost + estimatedMachineCost + jobWorkCost + overhead - scrapRecovery
  const qty = productionQuantity || 1
  return {
    materialCost,
    estimatedLabourCost,
    estimatedMachineCost,
    jobWorkCost,
    overhead,
    scrapRecovery,
    totalEstimatedCost,
    estimatedCostPerUnit: totalEstimatedCost / qty,
  }
}

export async function getBomWhereUsed(bomId: string): Promise<BomWhereUsedRow[]> {
  await delay()
  const bom = boms.find((b) => b.id === bomId)
  if (!bom) return []
  const rows: BomWhereUsedRow[] = []

  for (const other of boms) {
    if (other.id === bomId) continue
    if (other.finishedItemId === bom.finishedItemId || other.previousVersionId === bomId) {
      rows.push({
        id: other.id,
        documentType: 'BOM Version',
        documentNo: `${other.bomNumber} (${other.version})`,
        status: other.status,
        href: `/manufacturing/bom/${other.id}`,
      })
    }
  }

  try {
    const { getWorkOrders } = await import('./workOrderService')
    const wos = await getWorkOrders()
    for (const wo of wos) {
      if (wo.bomId === bomId) {
        rows.push({
          id: wo.id,
          documentType: 'Work Order',
          documentNo: wo.woNumber,
          status: wo.status,
          qty: wo.plannedQty,
          href: `/manufacturing/work-orders/${wo.id}`,
        })
      }
    }
  } catch {
    /* WO store optional in isolation */
  }

  try {
    const { getJobWorkOrders } = await import('./jobWorkService')
    const jws = await getJobWorkOrders()
    for (const jw of jws) {
      if (jw.bomId === bomId) {
        rows.push({
          id: jw.id,
          documentType: 'Job Work',
          documentNo: jw.jwNumber,
          status: jw.status,
          href: `/manufacturing/job-work/${jw.id}`,
        })
      }
    }
  } catch {
    /* JW store optional */
  }

  return rows
}

export async function getProductionPlans(filter?: {
  search?: string
  source?: ProductionPlanSource | ''
  status?: ProductionPlanStatus | ''
}): Promise<ProductionPlan[]> {
  if (isApiMode()) {
    try {
      const res = await planApi.listProductionPlans({
        search: filter?.search || undefined,
        sourceType: filter?.source ? planSourceToApi(filter.source) : undefined,
        status: filter?.status
          ? filter.status === 'work_orders_created'
            ? 'WORK_ORDERS_CREATED'
            : filter.status.toUpperCase()
          : undefined,
        limit: 100,
      })
      return (res.data ?? []).map(mapApiProductionPlan)
    } catch {
      return []
    }
  }
  await delay()
  return plans
    .map(recomputePlan)
    .filter((p) => {
      if (filter?.source && p.source !== filter.source) return false
      if (filter?.status && p.status !== filter.status) return false
      if (filter?.search) {
        const q = filter.search.toLowerCase()
        const hay = `${p.planNo} ${p.planName} ${p.owner} ${p.source}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    .map((p) => structuredClone(p))
}

export async function getProductionPlanById(id: string): Promise<ProductionPlan | null> {
  if (isApiMode()) {
    try {
      const res = await planApi.getProductionPlanApi(id)
      return res.data ? mapApiProductionPlan(res.data) : null
    } catch {
      return null
    }
  }
  await delay()
  const plan = plans.find((p) => p.id === id)
  return plan ? structuredClone(recomputePlan(plan)) : null
}

export type CreateProductionPlanInput = {
  planName: string
  planDate: string
  source: ProductionPlanSource
  warehouseId?: string
  warehouseName?: string
  planningPeriodFrom: string
  planningPeriodTo: string
  owner?: string
  lines: Array<{
    finishedItemId: string
    finishedItemCode: string
    finishedItemName: string
    demandQuantity: number
    availableFinishedStock?: number
    requiredDate: string
    productionMethod?: ProductionMethod
    sourceDocumentNo?: string
    bomStatus?: ProductionPlanLine['bomStatus']
    materialStatus?: ProductionPlanLine['materialStatus']
  }>
}

export async function createProductionPlan(
  input: CreateProductionPlanInput,
): Promise<{ ok: true; plan: ProductionPlan } | { ok: false; error: string }> {
  if (isApiMode()) {
    try {
      const res = await planApi.createProductionPlanApi({
        planName: input.planName,
        planDate: input.planDate,
        sourceType: planSourceToApi(input.source),
        warehouseId: input.warehouseId || undefined,
        periodFrom: input.planningPeriodFrom || undefined,
        periodTo: input.planningPeriodTo || undefined,
        lines: input.lines.map((l) => ({
          productItemId: l.finishedItemId,
          demandQuantity: l.demandQuantity,
          requiredDate: l.requiredDate,
          sourceDocumentNo: l.sourceDocumentNo,
        })),
      })
      if (!res.data) return { ok: false, error: 'Create failed' }
      return { ok: true, plan: mapApiProductionPlan(res.data) }
    } catch (e) {
      return { ok: false, error: apiErr(e) }
    }
  }
  await delay()
  if (!input.planName.trim()) return { ok: false, error: 'Plan name is required' }
  if (!input.planDate) return { ok: false, error: 'Plan date is required' }
  if (input.lines.length === 0) return { ok: false, error: 'Add at least one plan line' }
  if (input.lines.some((l) => !(l.demandQuantity > 0))) return { ok: false, error: 'Required qty must be greater than zero' }

  const planId = `pp-${crypto.randomUUID().slice(0, 8)}`
  const lines: ProductionPlanLine[] = input.lines.map((l) => {
    const available = l.availableFinishedStock ?? 0
    const required = calcRequiredProductionQty(l.demandQuantity, 0, available, 0)
    return {
      id: `plan-${crypto.randomUUID().slice(0, 8)}`,
      planId,
      finishedItemId: l.finishedItemId,
      finishedItemCode: l.finishedItemCode,
      finishedItemName: l.finishedItemName,
      source: input.source,
      sourceDocumentId: null,
      sourceDocumentNo: l.sourceDocumentNo ?? input.source.toUpperCase(),
      demandQuantity: l.demandQuantity,
      safetyStock: 0,
      availableFinishedStock: available,
      openWorkOrderQuantity: 0,
      requiredProductionQuantity: required,
      shortageQty: Math.max(0, l.demandQuantity - available),
      materialStatus: l.materialStatus ?? (available <= 0 ? 'shortage' : 'partial'),
      requiredDate: l.requiredDate,
      productionMethod: l.productionMethod ?? 'in_house',
      bomStatus: l.bomStatus ?? 'active',
      woCreated: false,
      ignored: false,
    }
  })

  let plan: ProductionPlan = {
    id: planId,
    planNo: nextPlanNo(),
    planName: input.planName.trim(),
    planDate: input.planDate,
    source: input.source,
    warehouseId: input.warehouseId ?? 'wh-fg',
    warehouseName: input.warehouseName ?? 'FG Stores',
    planningPeriodFrom: input.planningPeriodFrom,
    planningPeriodTo: input.planningPeriodTo,
    owner: input.owner?.trim() || 'Demo User',
    status: 'draft',
    totalItems: lines.length,
    plannedQty: 0,
    wosCreated: 0,
    lines,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'Demo User',
  }
  plan = recomputePlan(plan)
  plans = [plan, ...plans]
  pushAudit({ entityType: 'production_plan', entityId: plan.id, action: 'Created', userName: 'Demo User' })
  return { ok: true, plan: structuredClone(plan) }
}

export async function markProductionPlanPlanned(
  id: string,
): Promise<{ ok: true; plan: ProductionPlan } | { ok: false; error: string }> {
  if (isApiMode()) {
    try {
      await planApi.previewProductionPlanNetting(id)
      const res = await planApi.releaseProductionPlan(id)
      if (!res.data) return { ok: false, error: 'Release failed' }
      return { ok: true, plan: mapApiProductionPlan(res.data) }
    } catch (e) {
      return { ok: false, error: apiErr(e) }
    }
  }
  await delay()
  const idx = plans.findIndex((p) => p.id === id)
  if (idx < 0) return { ok: false, error: 'Plan not found' }
  if (plans[idx].status === 'cancelled' || plans[idx].status === 'closed') {
    return { ok: false, error: 'Cannot plan a closed or cancelled plan' }
  }
  plans[idx] = recomputePlan({ ...plans[idx], status: 'planned' })
  pushAudit({ entityType: 'production_plan', entityId: id, action: 'Marked Planned', userName: 'Demo User' })
  return { ok: true, plan: structuredClone(plans[idx]) }
}

export async function closeProductionPlan(
  id: string,
): Promise<{ ok: true; plan: ProductionPlan } | { ok: false; error: string }> {
  if (isApiMode()) {
    try {
      const res = await planApi.closeProductionPlanApi(id)
      if (!res.data) return { ok: false, error: 'Close failed' }
      return { ok: true, plan: mapApiProductionPlan(res.data) }
    } catch (e) {
      return { ok: false, error: apiErr(e) }
    }
  }
  await delay()
  const idx = plans.findIndex((p) => p.id === id)
  if (idx < 0) return { ok: false, error: 'Plan not found' }
  plans[idx] = recomputePlan({ ...plans[idx], status: 'closed' })
  pushAudit({ entityType: 'production_plan', entityId: id, action: 'Closed', userName: 'Demo User' })
  return { ok: true, plan: structuredClone(plans[idx]) }
}

export function getProductionPlanAiSuggestions(plan: ProductionPlan): string[] {
  return buildProductionPlanAiInsights(plan)
}

/** Flattened lines (legacy smoke / helpers) */
export async function getProductionPlan(): Promise<ProductionPlanLine[]> {
  await delay()
  return allPlanLines().filter((p) => !p.ignored).map((p) => structuredClone(p))
}

export async function checkPlannedMaterialAvailability(
  planLineIds?: string[],
): Promise<ProductionPlanLine[]> {
  await delay()
  plans = plans.map((plan) => {
    const lines = plan.lines.map((p) => {
      if (planLineIds && !planLineIds.includes(p.id)) return p
      if (p.ignored) return p
      const need = calcRequiredProductionQty(
        p.demandQuantity,
        p.safetyStock,
        p.availableFinishedStock,
        p.openWorkOrderQuantity,
      )
      let materialStatus: ProductionPlanLine['materialStatus'] = 'available'
      if (need <= 0) materialStatus = 'available'
      else if (p.finishedItemCode.includes('TANK') || p.finishedItemCode.includes('CHS')) materialStatus = 'shortage'
      else if (need > 5) materialStatus = 'partial'
      else materialStatus = 'available'
      return { ...p, materialStatus, requiredProductionQuantity: need }
    })
    return recomputePlan({ ...plan, lines })
  })
  return getProductionPlan()
}

export async function createWorkOrderDraftFromPlanDemo(
  planLineId: string,
): Promise<{ ok: true; workOrderNo: string } | { ok: false; error: string }> {
  if (isApiMode()) {
    try {
      const list = await planApi.listProductionPlans({ limit: 100 })
      const parent = (list.data ?? []).find((p) => p.lines.some((l) => l.id === planLineId))
      if (!parent) return { ok: false, error: 'Plan line not found' }
      const res = await planApi.generateWorkOrdersFromPlanApi(parent.id, { lineIds: [planLineId] })
      const created = res.data?.created?.[0]
      if (!created) return { ok: false, error: 'No work order created' }
      return { ok: true, workOrderNo: created.orderNumber }
    } catch (e) {
      return { ok: false, error: apiErr(e) }
    }
  }
  await delay()
  const found = findLine(planLineId)
  if (!found || found.line.ignored) return { ok: false, error: 'Plan line not found' }
  const line = enrichLine(found.line)
  if (line.woCreated) return { ok: false, error: 'Work order already created for this line' }
  if (line.requiredProductionQuantity <= 0) return { ok: false, error: 'No production quantity required' }
  woDraftSeq += 1
  const workOrderNo = `WO-DRAFT-${woDraftSeq}`
  const plan = plans[found.planIdx]
  const lines = plan.lines.map((p, i) =>
    i === found.lineIdx
      ? {
          ...p,
          openWorkOrderQuantity: p.openWorkOrderQuantity + line.requiredProductionQuantity,
          requiredProductionQuantity: 0,
          woCreated: true,
          workOrderNo,
        }
      : p,
  )
  let next = recomputePlan({ ...plan, lines })
  const pending = next.lines.filter((l) => !l.ignored && !l.woCreated && l.requiredProductionQuantity > 0)
  if (pending.length === 0 && next.lines.some((l) => l.woCreated)) {
    next = { ...next, status: 'work_orders_created' }
  } else if (next.status === 'draft') {
    next = { ...next, status: 'planned' }
  }
  plans[found.planIdx] = next
  pushAudit({
    entityType: 'work_order_draft',
    entityId: workOrderNo,
    action: 'Draft created from plan',
    userName: 'Demo User',
    remarks: line.sourceDocumentNo,
  })
  return { ok: true, workOrderNo }
}

export async function generateWorkOrdersFromPlan(
  planId: string,
  planLineIds?: string[],
): Promise<{ ok: true; created: string[] } | { ok: false; error: string }> {
  if (isApiMode()) {
    try {
      const res = await planApi.generateWorkOrdersFromPlanApi(planId, {
        lineIds: planLineIds,
      })
      const created = (res.data?.created ?? []).map((c) => c.orderNumber)
      if (!created.length) return { ok: false, error: 'No work orders created' }
      return { ok: true, created }
    } catch (e) {
      return { ok: false, error: apiErr(e) }
    }
  }
  await delay()
  const plan = plans.find((p) => p.id === planId)
  if (!plan) return { ok: false, error: 'Plan not found' }
  if (plan.status === 'closed' || plan.status === 'cancelled') {
    return { ok: false, error: 'Cannot generate WOs from a closed or cancelled plan' }
  }
  const targets = plan.lines.filter((l) => {
    if (l.ignored || l.woCreated) return false
    if (planLineIds && !planLineIds.includes(l.id)) return false
    return enrichLine(l).requiredProductionQuantity > 0
  })
  if (targets.length === 0) return { ok: false, error: 'No eligible lines to create work orders' }
  const created: string[] = []
  for (const line of targets) {
    const r = await createWorkOrderDraftFromPlanDemo(line.id)
    if (r.ok) created.push(r.workOrderNo)
  }
  if (created.length === 0) return { ok: false, error: 'No work orders created' }
  return { ok: true, created }
}

export async function createSelectedWorkOrdersDemo(
  planLineIds: string[],
): Promise<{ ok: true; created: string[] } | { ok: false; error: string }> {
  await delay()
  if (planLineIds.length === 0) return { ok: false, error: 'Select at least one requirement' }
  const created: string[] = []
  for (const id of planLineIds) {
    const r = await createWorkOrderDraftFromPlanDemo(id)
    if (r.ok) created.push(r.workOrderNo)
  }
  if (created.length === 0) return { ok: false, error: 'No work orders created' }
  return { ok: true, created }
}

export async function ignoreProductionRequirementDemo(
  planLineId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await delay()
  const found = findLine(planLineId)
  if (!found) return { ok: false, error: 'Plan line not found' }
  const plan = plans[found.planIdx]
  const lines = plan.lines.map((p, i) => (i === found.lineIdx ? { ...p, ignored: true } : p))
  plans[found.planIdx] = recomputePlan({ ...plan, lines })
  pushAudit({
    entityType: 'production_plan',
    entityId: plan.id,
    action: 'Requirement ignored',
    userName: 'Demo User',
  })
  return { ok: true }
}

export async function updateProductionPlanLineDemo(
  planLineId: string,
  patch: Partial<Pick<ProductionPlanLine, 'demandQuantity' | 'requiredDate'>>,
): Promise<{ ok: true; line: ProductionPlanLine } | { ok: false; error: string }> {
  await delay()
  const found = findLine(planLineId)
  if (!found) return { ok: false, error: 'Plan line not found' }
  const plan = plans[found.planIdx]
  const cur = found.line
  const nextLine = enrichLine({
    ...cur,
    ...patch,
  })
  const lines = plan.lines.map((p, i) => (i === found.lineIdx ? nextLine : p))
  plans[found.planIdx] = recomputePlan({ ...plan, lines })
  return { ok: true, line: structuredClone(nextLine) }
}

export async function getManufacturingAuditTrail(entityId?: string): Promise<ManufacturingAuditEntry[]> {
  await delay()
  const rows = entityId ? audit.filter((a) => a.entityId === entityId) : audit
  return structuredClone(rows)
}

/** Test helper — reset in-memory demo state */
export function __resetManufacturingDemoState(): void {
  boms = structuredClone(seedManufacturingBoms)
  plans = structuredClone(seedProductionPlans)
  audit = structuredClone(seedManufacturingAudit)
  woDraftSeq = 100
}
