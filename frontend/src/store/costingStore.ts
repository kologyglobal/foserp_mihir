import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ComponentCostRow,
  CostSheet,
  CostVarianceRow,
  ProductCostSummary,
  TrailerProfitabilityRow,
} from '../types/costing'
import { costSheetTotals, DEFAULT_OVERHEAD_PCT } from '../types/costing'
import {
  buildAllCostSheets,
  buildCostSheet,
  type CostingInput,
} from '../utils/costEngine'
import { useBomStore } from './bomStore'
import { useInventoryStore } from './inventoryStore'
import { useMasterStore } from './masterStore'
import { useWorkCenterStore } from './workCenterStore'
import { useWorkOrderStore } from './workOrderStore'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'

interface CostingState {
  overheadPct: number
  setOverheadPct: (pct: number) => void
  getCostSheet: (woId: string) => CostSheet | null
  getAllCostSheets: () => CostSheet[]
  getProductCostSummaries: () => ProductCostSummary[]
  getVarianceReport: () => CostVarianceRow[]
  getTrailerProfitability: () => TrailerProfitabilityRow[]
  getMostExpensiveComponents: (limit?: number) => ComponentCostRow[]
}

function buildCostingInput(
  woId: string,
  childSheets: CostSheet[],
  overheadPct: number,
): CostingInput | null {
  const woStore = useWorkOrderStore.getState()
  const wo = woStore.getWorkOrder(woId)
  if (!wo) return null

  const bomStore = useBomStore.getState()
  const bomTree = wo.bomHeaderId ? bomStore.getBomTree(wo.bomHeaderId) : []
  const bomLines = wo.bomHeaderId ? bomStore.getLines(wo.bomHeaderId) : []
  const master = useMasterStore.getState()

  return {
    workOrder: wo,
    materialLines: woStore.getWoMaterials(woId),
    productionOps: woStore.getProductionOperations(woId),
    jobCards: woStore.getJobCards(woId),
    movements: useInventoryStore.getState().stockMovements,
    subcontractShipments: woStore.subcontractShipments.filter((s) => s.workOrderId === woId),
    childWorkOrders: woStore.workOrders.filter((c) => c.parentWoId === woId),
    childCostSheets: childSheets,
    bomTree,
    bomLines,
    items: master.items,
    workCenters: useWorkCenterStore.getState().workCenters,
    overheadPct,
  }
}

export const useCostingStore = create<CostingState>()(
  persist(
    (set, get) => ({
      overheadPct: DEFAULT_OVERHEAD_PCT,

      setOverheadPct: (pct) => set({ overheadPct: Math.max(0, Math.min(100, pct)) }),

      getCostSheet: (woId) => {
        const overheadPct = get().overheadPct
        const woStore = useWorkOrderStore.getState()
        const wo = woStore.getWorkOrder(woId)
        if (!wo) return null

        const childSheets = woStore.workOrders
          .filter((c) => c.parentWoId === woId)
          .map((c) => {
            const childInput = buildCostingInput(c.id, [], overheadPct)
            return childInput ? buildCostSheet(childInput) : null
          })
          .filter((s): s is CostSheet => !!s)

        const input = buildCostingInput(woId, childSheets, overheadPct)
        if (!input) return null
        return buildCostSheet(input)
      },

      getAllCostSheets: () => {
        const overheadPct = get().overheadPct
        const workOrders = useWorkOrderStore.getState().workOrders.filter(
          (w) => w.status !== 'cancelled',
        )
        const sheetMap = buildAllCostSheets(workOrders, (wo, childSheets) => {
          const input = buildCostingInput(wo.id, childSheets, overheadPct)!
          return { ...input, childCostSheets: childSheets }
        })
        return [...sheetMap.values()]
      },

      getProductCostSummaries: () => {
        const sheets = get().getAllCostSheets()
        const master = useMasterStore.getState()
        const byProduct = new Map<string, ProductCostSummary>()

        for (const sheet of sheets) {
          const wo = useWorkOrderStore.getState().getWorkOrder(sheet.workOrderId)
          if (!wo || wo.woType !== 'finished_goods') continue
          const product = master.getProduct(wo.productId)
          if (!product) continue
          const totals = costSheetTotals(sheet)
          const existing = byProduct.get(product.id)
          if (existing) {
            existing.woCount += 1
            existing.totalPlanned += totals.totalPlanned
            existing.totalActual += totals.totalActual
            existing.bomStandardCost += totals.bomStandardCost
            existing.avgVariancePct =
              existing.bomStandardCost > 0
                ? ((existing.totalActual - existing.bomStandardCost) / existing.bomStandardCost) * 100
                : 0
          } else {
            byProduct.set(product.id, {
              productId: product.id,
              productCode: product.productCode,
              productName: product.productName,
              woCount: 1,
              totalPlanned: totals.totalPlanned,
              totalActual: totals.totalActual,
              bomStandardCost: totals.bomStandardCost,
              avgVariancePct: totals.variancePct,
            })
          }
        }
        return [...byProduct.values()].sort((a, b) => b.totalActual - a.totalActual)
      },

      getVarianceReport: () => {
        return get()
          .getAllCostSheets()
          .map((sheet) => {
            const totals = costSheetTotals(sheet)
            return {
              workOrderId: sheet.workOrderId,
              woNo: sheet.woNo,
              itemCode: sheet.itemCode,
              woType: sheet.woType,
              salesOrderNo: sheet.salesOrderNo,
              totalPlanned: totals.totalPlanned,
              totalActual: totals.totalActual,
              bomStandardCost: totals.bomStandardCost,
              varianceAmount: totals.varianceAmount,
              variancePct: totals.variancePct,
              materialVariance: totals.actualMaterial - totals.plannedMaterial,
              laborVariance: totals.actualLabor - totals.plannedLabor,
            } satisfies CostVarianceRow
          })
          .sort((a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct))
      },

      getTrailerProfitability: () => {
        const master = useMasterStore.getState()
        return get()
          .getAllCostSheets()
          .filter((s) => s.woType === 'finished_goods')
          .map((sheet) => {
            const wo = useWorkOrderStore.getState().getWorkOrder(sheet.workOrderId)!
            const product = master.getProduct(wo.productId)
            const totals = costSheetTotals(sheet)
            const standardPrice = product?.standardPrice ?? 0
            const revenue = standardPrice * sheet.qty
            const grossMargin = revenue - totals.totalActual
            const marginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0
            return {
              salesOrderNo: sheet.salesOrderNo ?? '—',
              fgWoNo: sheet.woNo,
              productCode: product?.productCode ?? sheet.itemCode,
              qty: sheet.qty,
              totalActualCost: totals.totalActual,
              standardPrice,
              revenue,
              grossMargin,
              marginPct,
            } satisfies TrailerProfitabilityRow
          })
          .sort((a, b) => b.revenue - a.revenue)
      },

      getMostExpensiveComponents: (limit = 10) => {
        const master = useMasterStore.getState()
        const byItem = new Map<string, ComponentCostRow>()

        for (const sheet of get().getAllCostSheets()) {
          if (sheet.woType === 'finished_goods') continue
          const item = master.getItem(sheet.itemId)
          const totals = costSheetTotals(sheet)
          const existing = byItem.get(sheet.itemId)
          if (existing) {
            existing.totalActualCost += totals.totalActual
            existing.woCount += 1
          } else {
            byItem.set(sheet.itemId, {
              itemCode: sheet.itemCode,
              itemName: item?.itemName ?? sheet.itemCode,
              totalActualCost: totals.totalActual,
              woCount: 1,
            })
          }
        }
        return [...byItem.values()].sort((a, b) => b.totalActualCost - a.totalActualCost).slice(0, limit)
      },
    }),
    {
      name: ERP_STORAGE_KEYS.costing,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
      partialize: (s) => ({ overheadPct: s.overheadPct }),
    },
  ),
)
