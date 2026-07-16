/**
 * Manufacturing Accounting & Costing mock service — Promise-based for future API swap.
 * Demo / UI only. Does NOT post real GL or run production/inventory backend.
 *
 * SECURITY: All reads/writes/exports must also be enforced by the future backend
 * (tenant isolation + accounting.mfg_costing.* permissions). UI gating alone is not security.
 */

import {
  seedCostCentres,
  seedFinishedGoodsValuation,
  seedManufacturingCostDashboard,
  seedManufacturingCostingSetup,
  seedMaterialConsumption,
  seedOverheadAllocations,
  seedProductCostSheets,
  seedProductionCostingWorkbench,
  seedProductionLedger,
  seedProductionVariances,
  seedScrapReworkCosts,
  seedSubcontractingCosts,
  seedWorkInProgress,
} from '../../data/accounting/manufacturingAccountingSeed'
import type {
  CostCentreRow,
  FinishedGoodsValuationRow,
  ManufacturingAccountingFilter,
  ManufacturingCostDashboard,
  ManufacturingCostExportRequest,
  ManufacturingCostingSetup,
  ManufacturingCostPrintPreview,
  ManufacturingCostReportCard,
  MaterialConsumptionLine,
  OverheadAllocationRow,
  ProductCostSheet,
  ProductionCostingWorkbench,
  ProductionLedgerEntry,
  ProductionVarianceRow,
  ScrapReworkCostRow,
  SubcontractingCostRow,
  WorkInProgressRow,
} from '../../types/manufacturingAccounting'
import { DEFAULT_MANUFACTURING_ACCOUNTING_FILTER } from '../../types/manufacturingAccounting'

export { DEFAULT_MANUFACTURING_ACCOUNTING_FILTER }

export class ManufacturingAccountingServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ManufacturingAccountingServiceError'
  }
}

const COMPANY_NAME = 'Vasant Trailers Pvt Ltd'
const delay = () => new Promise((r) => setTimeout(r, 80 + Math.floor(Math.random() * 70)))

let dashboardStore = seedManufacturingCostDashboard()
let materialConsumptionStore = seedMaterialConsumption()
let wipStore = seedWorkInProgress()
let fgValuationStore = seedFinishedGoodsValuation()
let costingWorkbenchStore = seedProductionCostingWorkbench()
let variancesStore = seedProductionVariances()
let subcontractingStore = seedSubcontractingCosts()
let scrapReworkStore = seedScrapReworkCosts()
let overheadStore = seedOverheadAllocations()
let costCentresStore = seedCostCentres()
let costSheetsStore = seedProductCostSheets()
let ledgerStore = seedProductionLedger()
let setupStore = seedManufacturingCostingSetup()

function clone<T>(value: T): T {
  return structuredClone(value)
}

function matchSearch(blob: string, q: string): boolean {
  return !q || blob.toLowerCase().includes(q.toLowerCase())
}

function inDateRange(date: string, from: string, to: string): boolean {
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

function baseFilter<T extends { productionOrderId?: string }>(
  list: T[],
  filter: Partial<ManufacturingAccountingFilter>,
  searchFn: (item: T) => string,
  dateFn: (item: T) => string,
): T[] {
  const f = { ...DEFAULT_MANUFACTURING_ACCOUNTING_FILTER, ...filter }
  return list.filter((item) => {
    if (f.search && !matchSearch(searchFn(item), f.search)) return false
    if (f.productionOrderId && item.productionOrderId !== f.productionOrderId) return false
    if (!inDateRange(dateFn(item), f.dateFrom, f.dateTo)) return false
    return true
  })
}

function applyMaterialConsumptionFilter(
  list: MaterialConsumptionLine[],
  filter: Partial<ManufacturingAccountingFilter>,
): MaterialConsumptionLine[] {
  const f = { ...DEFAULT_MANUFACTURING_ACCOUNTING_FILTER, ...filter }
  return baseFilter(
    list,
    filter,
    (m) =>
      `${m.productionOrderNumber} ${m.itemCode} ${m.itemName} ${m.materialCode} ${m.materialName} ${m.costCentre} ${m.workCentre}`,
    (m) => m.consumptionDate,
  ).filter((m) => {
    if (f.itemCode && m.itemCode !== f.itemCode && m.materialCode !== f.itemCode) return false
    if (f.costCentre && m.costCentre !== f.costCentre) return false
    if (f.workCentre && m.workCentre !== f.workCentre) return false
    return true
  })
}

function applyWipFilter(list: WorkInProgressRow[], filter: Partial<ManufacturingAccountingFilter>): WorkInProgressRow[] {
  const f = { ...DEFAULT_MANUFACTURING_ACCOUNTING_FILTER, ...filter }
  return baseFilter(
    list,
    filter,
    (w) => `${w.productionOrderNumber} ${w.finishedItemCode} ${w.finishedItemName} ${w.costCentre}`,
    (w) => w.lastUpdated,
  ).filter((w) => {
    if (f.itemCode && w.finishedItemCode !== f.itemCode) return false
    if (f.status && w.status !== f.status) return false
    if (f.wipStatus && w.wipStatus !== f.wipStatus) return false
    if (f.costCentre && w.costCentre !== f.costCentre) return false
    return true
  })
}

function applyFgFilter(
  list: FinishedGoodsValuationRow[],
  filter: Partial<ManufacturingAccountingFilter>,
): FinishedGoodsValuationRow[] {
  const f = { ...DEFAULT_MANUFACTURING_ACCOUNTING_FILTER, ...filter }
  return baseFilter(
    list,
    filter,
    (fg) => `${fg.productionOrderNumber} ${fg.itemCode} ${fg.itemName} ${fg.grnNumber} ${fg.warehouse}`,
    (fg) => fg.receiptDate,
  ).filter((fg) => {
    if (f.itemCode && fg.itemCode !== f.itemCode) return false
    if (f.costCentre && fg.costCentre !== f.costCentre) return false
    if (f.costingMethod && fg.valuationMethod !== f.costingMethod) return false
    return true
  })
}

function applyCostingFilter(
  list: ProductionCostingWorkbench[],
  filter: Partial<ManufacturingAccountingFilter>,
): ProductionCostingWorkbench[] {
  const f = { ...DEFAULT_MANUFACTURING_ACCOUNTING_FILTER, ...filter }
  return list.filter((c) => {
    if (f.search) {
      const blob = `${c.productionOrderNumber} ${c.finishedItemCode} ${c.finishedItemName} ${c.costCentre}`
      if (!matchSearch(blob, f.search)) return false
    }
    if (f.productionOrderId && c.productionOrderId !== f.productionOrderId) return false
    if (f.itemCode && c.finishedItemCode !== f.itemCode) return false
    if (f.status && c.status !== f.status) return false
    if (f.costCentre && c.costCentre !== f.costCentre) return false
    if (f.costingMethod && c.costingMethod !== f.costingMethod) return false
    if (!inDateRange(c.periodFrom, f.dateFrom, f.dateTo) && !inDateRange(c.periodTo, f.dateFrom, f.dateTo)) {
      if (f.dateFrom || f.dateTo) {
        const inRange =
          (!f.dateFrom || c.periodTo >= f.dateFrom) && (!f.dateTo || c.periodFrom <= f.dateTo)
        if (!inRange) return false
      }
    }
    return true
  })
}

function applyVarianceFilter(
  list: ProductionVarianceRow[],
  filter: Partial<ManufacturingAccountingFilter>,
): ProductionVarianceRow[] {
  const f = { ...DEFAULT_MANUFACTURING_ACCOUNTING_FILTER, ...filter }
  return baseFilter(
    list,
    filter,
    (v) => `${v.productionOrderNumber} ${v.finishedItemCode} ${v.finishedItemName} ${v.varianceType} ${v.narration}`,
    (v) => v.varianceDate,
  ).filter((v) => {
    if (f.varianceType && v.varianceType !== f.varianceType) return false
    if (f.costCentre && v.costCentre !== f.costCentre) return false
    if (f.workCentre && v.workCentre !== f.workCentre) return false
    return true
  })
}

function applySubcontractingFilter(
  list: SubcontractingCostRow[],
  filter: Partial<ManufacturingAccountingFilter>,
): SubcontractingCostRow[] {
  const f = { ...DEFAULT_MANUFACTURING_ACCOUNTING_FILTER, ...filter }
  return baseFilter(
    list,
    filter,
    (s) => `${s.productionOrderNumber} ${s.vendorName} ${s.serviceDescription} ${s.challanNumber}`,
    (s) => s.jobWorkDate,
  ).filter((s) => {
    if (f.costCentre && s.costCentre !== f.costCentre) return false
    return true
  })
}

function applyScrapReworkFilter(
  list: ScrapReworkCostRow[],
  filter: Partial<ManufacturingAccountingFilter>,
): ScrapReworkCostRow[] {
  const f = { ...DEFAULT_MANUFACTURING_ACCOUNTING_FILTER, ...filter }
  return baseFilter(
    list,
    filter,
    (s) => `${s.productionOrderNumber} ${s.itemCode} ${s.itemName} ${s.reason} ${s.type}`,
    (s) => s.recordDate,
  ).filter((s) => {
    if (f.costCentre && s.costCentre !== f.costCentre) return false
    if (f.workCentre && s.workCentre !== f.workCentre) return false
    return true
  })
}

function applyOverheadFilter(
  list: OverheadAllocationRow[],
  filter: Partial<ManufacturingAccountingFilter>,
): OverheadAllocationRow[] {
  const f = { ...DEFAULT_MANUFACTURING_ACCOUNTING_FILTER, ...filter }
  return list.filter((o) => {
    if (f.search) {
      const blob = `${o.overheadPool} ${o.period} ${o.productionOrderNumber ?? ''} ${o.costCentre}`
      if (!matchSearch(blob, f.search)) return false
    }
    if (f.productionOrderId && o.productionOrderId !== f.productionOrderId) return false
    if (!inDateRange(o.allocationDate, f.dateFrom, f.dateTo)) return false
    if (f.costCentre && o.costCentre !== f.costCentre) return false
    if (f.workCentre && o.workCentre !== f.workCentre) return false
    return true
  })
}

function applyCostCentreFilter(
  list: CostCentreRow[],
  filter: Partial<ManufacturingAccountingFilter>,
): CostCentreRow[] {
  const f = { ...DEFAULT_MANUFACTURING_ACCOUNTING_FILTER, ...filter }
  return list.filter((c) => {
    if (f.search) {
      const blob = `${c.code} ${c.name} ${c.department} ${c.manager} ${c.plant}`
      if (!matchSearch(blob, f.search)) return false
    }
    if (f.costCentre && c.code !== f.costCentre) return false
    if (f.plant && c.plant !== f.plant) return false
    return true
  })
}

function applyCostSheetFilter(
  list: ProductCostSheet[],
  filter: Partial<ManufacturingAccountingFilter>,
): ProductCostSheet[] {
  const f = { ...DEFAULT_MANUFACTURING_ACCOUNTING_FILTER, ...filter }
  return list.filter((cs) => {
    if (f.search) {
      const blob = `${cs.itemCode} ${cs.itemName} ${cs.revision}`
      if (!matchSearch(blob, f.search)) return false
    }
    if (f.itemCode && cs.itemCode !== f.itemCode) return false
    if (f.costingMethod && cs.costingMethod !== f.costingMethod) return false
    return true
  })
}

function applyLedgerFilter(
  list: ProductionLedgerEntry[],
  filter: Partial<ManufacturingAccountingFilter>,
): ProductionLedgerEntry[] {
  const f = { ...DEFAULT_MANUFACTURING_ACCOUNTING_FILTER, ...filter }
  return baseFilter(
    list,
    filter,
    (l) =>
      `${l.productionOrderNumber} ${l.itemCode} ${l.itemName} ${l.txnType} ${l.accountCode} ${l.narration} ${l.sourceDocument}`,
    (l) => l.postingDate,
  ).filter((l) => {
    if (f.txnType && l.txnType !== f.txnType) return false
    if (f.costCentre && l.costCentre !== f.costCentre) return false
    if (f.workCentre && l.workCentre !== f.workCentre) return false
    return true
  })
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getManufacturingCostDashboard(): Promise<ManufacturingCostDashboard> {
  await delay()
  return clone(dashboardStore)
}

// ─── Material Consumption ─────────────────────────────────────────────────────

export async function getMaterialConsumption(
  filter?: Partial<ManufacturingAccountingFilter>,
): Promise<MaterialConsumptionLine[]> {
  await delay()
  return clone(applyMaterialConsumptionFilter(materialConsumptionStore, filter ?? {}))
}

// ─── Work in Progress ─────────────────────────────────────────────────────────

export async function getWorkInProgress(
  filter?: Partial<ManufacturingAccountingFilter>,
): Promise<WorkInProgressRow[]> {
  await delay()
  return clone(applyWipFilter(wipStore, filter ?? {}))
}

// ─── Finished Goods ───────────────────────────────────────────────────────────

export async function getFinishedGoodsValuation(
  filter?: Partial<ManufacturingAccountingFilter>,
): Promise<FinishedGoodsValuationRow[]> {
  await delay()
  return clone(applyFgFilter(fgValuationStore, filter ?? {}))
}

// ─── Production Costing Workbench ─────────────────────────────────────────────

export async function getProductionCostingWorkbench(
  filter?: Partial<ManufacturingAccountingFilter>,
): Promise<ProductionCostingWorkbench[]> {
  await delay()
  return clone(applyCostingFilter(costingWorkbenchStore, filter ?? {}))
}

// ─── Variances ────────────────────────────────────────────────────────────────

export async function getProductionVariances(
  filter?: Partial<ManufacturingAccountingFilter>,
): Promise<ProductionVarianceRow[]> {
  await delay()
  return clone(applyVarianceFilter(variancesStore, filter ?? {}))
}

// ─── Subcontracting ───────────────────────────────────────────────────────────

export async function getSubcontractingCosts(
  filter?: Partial<ManufacturingAccountingFilter>,
): Promise<SubcontractingCostRow[]> {
  await delay()
  return clone(applySubcontractingFilter(subcontractingStore, filter ?? {}))
}

// ─── Scrap & Rework ───────────────────────────────────────────────────────────

export async function getScrapReworkCosts(
  filter?: Partial<ManufacturingAccountingFilter>,
): Promise<ScrapReworkCostRow[]> {
  await delay()
  return clone(applyScrapReworkFilter(scrapReworkStore, filter ?? {}))
}

// ─── Overhead Allocations ─────────────────────────────────────────────────────

export async function getOverheadAllocations(
  filter?: Partial<ManufacturingAccountingFilter>,
): Promise<OverheadAllocationRow[]> {
  await delay()
  return clone(applyOverheadFilter(overheadStore, filter ?? {}))
}

// ─── Cost Centres ─────────────────────────────────────────────────────────────

export async function getCostCentres(
  filter?: Partial<ManufacturingAccountingFilter>,
): Promise<CostCentreRow[]> {
  await delay()
  return clone(applyCostCentreFilter(costCentresStore, filter ?? {}))
}

// ─── Product Cost Sheets ──────────────────────────────────────────────────────

export async function getProductCostSheets(
  filter?: Partial<ManufacturingAccountingFilter>,
): Promise<ProductCostSheet[]> {
  await delay()
  return clone(applyCostSheetFilter(costSheetsStore, filter ?? {}))
}

export async function getProductCostSheetById(id: string): Promise<ProductCostSheet | null> {
  await delay()
  const sheet = costSheetsStore.find((s) => s.id === id)
  return sheet ? clone(sheet) : null
}

// ─── Production Ledger ────────────────────────────────────────────────────────

export async function getProductionLedger(
  filter?: Partial<ManufacturingAccountingFilter>,
): Promise<ProductionLedgerEntry[]> {
  await delay()
  return clone(applyLedgerFilter(ledgerStore, filter ?? {}))
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function getManufacturingCostReports(): Promise<ManufacturingCostReportCard[]> {
  await delay()
  return [
    {
      id: 'rpt-wip',
      name: 'WIP Valuation Report',
      description: 'Work in progress valuation by production order and cost centre',
      category: 'WIP',
      lastGeneratedAt: '2026-07-14T10:00:00.000Z',
    },
    {
      id: 'rpt-fg',
      name: 'Finished Goods Valuation',
      description: 'FG inventory valuation with standard vs actual cost',
      category: 'Costing',
      lastGeneratedAt: '2026-07-12T10:00:00.000Z',
    },
    {
      id: 'rpt-variance',
      name: 'Production Variance Analysis',
      description: 'Variance breakdown by type, PO and cost centre',
      category: 'Variance',
      lastGeneratedAt: '2026-07-14T14:00:00.000Z',
    },
    {
      id: 'rpt-consumption',
      name: 'Material Consumption Report',
      description: 'Material issued vs standard with usage and price variances',
      category: 'Costing',
      lastGeneratedAt: '2026-07-10T10:00:00.000Z',
    },
    {
      id: 'rpt-cost-sheet',
      name: 'Product Cost Sheet Register',
      description: 'Active cost sheets with BOM and routing cost breakup',
      category: 'Analysis',
      lastGeneratedAt: '2026-07-01T10:00:00.000Z',
    },
    {
      id: 'rpt-overhead',
      name: 'Overhead Allocation Report',
      description: 'Factory overhead allocated by pool, basis and cost centre',
      category: 'Analysis',
      lastGeneratedAt: null,
    },
    {
      id: 'rpt-subcontract',
      name: 'Subcontracting Cost Register',
      description: 'Job-work challans, invoices and cost by vendor',
      category: 'Costing',
      lastGeneratedAt: '2026-07-08T10:00:00.000Z',
    },
    {
      id: 'rpt-scrap',
      name: 'Scrap & Rework Analysis',
      description: 'Scrap and rework costs with recovery and net impact',
      category: 'Variance',
      lastGeneratedAt: '2026-07-05T10:00:00.000Z',
    },
  ]
}

// ─── Setup ────────────────────────────────────────────────────────────────────

export async function getManufacturingCostingSetup(): Promise<ManufacturingCostingSetup> {
  await delay()
  return clone(setupStore)
}

export async function updateManufacturingCostingSetupDemo(
  patch: Partial<ManufacturingCostingSetup>,
): Promise<ManufacturingCostingSetup> {
  await delay()
  setupStore = { ...setupStore, ...patch }
  return clone(setupStore)
}

// ─── Export / Print ───────────────────────────────────────────────────────────

export async function exportManufacturingCostData(
  req: ManufacturingCostExportRequest,
): Promise<{ fileName: string; rowCount: number; format: string }> {
  await delay()
  let rowCount = 0
  const name = req.reportName.toLowerCase()
  if (name.includes('wip')) rowCount = (await getWorkInProgress(req.filter)).length
  else if (name.includes('finished') || name.includes('fg')) rowCount = (await getFinishedGoodsValuation(req.filter)).length
  else if (name.includes('variance')) rowCount = (await getProductionVariances(req.filter)).length
  else if (name.includes('consumption') || name.includes('material')) rowCount = (await getMaterialConsumption(req.filter)).length
  else if (name.includes('cost sheet')) rowCount = (await getProductCostSheets(req.filter)).length
  else if (name.includes('ledger')) rowCount = (await getProductionLedger(req.filter)).length
  else if (name.includes('subcontract')) rowCount = (await getSubcontractingCosts(req.filter)).length
  else if (name.includes('scrap')) rowCount = (await getScrapReworkCosts(req.filter)).length
  else if (name.includes('overhead')) rowCount = (await getOverheadAllocations(req.filter)).length
  else if (name.includes('cost centre')) rowCount = (await getCostCentres(req.filter)).length
  else rowCount = (await getProductionCostingWorkbench(req.filter)).length

  return {
    fileName: `${req.reportName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.${req.format}`,
    rowCount,
    format: req.format,
  }
}

export async function getManufacturingCostPrintPreview(
  reportName: string,
  filter?: Partial<ManufacturingAccountingFilter>,
): Promise<ManufacturingCostPrintPreview> {
  await delay()
  const f = filter ?? {}
  let rows: Array<Record<string, string | number | null>> = []

  const name = reportName.toLowerCase()
  if (name.includes('wip')) {
    rows = (await getWorkInProgress(f)).map((w) => ({
      'PO Number': w.productionOrderNumber,
      Item: w.finishedItemName,
      Status: w.status,
      'Planned Qty': w.plannedQty,
      'Completed Qty': w.completedQty,
      'WIP Value': w.wipValue,
      '% Complete': w.percentComplete,
    }))
  } else if (name.includes('variance')) {
    rows = (await getProductionVariances(f)).map((v) => ({
      Date: v.varianceDate,
      'PO Number': v.productionOrderNumber,
      Type: v.varianceType,
      Standard: v.standardAmount,
      Actual: v.actualAmount,
      Variance: v.varianceAmount,
      Posted: v.posted ? 'Yes' : 'No',
    }))
  } else if (name.includes('consumption') || name.includes('material')) {
    rows = (await getMaterialConsumption(f)).map((m) => ({
      Date: m.consumptionDate,
      'PO Number': m.productionOrderNumber,
      Material: m.materialName,
      'Std Qty': m.standardQty,
      'Act Qty': m.actualQty,
      'Act Value': m.actualValue,
      Variance: m.varianceValue,
    }))
  } else if (name.includes('cost sheet')) {
    rows = (await getProductCostSheets(f)).map((cs) => ({
      'Item Code': cs.itemCode,
      Name: cs.itemName,
      Revision: cs.revision,
      'Std Cost': cs.totalStandardCost,
      'Selling Price': cs.suggestedSellingPrice,
      Status: cs.status,
    }))
  } else if (name.includes('ledger')) {
    rows = (await getProductionLedger(f)).map((l) => ({
      Date: l.postingDate,
      'PO Number': l.productionOrderNumber,
      Type: l.txnType,
      Account: l.accountName,
      Debit: l.debit,
      Credit: l.credit,
    }))
  } else {
    rows = (await getProductionCostingWorkbench(f)).map((c) => ({
      'PO Number': c.productionOrderNumber,
      Item: c.finishedItemName,
      'Total Cost': c.costBreakup.totalProductionCost,
      'Cost/Unit': c.costBreakup.costPerUnit,
      Variance: c.varianceAmount,
    }))
  }

  return {
    reportName,
    generatedAt: new Date().toISOString(),
    companyName: COMPANY_NAME,
    filterSummary: f.search ? `Search: ${f.search}` : 'All records',
    rows,
  }
}

// ─── Reset ────────────────────────────────────────────────────────────────────

export function resetManufacturingAccountingDemo(): void {
  dashboardStore = seedManufacturingCostDashboard()
  materialConsumptionStore = seedMaterialConsumption()
  wipStore = seedWorkInProgress()
  fgValuationStore = seedFinishedGoodsValuation()
  costingWorkbenchStore = seedProductionCostingWorkbench()
  variancesStore = seedProductionVariances()
  subcontractingStore = seedSubcontractingCosts()
  scrapReworkStore = seedScrapReworkCosts()
  overheadStore = seedOverheadAllocations()
  costCentresStore = seedCostCentres()
  costSheetsStore = seedProductCostSheets()
  ledgerStore = seedProductionLedger()
  setupStore = seedManufacturingCostingSetup()
}
