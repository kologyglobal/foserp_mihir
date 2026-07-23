/**
 * Manufacturing Phase 7E — work-order costing, costing policies and
 * manufacturing accounting (events, workspace, financial close).
 * Base path: /api/v1/t/:tenantSlug/manufacturing/...
 *
 * Decimal columns are serialized by the backend as strings (Prisma Decimal).
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

// ─── Costing policies ────────────────────────────────────────────────────────

export type CostingPolicyStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

export interface ManufacturingCostingPolicy {
  id: string
  tenantId: string
  legalEntityId: string | null
  plantCode: string | null
  name: string
  status: CostingPolicyStatus
  costingMethod: 'ACTUAL' | 'PLANNED_AS_PROVISIONAL'
  materialValuationSource: 'MOVEMENT_UNIT_COST' | 'PROVISIONAL_RATE'
  labourRateSource: 'WORK_CENTRE_RATE' | 'TENANT_DEFAULT'
  machineRateSource: 'MACHINE_RATE' | 'WORK_CENTRE_RATE'
  jobWorkCostSource: 'LINKED_INVOICE' | 'APPROVED_CHARGE' | 'PROVISIONAL_RATE'
  overheadMethod: 'NONE' | 'PER_LABOUR_HOUR' | 'PER_MACHINE_HOUR' | 'PER_GOOD_UNIT' | 'PERCENT_OF_MATERIAL_COST'
  overheadRate: string
  defaultLabourRate: string
  defaultMachineRate: string
  fgPostingMode: 'MANUAL' | 'NONE'
  variancePostingMode: 'MANUAL' | 'NONE'
  effectiveFrom: string | null
  currencyCode: string
  createdAt: string
  updatedAt: string
}

export async function listCostingPolicies(
  params?: { page?: number; limit?: number; status?: CostingPolicyStatus; plantCode?: string },
) {
  return apiRequest<ManufacturingCostingPolicy[]>(`${tenantPath('/manufacturing/costing/policies')}${buildQuery(params)}`)
}

export async function getCostingPolicy(id: string) {
  return apiRequest<ManufacturingCostingPolicy>(tenantPath(`/manufacturing/costing/policies/${id}`))
}

export async function createCostingPolicy(data: Record<string, unknown>) {
  return apiRequest<ManufacturingCostingPolicy>(tenantPath('/manufacturing/costing/policies'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateCostingPolicy(id: string, data: Record<string, unknown>) {
  return apiRequest<ManufacturingCostingPolicy>(tenantPath(`/manufacturing/costing/policies/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function activateCostingPolicy(id: string) {
  return apiRequest<ManufacturingCostingPolicy>(tenantPath(`/manufacturing/costing/policies/${id}/activate`), {
    method: 'POST',
  })
}

// ─── Accounting readiness (tenant + per work order) ─────────────────────────

export interface ManufacturingAccountingGateStatus {
  legalEntityId: string | null
  enabled: boolean
  reason: 'ENABLED' | 'FLAG_OFF' | 'NO_LEGAL_ENTITY'
}

export interface ManufacturingAccountingReadiness {
  ready: boolean
  costingEnabled: boolean
  accountingFlag: ManufacturingAccountingGateStatus
  legalEntityId: string | null
  mappingKeys: {
    required: string[]
    core?: string[]
    conditional?: string[]
    present: string[]
    missing: string[]
    invalid?: Array<{ mappingKey: string; code: string; message: string }>
    conditionalEnabled?: Record<string, boolean>
  }
  openPeriod: {
    id: string
    code: string
    periodNumber?: number
    name: string
    startDate: string
    endDate: string
    status: string
  } | null
  /** YYYY-MM-DD used for OPEN period containment */
  postingDateChecked?: string | null
  /** @deprecated prefer postingDateChecked */
  postingDate?: string | null
  pendingEventCount: number
  failedEventCount: number
  unreconciledAccountingEventCount?: number
  inventoryPostingsUnreconciledCount?: number
  provisionalCostCount: number
  eventIntegrity?: {
    counts: {
      failed: number
      unreconciled: number
      retryExhausted: number
      inventoryMissingAccounting: number
      accountingMissingInventory: number
      reversalChainInconsistent: number
      duplicatePendingPosting: number
      totalExceptions: number
    }
    exceptions: Array<{
      eventId: string | null
      sourceType: string
      sourceDocument: string
      workOrderId: string | null
      workOrderNumber: string | null
      eventType: string | null
      status: string | null
      reconciliationStatus: string
      failureCode: string | null
      failureReason: string | null
      retryEligible: boolean
      createdAt: string | null
      lastAttemptedAt: string | null
    }>
    technicalDetails?: Array<{
      eventId: string | null
      postingEventId: string | null
      voucherId: string | null
      idempotencyKey: string | null
      attemptCount: number | null
      postingErrorCode: string | null
      rawFailureReason: string | null
      inventoryMovementId: string | null
      exceptionKind: string
    }>
  }
  blockers: string[]
  warnings: string[]
  notes?: {
    periodCheckDoesNotBypassPosting?: string
    eventExceptionsUiSafe?: string
  }
  enablementChecks?: {
    accountMappingsReady: boolean
    openFinancialPeriodExists: boolean
    failedAccountingEventCount: number
    unreconciledAccountingEventCount: number
    inventoryPostingsUnreconciledCount?: number
    inventoryReconcileConfirmed: boolean
    pilotSignOff: boolean
    canEnable: boolean
  }
  checklist?: {
    wipConfigured: boolean
    fgConfigured: boolean
    finishedGoodsConfigured?: boolean
    varianceConfigured: boolean
    productionVarianceConfigured?: boolean
    rmConfigured: boolean
    labourConfigured?: boolean
    machineConfigured?: boolean
    jobWorkConfigured?: boolean
    overheadConfigured?: boolean
    scrapConfigured?: boolean
    periodOpen: boolean
    accountMappingsReady?: boolean
    noFailedEvents?: boolean
    noUnreconciledEvents?: boolean
    inventoryReconcileSignedOff: boolean
    pilotFinanceSignedOff: boolean
    canEnable?: boolean
  }
  allowedActions: {
    validate: boolean
    post: boolean
    retry: boolean
    financialClose: boolean
    enable?: boolean
  }
}

export async function getCostingReadiness() {
  return apiRequest<ManufacturingAccountingReadiness>(tenantPath('/manufacturing/costing/readiness'))
}

export async function getWorkOrderAccountingReadiness(workOrderId: string) {
  return apiRequest<ManufacturingAccountingReadiness>(
    tenantPath(`/manufacturing/work-orders/${workOrderId}/accounting-readiness`),
  )
}

// ─── Work-order cost snapshots / entries ─────────────────────────────────────

export type CostCompletenessStatus =
  | 'COMPLETE'
  | 'COMPLETE_WITH_PROVISIONAL'
  | 'NOT_CALCULATED'
  | `INCOMPLETE_${string}`

export interface WorkOrderCostSnapshot {
  id: string | null
  tenantId: string
  productionOrderId: string
  snapshotType: string
  snapshotVersion: number | null
  status: string
  calculationDate: string
  currencyCode: string
  plannedQuantity: string
  goodQuantity: string
  fgReceivedQuantity: string
  plannedMaterialCost: string
  actualMaterialCost: string
  plannedLabourCost: string
  actualLabourCost: string
  plannedMachineCost: string
  actualMachineCost: string
  plannedJobWorkCost: string
  actualJobWorkCost: string
  plannedOverheadCost: string
  actualOverheadCost: string
  scrapCost: string
  reworkCost: string
  totalPlannedCost: string
  totalActualCost: string
  totalPostedCost: string
  provisionalCost: string
  varianceAmount: string
  unitPlannedCost: string
  unitActualCost: string
  completenessStatus: CostCompletenessStatus
  warningSummaryJson?: string[] | null
}

export type CostCategory = 'MATERIAL' | 'LABOUR' | 'MACHINE' | 'JOB_WORK' | 'OVERHEAD'

export interface WorkOrderCostEntry {
  id: string
  costCategory: CostCategory
  sourceEntityType: string
  sourceEntityId: string
  sourceTransactionDate: string
  itemId: string | null
  workCentreId: string | null
  machineId: string | null
  jobWorkOrderId: string | null
  quantity: string | null
  durationMinutes: number | null
  rate: string
  amount: string
  currencyCode: string
  provisional: boolean
  createdAt: string
}

export interface AccountingStatusCount {
  status: string
  _count: { _all: number }
}

export interface WorkOrderCostSummary {
  snapshot: WorkOrderCostSnapshot | null
  completenessStatus?: 'NOT_CALCULATED'
  warnings: string[]
  accountingStatus: AccountingStatusCount[]
  allowedActions: string[]
}

export async function getWorkOrderCostSummary(workOrderId: string) {
  return apiRequest<WorkOrderCostSummary>(tenantPath(`/manufacturing/work-orders/${workOrderId}/cost-summary`))
}

export async function getWorkOrderCostDetails(workOrderId: string) {
  return apiRequest<WorkOrderCostEntry[]>(tenantPath(`/manufacturing/work-orders/${workOrderId}/cost-details`))
}

export async function getWorkOrderCostSnapshots(workOrderId: string) {
  return apiRequest<WorkOrderCostSnapshot[]>(tenantPath(`/manufacturing/work-orders/${workOrderId}/cost-snapshots`))
}

export async function calculateWorkOrderCost(workOrderId: string, data?: { persist?: boolean }) {
  return apiRequest<{ snapshot: WorkOrderCostSnapshot; entries: unknown[]; warnings: string[] }>(
    tenantPath(`/manufacturing/work-orders/${workOrderId}/cost/calculate`),
    { method: 'POST', body: JSON.stringify(data ?? {}) },
  )
}

// ─── Financial close ─────────────────────────────────────────────────────────

export interface FinancialClosePreview {
  ready: boolean
  blockers: string[]
  readiness: ManufacturingAccountingReadiness
  orderStatus: string
  snapshot: WorkOrderCostSnapshot | null
  residualVariance: string | null
}

export async function previewWorkOrderFinancialClose(workOrderId: string) {
  return apiRequest<FinancialClosePreview>(tenantPath(`/manufacturing/work-orders/${workOrderId}/financial-close/preview`), {
    method: 'POST',
  })
}

export async function recordWorkOrderFinancialClose(workOrderId: string) {
  return apiRequest<ManufacturingAccountingEvent>(tenantPath(`/manufacturing/work-orders/${workOrderId}/financial-close`), {
    method: 'POST',
  })
}

// ─── Manufacturing accounting events ─────────────────────────────────────────

export type ManufacturingAccountingEventStatus = 'RECORDED' | 'POSTED' | 'FAILED' | 'REVERSED' | 'SKIPPED'

export interface ManufacturingAccountingEvent {
  id: string
  tenantId: string
  legalEntityId: string
  eventType: string
  status: ManufacturingAccountingEventStatus
  productionOrderId: string | null
  idempotencyKey: string
  sourceDocumentType: string
  sourceDocumentId: string
  quantity: string
  amount: string
  currencyCode: string
  payloadJson: Record<string, unknown> | null
  voucherId: string | null
  postingEventId: string | null
  postedAt: string | null
  failureReason: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export async function getManufacturingAccountingGateStatus(legalEntityId?: string) {
  return apiRequest<ManufacturingAccountingGateStatus>(
    `${tenantPath('/manufacturing/accounting/gate')}${buildQuery({ legalEntityId })}`,
  )
}

// ─── Feature control (Wave 3 — MANUFACTURING_ACCOUNTING flag admin) ──────────

export interface FinanceFeatureControlRow {
  id: string
  tenantId: string
  legalEntityId: string
  featureKey: string
  isEnabled: boolean
  updatedBy: string | null
  updatedAt: string
  legalEntity?: { id: string; code: string; displayName: string | null; isActive: boolean }
}

export interface ManufacturingAccountingFeatureStatus {
  legalEntity: { id: string; code: string; displayName: string | null; isActive: boolean }
  featureKey: string
  isEnabled: boolean
  control: FinanceFeatureControlRow | null
  readiness: ManufacturingAccountingReadiness
  enablement: { ready: boolean; blockers: string[] }
  signOffs?: {
    inventoryReconcile: {
      confirmed: boolean
      confirmedBy: string | null
      confirmedAt: string | null
      remarks: string | null
      scope: Record<string, unknown> | null
      reportRef: string | null
    }
    pilotFinance: {
      confirmed: boolean
      signedOffBy: string | null
      signedOffAt: string | null
      remarks: string | null
      scope: Record<string, unknown> | null
      legalEntityId: string
    }
    historyCount: number
  }
}

export async function listFinanceFeatureControls(featureKey?: string) {
  return apiRequest<FinanceFeatureControlRow[]>(
    `${tenantPath('/manufacturing/accounting/feature-controls')}${buildQuery({ featureKey })}`,
  )
}

export async function getManufacturingAccountingFeatureControl(legalEntityId: string) {
  return apiRequest<ManufacturingAccountingFeatureStatus>(
    tenantPath(`/manufacturing/accounting/feature-controls/${legalEntityId}/MANUFACTURING_ACCOUNTING`),
  )
}

/** @deprecated Prefer postEnable / postDisable / dedicated sign-off endpoints. */
export async function setManufacturingAccountingFeatureControl(
  legalEntityId: string,
  input: {
    isEnabled: boolean
    inventoryReconcileConfirmed?: boolean
    inventoryReconcileRemarks?: string
    inventoryReconcileScope?: {
      plantId?: string
      warehouseIds?: string[]
      workOrderIds?: string[]
      productIds?: string[]
    }
    inventoryReconcileReportRef?: string
    pilotSignOff?: boolean
    pilotSignOffRemarks?: string
    pilotScope?: {
      plantId?: string
      finishedItemIds?: string[]
      warehouseIds?: string[]
      sampleWorkOrderId?: string
      samplePostingPreviewReviewed?: boolean
    }
    signOffNote?: string
  },
) {
  return apiRequest<ManufacturingAccountingFeatureStatus>(
    tenantPath(`/manufacturing/accounting/feature-controls/${legalEntityId}/MANUFACTURING_ACCOUNTING`),
    { method: 'PUT', body: JSON.stringify(input) },
  )
}

export async function getManufacturingAccountingReadinessConsolidated(params?: {
  legalEntityId?: string
  postingDate?: string
  includeTechnicalDetails?: boolean
}) {
  return apiRequest<{
    ready: boolean
    canEnable: boolean
    legalEntityId: string | null
    postingDateChecked: string | null
    featureFlag: {
      enabled: boolean
      reason: string
      enabledBy: string | null
      enabledAt: string | null
      disabledBy: string | null
      disabledAt: string | null
      activationNote: string | null
      configurationVersion: number
      pilotScope: unknown
    }
    checks: Record<string, unknown>
    blockingCodes: string[]
    blockers: string[]
    nextAction: { code: string; label: string }
    allowedActions: Record<string, boolean>
    signOffHistorySummary: Array<{
      id: string
      signOffType: string
      status: string
      confirmedById: string
      confirmedAt: string
      remarks: string | null
    }>
    readiness: ManufacturingAccountingReadiness
  }>(`${tenantPath('/manufacturing/accounting/readiness')}${buildQuery(params)}`)
}

export async function postInventoryReconciliationSignOff(body: {
  legalEntityId: string
  inventoryReconcileConfirmed: true
  remarks?: string
  scope?: Record<string, unknown>
  reportRef?: string
  idempotencyKey?: string
}) {
  return apiRequest(tenantPath('/manufacturing/accounting/sign-offs/inventory-reconciliation'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function postFinancePilotSignOff(body: {
  legalEntityId: string
  pilotSignOff: true
  remarks?: string
  scope?: Record<string, unknown>
  idempotencyKey?: string
}) {
  return apiRequest(tenantPath('/manufacturing/accounting/sign-offs/finance-pilot'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function postEnableManufacturingAccounting(body: {
  legalEntityId: string
  postingDate?: string
  inventoryReconcileConfirmed: true
  pilotSignOff: true
  confirmationNote?: string
  idempotencyKey?: string
}) {
  return apiRequest(tenantPath('/manufacturing/accounting/enable'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function postDisableManufacturingAccounting(body: {
  legalEntityId: string
  reason: string
}) {
  return apiRequest(tenantPath('/manufacturing/accounting/disable'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function listManufacturingAccountingEvents(
  params?: { page?: number; limit?: number; productionOrderId?: string; eventType?: string; status?: string },
) {
  return apiRequest<ManufacturingAccountingEvent[]>(
    `${tenantPath('/manufacturing/accounting/events')}${buildQuery(params)}`,
  )
}

export async function getManufacturingAccountingEvent(id: string) {
  return apiRequest<ManufacturingAccountingEvent>(tenantPath(`/manufacturing/accounting/events/${id}`))
}

export interface ManufacturingEventValidation {
  ready: boolean
  event: ManufacturingAccountingEvent
  readiness: ManufacturingAccountingReadiness
  blockers: string[]
}

export async function validateManufacturingAccountingEvent(id: string) {
  return apiRequest<ManufacturingEventValidation>(tenantPath(`/manufacturing/accounting/events/${id}/validate`), {
    method: 'POST',
  })
}

export async function postManufacturingAccountingEvent(id: string) {
  return apiRequest<ManufacturingAccountingEvent>(tenantPath(`/manufacturing/accounting/events/${id}/post`), {
    method: 'POST',
  })
}

export async function retryManufacturingAccountingEvent(id: string) {
  return apiRequest<ManufacturingAccountingEvent>(tenantPath(`/manufacturing/accounting/events/${id}/retry`), {
    method: 'POST',
  })
}

// ─── Accounting workspace ────────────────────────────────────────────────────

export interface ManufacturingAccountingWorkspaceSummary {
  unpostedCount: number
  failedCount: number
  provisionalCount: number
  wipValue: string
  fgCapitalisedToday: string
  workOrdersReadyToClose: number
}

export interface ProvisionalCostRow extends WorkOrderCostSnapshot {
  productionOrder: { orderNumber: string; status: string }
}

export interface CloseReadyRow {
  id: string
  orderNumber: string
  status: string
  completedGoodQuantity: string
  costSnapshots: WorkOrderCostSnapshot[]
}

export interface ReconciliationRow {
  productionOrderId: string
  orderNumber: string
  operationalCost: string
  postedAmount: string
  difference: string
  status: 'RECONCILED' | 'DIFFERENCE' | 'UNPOSTED' | 'PROVISIONAL' | 'BLOCKED'
  snapshotVersion: number
}

export async function getAccountingWorkspaceSummary() {
  return apiRequest<ManufacturingAccountingWorkspaceSummary>(tenantPath('/manufacturing/accounting/workspace/summary'))
}

export async function listAccountingWorkspaceUnposted() {
  return apiRequest<ManufacturingAccountingEvent[]>(tenantPath('/manufacturing/accounting/workspace/unposted'))
}

export async function listAccountingWorkspaceFailed() {
  return apiRequest<ManufacturingAccountingEvent[]>(tenantPath('/manufacturing/accounting/workspace/failed'))
}

export async function listAccountingWorkspaceProvisional() {
  return apiRequest<ProvisionalCostRow[]>(tenantPath('/manufacturing/accounting/workspace/provisional'))
}

export async function listAccountingWorkspaceCloseReady() {
  return apiRequest<CloseReadyRow[]>(tenantPath('/manufacturing/accounting/workspace/close-ready'))
}

export async function listAccountingWorkspaceReconciliation() {
  return apiRequest<ReconciliationRow[]>(tenantPath('/manufacturing/accounting/workspace/reconciliation'))
}
