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
  | 'OTHER'
export type MaintenanceSourceType = 'MANUAL' | 'MY_WORK' | 'WORK_ORDER' | 'JOB_CARD' | 'OPERATION'
export type MaintenancePhotoCategory = 'BEFORE' | 'DURING' | 'AFTER' | 'OTHER'

export interface MaintenancePart {
  id: string
  itemId: string | null
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
  machine?: {
    id: string
    code: string
    name: string
    status: string
    workCentreId: string | null
    workCentre?: { id: string; code: string; name: string; plantCode?: string | null } | null
  }
  contractor?: { id: string; code: string; name: string } | null
  parts: MaintenancePart[]
  photos: MaintenancePhoto[]
}

export interface MaintenanceDashboard {
  openTickets: number
  machinesDown: number
  underRepair: number
  waitingForParts: number
  closedThisMonth: number
  needsAttention: MaintenanceTicket[]
  recent: MaintenanceTicket[]
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
    failureCategory?: MaintenanceFailureCategory | null
    serviceDescription?: string | null
    serviceCost?: number
    otherCost?: number
    invoiceNumber?: string | null
    invoiceDate?: string | null
    technicianName?: string | null
    contractorId?: string | null
    operatorName?: string | null
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
      totalCost: number
      avgRepairMinutes: number
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
