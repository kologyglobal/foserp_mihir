import type {
  BillOfMaterial,
  BomCostPreview,
  BomLine,
  BomStatus,
  ManufacturingAuditEntry,
  ManufacturingDashboard,
  ManufacturingFilter,
  ProductionMethod,
  ProductionPlanLine,
} from '../../types/manufacturing'
import {
  calcRequiredProductionQty,
  seedManufacturingAudit,
  seedManufacturingBoms,
  seedManufacturingDashboard,
  seedProductionPlan,
} from '../../data/manufacturing/seed'

const delay = (ms = 80) => new Promise((r) => setTimeout(r, ms))

let boms: BillOfMaterial[] = structuredClone(seedManufacturingBoms)
let planLines: ProductionPlanLine[] = structuredClone(seedProductionPlan)
let audit: ManufacturingAuditEntry[] = structuredClone(seedManufacturingAudit)
let woDraftSeq = 100

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
  effectiveFrom?: string
  effectiveTo?: string | null
  defaultMaterialWarehouseId?: string
  defaultMaterialWarehouseName?: string
  defaultFgWarehouseId?: string
  defaultFgWarehouseName?: string
  lines: Omit<BomLine, 'id' | 'lineNo'>[]
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

  const lines: BomLine[] = input.lines.map((l, i) => ({
    ...l,
    id: `mfg-bom-line-${crypto.randomUUID().slice(0, 8)}`,
    lineNo: i + 1,
  }))

  let bom: BillOfMaterial = {
    id: `mfg-bom-${crypto.randomUUID().slice(0, 8)}`,
    bomNumber: nextBomNumber(),
    finishedItemId: input.finishedItemId,
    finishedItemCode: input.finishedItemCode,
    finishedItemName: input.finishedItemName,
    itemCategory: input.itemCategory ?? 'Finished Goods',
    productionQuantity: input.productionQuantity,
    baseUom: input.baseUom ?? 'NOS',
    version: 'V1',
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
    qualityRequired: true,
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
    ? patch.lines.map((l, i) => ({
        ...l,
        id: 'id' in l && typeof (l as BomLine).id === 'string' ? (l as BomLine).id : `mfg-bom-line-${crypto.randomUUID().slice(0, 8)}`,
        lineNo: i + 1,
      }))
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
    effectiveFrom,
    effectiveTo: effectiveTo ?? null,
    defaultMaterialWarehouseId: patch.defaultMaterialWarehouseId ?? current.defaultMaterialWarehouseId,
    defaultMaterialWarehouseName: patch.defaultMaterialWarehouseName ?? current.defaultMaterialWarehouseName,
    defaultFgWarehouseId: patch.defaultFgWarehouseId ?? current.defaultFgWarehouseId,
    defaultFgWarehouseName: patch.defaultFgWarehouseName ?? current.defaultFgWarehouseName,
    lines: linesInput as BomLine[],
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
  const materialCost = bom.lines.reduce((s, l) => s + l.estimatedCost, 0)
  const estimatedLabourCost = bom.productionMethod === 'job_work' ? 0 : materialCost * 0.12
  const estimatedMachineCost = bom.productionMethod === 'job_work' ? 0 : materialCost * 0.05
  const jobWorkCost = bom.productionMethod === 'in_house'
    ? 0
    : bom.lines.filter((l) => l.supplyMethod === 'vendor_supplied').reduce((s, l) => s + l.estimatedCost, 0) * 0.1
  const overhead = materialCost * 0.08
  const scrapRecovery = bom.lines.reduce((s, l) => s + (l.estimatedCost * l.scrapPercent) / 100 / 4, 0)
  const totalEstimatedCost = materialCost + estimatedLabourCost + estimatedMachineCost + jobWorkCost + overhead - scrapRecovery
  const qty = bom.productionQuantity || 1
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

export async function getProductionPlan(): Promise<ProductionPlanLine[]> {
  await delay()
  return planLines.filter((p) => !p.ignored).map((p) => {
    const requiredProductionQuantity = calcRequiredProductionQty(
      p.demandQuantity,
      p.safetyStock,
      p.availableFinishedStock,
      p.openWorkOrderQuantity,
    )
    return structuredClone({ ...p, requiredProductionQuantity })
  })
}

export async function checkPlannedMaterialAvailability(
  planLineIds?: string[],
): Promise<ProductionPlanLine[]> {
  await delay()
  planLines = planLines.map((p) => {
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
  return getProductionPlan()
}

export async function createWorkOrderDraftFromPlanDemo(
  planLineId: string,
): Promise<{ ok: true; workOrderNo: string } | { ok: false; error: string }> {
  await delay()
  const line = planLines.find((p) => p.id === planLineId)
  if (!line || line.ignored) return { ok: false, error: 'Plan line not found' }
  if (line.requiredProductionQuantity <= 0) return { ok: false, error: 'No production quantity required' }
  woDraftSeq += 1
  const workOrderNo = `WO-DRAFT-${woDraftSeq}`
  planLines = planLines.map((p) =>
    p.id === planLineId
      ? {
          ...p,
          openWorkOrderQuantity: p.openWorkOrderQuantity + p.requiredProductionQuantity,
          requiredProductionQuantity: 0,
        }
      : p,
  )
  pushAudit({
    entityType: 'work_order_draft',
    entityId: workOrderNo,
    action: 'Draft created from plan',
    userName: 'Demo User',
    remarks: line.sourceDocumentNo,
  })
  return { ok: true, workOrderNo }
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
  const idx = planLines.findIndex((p) => p.id === planLineId)
  if (idx < 0) return { ok: false, error: 'Plan line not found' }
  planLines[idx] = { ...planLines[idx], ignored: true }
  pushAudit({
    entityType: 'production_plan',
    entityId: planLineId,
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
  const idx = planLines.findIndex((p) => p.id === planLineId)
  if (idx < 0) return { ok: false, error: 'Plan line not found' }
  const cur = planLines[idx]
  const next = {
    ...cur,
    ...patch,
    requiredProductionQuantity: calcRequiredProductionQty(
      patch.demandQuantity ?? cur.demandQuantity,
      cur.safetyStock,
      cur.availableFinishedStock,
      cur.openWorkOrderQuantity,
    ),
  }
  planLines[idx] = next
  return { ok: true, line: structuredClone(next) }
}

export async function getManufacturingAuditTrail(entityId?: string): Promise<ManufacturingAuditEntry[]> {
  await delay()
  const rows = entityId ? audit.filter((a) => a.entityId === entityId) : audit
  return structuredClone(rows)
}

/** Test helper — reset in-memory demo state */
export function __resetManufacturingDemoState(): void {
  boms = structuredClone(seedManufacturingBoms)
  planLines = structuredClone(seedProductionPlan)
  audit = structuredClone(seedManufacturingAudit)
  woDraftSeq = 100
}
