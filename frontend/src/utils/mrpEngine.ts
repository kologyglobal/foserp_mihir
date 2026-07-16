import type { BomHeader, BomLineEnriched } from '../types/bom'
import type { Item, ItemVendorMap, Product, Vendor, Warehouse } from '../types/master'
import type { StockMovement, StockReservation } from '../types/inventory'
import type {
  MrpException,
  MrpMaterialLine,
  MrpPeggingLink,
  MrpRiskStatus,
  MrpRunInput,
  MrpWoRequirement,
  SalesOrder,
} from '../types/mrp'
import { buildBomTree } from './bom'
import { computeFreeQty, computeOnHand, computeReservedQty } from './inventory'
import { getReleasedBomForProduct, isMrpEligibleStatus } from './mrp'

export interface MrpEngineContext {
  salesOrder: SalesOrder
  product: Product
  fgItem: Item
  bomHeader: BomHeader | undefined
  bomLines: BomLineEnriched[]
  items: Item[]
  warehouses: Warehouse[]
  movements: StockMovement[]
  reservations: StockReservation[]
  vendorMaps: ItemVendorMap[]
  vendors: Vendor[]
  getUomCode: (id: string) => string
  getWarehouseCode: (id: string) => string
}

function genLineId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function roundSuggestQty(shortage: number, reorderQty: number): number {
  if (shortage <= 0) return 0
  if (reorderQty <= 0) return shortage
  return Math.ceil(shortage / reorderQty) * reorderQty
}

function computeRisk(
  shortageQty: number,
  freeStock: number,
  requiredDate: string,
  leadTimeDays: number,
): MrpRiskStatus {
  if (shortageQty <= 0) return 'ready'
  const orderBy = addDays(requiredDate, leadTimeDays)
  const today = new Date().toISOString().slice(0, 10)
  if (orderBy < today) return 'delayed'
  if (freeStock <= 0) return 'critical'
  return 'low'
}

interface ExplosionAccum {
  materials: Omit<MrpMaterialLine, 'onHand' | 'reservedQty' | 'freeStock' | 'shortageQty' | 'suggestedPoQty' | 'suggestedPrQty' | 'riskStatus' | 'orderByDate' | 'preferredVendor'>[]
  woReqs: Omit<MrpWoRequirement, 'riskStatus'>[]
  pegging: Omit<MrpPeggingLink, 'id'>[]
}

function explodeNode(
  node: BomLineEnriched,
  orderQty: number,
  parentItemCode: string | null,
  ctx: Pick<MrpEngineContext, 'salesOrder' | 'product' | 'fgItem' | 'bomHeader'>,
  acc: ExplosionAccum,
): void {
  if (!ctx.bomHeader) return

  const requiredQty = node.qtyPerProduct * orderQty * (1 + node.scrapPct / 100)
  const rule = node.subAssemblyRule

  if (rule === 'phantom') {
    node.children.forEach((c) => explodeNode(c, orderQty, node.itemCode, ctx, acc))
    return
  }

  if (rule === 'manufactured' && node.children.length > 0) {
    acc.woReqs.push({
      id: genLineId('wo'),
      salesOrderId: ctx.salesOrder.id,
      salesOrderNo: ctx.salesOrder.salesOrderNo,
      productId: ctx.product.id,
      productName: ctx.product.productName,
      bomHeaderId: ctx.bomHeader.id,
      pegBomLineId: node.id,
      itemId: node.itemId,
      itemCode: node.itemCode,
      itemName: node.itemName,
      subAssemblyRule: 'manufactured',
      requiredQty,
      requiredDate: ctx.salesOrder.requiredDate,
      startByDate: addDays(ctx.salesOrder.requiredDate, node.leadTimeDays),
      warehouseId: node.issueWarehouseId,
      warehouseCode: node.issueWarehouseCode,
      leadTimeDays: node.leadTimeDays,
    })
    node.children.forEach((c) => explodeNode(c, orderQty, node.itemCode, ctx, acc))
    return
  }

  if (rule === 'subcontracted') {
    acc.woReqs.push({
      id: genLineId('wo'),
      salesOrderId: ctx.salesOrder.id,
      salesOrderNo: ctx.salesOrder.salesOrderNo,
      productId: ctx.product.id,
      productName: ctx.product.productName,
      bomHeaderId: ctx.bomHeader.id,
      pegBomLineId: node.id,
      itemId: node.itemId,
      itemCode: node.itemCode,
      itemName: node.itemName,
      subAssemblyRule: 'subcontracted',
      requiredQty,
      requiredDate: ctx.salesOrder.requiredDate,
      startByDate: addDays(ctx.salesOrder.requiredDate, node.leadTimeDays),
      warehouseId: node.issueWarehouseId,
      warehouseCode: node.issueWarehouseCode,
      leadTimeDays: node.leadTimeDays,
    })
    node.children.forEach((c) => explodeNode(c, orderQty, node.itemCode, ctx, acc))
    return
  }

  if (rule === 'purchased' || node.children.length === 0) {
    acc.materials.push({
      id: genLineId('ml'),
      salesOrderId: ctx.salesOrder.id,
      salesOrderNo: ctx.salesOrder.salesOrderNo,
      productId: ctx.product.id,
      productName: ctx.product.productName,
      fgItemCode: ctx.fgItem.itemCode,
      bomHeaderId: ctx.bomHeader.id,
      bomRevision: ctx.bomHeader.revision,
      pegBomLineId: node.id,
      pegParentItemCode: parentItemCode,
      itemId: node.itemId,
      itemCode: node.itemCode,
      itemName: node.itemName,
      warehouseId: node.issueWarehouseId,
      warehouseCode: node.issueWarehouseCode,
      uomCode: node.uomCode,
      sourceType: node.sourceType,
      subAssemblyRule: node.subAssemblyRule,
      requiredQty,
      requiredDate: ctx.salesOrder.requiredDate,
      leadTimeDays: node.leadTimeDays,
    })
    acc.pegging.push({
      salesOrderNo: ctx.salesOrder.salesOrderNo,
      productName: ctx.product.productName,
      fgItemCode: ctx.fgItem.itemCode,
      bomRevision: ctx.bomHeader.revision,
      pegParentItemCode: parentItemCode,
      demandItemCode: node.itemCode,
      demandItemName: node.itemName,
      warehouseCode: node.issueWarehouseCode,
      requiredQty,
      requiredDate: ctx.salesOrder.requiredDate,
    })
    return
  }

  node.children.forEach((c) => explodeNode(c, orderQty, node.itemCode, ctx, acc))
}

function reservedForDemand(
  reservations: StockReservation[],
  itemId: string,
  warehouseId: string,
  salesOrderNo: string,
): number {
  return reservations
    .filter(
      (r) =>
        r.status === 'active' &&
        r.itemId === itemId &&
        r.warehouseId === warehouseId &&
        r.demandType === 'SO' &&
        r.demandId === salesOrderNo,
    )
    .reduce((sum, r) => sum + r.qty, 0)
}

function enrichMaterialLine(
  raw: ExplosionAccum['materials'][0],
  item: Item,
  movements: StockMovement[],
  reservations: StockReservation[],
  vendorMaps: ItemVendorMap[],
  vendors: Vendor[],
): MrpMaterialLine {
  const onHand = computeOnHand(movements, raw.itemId, raw.warehouseId)
  const reservedQty = computeReservedQty(reservations, raw.itemId, raw.warehouseId)
  const freeStock = computeFreeQty(onHand, reservedQty)
  const soReserved = reservedForDemand(reservations, raw.itemId, raw.warehouseId, raw.salesOrderNo)
  const reservedForOthers = Math.max(0, reservedQty - soReserved)
  const availableForSo = onHand - reservedForOthers
  const shortageQty = Math.max(0, raw.requiredQty - availableForSo)
  const orderByDate = addDays(raw.requiredDate, raw.leadTimeDays)
  const riskStatus = computeRisk(shortageQty, freeStock, raw.requiredDate, raw.leadTimeDays)
  const purchasable =
    raw.sourceType === 'buy' ||
    raw.sourceType === 'subcontract' ||
    raw.subAssemblyRule === 'purchased'
  const suggestQty = roundSuggestQty(shortageQty, item.reorderQty)
  const vm = vendorMaps.find((v) => v.itemId === raw.itemId && v.isPreferred)
  const vendor = vm ? vendors.find((v) => v.id === vm.vendorId) : undefined

  return {
    ...raw,
    onHand,
    reservedQty,
    freeStock,
    shortageQty,
    suggestedPoQty: purchasable ? suggestQty : 0,
    suggestedPrQty: !purchasable && shortageQty > 0 ? suggestQty : purchasable ? 0 : 0,
    orderByDate,
    riskStatus,
    preferredVendor: vendor?.vendorName ?? null,
  }
}

export function runMrpForSalesOrder(ctx: MrpEngineContext): {
  materials: MrpMaterialLine[]
  woRequirements: MrpWoRequirement[]
  exceptions: MrpException[]
  pegging: MrpPeggingLink[]
} {
  const exceptions: MrpException[] = []
  const { salesOrder, product, fgItem, bomHeader, bomLines, items, movements, reservations, vendorMaps, vendors } = ctx

  if (!product.fgItemId || !fgItem) {
    exceptions.push({
      id: genLineId('ex'),
      salesOrderId: salesOrder.id,
      salesOrderNo: salesOrder.salesOrderNo,
      productId: product.id,
      type: 'no_fg_item',
      severity: 'error',
      message: `Product ${product.productName} has no FG Item linked — MRP cannot proceed`,
    })
    return { materials: [], woRequirements: [], exceptions, pegging: [] }
  }

  if (!bomHeader) {
    exceptions.push({
      id: genLineId('ex'),
      salesOrderId: salesOrder.id,
      salesOrderNo: salesOrder.salesOrderNo,
      productId: product.id,
      type: 'no_released_bom',
      severity: 'error',
      message: `No Released BOM for ${product.productName} — draft/approved BOMs are ignored`,
    })
    return { materials: [], woRequirements: [], exceptions, pegging: [] }
  }

  if (!isMrpEligibleStatus(bomHeader.status)) {
    exceptions.push({
      id: genLineId('ex'),
      salesOrderId: salesOrder.id,
      salesOrderNo: salesOrder.salesOrderNo,
      productId: product.id,
      type: 'draft_bom_skipped',
      severity: 'error',
      message: `BOM ${bomHeader.bomNo} ${bomHeader.revision} is ${bomHeader.status} — only Released BOM used`,
    })
    return { materials: [], woRequirements: [], exceptions, pegging: [] }
  }

  const itemMap = new Map(items.map((i) => [i.id, i]))
  for (const line of bomLines) {
    const flat = flattenTree(line)
    for (const n of flat) {
      const item = itemMap.get(n.itemId)
      if (!item?.isActive) {
        exceptions.push({
          id: genLineId('ex'),
          salesOrderId: salesOrder.id,
          salesOrderNo: salesOrder.salesOrderNo,
          productId: product.id,
          type: 'inactive_bom_item',
          severity: 'warning',
          message: `Inactive item ${n.itemCode} in Released BOM ${bomHeader.revision}`,
        })
      }
    }
  }

  const acc: ExplosionAccum = { materials: [], woReqs: [], pegging: [] }
  bomLines.forEach((root) => explodeNode(root, salesOrder.qty, null, ctx, acc))

  const materials = acc.materials.map((m) => {
    const item = itemMap.get(m.itemId)!
    const enriched = enrichMaterialLine(m, item, movements, reservations, vendorMaps, vendors)
    if (enriched.riskStatus === 'delayed' && enriched.shortageQty > 0) {
      exceptions.push({
        id: genLineId('ex'),
        salesOrderId: salesOrder.id,
        salesOrderNo: salesOrder.salesOrderNo,
        productId: product.id,
        type: 'past_due_material',
        severity: 'error',
        message: `${enriched.itemCode} must be ordered by ${enriched.orderByDate} — lead time ${enriched.leadTimeDays}d exceeds ${salesOrder.requiredDate}`,
      })
    }
    if (enriched.shortageQty > 0 && enriched.suggestedPoQty > 0 && !enriched.preferredVendor) {
      exceptions.push({
        id: genLineId('ex'),
        salesOrderId: salesOrder.id,
        salesOrderNo: salesOrder.salesOrderNo,
        productId: product.id,
        type: 'no_vendor',
        severity: 'warning',
        message: `No preferred vendor for ${enriched.itemCode} — PO suggestion only`,
      })
    }
    return enriched
  })

  const woRequirements = acc.woReqs.map((w) => ({
    ...w,
    riskStatus: computeRisk(0, 0, w.requiredDate, w.leadTimeDays),
  }))

  const pegging = acc.pegging.map((p) => ({ ...p, id: genLineId('peg') }))

  return { materials, woRequirements, exceptions, pegging }
}

function flattenTree(node: BomLineEnriched): BomLineEnriched[] {
  return [node, ...node.children.flatMap(flattenTree)]
}

export function buildMrpContext(
  input: MrpRunInput,
  salesOrder: SalesOrder,
  product: Product,
  fgItem: Item,
  bomHeaders: BomHeader[],
  bomLinesRaw: import('../types/bom').BomLine[],
  items: Item[],
  warehouses: Warehouse[],
  movements: StockMovement[],
  reservations: StockReservation[],
  vendorMaps: ItemVendorMap[],
  vendors: Vendor[],
  getUomCode: (id: string) => string,
  getWarehouseCode: (id: string) => string,
): MrpEngineContext {
  const bomHeader = getReleasedBomForProduct(bomHeaders, product.id)
  const tree = bomHeader
    ? buildBomTree(
        bomHeader,
        bomLinesRaw.filter((l) => l.bomHeaderId === bomHeader.id),
        items,
        getUomCode,
        getWarehouseCode,
      )
    : []

  return {
    salesOrder: { ...salesOrder, qty: input.qty, requiredDate: input.requiredDate },
    product,
    fgItem,
    bomHeader,
    bomLines: tree,
    items,
    warehouses,
    movements,
    reservations,
    vendorMaps,
    vendors,
    getUomCode,
    getWarehouseCode,
  }
}

export function aggregateMaterialShortages(lines: MrpMaterialLine[]): MrpMaterialLine[] {
  const map = new Map<string, MrpMaterialLine>()
  for (const line of lines) {
    const key = `${line.itemId}:${line.warehouseId}`
    const existing = map.get(key)
    if (!existing) {
      map.set(key, { ...line })
      continue
    }
    existing.requiredQty += line.requiredQty
    existing.shortageQty = Math.max(0, existing.requiredQty - existing.freeStock)
    existing.suggestedPoQty = Math.max(existing.suggestedPoQty, line.suggestedPoQty)
    existing.suggestedPrQty = Math.max(existing.suggestedPrQty, line.suggestedPrQty)
    existing.riskStatus = computeRisk(
      existing.shortageQty,
      existing.freeStock,
      line.requiredDate,
      existing.leadTimeDays,
    )
  }
  return [...map.values()].filter((l) => l.shortageQty > 0)
}

export function isProductionReady(
  salesOrderId: string,
  materials: MrpMaterialLine[],
): boolean {
  return materials
    .filter((m) => m.salesOrderId === salesOrderId)
    .every((m) => m.shortageQty === 0)
}
