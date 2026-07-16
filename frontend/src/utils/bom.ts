import type { Item } from '../types/master'
import type { BomHeader, BomLine, BomLineEnriched, BomRevisionCompare } from '../types/bom'

export function lineTotalCost(
  qtyPerProduct: number,
  standardCost: number,
  scrapPct: number,
): number {
  return qtyPerProduct * standardCost * (1 + scrapPct / 100)
}

export function buildBomTree(
  header: BomHeader,
  lines: BomLine[],
  items: Item[],
  getUomCode: (id: string) => string,
  getWarehouseCode: (id: string) => string,
): BomLineEnriched[] {
  const itemMap = new Map(items.map((i) => [i.id, i]))

  function qtyToProduct(lineId: string, qty: number): number {
    const line = lines.find((l) => l.id === lineId)
    if (!line || !line.parentLineId) return qty
    const parent = lines.find((l) => l.id === line.parentLineId)!
    return qtyToProduct(parent.id, qty * parent.qtyPerParent)
  }

  function enrich(line: BomLine): BomLineEnriched {
    const item = itemMap.get(line.itemId)!
    const qtyPerProduct = qtyToProduct(line.id, line.qtyPerParent)
    const totalCost = lineTotalCost(qtyPerProduct, line.standardCost, line.scrapPct)
    const children = lines
      .filter((l) => l.parentLineId === line.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(enrich)

    return {
      ...line,
      itemCode: item?.itemCode ?? '—',
      itemName: item?.itemName ?? '—',
      itemType: item?.itemType ?? 'raw',
      subAssemblyRule: item?.subAssemblyRule ?? null,
      specification: item?.materialGrade ?? item?.itemDescription ?? '—',
      uomCode: getUomCode(line.uomId),
      issueWarehouseCode: getWarehouseCode(line.issueWarehouseId),
      qtyPerProduct,
      totalCost,
      revision: header.revision,
      children,
    }
  }

  return lines
    .filter((l) => !l.parentLineId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(enrich)
}

export function flattenBomTree(nodes: BomLineEnriched[]): BomLineEnriched[] {
  const result: BomLineEnriched[] = []
  function walk(n: BomLineEnriched) {
    result.push(n)
    n.children.forEach(walk)
  }
  nodes.forEach(walk)
  return result
}

export function computeBomTotalCost(tree: BomLineEnriched[]): number {
  const leaves = flattenBomTree(tree).filter((n) => n.children.length === 0)
  return leaves.reduce((sum, n) => sum + n.totalCost, 0)
}

export function hasInactiveItems(lines: BomLine[], items: Item[]): boolean {
  const itemMap = new Map(items.map((i) => [i.id, i]))
  return lines.some((l) => {
    const item = itemMap.get(l.itemId)
    return !item || !item.isActive
  })
}

export function hasDuplicateSiblingItem(
  lines: BomLine[],
  parentLineId: string | null,
  itemId: string,
  excludeLineId?: string,
): boolean {
  return lines.some(
    (l) =>
      l.parentLineId === parentLineId &&
      l.itemId === itemId &&
      l.id !== excludeLineId,
  )
}

export function inferSourceType(item: Item): BomLine['sourceType'] {
  if (item.subAssemblyRule === 'subcontracted') return 'subcontract'
  if (item.itemType === 'bought_out') return 'buy'
  if (item.itemType === 'sub_assembly') return 'make'
  if (item.itemType === 'consumable') return 'buy'
  return 'make'
}

export function inferIssueWarehouseId(
  item: Item,
  getCategoryDefaultWh: (catId: string) => string | null,
): string {
  return getCategoryDefaultWh(item.categoryId) ?? 'wh-rm-main'
}

export function inferNodeLevel(item: Item, hasParent: boolean): BomLineEnriched['nodeLevel'] {
  if (item.itemType === 'sub_assembly') return hasParent ? 'sub_assembly' : 'assembly'
  if (!hasParent) return 'assembly'
  return 'component'
}

/** MRP explosion skips phantom sub-assemblies — returns leaf demand lines only */
export function explodeBomForMrp(tree: BomLineEnriched[]): BomLineEnriched[] {
  const leaves: BomLineEnriched[] = []
  function walk(node: BomLineEnriched) {
    if (node.subAssemblyRule === 'phantom' || node.children.length > 0) {
      node.children.forEach(walk)
      return
    }
    leaves.push(node)
  }
  tree.forEach(walk)
  return leaves
}

export function compareBomRevisions(
  flatA: BomLineEnriched[],
  flatB: BomLineEnriched[],
): BomRevisionCompare[] {
  const codesA = new Map(flatA.map((l) => [l.itemCode, l]))
  const codesB = new Map(flatB.map((l) => [l.itemCode, l]))
  const allCodes = new Set([...codesA.keys(), ...codesB.keys()])
  const rows: BomRevisionCompare[] = []

  for (const code of allCodes) {
    const a = codesA.get(code)
    const b = codesB.get(code)
    if (!a && b) {
      rows.push({ field: `${code} — Added`, revA: '—', revB: b.qtyPerProduct, changed: true })
    } else if (a && !b) {
      rows.push({ field: `${code} — Removed`, revA: a.qtyPerProduct, revB: '—', changed: true })
    } else if (a && b) {
      const qtyChanged = a.qtyPerProduct !== b.qtyPerProduct
      const costChanged = a.totalCost !== b.totalCost
      if (qtyChanged) {
        rows.push({ field: `${code} Qty`, revA: a.qtyPerProduct, revB: b.qtyPerProduct, changed: true })
      }
      if (costChanged) {
        rows.push({ field: `${code} Cost`, revA: a.totalCost, revB: b.totalCost, changed: true })
      }
    }
  }
  return rows
}

export function exportBomCsv(
  header: BomHeader,
  productName: string,
  flat: BomLineEnriched[],
): string {
  const rows = [
    ['BOM No', header.bomNo, 'Revision', header.revision, 'Product', productName].join(','),
    ['Status', header.status, 'Total Cost', header.totalCost.toFixed(2)].join(','),
    '',
    ['Item Code', 'Item Name', 'Level', 'SA Rule', 'Qty/Product', 'UOM', 'Issue WH', 'Scrap%', 'Source', 'Lead Days', 'Std Cost', 'Total Cost'].join(','),
  ]
  for (const l of flat) {
    rows.push(
      [
        l.itemCode,
        `"${l.itemName}"`,
        l.nodeLevel,
        l.subAssemblyRule ?? '—',
        l.qtyPerProduct,
        l.uomCode,
        l.issueWarehouseCode,
        l.scrapPct,
        l.sourceType,
        l.leadTimeDays,
        l.standardCost,
        l.totalCost.toFixed(2),
      ].join(','),
    )
  }
  return rows.join('\n')
}

export function nextRevision(current: string): string {
  const match = current.match(/Rev-([A-Z])/)
  if (!match) return 'Rev-B'
  const next = String.fromCharCode(match[1].charCodeAt(0) + 1)
  return `Rev-${next}`
}
