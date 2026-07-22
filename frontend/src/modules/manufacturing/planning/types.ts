/**
 * Manufacturing Phase 6A1 — Production Planning workbench types.
 * Distinct from the legacy Phase 6A netting workbench (`modules/manufacturing/production-plan`,
 * API base `/manufacturing/plans`). This module's API base is `/manufacturing/production-plans`
 * + `/manufacturing/planning/*`.
 */

export const PRODUCTION_PLAN_STATUSES = [
  'DRAFT',
  'CALCULATING',
  'CALCULATED',
  'REVIEWED',
  'CANCELLED',
  'CALCULATION_FAILED',
] as const

export type ProductionPlanStatus = (typeof PRODUCTION_PLAN_STATUSES)[number]

export const CONSOLIDATION_MODES = ['BY_ITEM', 'BY_ITEM_AND_DATE', 'BY_SALES_ORDER'] as const
export type ConsolidationMode = (typeof CONSOLIDATION_MODES)[number]

export const DEMAND_SOURCE_TYPES = ['SALES_ORDER', 'FORECAST', 'REORDER_POINT', 'MANUAL'] as const
export type DemandSourceType = (typeof DEMAND_SOURCE_TYPES)[number]

export const SUGGESTION_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED'] as const
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number]

export const EXCEPTION_SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'] as const
export type ExceptionSeverity = (typeof EXCEPTION_SEVERITIES)[number]

export const CALCULATION_RUN_STATUSES = ['RUNNING', 'SUCCEEDED', 'FAILED'] as const
export type CalculationRunStatus = (typeof CALCULATION_RUN_STATUSES)[number]

export interface ProductionPlanSummary {
  id: string
  planNumber: string
  planName: string
  status: ProductionPlanStatus
  plantCode: string | null
  plantName: string | null
  periodFrom: string | null
  periodTo: string | null
  consolidationMode: ConsolidationMode
  demandLineCount: number
  suggestionCount: number
  exceptionCount: number
  lastCalculatedAt: string | null
  reviewedAt: string | null
  reviewedBy: string | null
  notes: string | null
  createdAt: string
  createdBy: string | null
}

export interface ProductionPlanDemandLine {
  id: string
  planId: string
  itemId: string
  itemCode: string
  itemName: string
  uomCode: string
  sourceType: DemandSourceType
  sourceDocumentId: string | null
  sourceDocumentNo: string | null
  demandQuantity: string
  requiredDate: string | null
  netRequirement: string
  notes: string | null
}

export interface WorkOrderSuggestion {
  id: string
  planId: string
  itemId: string
  itemCode: string
  itemName: string
  uomCode: string
  suggestedQuantity: string
  suggestedStartDate: string | null
  suggestedDueDate: string | null
  status: SuggestionStatus
  demandLineIds: string[]
  notes: string | null
  decidedAt: string | null
  decidedBy: string | null
}

export interface PlanningException {
  id: string
  planId: string | null
  planNumber: string | null
  itemId: string | null
  itemCode: string | null
  itemName: string | null
  exceptionType: string
  severity: ExceptionSeverity
  message: string
  acknowledged: boolean
  acknowledgedAt: string | null
  acknowledgedBy: string | null
  createdAt: string
}

export interface PlanCalculationRun {
  id: string
  planId: string
  status: CalculationRunStatus
  startedAt: string
  completedAt: string | null
  triggeredBy: string | null
  demandLinesProcessed: number
  suggestionsGenerated: number
  exceptionsRaised: number
  errorMessage: string | null
}

export interface ProductionPlanDetail extends ProductionPlanSummary {
  demand: ProductionPlanDemandLine[]
  suggestions: WorkOrderSuggestion[]
  exceptions: PlanningException[]
  calculationRuns: PlanCalculationRun[]
}

export interface UnplannedDemandItem {
  id: string
  itemId: string
  itemCode: string
  itemName: string
  uomCode: string
  sourceType: DemandSourceType
  sourceDocumentId: string | null
  sourceDocumentNo: string | null
  quantity: string
  requiredDate: string | null
  customerName: string | null
}

export interface PlanningOverviewSummary {
  unplannedDemandCount: number
  activePlanCount: number
  workOrderSuggestionCount: number
  planningExceptionCount: number
}

export interface CreateProductionPlanPayload {
  planName: string
  periodFrom: string
  periodTo: string
  plantId?: string
  consolidationMode: ConsolidationMode
  demandSourceTypes: DemandSourceType[]
  unplannedDemandIds?: string[]
  notes?: string
}

export interface ListProductionPlansQuery {
  status?: ProductionPlanStatus
  search?: string
  page?: number
  limit?: number
}
