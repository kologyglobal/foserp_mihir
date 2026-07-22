/**
 * Manufacturing Phase 6A1 — Production Planning workbench API client.
 * Base: `/t/:tenantSlug/manufacturing/production-plans` + `/manufacturing/planning/*`.
 * Distinct from the legacy Phase 6A netting workbench client in `services/api/manufacturingApi.ts`
 * (base `/manufacturing/plans`) — that workbench and its route/nav entry stay untouched.
 */
import { apiRequest, tenantPath } from '@/services/api/client'
import type {
  CreateProductionPlanPayload,
  ListProductionPlansQuery,
  PlanCalculationRun,
  PlanningException,
  PlanningOverviewSummary,
  ProductionPlanDemandLine,
  ProductionPlanDetail,
  ProductionPlanSummary,
  UnplannedDemandItem,
  WorkOrderSuggestion,
} from '../types'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

// ─── Overview / unplanned demand ────────────────────────────────────────────

export async function getPlanningOverview() {
  return apiRequest<PlanningOverviewSummary>(tenantPath('/manufacturing/planning/overview'))
}

export async function listUnplannedDemand(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return apiRequest<UnplannedDemandItem[]>(
    `${tenantPath('/manufacturing/planning/unplanned-demand')}${buildQuery(params)}`,
  )
}

export async function listPlanningExceptions(
  params?: Partial<{ severity: string; acknowledged: boolean }> & Record<string, string | number | boolean | undefined>,
) {
  return apiRequest<PlanningException[]>(
    `${tenantPath('/manufacturing/planning/exceptions')}${buildQuery(params)}`,
  )
}

export async function acknowledgePlanningException(exceptionId: string, data?: { remarks?: string }) {
  return apiRequest<PlanningException>(
    tenantPath(`/manufacturing/planning/exceptions/${exceptionId}/acknowledge`),
    { method: 'POST', body: JSON.stringify(data ?? {}) },
  )
}

// ─── Production plans — CRUD + lifecycle ────────────────────────────────────

export async function listProductionPlansV2(
  params?: Partial<ListProductionPlansQuery> & Record<string, string | number | boolean | undefined>,
) {
  return apiRequest<ProductionPlanSummary[]>(
    `${tenantPath('/manufacturing/production-plans')}${buildQuery(params)}`,
  )
}

export async function getProductionPlanV2(id: string) {
  return apiRequest<ProductionPlanDetail>(tenantPath(`/manufacturing/production-plans/${id}`))
}

export async function createProductionPlanV2(data: CreateProductionPlanPayload) {
  return apiRequest<ProductionPlanDetail>(tenantPath('/manufacturing/production-plans'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateProductionPlanV2(id: string, data: Partial<CreateProductionPlanPayload>) {
  return apiRequest<ProductionPlanDetail>(tenantPath(`/manufacturing/production-plans/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function calculateProductionPlan(id: string) {
  return apiRequest<ProductionPlanDetail>(tenantPath(`/manufacturing/production-plans/${id}/calculate`), {
    method: 'POST',
  })
}

export async function recalculateProductionPlan(id: string) {
  return apiRequest<ProductionPlanDetail>(tenantPath(`/manufacturing/production-plans/${id}/recalculate`), {
    method: 'POST',
  })
}

export async function reviewProductionPlan(id: string, data?: { remarks?: string }) {
  return apiRequest<ProductionPlanDetail>(tenantPath(`/manufacturing/production-plans/${id}/review`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export async function cancelProductionPlanV2(id: string, data?: { reason?: string }) {
  return apiRequest<ProductionPlanDetail>(tenantPath(`/manufacturing/production-plans/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export async function cloneProductionPlan(id: string, data?: { planName?: string }) {
  return apiRequest<ProductionPlanDetail>(tenantPath(`/manufacturing/production-plans/${id}/clone`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

// ─── Production plans — demand / suggestions / exceptions / calculation runs ─

export async function listPlanDemand(planId: string) {
  return apiRequest<ProductionPlanDemandLine[]>(tenantPath(`/manufacturing/production-plans/${planId}/demand`))
}

export async function listPlanSuggestions(planId: string) {
  return apiRequest<WorkOrderSuggestion[]>(tenantPath(`/manufacturing/production-plans/${planId}/suggestions`))
}

export async function acceptPlanSuggestion(planId: string, suggestionId: string, data?: { remarks?: string }) {
  return apiRequest<WorkOrderSuggestion>(
    tenantPath(`/manufacturing/production-plans/${planId}/suggestions/${suggestionId}/accept`),
    { method: 'POST', body: JSON.stringify(data ?? {}) },
  )
}

export async function rejectPlanSuggestion(planId: string, suggestionId: string, data: { reason: string }) {
  return apiRequest<WorkOrderSuggestion>(
    tenantPath(`/manufacturing/production-plans/${planId}/suggestions/${suggestionId}/reject`),
    { method: 'POST', body: JSON.stringify(data) },
  )
}

export async function listPlanExceptions(planId: string) {
  return apiRequest<PlanningException[]>(tenantPath(`/manufacturing/production-plans/${planId}/exceptions`))
}

export async function acknowledgePlanException(planId: string, exceptionId: string, data?: { remarks?: string }) {
  return apiRequest<PlanningException>(
    tenantPath(`/manufacturing/production-plans/${planId}/exceptions/${exceptionId}/acknowledge`),
    { method: 'POST', body: JSON.stringify(data ?? {}) },
  )
}

export async function listPlanCalculationRuns(planId: string) {
  return apiRequest<PlanCalculationRun[]>(tenantPath(`/manufacturing/production-plans/${planId}/calculation-runs`))
}
