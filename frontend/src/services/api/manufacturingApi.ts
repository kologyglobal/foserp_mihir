/**
 * Manufacturing Phase 1 setup API — work centres, machines, BOMs, routings, profiles.
 * Base path: /api/v1/t/:tenantSlug/manufacturing/...
 */
import type {
  Bom,
  BomCompareResult,
  BomLine,
  BomTreeNode,
  BomVersion,
  Dependency,
  Machine,
  Operation,
  Profile,
  ProfileReadiness,
  Routing,
  RoutingCompareResult,
  RoutingVersion,
  StageGroup,
  ValidationResult,
  WorkCentre,
} from '../../types/manufacturingSetup'
import type {
  CompleteStagePayload,
  CompleteStageResult,
  CompleteWorkOrderResult,
  ControlRoomOverview,
  ConvertSalesOrderLinePayload,
  ConvertSalesOrderLineResult,
  CorrectProgressPayload,
  CorrectProgressResult,
  CreateManualDemandPayload,
  CreateManualWorkOrderPayload,
  EligibleSalesOrder,
  HoldWorkOrderPayload,
  ListDemandsQuery,
  ListWorkOrdersQuery,
  ProductionActivityEntry,
  ProductionDemand,
  ProductionOrder,
  ProductionOrderBomSnapshotLine,
  ProductionStageLedgerEntry,
  RecordProgressPayload,
  RecordProgressResult,
  SalesOrderLineEligibilityResult,
  TodayOverview,
  WorkOrderDetail,
  WorkOrdersSummary,
  ProductionOrderMaterial,
  MaterialsReadiness,
  SyncMaterialsResult,
  ReserveMaterialsResult,
  ShortageRequisitionResult,
} from '../../types/manufacturingProduction'
import type {
  CompleteAssignmentPayload,
  CreateAssignmentPayload,
  CreateDailyBatchPayload,
  DailyBatchValidationResult,
  DailyProductionBatch,
  DailyProductionLine,
  ListAssignmentsQuery,
  ListDailyBatchesQuery,
  ListIssuesQuery,
  ListMyWorkQuery,
  PauseAssignmentPayload,
  ProductionAssignment,
  ProductionIssue,
  ReportIssuePayload,
  UpsertDailyLinePayload,
} from '../../types/manufacturingPhase2b'
import type { RuntimeChange, RuntimeChangeInput, RuntimeChangePreview, RuntimeChangeStatus, RuntimeChangeType } from '../../types/manufacturingRuntimeChange'
import type { TransferToWorkOrderInput, WipMovement, WipMovementInput, WipMovementType } from '../../types/manufacturingWipMovement'
import type {
  CorrectionDependency,
  CorrectionHistoryEntry,
  CorrectionInput,
  CorrectionPreview,
  CorrectionStatus,
  CorrectionTransactionType,
  ListCorrectionsQuery,
  ManufacturingCorrection,
} from '../../types/manufacturingCorrection'
import { API_CONFIG } from '../../config/apiConfig'
import { apiRequest, getStoredSession, tenantPath } from './client'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

// ─── Work centres ───────────────────────────────────────────────────────────

export async function listWorkCentres(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<WorkCentre[]>(`${tenantPath('/manufacturing/work-centres')}${buildQuery(params)}`)
}

export async function getWorkCentre(id: string) {
  return apiRequest<WorkCentre>(tenantPath(`/manufacturing/work-centres/${id}`))
}

export async function createWorkCentre(data: Record<string, unknown>) {
  return apiRequest<WorkCentre>(tenantPath('/manufacturing/work-centres'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateWorkCentre(id: string, data: Record<string, unknown>) {
  return apiRequest<WorkCentre>(tenantPath(`/manufacturing/work-centres/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function activateWorkCentre(id: string) {
  return apiRequest<WorkCentre>(tenantPath(`/manufacturing/work-centres/${id}/activate`), { method: 'POST' })
}

export async function deactivateWorkCentre(id: string) {
  return apiRequest<WorkCentre>(tenantPath(`/manufacturing/work-centres/${id}/deactivate`), { method: 'POST' })
}

export async function deleteWorkCentre(id: string) {
  return apiRequest<null>(tenantPath(`/manufacturing/work-centres/${id}`), { method: 'DELETE' })
}

// ─── Machines ───────────────────────────────────────────────────────────────

export async function listMachines(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<Machine[]>(`${tenantPath('/manufacturing/machines')}${buildQuery(params)}`)
}

export async function getMachine(id: string) {
  return apiRequest<Machine>(tenantPath(`/manufacturing/machines/${id}`))
}

export async function createMachine(data: Record<string, unknown>) {
  return apiRequest<Machine>(tenantPath('/manufacturing/machines'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateMachine(id: string, data: Record<string, unknown>) {
  return apiRequest<Machine>(tenantPath(`/manufacturing/machines/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function activateMachine(id: string) {
  return apiRequest<Machine>(tenantPath(`/manufacturing/machines/${id}/activate`), { method: 'POST' })
}

export async function deactivateMachine(id: string) {
  return apiRequest<Machine>(tenantPath(`/manufacturing/machines/${id}/deactivate`), { method: 'POST' })
}

export async function setMachineStatus(id: string, status: string) {
  return apiRequest<Machine>(tenantPath(`/manufacturing/machines/${id}/status`), {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
}

export async function deleteMachine(id: string) {
  return apiRequest<null>(tenantPath(`/manufacturing/machines/${id}`), { method: 'DELETE' })
}

// ─── BOMs ───────────────────────────────────────────────────────────────────

export interface BomImportPreviewRow {
  row: number
  lineRef: string
  parentLineRef: string | null
  itemCode: string
  itemName: string
  quantity: number
  uomCode: string
  sequence: number
  level: number
  errors: string[]
  warnings: string[]
}

export interface BomImportPreviewGroup {
  bomCode: string
  bomName: string
  outputItemCode: string
  outputItemName: string
  action: 'CREATE_BOM' | 'CREATE_REVISION'
  nextVersionNumber: number
  lineCount: number
  errors: string[]
  warnings: string[]
  rows: BomImportPreviewRow[]
}

export interface BomImportPreview {
  ready: boolean
  bomCount: number
  lineCount: number
  errorCount: number
  warningCount: number
  groups: BomImportPreviewGroup[]
}

export interface BomImportResult {
  importedBomCount: number
  importedLineCount: number
  warnings: number
  idempotentReplay: boolean
  created: Array<{
    bomId: string
    bomCode: string
    versionId: string
    versionNumber: number
    revisionCode: string
    lineCount: number
    action: 'CREATE_BOM' | 'CREATE_REVISION'
  }>
}

export async function downloadBomImportTemplate() {
  const session = getStoredSession()
  const res = await fetch(`${API_CONFIG.baseUrl}${tenantPath('/manufacturing/boms/import/template')}`, {
    headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {},
  })
  if (!res.ok) throw new Error('BOM template download failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'bom-combined-import-template.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export async function previewBomCsvImport(rows: Record<string, string>[], restrictBomCode?: string) {
  return apiRequest<BomImportPreview>(tenantPath('/manufacturing/boms/import/preview'), {
    method: 'POST',
    body: JSON.stringify({ rows, restrictBomCode }),
  })
}

export async function confirmBomCsvImport(
  rows: Record<string, string>[],
  idempotencyKey: string,
  restrictBomCode?: string,
) {
  return apiRequest<BomImportResult>(tenantPath('/manufacturing/boms/import'), {
    method: 'POST',
    body: JSON.stringify({ rows, idempotencyKey, restrictBomCode }),
  })
}

export async function listBoms(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<Bom[]>(`${tenantPath('/manufacturing/boms')}${buildQuery(params)}`)
}

export async function createBom(data: Record<string, unknown>) {
  return apiRequest<Bom>(tenantPath('/manufacturing/boms'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getBom(bomId: string) {
  return apiRequest<Bom & { versions: BomVersion[] }>(tenantPath(`/manufacturing/boms/${bomId}`))
}

export async function listBomVersions(bomId: string, params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<BomVersion[]>(`${tenantPath(`/manufacturing/boms/${bomId}/versions`)}${buildQuery(params)}`)
}

export async function createBomVersion(bomId: string, data: Record<string, unknown>) {
  return apiRequest<BomVersion>(tenantPath(`/manufacturing/boms/${bomId}/versions`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ─── BOM versions ───────────────────────────────────────────────────────────

export async function getBomVersion(versionId: string) {
  return apiRequest<BomVersion & { lines: BomLine[] }>(tenantPath(`/manufacturing/bom-versions/${versionId}`))
}

export async function updateBomVersion(versionId: string, data: Record<string, unknown>) {
  return apiRequest<BomVersion>(tenantPath(`/manufacturing/bom-versions/${versionId}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function getBomVersionTree(versionId: string) {
  return apiRequest<{ version: BomVersion; tree: BomTreeNode[] }>(
    tenantPath(`/manufacturing/bom-versions/${versionId}/tree`),
  )
}

export async function createBomLine(versionId: string, data: Record<string, unknown>) {
  return apiRequest<BomLine>(tenantPath(`/manufacturing/bom-versions/${versionId}/lines`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function validateBomVersion(versionId: string) {
  return apiRequest<ValidationResult>(tenantPath(`/manufacturing/bom-versions/${versionId}/validate`), {
    method: 'POST',
  })
}

export async function activateBomVersion(versionId: string) {
  return apiRequest<BomVersion>(tenantPath(`/manufacturing/bom-versions/${versionId}/activate`), { method: 'POST' })
}

export async function reviseBomVersion(versionId: string) {
  return apiRequest<BomVersion>(tenantPath(`/manufacturing/bom-versions/${versionId}/revise`), { method: 'POST' })
}

export async function compareBomVersions(versionId: string, from: string | undefined, to: string) {
  return apiRequest<BomCompareResult>(
    `${tenantPath(`/manufacturing/bom-versions/${versionId}/compare`)}${buildQuery({ from, to })}`,
  )
}

// ─── BOM lines ──────────────────────────────────────────────────────────────

export async function updateBomLine(lineId: string, data: Record<string, unknown>) {
  return apiRequest<BomLine>(tenantPath(`/manufacturing/bom-lines/${lineId}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteBomLine(lineId: string) {
  return apiRequest<null>(tenantPath(`/manufacturing/bom-lines/${lineId}`), { method: 'DELETE' })
}

// ─── Routings ───────────────────────────────────────────────────────────────

export async function listRoutings(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<Routing[]>(`${tenantPath('/manufacturing/routings')}${buildQuery(params)}`)
}

export async function createRouting(data: Record<string, unknown>) {
  return apiRequest<Routing>(tenantPath('/manufacturing/routings'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateRouting(id: string, data: Record<string, unknown>) {
  return apiRequest<Routing>(tenantPath(`/manufacturing/routings/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function getRouting(routingId: string) {
  return apiRequest<Routing & { versions: RoutingVersion[] }>(tenantPath(`/manufacturing/routings/${routingId}`))
}

export async function listRoutingVersions(
  routingId: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  return apiRequest<RoutingVersion[]>(
    `${tenantPath(`/manufacturing/routings/${routingId}/versions`)}${buildQuery(params)}`,
  )
}

export async function createRoutingVersion(routingId: string, data: Record<string, unknown>) {
  return apiRequest<RoutingVersion>(tenantPath(`/manufacturing/routings/${routingId}/versions`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ─── Routing versions ───────────────────────────────────────────────────────

export async function getRoutingVersion(versionId: string) {
  return apiRequest<
    RoutingVersion & { stageGroups: StageGroup[]; operations: Operation[]; dependencies: Dependency[] }
  >(tenantPath(`/manufacturing/routing-versions/${versionId}`))
}

export async function updateRoutingVersion(versionId: string, data: Record<string, unknown>) {
  return apiRequest<RoutingVersion>(tenantPath(`/manufacturing/routing-versions/${versionId}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function createStageGroup(versionId: string, data: Record<string, unknown>) {
  return apiRequest<StageGroup>(tenantPath(`/manufacturing/routing-versions/${versionId}/stage-groups`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function createOperation(versionId: string, data: Record<string, unknown>) {
  return apiRequest<Operation>(tenantPath(`/manufacturing/routing-versions/${versionId}/operations`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function createDependency(versionId: string, data: Record<string, unknown>) {
  return apiRequest<Dependency>(tenantPath(`/manufacturing/routing-versions/${versionId}/dependencies`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function validateRoutingVersion(versionId: string) {
  return apiRequest<ValidationResult>(tenantPath(`/manufacturing/routing-versions/${versionId}/validate`), {
    method: 'POST',
  })
}

export async function activateRoutingVersion(versionId: string) {
  return certifyRoutingVersion(versionId)
}

export async function certifyRoutingVersion(versionId: string) {
  return apiRequest<RoutingVersion>(tenantPath(`/manufacturing/routing-versions/${versionId}/certify`), {
    method: 'POST',
  })
}

export async function closeRoutingVersion(versionId: string, data: { reason: string; forceReplace?: boolean }) {
  return apiRequest<RoutingVersion>(tenantPath(`/manufacturing/routing-versions/${versionId}/close`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export type RoutingWhereUsed = {
  profiles: Array<{
    id: string
    code: string
    name: string
    defaultRoutingVersionId: string | null
    isActive: boolean
  }>
  openProductionOrders: Array<{
    id: string
    orderNumber: string
    status: string
    routingVersionId: string | null
  }>
}

export async function getRoutingWhereUsed(versionId: string) {
  return apiRequest<RoutingWhereUsed>(tenantPath(`/manufacturing/routing-versions/${versionId}/where-used`))
}

export async function reviseRoutingVersion(versionId: string, data?: { revisionNotes: string }) {
  return apiRequest<RoutingVersion>(tenantPath(`/manufacturing/routing-versions/${versionId}/revise`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export async function compareRoutingVersions(versionId: string, from: string | undefined, to: string) {
  return apiRequest<RoutingCompareResult>(
    `${tenantPath(`/manufacturing/routing-versions/${versionId}/compare`)}${buildQuery({ from, to })}`,
  )
}

export type RoutingBomContext = {
  productItemId: string | null
  bomVersion: {
    id: string
    bomId: string
    bomCode: string
    bomName: string
    versionNumber: number
    revisionCode: string
    status: string
  } | null
  tree: Array<{
    id: string
    itemId: string
    lineType: string
    makeOrBuy: string
    phantomAssembly: boolean
    descriptionOverride: string | null
    item: { code: string; name: string } | null
    children: RoutingBomContext['tree']
  }>
  unresolvedReason: 'NO_PRODUCT_ITEM' | 'NO_BOM' | 'NO_ACTIVE_BOM_VERSION' | null
}

export async function getRoutingBomContext(versionId: string) {
  return apiRequest<RoutingBomContext>(tenantPath(`/manufacturing/routing-versions/${versionId}/bom-context`))
}

export async function generateRoutingStagesFromBom(versionId: string, replaceExisting: boolean) {
  return apiRequest<{ stageGroups: StageGroup[]; bomVersionId: string }>(
    tenantPath(`/manufacturing/routing-versions/${versionId}/generate-stages-from-bom`),
    {
      method: 'POST',
      body: JSON.stringify({ replaceExisting }),
    },
  )
}

// ─── Stage groups, operations, dependencies (direct mutation) ─────────────

export async function updateStageGroup(stageGroupId: string, data: Record<string, unknown>) {
  return apiRequest<StageGroup>(tenantPath(`/manufacturing/stages/${stageGroupId}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteStageGroup(stageGroupId: string) {
  return apiRequest<null>(tenantPath(`/manufacturing/stages/${stageGroupId}`), { method: 'DELETE' })
}

export async function updateOperation(operationId: string, data: Record<string, unknown>) {
  return apiRequest<Operation>(tenantPath(`/manufacturing/operations/${operationId}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteOperation(operationId: string) {
  return apiRequest<null>(tenantPath(`/manufacturing/operations/${operationId}`), { method: 'DELETE' })
}

export async function deleteDependency(dependencyId: string) {
  return apiRequest<null>(tenantPath(`/manufacturing/dependencies/${dependencyId}`), { method: 'DELETE' })
}

// ─── Manufacturing profiles ─────────────────────────────────────────────────

export async function listProfiles(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<Profile[]>(`${tenantPath('/manufacturing/profiles')}${buildQuery(params)}`)
}

export async function getProfile(id: string) {
  return apiRequest<Profile>(tenantPath(`/manufacturing/profiles/${id}`))
}

export async function createProfile(data: Record<string, unknown>) {
  return apiRequest<Profile>(tenantPath('/manufacturing/profiles'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateProfile(id: string, data: Record<string, unknown>) {
  return apiRequest<Profile>(tenantPath(`/manufacturing/profiles/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteProfile(id: string) {
  return apiRequest<null>(tenantPath(`/manufacturing/profiles/${id}`), { method: 'DELETE' })
}

export async function activateProfile(id: string) {
  return apiRequest<Profile>(tenantPath(`/manufacturing/profiles/${id}/activate`), { method: 'POST' })
}

export async function deactivateProfile(id: string) {
  return apiRequest<Profile>(tenantPath(`/manufacturing/profiles/${id}/deactivate`), { method: 'POST' })
}

export async function getProfileReadiness(id: string) {
  return apiRequest<ProfileReadiness>(tenantPath(`/manufacturing/profiles/${id}/readiness`))
}

// ─── Phase 2A — Production demands ──────────────────────────────────────────

export async function listDemands(params?: Partial<ListDemandsQuery> & Record<string, string | number | boolean | undefined>) {
  return apiRequest<ProductionDemand[]>(`${tenantPath('/manufacturing/demands')}${buildQuery(params)}`)
}

export async function getDemand(id: string) {
  return apiRequest<ProductionDemand>(tenantPath(`/manufacturing/demands/${id}`))
}

export async function createManualDemand(data: CreateManualDemandPayload) {
  return apiRequest<ProductionDemand>(tenantPath('/manufacturing/demands'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function cancelDemand(id: string, data?: { reason?: string }) {
  return apiRequest<ProductionDemand>(tenantPath(`/manufacturing/demands/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

// ─── Phase 2A — Sales order → demand conversion ─────────────────────────────

export async function listEligibleSalesOrders() {
  return apiRequest<EligibleSalesOrder[]>(tenantPath('/manufacturing/demand-sources/sales-orders'))
}

export async function getSalesOrderLineEligibility(salesOrderId: string) {
  return apiRequest<SalesOrderLineEligibilityResult>(
    tenantPath(`/manufacturing/demand-sources/sales-orders/${salesOrderId}/lines`),
  )
}

export async function convertSalesOrderLine(
  salesOrderId: string,
  lineRef: string,
  data: ConvertSalesOrderLinePayload,
) {
  return apiRequest<ConvertSalesOrderLineResult>(
    tenantPath(`/manufacturing/demand-sources/sales-orders/${salesOrderId}/lines/${encodeURIComponent(lineRef)}/convert`),
    { method: 'POST', body: JSON.stringify(data) },
  )
}

// ─── Phase 2A — Work orders ──────────────────────────────────────────────────

export async function listWorkOrders(params?: Partial<ListWorkOrdersQuery> & Record<string, string | number | boolean | undefined>) {
  return apiRequest<ProductionOrder[]>(`${tenantPath('/manufacturing/work-orders')}${buildQuery(params)}`)
}

export async function getWorkOrdersSummary() {
  return apiRequest<WorkOrdersSummary>(tenantPath('/manufacturing/work-orders/summary'))
}

export async function getWorkOrder(id: string) {
  return apiRequest<ProductionOrder>(tenantPath(`/manufacturing/work-orders/${id}`))
}

export async function getWorkOrderDetail(id: string) {
  return apiRequest<WorkOrderDetail>(tenantPath(`/manufacturing/work-orders/${id}/detail`))
}

export async function getWorkOrderActivities(id: string) {
  return apiRequest<ProductionActivityEntry[]>(tenantPath(`/manufacturing/work-orders/${id}/activities`))
}

export async function getWorkOrderLedger(id: string) {
  return apiRequest<ProductionStageLedgerEntry[]>(tenantPath(`/manufacturing/work-orders/${id}/ledger`))
}

export async function createManualWorkOrder(data: CreateManualWorkOrderPayload) {
  return apiRequest<ProductionOrder>(tenantPath('/manufacturing/work-orders'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function cancelWorkOrder(id: string, data?: { reason?: string }) {
  return apiRequest<ProductionOrder>(tenantPath(`/manufacturing/work-orders/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export async function splitWorkOrder(id: string, data: { quantity: number; reason?: string }) {
  return apiRequest<{
    parentId: string
    child: ProductionOrder
    split: { id: string; parentOrderId: string; childOrderId: string; splitQty: string; reason: string | null }
    correctionId: string
  }>(tenantPath(`/manufacturing/work-orders/${id}/split`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ─── Phase 5A — Runtime changes / production exceptions ─────────────────────

export async function listRuntimeChanges(
  workOrderId: string,
  params?: { page?: number; limit?: number; status?: RuntimeChangeStatus; changeType?: RuntimeChangeType; riskLevel?: string },
) {
  return apiRequest<RuntimeChange[]>(
    `${tenantPath(`/manufacturing/work-orders/${workOrderId}/runtime-changes`)}${buildQuery(params)}`,
  )
}

export async function getRuntimeChange(workOrderId: string, changeId: string) {
  return apiRequest<RuntimeChange>(tenantPath(`/manufacturing/work-orders/${workOrderId}/runtime-changes/${changeId}`))
}

export async function previewRuntimeChange(workOrderId: string, body: Omit<RuntimeChangeInput, 'reason' | 'idempotencyKey'>) {
  return apiRequest<RuntimeChangePreview>(tenantPath(`/manufacturing/work-orders/${workOrderId}/runtime-changes/preview`), {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function createRuntimeChange(workOrderId: string, body: RuntimeChangeInput) {
  return apiRequest<RuntimeChange>(tenantPath(`/manufacturing/work-orders/${workOrderId}/runtime-changes`), {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function updateRuntimeChange(workOrderId: string, changeId: string, body: Partial<Omit<RuntimeChangeInput, 'changeType' | 'idempotencyKey'>>) {
  return apiRequest<RuntimeChange>(tenantPath(`/manufacturing/work-orders/${workOrderId}/runtime-changes/${changeId}`), {
    method: 'PATCH', body: JSON.stringify(body),
  })
}

export async function validateRuntimeChange(workOrderId: string, changeId: string) {
  return apiRequest<{ valid: boolean; impact: RuntimeChangePreview['impact']; risk: RuntimeChangePreview['risk'] }>(
    tenantPath(`/manufacturing/work-orders/${workOrderId}/runtime-changes/${changeId}/validate`), { method: 'POST' },
  )
}

export async function submitRuntimeChange(workOrderId: string, changeId: string) {
  return apiRequest<RuntimeChange>(tenantPath(`/manufacturing/work-orders/${workOrderId}/runtime-changes/${changeId}/submit`), { method: 'POST' })
}

export async function approveRuntimeChange(workOrderId: string, changeId: string, body?: { remarks?: string }) {
  return apiRequest<RuntimeChange>(tenantPath(`/manufacturing/work-orders/${workOrderId}/runtime-changes/${changeId}/approve`), {
    method: 'POST', body: JSON.stringify(body ?? {}),
  })
}

export async function rejectRuntimeChange(workOrderId: string, changeId: string, body: { reason: string }) {
  return apiRequest<RuntimeChange>(tenantPath(`/manufacturing/work-orders/${workOrderId}/runtime-changes/${changeId}/reject`), {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function applyRuntimeChange(workOrderId: string, changeId: string, body?: { idempotencyKey?: string }) {
  return apiRequest<RuntimeChange>(tenantPath(`/manufacturing/work-orders/${workOrderId}/runtime-changes/${changeId}/apply`), {
    method: 'POST', body: JSON.stringify(body ?? {}),
  })
}

export async function cancelRuntimeChange(workOrderId: string, changeId: string, body?: { reason?: string }) {
  return apiRequest<RuntimeChange>(tenantPath(`/manufacturing/work-orders/${workOrderId}/runtime-changes/${changeId}/cancel`), {
    method: 'POST', body: JSON.stringify(body ?? {}),
  })
}

// ─── Phase 5B — WIP movements / transfers ───────────────────────────────────

export async function listWipMovements(
  workOrderId: string,
  params?: { movementType?: WipMovementType; limit?: number; offset?: number },
) {
  return apiRequest<{ total: number; items: WipMovement[] }>(
    `${tenantPath(`/manufacturing/work-orders/${workOrderId}/wip-movements`)}${buildQuery(params)}`,
  )
}

export async function getWipMovement(workOrderId: string, movementId: string) {
  return apiRequest<WipMovement>(
    tenantPath(`/manufacturing/work-orders/${workOrderId}/wip-movements/${movementId}`),
  )
}

export async function createWipMovement(workOrderId: string, body: WipMovementInput) {
  return apiRequest<WipMovement>(tenantPath(`/manufacturing/work-orders/${workOrderId}/wip-movements`), {
    method: 'POST', body: JSON.stringify(body),
  })
}

export async function transferToWorkOrder(workOrderId: string, targetId: string, body: TransferToWorkOrderInput) {
  return apiRequest<WipMovement>(
    tenantPath(`/manufacturing/work-orders/${workOrderId}/transfer-to/${targetId}`),
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export async function releaseWorkOrder(id: string) {
  return apiRequest<ProductionOrder>(tenantPath(`/manufacturing/work-orders/${id}/release`), { method: 'POST' })
}

export async function startWorkOrder(id: string, data?: { stageId?: string }) {
  return apiRequest<ProductionOrder & { warnings?: string[] }>(tenantPath(`/manufacturing/work-orders/${id}/start`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export async function holdWorkOrder(id: string, data: HoldWorkOrderPayload) {
  return apiRequest<ProductionOrder>(tenantPath(`/manufacturing/work-orders/${id}/hold`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function resumeWorkOrder(id: string, data?: { remarks?: string }) {
  return apiRequest<ProductionOrder>(tenantPath(`/manufacturing/work-orders/${id}/resume`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export async function completeWorkOrder(id: string, data?: { remarks?: string }) {
  return apiRequest<CompleteWorkOrderResult>(tenantPath(`/manufacturing/work-orders/${id}/complete`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export async function recordProgress(id: string, data: RecordProgressPayload) {
  return apiRequest<RecordProgressResult>(tenantPath(`/manufacturing/work-orders/${id}/progress`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function completeStage(id: string, data: CompleteStagePayload) {
  return apiRequest<CompleteStageResult>(tenantPath(`/manufacturing/work-orders/${id}/stages/complete`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function correctProgress(id: string, data: CorrectProgressPayload) {
  return apiRequest<CorrectProgressResult>(tenantPath(`/manufacturing/work-orders/${id}/progress/correct`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ─── Phase 2A — Dashboards ───────────────────────────────────────────────────

export async function getTodayDashboard() {
  return apiRequest<TodayOverview>(tenantPath('/manufacturing/today'))
}

export async function getControlRoomDashboard() {
  return apiRequest<ControlRoomOverview>(tenantPath('/manufacturing/control-room'))
}

// ─── Phase 2B — Assignments ──────────────────────────────────────────────────

export async function listAssignments(params?: Partial<ListAssignmentsQuery> & Record<string, string | number | boolean | undefined>) {
  return apiRequest<ProductionAssignment[]>(`${tenantPath('/manufacturing/assignments')}${buildQuery(params)}`)
}

export async function getAssignment(id: string) {
  return apiRequest<ProductionAssignment>(tenantPath(`/manufacturing/assignments/${id}`))
}

export async function getAssignmentHistory(id: string) {
  return apiRequest<ProductionAssignment[]>(tenantPath(`/manufacturing/assignments/${id}/history`))
}

export async function createAssignment(data: CreateAssignmentPayload) {
  return apiRequest<ProductionAssignment & { warnings?: string[] }>(tenantPath('/manufacturing/assignments'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function reassignAssignment(id: string, data: Partial<CreateAssignmentPayload> & { reason?: string }) {
  return apiRequest<ProductionAssignment & { warnings?: string[] }>(tenantPath(`/manufacturing/assignments/${id}/reassign`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function cancelAssignment(id: string, data?: { reason?: string }) {
  return apiRequest<ProductionAssignment>(tenantPath(`/manufacturing/assignments/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export async function acceptAssignment(id: string) {
  return apiRequest<ProductionAssignment>(tenantPath(`/manufacturing/assignments/${id}/accept`), { method: 'POST' })
}

export async function startAssignment(id: string) {
  return apiRequest<ProductionAssignment & { warnings?: string[] }>(tenantPath(`/manufacturing/assignments/${id}/start`), {
    method: 'POST',
  })
}

export async function pauseAssignment(id: string, data?: PauseAssignmentPayload) {
  return apiRequest<ProductionAssignment>(tenantPath(`/manufacturing/assignments/${id}/pause`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export async function resumeAssignment(id: string) {
  return apiRequest<ProductionAssignment>(tenantPath(`/manufacturing/assignments/${id}/resume`), { method: 'POST' })
}

export async function completeAssignment(id: string, data: CompleteAssignmentPayload) {
  return apiRequest<{ assignment: ProductionAssignment; ledgerEntryId: string }>(
    tenantPath(`/manufacturing/assignments/${id}/complete`),
    { method: 'POST', body: JSON.stringify(data) },
  )
}

export async function listWorkOrderAssignments(
  workOrderId: string,
  params?: Partial<ListAssignmentsQuery> & Record<string, string | number | boolean | undefined>,
) {
  return apiRequest<ProductionAssignment[]>(
    `${tenantPath(`/manufacturing/work-orders/${workOrderId}/assignments`)}${buildQuery(params)}`,
  )
}

// ─── Phase 2B — Operator my work ─────────────────────────────────────────────

export async function getMyWork(params?: Partial<ListMyWorkQuery> & Record<string, string | number | boolean | undefined>) {
  return apiRequest<ProductionAssignment[]>(`${tenantPath('/manufacturing/my-work')}${buildQuery(params)}`)
}

export interface ShopfloorKioskCard {
  id: string
  productionOrderId: string
  workOrderNo: string
  productItemId: string | null
  productCode: string | null
  productName: string | null
  productLabel: string
  stageId: string
  stageCode: string | null
  stageName: string | null
  operationId: string | null
  operationCode: string | null
  operationName: string | null
  machineLabel: string | null
  workCentreLabel: string | null
  assignedQuantity: string
  completedQuantity: string
  balanceQuantity: string
  status: string
  workInstruction: string | null
  allowedActions: ProductionAssignment['allowedActions']
  assignmentDate: string | null
  startedAt: string | null
  pausedAt: string | null
}

export interface ShopfloorKioskSummary {
  openCount: number
  inProgressCount: number
  pausedCount: number
}

/** Mobile kiosk projection of operator assignments (includes product label). */
export async function getShopfloorKioskMyWork(
  params?: Partial<ListMyWorkQuery> & Record<string, string | number | boolean | undefined>,
) {
  return apiRequest<ShopfloorKioskCard[]>(`${tenantPath('/manufacturing/kiosk/my-work')}${buildQuery(params)}`)
}

export async function getShopfloorKioskSummary(
  params?: Partial<ListMyWorkQuery> & Record<string, string | number | boolean | undefined>,
) {
  return apiRequest<ShopfloorKioskSummary>(`${tenantPath('/manufacturing/kiosk/summary')}${buildQuery(params)}`)
}

// ─── Phase 2B — Daily production ─────────────────────────────────────────────

export async function listDailyProductionBatches(
  params?: Partial<ListDailyBatchesQuery> & Record<string, string | number | boolean | undefined>,
) {
  return apiRequest<DailyProductionBatch[]>(`${tenantPath('/manufacturing/daily-production')}${buildQuery(params)}`)
}

export async function getDailyProductionBatch(id: string) {
  return apiRequest<DailyProductionBatch>(tenantPath(`/manufacturing/daily-production/${id}`))
}

export async function createDailyProductionBatch(data: CreateDailyBatchPayload) {
  return apiRequest<DailyProductionBatch>(tenantPath('/manufacturing/daily-production'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateDailyProductionBatch(id: string, data: Partial<CreateDailyBatchPayload>) {
  return apiRequest<DailyProductionBatch>(tenantPath(`/manufacturing/daily-production/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function addDailyProductionLine(batchId: string, data: UpsertDailyLinePayload) {
  return apiRequest<DailyProductionLine>(tenantPath(`/manufacturing/daily-production/${batchId}/lines`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateDailyProductionLine(batchId: string, lineId: string, data: UpsertDailyLinePayload) {
  return apiRequest<DailyProductionLine>(tenantPath(`/manufacturing/daily-production/${batchId}/lines/${lineId}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function removeDailyProductionLine(batchId: string, lineId: string) {
  return apiRequest<null>(tenantPath(`/manufacturing/daily-production/${batchId}/lines/${lineId}`), { method: 'DELETE' })
}

export async function validateDailyProductionBatch(id: string) {
  return apiRequest<DailyBatchValidationResult>(tenantPath(`/manufacturing/daily-production/${id}/validate`), {
    method: 'POST',
  })
}

export async function submitDailyProductionBatch(id: string) {
  return apiRequest<{ batch: DailyProductionBatch; ledgerEntryIds: string[] }>(
    tenantPath(`/manufacturing/daily-production/${id}/submit`),
    { method: 'POST' },
  )
}

export async function correctDailyProductionLine(
  batchId: string,
  lineId: string,
  data: { goodQuantity: number; reworkQuantity: number; rejectedQuantity: number; scrapQuantity: number; reason: string },
) {
  return apiRequest<{ reversalId: string; correctionId: string }>(
    tenantPath(`/manufacturing/daily-production/${batchId}/lines/${lineId}/correct`),
    { method: 'POST', body: JSON.stringify(data) },
  )
}

// ─── Phase 2B — Issues ───────────────────────────────────────────────────────

export async function listIssues(params?: Partial<ListIssuesQuery> & Record<string, string | number | boolean | undefined>) {
  return apiRequest<ProductionIssue[]>(`${tenantPath('/manufacturing/issues')}${buildQuery(params)}`)
}

export async function getIssue(id: string) {
  return apiRequest<ProductionIssue>(tenantPath(`/manufacturing/issues/${id}`))
}

export async function reportIssue(data: ReportIssuePayload) {
  return apiRequest<ProductionIssue>(tenantPath('/manufacturing/issues'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function acknowledgeIssue(id: string, data?: { remarks?: string }) {
  return apiRequest<ProductionIssue>(tenantPath(`/manufacturing/issues/${id}/acknowledge`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export async function markIssueInProgress(id: string) {
  return apiRequest<ProductionIssue>(tenantPath(`/manufacturing/issues/${id}/in-progress`), { method: 'POST' })
}

export async function resolveIssue(
  id: string,
  data: { resolution: string; actualDowntimeMinutes?: number; endDowntime?: boolean; resumeAssignment?: boolean },
) {
  return apiRequest<ProductionIssue>(tenantPath(`/manufacturing/issues/${id}/resolve`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function cancelIssue(id: string, data?: { reason?: string }) {
  return apiRequest<ProductionIssue>(tenantPath(`/manufacturing/issues/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

// ─── Phase 3C — Production materials (Inventory + Purchase integration) ─────

export async function listWorkOrderMaterials(workOrderId: string) {
  return apiRequest<ProductionOrderMaterial[]>(tenantPath(`/manufacturing/work-orders/${workOrderId}/materials`))
}

export async function getWorkOrderMaterialsReadiness(workOrderId: string) {
  return apiRequest<MaterialsReadiness>(tenantPath(`/manufacturing/work-orders/${workOrderId}/materials/readiness`))
}

export async function syncWorkOrderMaterialRequirements(workOrderId: string) {
  return apiRequest<SyncMaterialsResult>(tenantPath(`/manufacturing/work-orders/${workOrderId}/materials/sync-requirements`), {
    method: 'POST',
  })
}

export async function addWorkOrderMaterialRequirement(
  workOrderId: string,
  data: {
    itemId: string
    uomId: string
    requiredQty: number
    makeOrBuy?: 'MAKE' | 'BUY'
    lineType?: string
    remarks?: string
  },
) {
  return apiRequest<ProductionOrderMaterial>(tenantPath(`/manufacturing/work-orders/${workOrderId}/materials`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateWorkOrderMaterialRequirement(
  workOrderId: string,
  materialId: string,
  data: {
    requiredQty?: number
    itemId?: string
    uomId?: string
    remarks?: string | null
  },
) {
  return apiRequest<ProductionOrderMaterial>(
    tenantPath(`/manufacturing/work-orders/${workOrderId}/materials/${materialId}`),
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  )
}

export async function removeWorkOrderMaterialRequirement(workOrderId: string, materialId: string) {
  return apiRequest<{ id: string }>(
    tenantPath(`/manufacturing/work-orders/${workOrderId}/materials/${materialId}`),
    { method: 'DELETE' },
  )
}

export async function addWorkOrderBomLine(
  workOrderId: string,
  data: {
    itemId: string
    uomId: string
    perUnitQuantity: number
    scrapPercent?: number
    makeOrBuy?: 'MAKE' | 'BUY'
    lineType?: string
    isOptional?: boolean
    descriptionOverride?: string | null
    parentLineId?: string | null
    syncMaterial?: boolean
  },
) {
  return apiRequest<ProductionOrderBomSnapshotLine>(
    tenantPath(`/manufacturing/work-orders/${workOrderId}/bom-lines`),
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
  )
}

export async function updateWorkOrderBomLine(
  workOrderId: string,
  lineId: string,
  data: {
    itemId?: string
    uomId?: string
    perUnitQuantity?: number
    scrapPercent?: number
    requiredQuantity?: number
    makeOrBuy?: 'MAKE' | 'BUY'
    lineType?: string
    isOptional?: boolean
    descriptionOverride?: string | null
    parentLineId?: string | null
  },
) {
  return apiRequest<ProductionOrderBomSnapshotLine>(
    tenantPath(`/manufacturing/work-orders/${workOrderId}/bom-lines/${lineId}`),
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  )
}

export async function removeWorkOrderBomLine(workOrderId: string, lineId: string) {
  return apiRequest<{ id: string }>(
    tenantPath(`/manufacturing/work-orders/${workOrderId}/bom-lines/${lineId}`),
    { method: 'DELETE' },
  )
}

export async function reserveWorkOrderMaterials(workOrderId: string, data?: { materialIds?: string[] }) {
  return apiRequest<ReserveMaterialsResult>(tenantPath(`/manufacturing/work-orders/${workOrderId}/materials/reserve`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export async function issueWorkOrderMaterial(
  workOrderId: string,
  data: {
    materialId: string
    quantity: number
    idempotencyKey: string
    remarks?: string
    warehouseId?: string
    additional?: boolean
  },
) {
  return apiRequest<ProductionOrderMaterial>(tenantPath(`/manufacturing/work-orders/${workOrderId}/materials/issue`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function returnWorkOrderMaterial(
  workOrderId: string,
  data: { materialId: string; quantity: number; idempotencyKey?: string; remarks?: string },
) {
  return apiRequest<ProductionOrderMaterial>(tenantPath(`/manufacturing/work-orders/${workOrderId}/materials/return`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function createWorkOrderShortageRequisition(
  workOrderId: string,
  data?: { idempotencyKey?: string; priority?: string; submit?: boolean },
) {
  return apiRequest<ShortageRequisitionResult>(
    tenantPath(`/manufacturing/work-orders/${workOrderId}/materials/shortage-requisition`),
    { method: 'POST', body: JSON.stringify(data ?? {}) },
  )
}

// ─── Phase 5C — Transaction corrections / reversals ─────────────────────────

export async function listCorrections(params?: Partial<ListCorrectionsQuery> & Record<string, string | number | boolean | undefined>) {
  return apiRequest<ManufacturingCorrection[]>(
    `${tenantPath('/manufacturing/corrections')}${buildQuery(params)}`,
  )
}

export async function previewCorrection(body: Omit<CorrectionInput, 'reason' | 'idempotencyKey' | 'businessJustification'>) {
  return apiRequest<CorrectionPreview>(tenantPath('/manufacturing/corrections/preview'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function createCorrection(body: CorrectionInput) {
  return apiRequest<ManufacturingCorrection>(tenantPath('/manufacturing/corrections'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getCorrection(correctionId: string) {
  return apiRequest<ManufacturingCorrection>(tenantPath(`/manufacturing/corrections/${correctionId}`))
}

export async function updateCorrection(
  correctionId: string,
  body: Partial<Omit<CorrectionInput, 'action' | 'transactionType' | 'sourceEntityId' | 'idempotencyKey'>>,
) {
  return apiRequest<ManufacturingCorrection>(tenantPath(`/manufacturing/corrections/${correctionId}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function validateCorrection(correctionId: string) {
  return apiRequest<{ valid: boolean; impact: CorrectionPreview['impact']; risk: CorrectionPreview['risk'] }>(
    tenantPath(`/manufacturing/corrections/${correctionId}/validate`),
    { method: 'POST' },
  )
}

export async function submitCorrection(correctionId: string) {
  return apiRequest<ManufacturingCorrection>(
    tenantPath(`/manufacturing/corrections/${correctionId}/submit`),
    { method: 'POST' },
  )
}

export async function approveCorrection(correctionId: string, body?: { remarks?: string }) {
  return apiRequest<ManufacturingCorrection>(
    tenantPath(`/manufacturing/corrections/${correctionId}/approve`),
    { method: 'POST', body: JSON.stringify(body ?? {}) },
  )
}

export async function rejectCorrection(correctionId: string, body: { reason: string }) {
  return apiRequest<ManufacturingCorrection>(
    tenantPath(`/manufacturing/corrections/${correctionId}/reject`),
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export async function applyCorrection(correctionId: string, body?: { idempotencyKey?: string }) {
  return apiRequest<ManufacturingCorrection>(
    tenantPath(`/manufacturing/corrections/${correctionId}/apply`),
    { method: 'POST', body: JSON.stringify(body ?? {}) },
  )
}

export async function cancelCorrection(correctionId: string, body?: { reason?: string }) {
  return apiRequest<ManufacturingCorrection>(
    tenantPath(`/manufacturing/corrections/${correctionId}/cancel`),
    { method: 'POST', body: JSON.stringify(body ?? {}) },
  )
}

export async function listCorrectionDependencies(correctionId: string) {
  return apiRequest<CorrectionDependency[]>(
    tenantPath(`/manufacturing/corrections/${correctionId}/dependencies`),
  )
}

export async function listCorrectionHistory(
  entityType: CorrectionTransactionType | string,
  entityId: string,
  params?: { limit?: number; status?: CorrectionStatus },
) {
  return apiRequest<CorrectionHistoryEntry[]>(
    `${tenantPath(`/manufacturing/transactions/${entityType}/${entityId}/correction-history`)}${buildQuery(params)}`,
  )
}

// ─── Phase 4B — Job Work / subcontracting ───────────────────────────────────

export async function listJobWorkOrders(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<unknown[]>(`${tenantPath('/manufacturing/job-work')}${buildQuery(params)}`)
}
export async function getJobWorkOrder(id: string) {
  return apiRequest<unknown>(tenantPath(`/manufacturing/job-work/${id}`))
}
export async function createJobWorkOrder(data: Record<string, unknown>) {
  return apiRequest<unknown>(tenantPath('/manufacturing/job-work'), { method: 'POST', body: JSON.stringify(data) })
}
export async function updateJobWorkOrder(id: string, data: Record<string, unknown>) {
  return apiRequest<unknown>(tenantPath(`/manufacturing/job-work/${id}`), { method: 'PATCH', body: JSON.stringify(data) })
}
export async function dispatchJobWorkOrder(id: string, data: Record<string, unknown>) {
  return apiRequest<unknown>(tenantPath(`/manufacturing/job-work/${id}/dispatch`), { method: 'POST', body: JSON.stringify(data) })
}
export async function receiveJobWorkOrder(id: string, data: Record<string, unknown>) {
  return apiRequest<unknown>(tenantPath(`/manufacturing/job-work/${id}/receive`), { method: 'POST', body: JSON.stringify(data) })
}
export async function returnJobWorkMaterial(id: string, data: Record<string, unknown>) {
  return apiRequest<unknown>(tenantPath(`/manufacturing/job-work/${id}/return-material`), { method: 'POST', body: JSON.stringify(data) })
}
export async function reconcileJobWorkOrder(id: string, data: Record<string, unknown>) {
  return apiRequest<unknown>(tenantPath(`/manufacturing/job-work/${id}/reconcile`), { method: 'POST', body: JSON.stringify(data) })
}
export async function approveJobWorkDifference(id: string, reason: string) {
  return apiRequest<unknown>(tenantPath(`/manufacturing/job-work/${id}/approve-difference`), { method: 'POST', body: JSON.stringify({ reason }) })
}
export async function linkJobWorkInvoice(id: string, data: Record<string, unknown>) {
  return apiRequest<unknown>(tenantPath(`/manufacturing/job-work/${id}/link-invoice`), { method: 'POST', body: JSON.stringify(data) })
}
export async function closeJobWorkOrder(id: string) {
  return apiRequest<unknown>(tenantPath(`/manufacturing/job-work/${id}/close`), { method: 'POST' })
}
export async function cancelJobWorkOrder(id: string, reason: string) {
  return apiRequest<unknown>(tenantPath(`/manufacturing/job-work/${id}/cancel`), { method: 'POST', body: JSON.stringify({ reason }) })
}

// ─── Phase 6A — Production plans ─────────────────────────────────────────────

export interface ApiProductionPlanLine {
  id: string
  lineNo: number
  productItemId: string
  productItemCode: string
  productItemName: string
  uomId: string
  uomCode: string
  demandQuantity: string
  safetyStockQuantity: string
  suggestedQuantity: string
  availableFinishedStock: string
  openWorkOrderQuantity: string
  requiredDate: string | null
  demandId: string | null
  demandNumber: string | null
  productionOrderId: string | null
  productionOrderNumber: string | null
  salesOrderId: string | null
  sourceDocumentId: string | null
  sourceDocumentNo: string | null
  ignored: boolean
  bomReady: boolean
  materialStatus: string | null
  notes: string | null
}

export interface ApiProductionPlan {
  id: string
  planNumber: string
  planName: string
  planDate: string | null
  sourceType: string
  status: string
  warehouseId: string | null
  warehouseCode: string | null
  warehouseName: string | null
  plantCode: string | null
  periodFrom: string | null
  periodTo: string | null
  notes: string | null
  ownerUserId: string | null
  totalItems: number
  plannedQty: number
  wosCreated: number
  lines: ApiProductionPlanLine[]
  createdAt: string
  updatedAt: string
  createdBy: string | null
}

export async function listProductionPlans(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<ApiProductionPlan[]>(`${tenantPath('/manufacturing/plans')}${buildQuery(params)}`)
}

export async function getProductionPlanApi(id: string) {
  return apiRequest<ApiProductionPlan>(tenantPath(`/manufacturing/plans/${id}`))
}

export async function createProductionPlanApi(data: Record<string, unknown>) {
  return apiRequest<ApiProductionPlan>(tenantPath('/manufacturing/plans'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateProductionPlanApi(id: string, data: Record<string, unknown>) {
  return apiRequest<ApiProductionPlan>(tenantPath(`/manufacturing/plans/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function releaseProductionPlan(id: string) {
  return apiRequest<ApiProductionPlan>(tenantPath(`/manufacturing/plans/${id}/release`), { method: 'POST' })
}

export async function previewProductionPlanNetting(id: string) {
  return apiRequest<{
    planId: string
    warehouseId: string | null
    lines: Array<Record<string, unknown>>
    summary: { totalLines: number; makeLines: number; shortageLines: number }
  }>(tenantPath(`/manufacturing/plans/${id}/preview-netting`), { method: 'POST' })
}

export async function generateWorkOrdersFromPlanApi(id: string, data?: { lineIds?: string[]; idempotencyKey?: string }) {
  return apiRequest<{ plan: ApiProductionPlan; created: Array<{ lineId: string; productionOrderId: string; orderNumber: string }> }>(
    tenantPath(`/manufacturing/plans/${id}/generate-work-orders`),
    { method: 'POST', body: JSON.stringify(data ?? {}) },
  )
}

export async function closeProductionPlanApi(id: string) {
  return apiRequest<ApiProductionPlan>(tenantPath(`/manufacturing/plans/${id}/close`), { method: 'POST' })
}

export async function cancelProductionPlanApi(id: string, reason: string) {
  return apiRequest<ApiProductionPlan>(tenantPath(`/manufacturing/plans/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

// ─── Phase 6B — Costing / manufacturing GL events ────────────────────────────

export async function getManufacturingAccountingGate(legalEntityId?: string) {
  const q = legalEntityId ? `?legalEntityId=${encodeURIComponent(legalEntityId)}` : ''
  return apiRequest<{ legalEntityId: string | null; enabled: boolean; reason: string }>(
    tenantPath(`/manufacturing/accounting/gate${q}`),
  )
}

export async function listManufacturingAccountingEvents(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return apiRequest<Array<Record<string, unknown>>>(
    `${tenantPath('/manufacturing/accounting/events')}${buildQuery(params)}`,
  )
}

export async function getWorkOrderCostPreview(workOrderId: string) {
  return apiRequest<Record<string, unknown>>(tenantPath(`/manufacturing/work-orders/${workOrderId}/costing/preview`))
}

// ─── Phase 7A — Warehouse mapping, material position, FG, store workbench ───

export type ManufacturingWarehouseMapping = {
  id: string
  tenantId: string
  plantCode: string | null
  rawMaterialWarehouseId: string
  productionIssueWarehouseId: string | null
  wipWarehouseId: string | null
  finishedGoodsWarehouseId: string
  qualityHoldWarehouseId: string | null
  reworkWarehouseId: string | null
  scrapWarehouseId: string | null
  jobWorkWarehouseId: string | null
  defaultReturnWarehouseId: string | null
  isDefault: boolean
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type StoreWorkbenchSummary = {
  asOf: string
  openWorkOrders: number
  kpis: {
    waitingReservation: number
    waitingIssue: number
    waitingReturns: number
    waitingWip: number
    waitingFg: number
    activeWoReservations: number
  }
}

export async function listWarehouseMappings(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<ManufacturingWarehouseMapping[]>(
    `${tenantPath('/manufacturing/warehouse-mappings')}${buildQuery(params)}`,
  )
}

export async function getWarehouseMapping(id: string) {
  return apiRequest<ManufacturingWarehouseMapping>(tenantPath(`/manufacturing/warehouse-mappings/${id}`))
}

export async function createWarehouseMapping(data: Record<string, unknown>) {
  return apiRequest<ManufacturingWarehouseMapping>(tenantPath('/manufacturing/warehouse-mappings'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateWarehouseMapping(id: string, data: Record<string, unknown>) {
  return apiRequest<ManufacturingWarehouseMapping>(tenantPath(`/manufacturing/warehouse-mappings/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function getWarehouseMappingReadiness(id: string) {
  return apiRequest<Record<string, unknown>>(tenantPath(`/manufacturing/warehouse-mappings/${id}/readiness`))
}

export async function getWarehouseMappingsTenantReadiness(params?: { plantCode?: string; profileId?: string }) {
  return apiRequest<Record<string, unknown>>(
    `${tenantPath('/manufacturing/warehouse-mappings/readiness')}${buildQuery(params)}`,
  )
}

export async function resolveWarehouseMapping(params?: { plantCode?: string; profileId?: string }) {
  return apiRequest<Record<string, unknown>>(
    `${tenantPath('/manufacturing/warehouse-mappings/resolve')}${buildQuery(params)}`,
  )
}

export async function getMaterialPosition(woId: string) {
  return apiRequest<Record<string, unknown>>(tenantPath(`/manufacturing/work-orders/${woId}/materials/position`))
}

export async function getMaterialReconciliation(woId: string) {
  return apiRequest<Record<string, unknown>>(
    tenantPath(`/manufacturing/work-orders/${woId}/materials/reconciliation`),
  )
}

export async function releaseReservation(
  woId: string,
  data?: { materialIds?: string[]; reason?: string },
) {
  return apiRequest<Record<string, unknown>>(
    tenantPath(`/manufacturing/work-orders/${woId}/materials/release-reservation`),
    { method: 'POST', body: JSON.stringify(data ?? {}) },
  )
}

export async function reallocateReservation(
  woId: string,
  data: {
    sourceMaterialId: string
    targetWorkOrderId: string
    targetMaterialId?: string
    quantity: number
    reason?: string
  },
) {
  return apiRequest<Record<string, unknown>>(
    tenantPath(`/manufacturing/work-orders/${woId}/materials/reallocate-reservation`),
    { method: 'POST', body: JSON.stringify(data) },
  )
}

export async function getWipPosition(woId: string) {
  return apiRequest<Record<string, unknown>>(tenantPath(`/manufacturing/work-orders/${woId}/wip-position`))
}

export async function getFgEligibility(woId: string) {
  return apiRequest<Record<string, unknown>>(tenantPath(`/manufacturing/work-orders/${woId}/fg-eligibility`))
}

export async function listFgReceipts(woId: string) {
  return apiRequest<import('@/types/manufacturingProduction').WorkOrderFgReceiptSummary[]>(
    tenantPath(`/manufacturing/work-orders/${woId}/fg-receipts`),
  )
}

export async function previewFgReceipt(woId: string, data?: { quantity?: number; warehouseId?: string }) {
  return apiRequest<Record<string, unknown>>(tenantPath(`/manufacturing/work-orders/${woId}/fg-receipts/preview`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export async function postFgReceipt(
  woId: string,
  data: {
    quantity: number
    warehouseId?: string
    receiptDate?: string
    batchOrLotNumber?: string
    serialNumbers?: string[]
    qualityInspectionId?: string
    qualityStatus?: string
    remarks?: string
    idempotencyKey?: string
    draftOnly?: boolean
  },
) {
  return apiRequest<Record<string, unknown>>(tenantPath(`/manufacturing/work-orders/${woId}/fg-receipts`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getCloseReadiness(woId: string, options?: { allowInProgress?: boolean }) {
  const q = options?.allowInProgress ? '?allowInProgress=true' : ''
  return apiRequest<Record<string, unknown>>(tenantPath(`/manufacturing/work-orders/${woId}/close-readiness${q}`))
}

export async function getStoreWorkbenchSummary() {
  return apiRequest<StoreWorkbenchSummary>(tenantPath('/manufacturing/store-workbench/summary'))
}

export async function getStoreWorkbenchReservations(limit?: number) {
  const q = limit != null ? `?limit=${limit}` : ''
  return apiRequest<{ asOf: string; rows: Record<string, unknown>[] }>(
    tenantPath(`/manufacturing/store-workbench/reservations${q}`),
  )
}

export async function getStoreWorkbenchIssues(limit?: number) {
  const q = limit != null ? `?limit=${limit}` : ''
  return apiRequest<{ asOf: string; rows: Record<string, unknown>[] }>(
    tenantPath(`/manufacturing/store-workbench/issues${q}`),
  )
}

export async function getStoreWorkbenchReturns(limit?: number) {
  const q = limit != null ? `?limit=${limit}` : ''
  return apiRequest<{ asOf: string; rows: Record<string, unknown>[] }>(
    tenantPath(`/manufacturing/store-workbench/returns${q}`),
  )
}

export async function getStoreWorkbenchWip(limit?: number) {
  const q = limit != null ? `?limit=${limit}` : ''
  return apiRequest<{ asOf: string; rows: Record<string, unknown>[] }>(
    tenantPath(`/manufacturing/store-workbench/wip${q}`),
  )
}

export async function getStoreWorkbenchFinishedGoods(limit?: number) {
  const q = limit != null ? `?limit=${limit}` : ''
  return apiRequest<{ asOf: string; rows: Record<string, unknown>[] }>(
    tenantPath(`/manufacturing/store-workbench/finished-goods${q}`),
  )
}

export async function getStoreWorkbenchReconciliation(limit?: number) {
  const q = limit != null ? `?limit=${limit}` : ''
  return apiRequest<{ asOf: string; rows: Record<string, unknown>[] }>(
    tenantPath(`/manufacturing/store-workbench/reconciliation${q}`),
  )
}
