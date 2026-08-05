import { apiClient, tenantPath } from '@/api/client'

export interface GateVehicle {
  id: string
  vehicleNumber?: string
  registrationNumber?: string
  status?: string
  driverName?: string
  purpose?: string
  direction?: string
  arrivedAt?: string
  exitedAt?: string
  [key: string]: unknown
}

export interface GateApproval {
  id: string
  requestNumber?: string
  subject?: string
  reason?: string
  status?: string
  requestedBy?: string
  requestedAt?: string
  [key: string]: unknown
}

export interface GateDashboardSummary {
  insideCount?: number
  pendingApprovals?: number
  expectedToday?: number
  vehiclesInside?: number
  [key: string]: unknown
}

export interface GateActivity {
  id: string
  action?: string
  description?: string
  createdAt?: string
  [key: string]: unknown
}

function qs(params: Record<string, string | number | boolean | undefined> = {}) {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '' || v === false) continue
    search.set(k, String(v))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

export async function getGateDashboard() {
  const res = await apiClient.get<GateDashboardSummary>(tenantPath('/gate/dashboard'))
  return res.data
}

export async function listGateVehicles(params: { status?: string; search?: string } = {}) {
  const res = await apiClient.get<GateVehicle[] | { items?: GateVehicle[] }>(
    tenantPath(`/gate/vehicles${qs(params)}`),
  )
  const data = res.data
  if (Array.isArray(data)) return data
  return data?.items ?? []
}

export async function getGateVehicle(id: string) {
  const res = await apiClient.get<GateVehicle>(tenantPath(`/gate/vehicles/${id}`))
  return res.data
}

export async function createGateVehicle(payload: Record<string, unknown>) {
  const res = await apiClient.post<GateVehicle>(tenantPath('/gate/vehicles'), payload, {
    retries: 0,
  })
  return res.data
}

export async function markVehicleArrived(id: string) {
  const res = await apiClient.post<GateVehicle>(
    tenantPath(`/gate/vehicles/${id}/arrived`),
    {},
    { retries: 0 },
  )
  return res.data
}

export async function allowVehicleInside(id: string) {
  const res = await apiClient.post<GateVehicle>(
    tenantPath(`/gate/vehicles/${id}/allow-inside`),
    {},
    { retries: 0 },
  )
  return res.data
}

export async function recordVehicleExit(id: string, remarks?: string) {
  const res = await apiClient.post<GateVehicle>(
    tenantPath(`/gate/vehicles/${id}/exit`),
    { remarks },
    { retries: 0 },
  )
  return res.data
}

export async function listGateApprovals(params: { status?: string } = {}) {
  const res = await apiClient.get<GateApproval[] | { items?: GateApproval[] }>(
    tenantPath(`/gate/approvals${qs({ status: params.status ?? 'pending' })}`),
  )
  const data = res.data
  if (Array.isArray(data)) return data
  return data?.items ?? []
}

export async function approveGateRequest(id: string, remarks = 'Approved from mobile') {
  const res = await apiClient.post(
    tenantPath(`/gate/approvals/${id}/approve`),
    { remarks },
    { retries: 0 },
  )
  return res.data
}

export async function rejectGateRequest(id: string, remarks: string) {
  const res = await apiClient.post(
    tenantPath(`/gate/approvals/${id}/reject`),
    { remarks },
    { retries: 0 },
  )
  return res.data
}

export async function listGateActivities(limit = 30) {
  const res = await apiClient.get<GateActivity[] | { items?: GateActivity[] }>(
    tenantPath(`/gate/activities${qs({ limit })}`),
  )
  const data = res.data
  if (Array.isArray(data)) return data
  return data?.items ?? []
}
