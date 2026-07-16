import type { BomLine, BomLineEnriched } from '../types/bom'
import type { StockMovement } from '../types/inventory'
import type { Item } from '../types/master'
import type { WorkCenter } from '../types/workcenter'
import type { CostElementBreakdown, CostSheet } from '../types/costing'
import type {
  JobCard,
  SubcontractShipment,
  WorkOrder,
  WorkOrderMaterialLine,
  WorkOrderProductionOperation,
} from '../types/workorder'
import { computeBomTotalCost, flattenBomTree } from './bom'

export interface CostingInput {
  workOrder: WorkOrder
  materialLines: WorkOrderMaterialLine[]
  productionOps: WorkOrderProductionOperation[]
  jobCards: JobCard[]
  movements: StockMovement[]
  subcontractShipments: SubcontractShipment[]
  childWorkOrders: WorkOrder[]
  childCostSheets: CostSheet[]
  bomTree: BomLineEnriched[]
  bomLines: BomLine[]
  items: Item[]
  workCenters: WorkCenter[]
  overheadPct: number
}

function findBomNodeByItemId(nodes: BomLineEnriched[], itemId: string): BomLineEnriched | undefined {
  for (const node of nodes) {
    if (node.itemId === itemId) return node
    const found = findBomNodeByItemId(node.children, itemId)
    if (found) return found
  }
  return undefined
}

/** BOM standard cost for one unit of the WO output item. */
export function bomStandardUnitCost(input: CostingInput): number {
  const { workOrder, bomTree } = input
  if (workOrder.woType === 'finished_goods') {
    return computeBomTotalCost(bomTree)
  }
  const node = findBomNodeByItemId(bomTree, workOrder.outputItemId)
  if (!node) return 0
  if (node.children.length === 0) return node.totalCost
  const leaves = flattenBomTree([node]).filter((n) => n.children.length === 0)
  return leaves.reduce((sum, n) => sum + n.totalCost, 0)
}

function linePlannedRate(
  line: WorkOrderMaterialLine,
  bomLines: BomLine[],
  items: Item[],
): number {
  if (line.pegBomLineId) {
    const peg = bomLines.find((l) => l.id === line.pegBomLineId)
    if (peg && peg.standardCost > 0) return peg.standardCost
  }
  const item = items.find((i) => i.id === line.itemId)
  return item?.standardRate ?? 0
}

function childSourcedItemIds(lines: WorkOrderMaterialLine[]): Set<string> {
  return new Set(lines.filter((l) => l.sourceWoId).map((l) => l.itemId))
}

export function computePlannedMaterial(
  input: Pick<CostingInput, 'workOrder' | 'materialLines' | 'bomLines' | 'items'>,
): number {
  const { workOrder, materialLines, bomLines, items } = input
  const excludeSa = workOrder.woType === 'finished_goods' ? childSourcedItemIds(materialLines) : new Set<string>()
  return materialLines.reduce((sum, line) => {
    if (excludeSa.has(line.itemId)) return sum
    const rate = linePlannedRate(line, bomLines, items)
    return sum + line.requiredQty * rate
  }, 0)
}

export function computeActualMaterial(
  woId: string,
  movements: StockMovement[],
  excludeItemIds: Set<string> = new Set(),
): number {
  return movements
    .filter(
      (m) =>
        m.workOrderId === woId &&
        (m.referenceType === 'ISSUE_TO_WO' || m.referenceType === 'SUBCON_OUT') &&
        !excludeItemIds.has(m.itemId),
    )
    .reduce((sum, m) => sum + Math.abs(m.value), 0)
}

export function computePlannedLaborMachine(
  ops: WorkOrderProductionOperation[],
  workCenters: WorkCenter[],
  woQty: number,
): Pick<CostElementBreakdown, 'labor' | 'machine'> {
  const wcMap = new Map(workCenters.map((w) => [w.id, w]))
  let labor = 0
  let machine = 0
  for (const op of ops) {
    if (op.outsourced) continue
    const rate = wcMap.get(op.workCenterId)?.costRatePerHour ?? 0
    labor += op.setupTimeHours * rate * (op.laborRequirement || 1)
    machine += op.runTimeHours * woQty * rate
  }
  return { labor, machine }
}

export function computeActualLaborMachine(
  jobCards: JobCard[],
  ops: WorkOrderProductionOperation[],
  workCenters: WorkCenter[],
): Pick<CostElementBreakdown, 'labor' | 'machine'> {
  const wcMap = new Map(workCenters.map((w) => [w.id, w]))
  const opMap = new Map(ops.map((o) => [o.id, o]))
  let labor = 0
  let machine = 0
  for (const jc of jobCards) {
    const hours = jc.actualHours ?? 0
    if (hours <= 0) continue
    const op = opMap.get(jc.productionOperationId)
    if (!op || op.outsourced) continue
    const rate = wcMap.get(op.workCenterId)?.costRatePerHour ?? 0
    const stdH = op.standardHours > 0 ? op.standardHours : hours
    const laborShare = stdH > 0 ? Math.min(1, op.setupTimeHours / stdH) : 0.35
    labor += hours * laborShare * rate * (op.laborRequirement || 1)
    machine += hours * (1 - laborShare) * rate
  }
  return { labor, machine }
}

export function computePlannedSubcontract(
  input: Pick<CostingInput, 'workOrder' | 'materialLines' | 'bomLines' | 'items' | 'bomTree'>,
): number {
  const { workOrder, materialLines, bomLines, items, bomTree } = input
  if (workOrder.woType === 'subcontract') {
    const node = findBomNodeByItemId(bomTree, workOrder.outputItemId)
    if (node) return node.totalCost * workOrder.qty
    return materialLines.reduce((sum, line) => {
      const rate = linePlannedRate(line, bomLines, items)
      return sum + line.requiredQty * rate
    }, 0)
  }
  return materialLines
    .filter((l) => l.sourceType === 'subcontract')
    .reduce((sum, line) => {
      const rate = linePlannedRate(line, bomLines, items)
      return sum + line.requiredQty * rate
    }, 0)
}

export function computeActualSubcontract(
  woId: string,
  movements: StockMovement[],
  shipments: SubcontractShipment[],
): number {
  const receiptValue = movements
    .filter((m) => m.workOrderId === woId && m.referenceType === 'SUBCON_IN')
    .reduce((sum, m) => sum + Math.abs(m.value), 0)
  if (receiptValue > 0) return receiptValue
  return shipments
    .filter((s) => s.workOrderId === woId && s.receivedQty > 0)
    .reduce((sum, s) => sum + s.receivedQty * 0, 0)
}

function applyOverhead(
  base: Omit<CostElementBreakdown, 'overhead'>,
  overheadPct: number,
): CostElementBreakdown {
  const subtotal = base.material + base.labor + base.machine + base.subcontract
  return {
    ...base,
    overhead: subtotal * (overheadPct / 100),
  }
}

/** Build cost sheet for a single WO (without child roll-up). */
export function buildCostSheet(input: CostingInput): CostSheet {
  const { workOrder, materialLines, productionOps, jobCards, movements, subcontractShipments, overheadPct } =
    input

  const excludeSaItems =
    workOrder.woType === 'finished_goods' ? childSourcedItemIds(materialLines) : new Set<string>()

  const plannedBase = {
    material: computePlannedMaterial(input),
    ...computePlannedLaborMachine(productionOps, input.workCenters, workOrder.qty),
    subcontract: computePlannedSubcontract(input),
  }
  const planned = applyOverhead(plannedBase, overheadPct)

  const actualBase = {
    material: computeActualMaterial(workOrder.id, movements, excludeSaItems),
    ...computeActualLaborMachine(jobCards, productionOps, input.workCenters),
    subcontract: computeActualSubcontract(workOrder.id, movements, subcontractShipments),
  }
  const actual = applyOverhead(actualBase, overheadPct)

  const bomUnit = bomStandardUnitCost(input)
  const bomStandardCost = bomUnit * workOrder.qty

  let rolledUpChildPlanned = 0
  let rolledUpChildActual = 0
  if (workOrder.woType === 'finished_goods' && input.childCostSheets.length > 0) {
    for (const child of input.childCostSheets) {
      const childPlanned =
        child.planned.material +
        child.planned.labor +
        child.planned.machine +
        child.planned.subcontract +
        child.planned.overhead
      const childActual =
        child.actual.material +
        child.actual.labor +
        child.actual.machine +
        child.actual.subcontract +
        child.actual.overhead
      rolledUpChildPlanned += childPlanned
      rolledUpChildActual += childActual
    }
  }

  return {
    costSheetId: `CS-${workOrder.woNo}`,
    workOrderId: workOrder.id,
    woNo: workOrder.woNo,
    itemId: workOrder.outputItemId,
    itemCode: workOrder.outputItemCode,
    woType: workOrder.woType,
    qty: workOrder.qty,
    salesOrderNo: workOrder.salesOrderNo,
    parentWoId: workOrder.parentWoId,
    planned,
    actual,
    rolledUpChildPlanned,
    rolledUpChildActual,
    bomStandardCost,
    computedAt: new Date().toISOString(),
  }
}

/** Leaf WOs first (sub-assemblies before FG parent) for roll-up. */
export function sortWorkOrdersForCosting(workOrders: WorkOrder[]): WorkOrder[] {
  const remaining = [...workOrders]
  const ordered: WorkOrder[] = []
  while (remaining.length > 0) {
    const leafIdx = remaining.findIndex(
      (wo) => !remaining.some((other) => other.parentWoId === wo.id),
    )
    if (leafIdx < 0) {
      ordered.push(...remaining)
      break
    }
    ordered.push(remaining[leafIdx])
    remaining.splice(leafIdx, 1)
  }
  return ordered
}

export function buildAllCostSheets(
  workOrders: WorkOrder[],
  buildInput: (wo: WorkOrder, childSheets: CostSheet[]) => CostingInput,
): Map<string, CostSheet> {
  const order = sortWorkOrdersForCosting(workOrders)
  const sheets = new Map<string, CostSheet>()

  for (const wo of order) {
    const childSheets = workOrders
      .filter((c) => c.parentWoId === wo.id)
      .map((c) => sheets.get(c.id))
      .filter((s): s is CostSheet => !!s)
    const input = buildInput(wo, childSheets)
    sheets.set(wo.id, buildCostSheet(input))
  }
  return sheets
}

