import type { BomLineEnriched } from '../types/bom'
import type { Item } from '../types/master'
import type { MrpRun, MrpWoRequirement } from '../types/mrp'
import type {
  WorkOrderConfig,
  WorkOrderMaterialLine,
  WorkOrderType,
  WoMaterialLineStatus,
} from '../types/workorder'
import { computeMaterialLineStatus, DEFAULT_WO_CONFIG } from '../types/workorder'
import { sortBySubAssemblyCreationOrder } from './woCreationOrder'
import type { BomSourceType } from '../types/bom'

export interface WoMaterialDraft {
  itemId: string
  itemCode: string
  warehouseId: string
  uomId: string
  requiredQty: number
  sourceType: BomSourceType
  pegBomLineId: string | null
}

export interface WoCreateDraft {
  woType: WorkOrderType
  outputItemId: string
  outputItemCode: string
  qty: number
  vendorId: string | null
  mrpWoRequirementId: string | null
  materials: WoMaterialDraft[]
  remarks: string
}

function collectLeafMaterials(
  node: BomLineEnriched,
  orderQty: number,
  acc: WoMaterialDraft[],
): void {
  const rule = node.subAssemblyRule

  if (rule === 'phantom') {
    node.children.forEach((c) => collectLeafMaterials(c, orderQty, acc))
    return
  }

  if ((rule === 'manufactured' || rule === 'subcontracted') && node.children.length > 0) {
    node.children.forEach((c) => collectLeafMaterials(c, orderQty, acc))
    return
  }

  if (rule === 'purchased' || node.children.length === 0) {
    const requiredQty = node.qtyPerProduct * orderQty * (1 + node.scrapPct / 100)
    acc.push({
      itemId: node.itemId,
      itemCode: node.itemCode,
      warehouseId: node.issueWarehouseId,
      uomId: node.uomId,
      requiredQty,
      sourceType: node.sourceType,
      pegBomLineId: node.id,
    })
    return
  }

  node.children.forEach((c) => collectLeafMaterials(c, orderQty, acc))
}

export function explodeMaterialsForNode(
  bomRoots: BomLineEnriched[],
  outputItemId: string,
  orderQty: number,
): WoMaterialDraft[] {
  function findNode(nodes: BomLineEnriched[]): BomLineEnriched | undefined {
    for (const n of nodes) {
      if (n.itemId === outputItemId) return n
      const found = findNode(n.children)
      if (found) return found
    }
    return undefined
  }

  const node = findNode(bomRoots)
  if (!node) return []

  const acc: WoMaterialDraft[] = []
  if (node.children.length > 0) {
    node.children.forEach((c) => collectLeafMaterials(c, orderQty, acc))
  } else {
    collectLeafMaterials(node, orderQty, acc)
  }
  return mergeMaterialDrafts(acc)
}

export function explodeAllLeafMaterials(bomRoots: BomLineEnriched[], orderQty: number): WoMaterialDraft[] {
  const acc: WoMaterialDraft[] = []
  bomRoots.forEach((root) => collectLeafMaterials(root, orderQty, acc))
  return mergeMaterialDrafts(acc)
}

const SA_RECEIPT_WAREHOUSE_BY_RULE: Record<string, string> = {
  manufactured: 'WIP_ASSEMBLY',
  subcontracted: 'WIP_FINAL',
}

/** BOM root sub-assemblies consumed by the FG assembly WO. */
export function explodeFgSubAssemblyMaterials(
  bomRoots: BomLineEnriched[],
  orderQty: number,
): WoMaterialDraft[] {
  const acc: WoMaterialDraft[] = []
  for (const node of bomRoots) {
    if (node.subAssemblyRule !== 'manufactured' && node.subAssemblyRule !== 'subcontracted') continue
    const warehouseCode = SA_RECEIPT_WAREHOUSE_BY_RULE[node.subAssemblyRule] ?? 'WIP_ASSEMBLY'
    acc.push({
      itemId: node.itemId,
      itemCode: node.itemCode,
      warehouseId: warehouseCode,
      uomId: node.uomId,
      requiredQty: node.qtyPerProduct * orderQty * (1 + node.scrapPct / 100),
      sourceType: node.sourceType,
      pegBomLineId: node.id,
    })
  }
  return acc
}

function mergeMaterialDrafts(lines: WoMaterialDraft[]): WoMaterialDraft[] {
  const map = new Map<string, WoMaterialDraft>()
  for (const line of lines) {
    const key = `${line.itemId}:${line.warehouseId}`
    const existing = map.get(key)
    if (existing) {
      existing.requiredQty += line.requiredQty
    } else {
      map.set(key, { ...line })
    }
  }
  return [...map.values()]
}

export function buildWoDraftsFromMrp(
  mrpRun: MrpRun,
  salesOrderId: string,
  productFgItemId: string,
  productFgItemCode: string,
  orderQty: number,
  bomRoots: BomLineEnriched[],
  config: WorkOrderConfig = DEFAULT_WO_CONFIG,
): WoCreateDraft[] {
  const woReqs = mrpRun.woRequirements.filter((w) => w.salesOrderId === salesOrderId)
  const materials = mrpRun.materialLines.filter((m) => m.salesOrderId === salesOrderId)
  const drafts: WoCreateDraft[] = []

  if (config.creationMode === 'one_per_trailer' && config.createFinishedGoodsWo) {
    drafts.push({
      woType: 'finished_goods',
      outputItemId: productFgItemId,
      outputItemCode: productFgItemCode,
      qty: orderQty,
      vendorId: null,
      mrpWoRequirementId: null,
      materials: materials.map((m) => ({
        itemId: m.itemId,
        itemCode: m.itemCode,
        warehouseId: m.warehouseId,
        uomId: '',
        requiredQty: m.requiredQty,
        sourceType: m.sourceType,
        pegBomLineId: m.pegBomLineId,
      })),
      remarks: `FG Work Order — ${orderQty} unit(s)`,
    })
    return drafts
  }

  if (config.createManufacturedSubAssemblyWo) {
    const manufactured = sortBySubAssemblyCreationOrder(
      woReqs.filter((w) => w.subAssemblyRule === 'manufactured'),
    )
    for (const req of manufactured) {
      drafts.push(woDraftFromRequirement(req, bomRoots, orderQty))
    }
  }

  if (config.createSubcontractWo) {
    const subcontracted = sortBySubAssemblyCreationOrder(
      woReqs.filter((w) => w.subAssemblyRule === 'subcontracted'),
    )
    for (const req of subcontracted) {
      drafts.push(woDraftFromRequirement(req, bomRoots, orderQty))
    }
  }

  if (config.createFinishedGoodsWo) {
    drafts.push({
      woType: 'finished_goods',
      outputItemId: productFgItemId,
      outputItemCode: productFgItemCode,
      qty: orderQty,
      vendorId: null,
      mrpWoRequirementId: null,
      materials: explodeFgSubAssemblyMaterials(bomRoots, orderQty),
      remarks: `FG assembly WO — consumes sub-assemblies`,
    })
  }

  return drafts
}

function woDraftFromRequirement(
  req: MrpWoRequirement,
  bomRoots: BomLineEnriched[],
  orderQty: number,
): WoCreateDraft {
  const woType: WorkOrderType = req.subAssemblyRule === 'subcontracted' ? 'subcontract' : 'manufactured_sub_assembly'
  return {
    woType,
    outputItemId: req.itemId,
    outputItemCode: req.itemCode,
    qty: req.requiredQty,
    vendorId: null,
    mrpWoRequirementId: req.id,
    materials: explodeMaterialsForNode(bomRoots, req.itemId, orderQty),
    remarks: `${req.itemName} — ${req.subAssemblyRule}`,
  }
}

export function toMaterialLine(
  id: string,
  workOrderId: string,
  draft: WoMaterialDraft,
  items: Item[],
  options?: {
    sourceWoId?: string | null
    resolveWarehouseId?: (codeOrId: string) => string
  },
): WorkOrderMaterialLine {
  const item = items.find((i) => i.id === draft.itemId)
  const uomId = draft.uomId || item?.baseUomId || ''
  const warehouseId = options?.resolveWarehouseId?.(draft.warehouseId) ?? draft.warehouseId
  const line: WorkOrderMaterialLine = {
    id,
    workOrderId,
    itemId: draft.itemId,
    itemCode: draft.itemCode,
    warehouseId,
    uomId,
    requiredQty: draft.requiredQty,
    reservedQty: 0,
    issuedQty: 0,
    balanceQty: draft.requiredQty,
    sourceType: draft.sourceType,
    status: 'open' as WoMaterialLineStatus,
    pegBomLineId: draft.pegBomLineId,
    sourceWoId: options?.sourceWoId ?? null,
  }
  line.status = computeMaterialLineStatus(line)
  return line
}
