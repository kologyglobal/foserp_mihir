/**
 * Maintenance V1 API client — API mode only (no demo fallback).
 * Base: /api/v1/t/:tenantSlug/maintenance/...
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

export type MaintenancePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
export type MaintenanceStatus =
  | 'REPORTED'
  | 'IN_REPAIR'
  | 'WAITING_FOR_PART'
  | 'ON_HOLD'
  | 'TESTING'
  | 'CLOSED'
  | 'CANCELLED'
export type MaintenanceTechnicianType = 'INTERNAL' | 'EXTERNAL'
export type MaintenanceTestResult = 'PASS' | 'FAIL'
export type MaintenanceFailureCategory =
  | 'MECHANICAL'
  | 'ELECTRICAL'
  | 'HYDRAULIC'
  | 'PNEUMATIC'
  | 'CONTROL'
  | 'SAFETY'
  | 'OTHER'
export type MaintenanceSourceType =
  | 'MANUAL'
  | 'MY_WORK'
  | 'WORK_ORDER'
  | 'JOB_CARD'
  | 'OPERATION'
  | 'PREVENTIVE'
export type MaintenancePhotoCategory = 'BEFORE' | 'DURING' | 'AFTER' | 'OTHER'

export interface MaintenancePart {
  id: string
  itemId: string | null
  warehouseId: string | null
  description: string
  qty: number
  unitCost: number
  totalCost: number
  remarks: string | null
  shortageQty: number | null
  inventoryMovementId: string | null
  purchaseRequisitionId: string | null
}

export interface MaintenancePhoto {
  id: string
  category: MaintenancePhotoCategory
  originalFilename: string
  mimeType: string
  fileSize: number
  uploadedAt: string
  uploadedBy: string | null
}

export interface MaintenanceTicket {
  id: string
  ticketNumber: string
  machineId: string
  workCentreId: string | null
  sourceType: MaintenanceSourceType
  workOrderId: string | null
  jobCardId: string | null
  jobCardCode: string | null
  operationId: string | null
  operationCode: string | null
  operationName: string | null
  problem: string
  priority: MaintenancePriority
  status: MaintenanceStatus
  failureCategory: MaintenanceFailureCategory | null
  reportedByUserId: string | null
  reportedAt: string
  operatorName: string | null
  reportedLatitude: number | null
  reportedLongitude: number | null
  reportedAccuracyM: number | null
  reportedLocationLabel: string | null
  repairStartedAt: string | null
  technicianType: MaintenanceTechnicianType | null
  technicianUserId: string | null
  contractorId: string | null
  technicianName: string | null
  repairDetails: string | null
  rootCause: string | null
  repairAction: string | null
  repairEndedAt: string | null
  repairMinutes: number | null
  repairLabel: string | null
  testResult: MaintenanceTestResult | null
  testedByUserId: string | null
  testedAt: string | null
  testRemarks: string | null
  closingRemarks: string | null
  closedByUserId: string | null
  closedAt: string | null
  downtimeEndedAt: string | null
  downtimeMinutes: number | null
  downtimeLabel: string | null
  partsCost: number
  serviceCost: number
  otherCost: number
  totalCost: number
  serviceDescription: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  holdReason: string | null
  inventoryPostingPending: boolean
  preventiveMaintenancePlanId?: string | null
  pmScheduledDueDate?: string | null
  scheduledDate?: string | null
  ticketKind?: 'BREAKDOWN' | 'PREVENTIVE'
  machine?: {
    id: string
    code: string
    name: string
    status: string
    workCentreId: string | null
    workCentre?: { id: string; code: string; name: string; plantCode?: string | null } | null
  }
  contractor?: { id: string; code: string; name: string } | null
  pmPlan?: { id: string; planNumber: string; name: string; nextDueDate?: string } | null
  parts: MaintenancePart[]
  photos: MaintenancePhoto[]
  checklistItems?: Array<{
    id: string
    sequence: number
    text: string
    isDone: boolean
    remark: string | null
  }>
}

export interface MaintenanceDashboard {
  openTickets: number
  machinesDown: number
  underRepair: number
  waitingForParts: number
  closedThisMonth: number
  downtimeThisMonth?: number
  downtimeThisMonthLabel?: string
  maintenanceCostThisMonth?: number
  pmDueToday?: number
  pmDueThisWeek?: number
  pmOverdue?: number
  pmNeedsAttention?: PreventiveMaintenancePlan[]
  needsAttention: MaintenanceTicket[]
  recent: MaintenanceTicket[]
}

export type PmDueStatus = 'UPCOMING' | 'DUE' | 'OVERDUE'
export type PmFrequencyType = 'DAYS' | 'WEEKS' | 'MONTHS'

export interface PreventiveMaintenancePlan {
  id: string
  planNumber: string
  machineId: string
  machine?: {
    id: string
    code: string
    name: string
    status: string
    workCentreId: string | null
    workCentre?: { id: string; code: string; name: string } | null
  }
  name: string
  description: string | null
  frequencyType: PmFrequencyType
  frequencyValue: number
  frequencyLabel: string
  startDate: string
  lastCompletedDate: string | null
  nextDueDate: string
  dueStatus: PmDueStatus
  assignedTechnicianId: string | null
  assignedContractorId: string | null
  contractor?: { id: string; code: string; name: string } | null
  estimatedDurationMin: number | null
  isActive: boolean
  checklist: Array<{ id: string; sequence: number; text: string }>
  openTicket: { id: string; ticketNumber: string; status: string } | null
  canCreateTicket: boolean
  createdAt: string
  updatedAt: string
}

export interface CloseReadiness {
  ready: boolean
  checks: Array<{ code: string; ok: boolean; message: string }>
  blockers: Array<{ code: string; ok: boolean; message: string }>
}

export const MAX_MAINTENANCE_PHOTOS = 4

export interface CreateTicketInput {
  machineId: string
  problem: string
  priority?: MaintenancePriority
  remarks?: string
  failureCategory?: MaintenanceFailureCategory
  sourceType?: MaintenanceSourceType
  sourceDocumentId?: string
  workOrderId?: string
  jobCardId?: string
  jobCardCode?: string
  operationId?: string
  operationCode?: string
  operationName?: string
  operatorName?: string
  reportedLatitude?: number
  reportedLongitude?: number
  reportedAccuracyM?: number
  reportedLocationLabel?: string
}

export async function getMaintenanceDashboard() {
  return apiRequest<MaintenanceDashboard>(tenantPath('/maintenance/dashboard'))
}

export async function listMaintenanceTickets(params?: {
  page?: number
  limit?: number
  status?: MaintenanceStatus
  machineId?: string
  workCentreId?: string
  priority?: MaintenancePriority
  search?: string
  openOnly?: boolean
}) {
  return apiRequest<MaintenanceTicket[]>(tenantPath(`/maintenance/tickets${buildQuery(params)}`))
}

export async function getMaintenanceTicket(id: string) {
  return apiRequest<MaintenanceTicket>(tenantPath(`/maintenance/tickets/${id}`))
}

export async function createMaintenanceTicket(body: CreateTicketInput) {
  return apiRequest<MaintenanceTicket>(tenantPath('/maintenance/tickets'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function startMaintenanceRepair(
  id: string,
  body: {
    technicianType: MaintenanceTechnicianType
    technicianUserId?: string
    contractorId?: string
    technicianName?: string
    operatorName?: string
    startedAt?: string
  },
) {
  return apiRequest<MaintenanceTicket>(tenantPath(`/maintenance/tickets/${id}/start-repair`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateMaintenanceTicket(
  id: string,
  body: {
    repairDetails?: string
    rootCause?: string | null
    repairAction?: string | null
    failureCategory?: MaintenanceFailureCategory | null
    serviceDescription?: string | null
    serviceCost?: number
    otherCost?: number
    invoiceNumber?: string | null
    invoiceDate?: string | null
    technicianName?: string | null
    contractorId?: string | null
    operatorName?: string | null
    checklistItems?: Array<{ id: string; isDone: boolean; remark?: string | null }>
  },
) {
  return apiRequest<MaintenanceTicket>(tenantPath(`/maintenance/tickets/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function holdMaintenanceTicket(id: string, body: { status: 'ON_HOLD' | 'WAITING_FOR_PART'; reason: string }) {
  return apiRequest<MaintenanceTicket>(tenantPath(`/maintenance/tickets/${id}/hold`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function resumeMaintenanceTicket(id: string, body?: { remarks?: string }) {
  return apiRequest<MaintenanceTicket>(tenantPath(`/maintenance/tickets/${id}/resume`), {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
}

export async function addMaintenancePart(
  id: string,
  body: {
    itemId?: string
    warehouseId?: string
    description: string
    qty: number
    unitCost?: number
    remarks?: string
    shortageQty?: number
  },
) {
  return apiRequest<MaintenanceTicket>(tenantPath(`/maintenance/tickets/${id}/parts`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function testMaintenanceMachine(
  id: string,
  body: { result: MaintenanceTestResult; remarks?: string; testedAt?: string },
) {
  return apiRequest<MaintenanceTicket>(tenantPath(`/maintenance/tickets/${id}/test`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getMaintenanceCloseReadiness(id: string) {
  return apiRequest<CloseReadiness>(tenantPath(`/maintenance/tickets/${id}/close-readiness`))
}

export async function closeMaintenanceTicket(id: string, body?: { closingRemarks?: string }) {
  return apiRequest<MaintenanceTicket>(tenantPath(`/maintenance/tickets/${id}/close`), {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
}

export async function getMachineMaintenanceHistory(machineId: string) {
  return apiRequest<{
    machine: { id: string; code: string; name: string; status: string } | null
    ticketCount: number
    closedCount: number
    downtimeMinutes: number
    downtimeLabel: string
    repairCost: number
    tickets: MaintenanceTicket[]
  }>(tenantPath(`/maintenance/machines/${machineId}/history`))
}

export async function getMaintenanceReports(params?: {
  from?: string
  to?: string
  machineId?: string
  workCentreId?: string
  status?: MaintenanceStatus
  failureCategory?: MaintenanceFailureCategory
  contractorId?: string
}) {
  return apiRequest<{
    summary: { totalBreakdowns: number; totalDowntimeMinutes: number; totalCost: number }
    downtimeByMachine: Array<{
      machineId: string
      code: string
      name: string
      breakdowns: number
      downtimeMinutes: number
      cost: number
    }>
    costByMachine: Array<{
      machineId: string
      code: string
      name: string
      breakdowns: number
      downtimeMinutes: number
      cost: number
    }>
    breakdownFrequency: Array<{
      machineId: string
      code: string
      name: string
      breakdowns: number
      downtimeMinutes: number
      cost: number
    }>
    contractors: Array<{
      contractorId: string
      code: string
      name: string
      jobs: number
      closedJobs?: number
      totalCost: number
      avgRepairMinutes: number
    }>
    productionImpactByMachine?: Array<{
      machineId: string
      code: string
      name: string
      breakdowns: number
      affectedWorkOrders: number
      affectedJobCards: number
      productionDowntimeMinutes: number
    }>
    tickets: Array<{
      id: string
      ticketNumber: string
      machineCode: string
      machineName: string
      status: string
      failureCategory: string | null
      downtimeMinutes: number | null
      totalCost: number
      reportedAt: string
      closedAt: string | null
      workOrderId?: string | null
      jobCardCode?: string | null
      operationName?: string | null
      rootCause?: string | null
      repairAction?: string | null
      repairMinutes?: number | null
    }>
  }>(tenantPath(`/maintenance/reports${buildQuery(params)}`))
}

export async function uploadMaintenancePhoto(id: string, file: File, category: MaintenancePhotoCategory = 'OTHER') {
  const form = new FormData()
  form.append('file', file)
  form.append('category', category)
  return apiRequest<MaintenancePhoto>(tenantPath(`/maintenance/tickets/${id}/photos`), {
    method: 'POST',
    body: form,
  })
}

export async function getActiveMaintenanceTicket(machineId: string) {
  return apiRequest<MaintenanceTicket | null>(
    tenantPath(`/maintenance/active-ticket${buildQuery({ machineId })}`),
  )
}

export async function linkMaintenancePartPr(
  ticketId: string,
  body: { partId: string; purchaseRequisitionId: string },
) {
  return apiRequest<MaintenanceTicket>(tenantPath(`/maintenance/tickets/${ticketId}/link-part-pr`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export type MachineHealthRow = {
  machineId: string
  machineCode: string
  machineName: string
  workCentre: { id: string; code: string; name: string; plantCode?: string | null } | null
  status: string
  healthStatus: 'AVAILABLE' | 'DOWN' | 'MAINTENANCE' | 'ATTENTION'
  openTicket: {
    id: string
    ticketNumber: string
    status: string
    failureCategory: string | null
    problem: string
    downtimeMinutes: number
    downtimeLabel: string
  } | null
  breakdowns30d: number
  breakdowns90d: number
  breakdownsYtd: number
  downtime30d: number
  downtime30dLabel: string
  downtimeYtd: number
  downtimeYtdLabel: string
  maintenanceCost30d: number
  maintenanceCostYtd: number
  partsCostYtd: number
  serviceCostYtd: number
  otherCostYtd: number
  averageRepairMinutes: number | null
  averageRepairLabel: string | null
  lastBreakdownAt: string | null
  lastMaintenanceAt: string | null
  mostCommonFailureCategory: string | null
  repeatBreakdown: boolean
  repeatBreakdownCount: number
  repeatBreakdownDays: number
  repeatDowntimeMinutes: number
  repeatCost: number
  productionImpact: {
    affectedWorkOrdersYtd: number
    affectedJobCardsYtd: number
    productionDowntimeYtd: number
    productionDowntimeYtdLabel: string
  }
}

export async function getMachineHealth(params?: {
  workCentreId?: string
  machineId?: string
  status?: string
  failureCategory?: MaintenanceFailureCategory
  period?: 'YTD' | '30d' | '90d' | 'custom'
  from?: string
  to?: string
  repeatBreakdownCount?: number
  repeatBreakdownDays?: number
}) {
  return apiRequest<{
    period: { from: string; to: string; label: string }
    items: MachineHealthRow[]
    topByDowntime: MachineHealthRow[]
    topByBreakdowns: MachineHealthRow[]
    topByCost: MachineHealthRow[]
    attention: MachineHealthRow[]
  }>(tenantPath(`/maintenance/machine-health${buildQuery(params)}`))
}

export async function getMachineHealthDetail(
  machineId: string,
  params?: { period?: 'YTD' | '30d' | '90d' | 'custom'; from?: string; to?: string },
) {
  return apiRequest<
    MachineHealthRow & {
      recentTickets: Array<{
        id: string
        ticketNumber: string
        reportedAt: string
        closedAt: string | null
        status: string
        failureCategory: string | null
        problem: string
        rootCause: string | null
        repairAction: string | null
        downtimeMinutes: number | null
        downtimeLabel: string | null
        totalCost: number
        workOrderId: string | null
        jobCardCode: string | null
        operationName: string | null
        technicianName: string | null
      }>
    }
  >(tenantPath(`/maintenance/machine-health/${machineId}${buildQuery(params)}`))
}

export async function listPreventivePlans(params?: {
  page?: number
  limit?: number
  machineId?: string
  workCentreId?: string
  dueStatus?: PmDueStatus
  activeOnly?: boolean
  search?: string
}) {
  return apiRequest<PreventiveMaintenancePlan[]>(
    tenantPath(`/maintenance/preventive${buildQuery(params)}`),
  )
}

export async function getPreventivePlan(id: string) {
  return apiRequest<PreventiveMaintenancePlan>(tenantPath(`/maintenance/preventive/${id}`))
}

export async function createPreventivePlan(body: {
  machineId: string
  name: string
  description?: string | null
  frequencyType: PmFrequencyType
  frequencyValue: number
  startDate: string
  nextDueDate?: string
  assignedTechnicianId?: string | null
  assignedContractorId?: string | null
  estimatedDurationMin?: number | null
  checklist?: Array<{ text: string; sequence?: number }>
  isActive?: boolean
}) {
  return apiRequest<PreventiveMaintenancePlan>(tenantPath('/maintenance/preventive'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updatePreventivePlan(
  id: string,
  body: Partial<{
    name: string
    description: string | null
    frequencyType: PmFrequencyType
    frequencyValue: number
    startDate: string
    nextDueDate: string
    assignedTechnicianId: string | null
    assignedContractorId: string | null
    estimatedDurationMin: number | null
    checklist: Array<{ text: string; sequence?: number }>
    isActive: boolean
  }>,
) {
  return apiRequest<PreventiveMaintenancePlan>(tenantPath(`/maintenance/preventive/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deactivatePreventivePlan(id: string) {
  return apiRequest<PreventiveMaintenancePlan>(tenantPath(`/maintenance/preventive/${id}/deactivate`), {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function createTicketFromPreventivePlan(
  planId: string,
  body?: { priority?: MaintenancePriority; remarks?: string; scheduledDate?: string },
) {
  return apiRequest<MaintenanceTicket>(tenantPath(`/maintenance/preventive/${planId}/create-ticket`), {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
}

export async function getMachinePreventivePlans(machineId: string) {
  return apiRequest<PreventiveMaintenancePlan[]>(
    tenantPath(`/maintenance/machines/${machineId}/preventive`),
  )
}

export async function getPmComplianceReport(params?: {
  from?: string
  to?: string
  machineId?: string
  workCentreId?: string
}) {
  return apiRequest<{
    summary: {
      scheduled: number
      completedOnTime: number
      completedLate: number
      overdue: number
    }
    rows: Array<{
      planNumber: string | null
      planName: string | null
      machineCode: string
      machineName: string
      dueDate: string | null
      completedDate: string | null
      status: string
      delayDays: number
      ticketNumber: string | null
      ticketId: string | null
    }>
  }>(tenantPath(`/maintenance/reports/pm-compliance${buildQuery(params)}`))
}
