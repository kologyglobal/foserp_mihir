import type { ProductionPlan, ProductionPlanLine, ProductionPlanSource, ProductionPlanStatus } from '@/types/manufacturing'
import type { ApiProductionPlan, ApiProductionPlanLine } from '@/services/api/manufacturingApi'

const SOURCE_TO_API: Record<ProductionPlanSource, string> = {
  sales_order: 'SALES_ORDER',
  stock_requirement: 'STOCK_REPLENISHMENT',
  forecast: 'FORECAST',
  manual: 'MANUAL',
}

const SOURCE_FROM_API: Record<string, ProductionPlanSource> = {
  SALES_ORDER: 'sales_order',
  STOCK_REPLENISHMENT: 'stock_requirement',
  FORECAST: 'forecast',
  MANUAL: 'manual',
}

const STATUS_FROM_API: Record<string, ProductionPlanStatus> = {
  DRAFT: 'draft',
  PLANNED: 'planned',
  WORK_ORDERS_CREATED: 'work_orders_created',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
}

export function planSourceToApi(source: ProductionPlanSource): string {
  return SOURCE_TO_API[source]
}

function num(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function mapLine(api: ApiProductionPlanLine, planSource: ProductionPlanSource): ProductionPlanLine {
  const suggested = num(api.suggestedQuantity)
  const demand = num(api.demandQuantity)
  return {
    id: api.id,
    planId: '', // filled by caller
    finishedItemId: api.productItemId,
    finishedItemCode: api.productItemCode,
    finishedItemName: api.productItemName,
    source: planSource,
    sourceDocumentId: api.sourceDocumentId,
    sourceDocumentNo: api.sourceDocumentNo ?? api.demandNumber ?? '',
    demandQuantity: demand,
    safetyStock: num(api.safetyStockQuantity),
    availableFinishedStock: num(api.availableFinishedStock),
    openWorkOrderQuantity: num(api.openWorkOrderQuantity),
    requiredProductionQuantity: suggested,
    shortageQty: Math.max(0, demand - num(api.availableFinishedStock)),
    materialStatus:
      api.materialStatus === 'available' || api.materialStatus === 'partial' || api.materialStatus === 'shortage'
        ? api.materialStatus
        : 'not_checked',
    requiredDate: api.requiredDate ?? '',
    productionMethod: 'in_house',
    bomStatus: api.bomReady ? 'active' : 'missing',
    woCreated: Boolean(api.productionOrderId),
    workOrderNo: api.productionOrderNumber ?? undefined,
    ignored: api.ignored,
  }
}

export function mapApiProductionPlan(api: ApiProductionPlan): ProductionPlan {
  const source = SOURCE_FROM_API[api.sourceType] ?? 'manual'
  const lines = (api.lines ?? []).map((line) => {
    const mapped = mapLine(line, source)
    mapped.planId = api.id
    return mapped
  })
  return {
    id: api.id,
    planNo: api.planNumber,
    planName: api.planName,
    planDate: api.planDate ?? '',
    source,
    warehouseId: api.warehouseId ?? '',
    warehouseName: api.warehouseName ?? api.warehouseCode ?? '',
    planningPeriodFrom: api.periodFrom ?? '',
    planningPeriodTo: api.periodTo ?? '',
    owner: api.ownerUserId ?? '',
    status: STATUS_FROM_API[api.status] ?? 'draft',
    totalItems: api.totalItems ?? lines.length,
    plannedQty: api.plannedQty ?? lines.reduce((s, l) => s + l.demandQuantity, 0),
    wosCreated: api.wosCreated ?? lines.filter((l) => l.woCreated).length,
    lines,
    createdAt: api.createdAt,
    updatedAt: api.updatedAt,
    createdBy: api.createdBy ?? '',
  }
}
