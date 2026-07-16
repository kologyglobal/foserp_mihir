import type { WorkOrderType } from './workorder'

/** Cost breakdown by category — planned or actual. */
export interface CostElementBreakdown {
  material: number
  labor: number
  machine: number
  subcontract: number
  overhead: number
}

export interface CostSheet {
  costSheetId: string
  workOrderId: string
  woNo: string
  itemId: string
  itemCode: string
  woType: WorkOrderType
  qty: number
  salesOrderNo: string | null
  parentWoId: string | null
  planned: CostElementBreakdown
  actual: CostElementBreakdown
  /** Sub-assembly WO costs rolled into this sheet (FG parent). */
  rolledUpChildPlanned: number
  rolledUpChildActual: number
  /** BOM standard cost baseline for variance. */
  bomStandardCost: number
  computedAt: string
}

export interface CostSheetTotals {
  plannedMaterial: number
  actualMaterial: number
  plannedLabor: number
  actualLabor: number
  plannedMachine: number
  actualMachine: number
  plannedSubcontract: number
  actualSubcontract: number
  plannedOverhead: number
  actualOverhead: number
  totalPlanned: number
  totalActual: number
  bomStandardCost: number
  varianceAmount: number
  variancePct: number
}

export interface ProductCostSummary {
  productId: string
  productCode: string
  productName: string
  woCount: number
  totalPlanned: number
  totalActual: number
  bomStandardCost: number
  avgVariancePct: number
}

export interface CostVarianceRow {
  workOrderId: string
  woNo: string
  itemCode: string
  woType: WorkOrderType
  salesOrderNo: string | null
  totalPlanned: number
  totalActual: number
  bomStandardCost: number
  varianceAmount: number
  variancePct: number
  materialVariance: number
  laborVariance: number
}

export interface TrailerProfitabilityRow {
  salesOrderNo: string
  fgWoNo: string
  productCode: string
  qty: number
  totalActualCost: number
  standardPrice: number
  revenue: number
  grossMargin: number
  marginPct: number
}

export interface ComponentCostRow {
  itemCode: string
  itemName: string
  totalActualCost: number
  woCount: number
}

export const DEFAULT_OVERHEAD_PCT = 10

export function sumCostElements(elements: CostElementBreakdown): number {
  return elements.material + elements.labor + elements.machine + elements.subcontract + elements.overhead
}

export function costSheetTotals(sheet: CostSheet): CostSheetTotals {
  const plannedSubtotal =
    sumCostElements(sheet.planned) + sheet.rolledUpChildPlanned
  const actualSubtotal =
    sumCostElements(sheet.actual) + sheet.rolledUpChildActual
  const varianceAmount = actualSubtotal - sheet.bomStandardCost
  const variancePct =
    sheet.bomStandardCost > 0 ? (varianceAmount / sheet.bomStandardCost) * 100 : 0

  return {
    plannedMaterial: sheet.planned.material,
    actualMaterial: sheet.actual.material,
    plannedLabor: sheet.planned.labor,
    actualLabor: sheet.actual.labor,
    plannedMachine: sheet.planned.machine,
    actualMachine: sheet.actual.machine,
    plannedSubcontract: sheet.planned.subcontract,
    actualSubcontract: sheet.actual.subcontract,
    plannedOverhead: sheet.planned.overhead,
    actualOverhead: sheet.actual.overhead,
    totalPlanned: plannedSubtotal,
    totalActual: actualSubtotal,
    bomStandardCost: sheet.bomStandardCost,
    varianceAmount,
    variancePct,
  }
}
