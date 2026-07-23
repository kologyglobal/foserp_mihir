/**
 * Quality Phase 4A/4B — inspection, NCR, parameter & plan API client.
 * Base: /api/v1/t/:tenantSlug/quality/...
 * Demo qualityStore remains for VITE_USE_API=false.
 */
import { apiRequest, tenantPath } from './client'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

export type QualityInspectionCategory = 'INCOMING' | 'IN_PROCESS' | 'FINAL' | 'SUBCONTRACT_RETURN'
export type QualityInspectionStatus = 'PENDING' | 'PASSED' | 'REWORK' | 'REJECTED' | 'CANCELLED'
export type QualityInspectionDecision = 'PASS' | 'CONDITIONAL_PASS' | 'HOLD' | 'USE_AS_IS' | 'REWORK' | 'REJECT'
export type QualityNcrStatus = 'OPEN' | 'INVESTIGATING' | 'CORRECTIVE_ACTION' | 'APPROVED' | 'CLOSED' | 'CANCELLED'
export type QualityNcrSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL'
export type QualityParameterType = 'BOOLEAN' | 'NUMERIC' | 'TEXT' | 'DROPDOWN' | 'PHOTO_REQUIRED'
export type QualityParameterSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL'
export type QualityPassFailRule = 'BOOLEAN_TRUE' | 'BOOLEAN_FALSE' | 'NUMERIC_TOLERANCE' | 'MANUAL'
export type QualityInspectionPlanStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE'

export interface QualityParameterSnapshot {
  parameterId: string
  parameterCode: string
  parameterName: string
  parameterType: string
  uomCode: string | null
  minValue: number | null
  maxValue: number | null
  targetValue: number | null
  mandatory: boolean
  severity: string
  passFailRule: string
  dropdownOptions: string[] | null
  sortOrder: number
  remarksRequired?: boolean
}

export interface QualityParameterResultRow {
  id: string
  parameterId: string
  parameterCode: string
  parameterName: string
  parameterType: string
  mandatory: boolean
  severity: string
  passFailRule: string
  uomCode: string | null
  minValue: number | null
  maxValue: number | null
  targetValue: number | null
  sortOrder: number
  measuredValue: string | null
  measuredNumeric: number | null
  passed: boolean | null
  remarks: string | null
}

export interface QualityInspection {
  id: string
  inspectionNumber: string
  category: QualityInspectionCategory
  status: QualityInspectionStatus
  decision: QualityInspectionDecision | null
  productionOrderId: string | null
  stageId: string | null
  operationId: string | null
  itemId: string | null
  inspectionPlanId?: string | null
  inspectionPlan?: {
    id: string
    planCode: string
    planName: string
    category: QualityInspectionCategory
    status: QualityInspectionPlanStatus
  } | null
  parameterSnapshot?: QualityParameterSnapshot[] | null
  parameterResults?: QualityParameterResultRow[]
  inspectedQty: string | null
  acceptedQty: string | null
  rejectedQty: string | null
  reworkQty: string | null
  title: string
  remarks: string | null
  decisionRemarks: string | null
  requestedAt: string
  decidedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface QualityNcr {
  id: string
  ncrNumber: string
  status: QualityNcrStatus
  severity: QualityNcrSeverity
  title: string
  description: string | null
  productionOrderId: string | null
  inspectionId: string | null
  itemId: string | null
  closedAt: string | null
  closureNotes: string | null
  disposition?: string | null
  dispositionQuantity?: string | null
  jobWorkOrderId?: string | null
  supplierId?: string | null
  createdAt: string
  updatedAt: string
}

export interface QualityBlocker {
  code: string
  message: string
  inspectionId?: string
  ncrId?: string
  stageId?: string
}

export interface QualityParameter {
  id: string
  parameterCode: string
  parameterName: string
  parameterType: QualityParameterType
  uomCode: string | null
  minValue: number | null
  maxValue: number | null
  targetValue: number | null
  mandatory: boolean
  severity: QualityParameterSeverity
  passFailRule: QualityPassFailRule
  dropdownOptions: string[] | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface QualityInspectionPlanLine {
  id: string
  parameterId: string
  sortOrder: number
  mandatoryOverride: boolean | null
  minValueOverride: number | null
  maxValueOverride: number | null
  targetValueOverride: number | null
  severityOverride: QualityParameterSeverity | null
  photoRequiredOverride: boolean | null
  remarksRequired: boolean
  parameter: Omit<QualityParameter, 'createdAt' | 'updatedAt'>
}

export interface QualityInspectionPlan {
  id: string
  planCode: string
  planName: string
  category: QualityInspectionCategory
  status: QualityInspectionPlanStatus
  itemId: string | null
  itemCategoryId: string | null
  operationName: string | null
  workCenterId: string | null
  effectiveFrom: string
  effectiveTo: string | null
  revision: string | null
  lines: QualityInspectionPlanLine[]
  createdAt: string
  updatedAt: string
}

export interface DecideInspectionPayload {
  decision: QualityInspectionDecision
  acceptedQty?: number
  rejectedQty?: number
  reworkQty?: number
  remarks?: string
  severity?: QualityNcrSeverity
  parameterResults?: Array<{
    parameterId: string
    measuredValue?: string | null
    measuredNumeric?: number | null
    passed?: boolean | null
    remarks?: string | null
  }>
}

export interface CreateInspectionPayload {
  category: 'IN_PROCESS' | 'FINAL'
  productionOrderId: string
  stageId?: string
  operationId?: string
  itemId?: string
  inspectionPlanId?: string
  inspectedQty?: number
  title?: string
  remarks?: string
  idempotencyKey?: string
}

export type CreateParameterPayload = {
  parameterCode: string
  parameterName: string
  parameterType: QualityParameterType
  uomCode?: string | null
  minValue?: number | null
  maxValue?: number | null
  targetValue?: number | null
  mandatory?: boolean
  severity?: QualityParameterSeverity
  passFailRule?: QualityPassFailRule
  dropdownOptions?: string[] | null
  active?: boolean
}

export type CreatePlanPayload = {
  planCode: string
  planName: string
  category: QualityInspectionCategory
  status?: QualityInspectionPlanStatus
  itemId?: string | null
  operationName?: string | null
  revision?: string | null
  lines: Array<{ parameterId: string; sortOrder?: number; mandatoryOverride?: boolean | null }>
}

export async function listInspections(params?: {
  page?: number
  limit?: number
  status?: QualityInspectionStatus
  category?: QualityInspectionCategory
  productionOrderId?: string
}) {
  return apiRequest<QualityInspection[]>(tenantPath(`/quality/inspections${buildQuery(params)}`))
}

export interface QcKioskQueueResult {
  items: Array<{
    id: string
    inspectionNumber: string
    category: string
    status: string
    title: string
    productionOrderId: string | null
    stageId: string | null
    itemId: string | null
    inspectedQty: string | null
    requestedAt: string
    planCode: string | null
    planName: string | null
  }>
  summary: { openCount: number; pendingCount: number; reworkCount: number }
}

export async function getQcKioskQueue(params?: { limit?: number; category?: QualityInspectionCategory; productionOrderId?: string }) {
  return apiRequest<QcKioskQueueResult>(tenantPath(`/quality/kiosk/queue${buildQuery(params)}`))
}

export async function getQcKioskSummary() {
  return apiRequest<{ openCount: number; pendingCount: number; reworkCount: number }>(tenantPath('/quality/kiosk/summary'))
}

export async function getQcKioskInspection(id: string) {
  return apiRequest<QualityInspection>(tenantPath(`/quality/kiosk/inspections/${id}`))
}

export async function decideQcKioskInspection(id: string, payload: DecideInspectionPayload) {
  return apiRequest<{ inspection: QualityInspection; promotedStages?: unknown[]; ncr?: QualityNcr }>(
    tenantPath(`/quality/kiosk/inspections/${id}/decide`),
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

export async function getInspection(id: string) {
  return apiRequest<QualityInspection>(tenantPath(`/quality/inspections/${id}`))
}

export async function createInspection(payload: CreateInspectionPayload) {
  return apiRequest<QualityInspection>(tenantPath('/quality/inspections'), { method: 'POST', body: JSON.stringify(payload) })
}

export async function decideInspection(id: string, payload: DecideInspectionPayload) {
  return apiRequest<{ inspection: QualityInspection; promotedStages?: unknown[]; ncr?: QualityNcr }>(
    tenantPath(`/quality/inspections/${id}/decide`),
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

export async function cancelInspection(id: string, payload?: { remarks?: string }) {
  return apiRequest<QualityInspection>(tenantPath(`/quality/inspections/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
  })
}

export async function listNcrs(params?: {
  page?: number
  limit?: number
  status?: QualityNcrStatus
  productionOrderId?: string
}) {
  return apiRequest<QualityNcr[]>(tenantPath(`/quality/ncrs${buildQuery(params)}`))
}

export async function getNcr(id: string) {
  return apiRequest<QualityNcr>(tenantPath(`/quality/ncrs/${id}`))
}

export async function closeNcr(id: string, payload?: { closureNotes?: string }) {
  return apiRequest<QualityNcr>(tenantPath(`/quality/ncrs/${id}/close`), { method: 'POST', body: JSON.stringify(payload ?? {}) })
}

export async function getProductionOrderQualityBlockers(productionOrderId: string) {
  return apiRequest<{ blockers: QualityBlocker[] }>(
    tenantPath(`/quality/production-orders/${productionOrderId}/blockers`),
  )
}

export async function getWorkOrderQualityBlockers(workOrderId: string) {
  return apiRequest<{ blockers: QualityBlocker[] }>(
    tenantPath(`/manufacturing/work-orders/${workOrderId}/quality-blockers`),
  )
}

export async function listQcParameters(params?: { page?: number; limit?: number; search?: string; active?: boolean }) {
  return apiRequest<QualityParameter[]>(tenantPath(`/quality/parameters${buildQuery(params)}`))
}

export async function getQcParameter(id: string) {
  return apiRequest<QualityParameter>(tenantPath(`/quality/parameters/${id}`))
}

export async function createQcParameter(payload: CreateParameterPayload) {
  return apiRequest<QualityParameter>(tenantPath('/quality/parameters'), { method: 'POST', body: JSON.stringify(payload) })
}

export async function updateQcParameter(id: string, payload: Partial<CreateParameterPayload>) {
  return apiRequest<QualityParameter>(tenantPath(`/quality/parameters/${id}`), { method: 'PATCH', body: JSON.stringify(payload) })
}

export async function deactivateQcParameter(id: string) {
  return apiRequest<QualityParameter>(tenantPath(`/quality/parameters/${id}/deactivate`), { method: 'POST', body: JSON.stringify({}) })
}

export async function listInspectionPlans(params?: {
  page?: number
  limit?: number
  search?: string
  status?: QualityInspectionPlanStatus
  category?: QualityInspectionCategory
}) {
  return apiRequest<QualityInspectionPlan[]>(tenantPath(`/quality/inspection-plans${buildQuery(params)}`))
}

export async function getInspectionPlan(id: string) {
  return apiRequest<QualityInspectionPlan>(tenantPath(`/quality/inspection-plans/${id}`))
}

export async function createInspectionPlan(payload: CreatePlanPayload) {
  return apiRequest<QualityInspectionPlan>(tenantPath('/quality/inspection-plans'), { method: 'POST', body: JSON.stringify(payload) })
}

export async function updateInspectionPlan(id: string, payload: Partial<CreatePlanPayload>) {
  return apiRequest<QualityInspectionPlan>(tenantPath(`/quality/inspection-plans/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deactivateInspectionPlan(id: string) {
  return apiRequest<QualityInspectionPlan>(tenantPath(`/quality/inspection-plans/${id}/deactivate`), {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function reviseInspectionPlan(id: string, payload?: { changeReason?: string }) {
  return apiRequest<unknown>(tenantPath(`/quality/inspection-plans/${id}/revise`), {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
  })
}

export async function activateInspectionPlan(id: string) {
  return apiRequest<QualityInspectionPlan>(tenantPath(`/quality/inspection-plans/${id}/activate`), {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function listInspectionPlanRevisions(id: string) {
  return apiRequest<unknown[]>(tenantPath(`/quality/inspection-plans/${id}/revisions`))
}

export interface QualityWorkspaceSummary {
  incomingPending: number
  incomingNote: string
  inProcessPending: number
  finalPending: number
  jobWorkPending: number
  openNcrs: number
  certificatesMissing: number
}

export async function getQualityWorkspaceSummary() {
  return apiRequest<QualityWorkspaceSummary>(tenantPath('/quality/workspace/summary'))
}

export interface IncomingQualityQueueItem {
  kind: 'GRN' | 'PURCHASE_QI'
  id: string
  number: string
  status: string
  vendorName: string | null
  warehouseId?: string | null
  receivedDate?: string | null
  grnId?: string | null
  grnNumber?: string | null
  href: string
}

export interface IncomingQualityReadiness {
  ready: boolean
  code: string
  message: string
  items?: IncomingQualityQueueItem[]
  counts?: { grnPending: number; purchaseQiPending: number; total: number }
}

export async function getIncomingQualityQueue() {
  return apiRequest<IncomingQualityReadiness>(tenantPath('/quality/incoming/queue'))
}

export async function listQualityCertificates(params?: { page?: number; limit?: number; inspectionId?: string }) {
  return apiRequest<unknown[]>(tenantPath(`/quality/certificates${buildQuery(params)}`))
}

export async function createQualityCertificate(payload: Record<string, unknown>) {
  return apiRequest<unknown>(tenantPath('/quality/certificates'), { method: 'POST', body: JSON.stringify(payload) })
}

export async function verifyQualityCertificate(id: string) {
  return apiRequest<unknown>(tenantPath(`/quality/certificates/${id}/verify`), { method: 'POST', body: JSON.stringify({}) })
}
