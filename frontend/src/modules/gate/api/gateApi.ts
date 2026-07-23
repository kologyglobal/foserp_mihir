/**
 * GateApiService comment update — backend now mounted.
 */
/**
 * Gate & Security live API service (API mode — VITE_USE_API=true when GATE_API_READY).
 *
 * Backend: `/api/v1/t/:tenantSlug/gate/...` (see GATE_ENDPOINTS).
 * This service NEVER falls back to demo data — failures surface as errors.
 */

import { apiRequest, tenantPath } from '@/services/api/client'
import type {
  ContractorEntry,
  CourierEntry,
  ExpectedVisitor,
  GateActivity,
  GateApproval,
  GateDashboardSummary,
  GateEntry,
  GateListFilter,
  GateLocation,
  GatePass,
  GateSettings,
  GateVehicle,
  MaterialInwardEntry,
  MaterialOutwardEntry,
  Visitor,
  VisitorVisit,
} from '../types/gate.types'
import type { GateService, OutwardDocumentSearchResult } from './gateServiceContract'

/** Assumed backend base: /api/v1/t/:tenantSlug/gate/... */
export const GATE_ENDPOINTS = {
  DASHBOARD: '/gate/dashboard',
  REGISTER: '/gate/register',
  ACTIVITIES: '/gate/activities',
  LOCATIONS: '/gate/locations',
  SETTINGS: '/gate/settings',
  VISITORS: '/gate/visitors',
  VISITOR_SEARCH: '/gate/visitors/search',
  EXPECTED_VISITORS: '/gate/expected-visitors',
  VEHICLES: '/gate/vehicles',
  MATERIAL_INWARD: '/gate/material-inward',
  MATERIAL_OUTWARD: '/gate/material-outward',
  OUTWARD_SEARCH: '/gate/material-outward/search-documents',
  PASSES: '/gate/passes',
  CONTRACTORS: '/gate/contractors',
  COURIERS: '/gate/couriers',
  APPROVALS: '/gate/approvals',
} as const

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== false) search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

function filterQuery(filter?: GateListFilter): string {
  return buildQuery({
    search: filter?.search,
    status: filter?.status,
    gate: filter?.gate,
    company: filter?.company,
    date: filter?.date,
    dateFrom: filter?.dateFrom,
    dateTo: filter?.dateTo,
    entryType: filter?.entryType || undefined,
    insideOnly: filter?.insideOnly,
    missingExitOnly: filter?.missingExitOnly,
  })
}

async function get<T>(path: string): Promise<T> {
  const res = await apiRequest<T>(tenantPath(path))
  return res.data
}

async function send<T>(path: string, method: 'POST' | 'PUT' | 'PATCH', body?: unknown): Promise<T> {
  const res = await apiRequest<T>(tenantPath(path), {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  return res.data
}

export const gateApiService: GateService = {
  // Dashboard & register
  getGateDashboard: () => get<GateDashboardSummary>(GATE_ENDPOINTS.DASHBOARD),
  getGateRegister: (filter) => get<GateEntry[]>(`${GATE_ENDPOINTS.REGISTER}${filterQuery(filter)}`),
  getGateActivities: (limit = 20) => get<GateActivity[]>(`${GATE_ENDPOINTS.ACTIVITIES}${buildQuery({ limit })}`),
  getGateLocations: () => get<GateLocation[]>(GATE_ENDPOINTS.LOCATIONS),

  // Settings
  getGateSettings: () => get<GateSettings>(GATE_ENDPOINTS.SETTINGS),
  updateGateSettings: (settings) => send<GateSettings>(GATE_ENDPOINTS.SETTINGS, 'PUT', settings),

  // Visitors
  getVisitors: (filter) => get<VisitorVisit[]>(`${GATE_ENDPOINTS.VISITORS}${filterQuery(filter)}`),
  getVisitorById: (id) => get<VisitorVisit>(`${GATE_ENDPOINTS.VISITORS}/${id}`),
  searchVisitorByMobile: (mobile) =>
    get<Visitor | null>(`${GATE_ENDPOINTS.VISITOR_SEARCH}${buildQuery({ mobile })}`),
  getExpectedVisitors: (filter) => get<ExpectedVisitor[]>(`${GATE_ENDPOINTS.EXPECTED_VISITORS}${filterQuery(filter)}`),
  createExpectedVisitor: (input) => send<ExpectedVisitor>(GATE_ENDPOINTS.EXPECTED_VISITORS, 'POST', input),
  cancelExpectedVisitor: (id) => send<ExpectedVisitor>(`${GATE_ENDPOINTS.EXPECTED_VISITORS}/${id}/cancel`, 'POST'),
  createVisitorEntry: (input) => send<VisitorVisit>(GATE_ENDPOINTS.VISITORS, 'POST', input),
  updateVisitorEntry: (id, input) => send<VisitorVisit>(`${GATE_ENDPOINTS.VISITORS}/${id}`, 'PUT', input),
  requestVisitorApproval: (id) => send<VisitorVisit>(`${GATE_ENDPOINTS.VISITORS}/${id}/request-approval`, 'POST'),
  approveVisitor: (id, remarks) => send<VisitorVisit>(`${GATE_ENDPOINTS.VISITORS}/${id}/approve`, 'POST', { remarks }),
  rejectVisitor: (id, remarks) => send<VisitorVisit>(`${GATE_ENDPOINTS.VISITORS}/${id}/reject`, 'POST', { remarks }),
  recordVisitorEntry: (id) => send<VisitorVisit>(`${GATE_ENDPOINTS.VISITORS}/${id}/entry`, 'POST'),
  recordVisitorExit: (id, input) => send<VisitorVisit>(`${GATE_ENDPOINTS.VISITORS}/${id}/exit`, 'POST', input),
  cancelVisitor: (id, remarks) => send<VisitorVisit>(`${GATE_ENDPOINTS.VISITORS}/${id}/cancel`, 'POST', { remarks }),

  // Vehicles
  getVehicles: (filter) => get<GateVehicle[]>(`${GATE_ENDPOINTS.VEHICLES}${filterQuery(filter)}`),
  getVehicleById: (id) => get<GateVehicle>(`${GATE_ENDPOINTS.VEHICLES}/${id}`),
  createVehicleEntry: (input) => send<GateVehicle>(GATE_ENDPOINTS.VEHICLES, 'POST', input),
  markVehicleArrived: (id) => send<GateVehicle>(`${GATE_ENDPOINTS.VEHICLES}/${id}/arrived`, 'POST'),
  allowVehicleInside: (id) => send<GateVehicle>(`${GATE_ENDPOINTS.VEHICLES}/${id}/allow-inside`, 'POST'),
  updateVehicleLocation: (id, location, status) =>
    send<GateVehicle>(`${GATE_ENDPOINTS.VEHICLES}/${id}/location`, 'POST', { location, status }),
  markVehicleReadyForExit: (id) => send<GateVehicle>(`${GATE_ENDPOINTS.VEHICLES}/${id}/ready-exit`, 'POST'),
  recordVehicleExit: (id, remarks) => send<GateVehicle>(`${GATE_ENDPOINTS.VEHICLES}/${id}/exit`, 'POST', { remarks }),

  // Material inward
  getMaterialInwardEntries: (filter) =>
    get<MaterialInwardEntry[]>(`${GATE_ENDPOINTS.MATERIAL_INWARD}${filterQuery(filter)}`),
  getMaterialInwardById: (id) => get<MaterialInwardEntry>(`${GATE_ENDPOINTS.MATERIAL_INWARD}/${id}`),
  createMaterialInward: (input) => send<MaterialInwardEntry>(GATE_ENDPOINTS.MATERIAL_INWARD, 'POST', input),
  updateMaterialInwardStatus: (id, status, note) =>
    send<MaterialInwardEntry>(`${GATE_ENDPOINTS.MATERIAL_INWARD}/${id}/status`, 'POST', { status, note }),
  cancelMaterialInward: (id, remarks) =>
    send<MaterialInwardEntry>(`${GATE_ENDPOINTS.MATERIAL_INWARD}/${id}/cancel`, 'POST', { remarks }),

  // Material outward
  getMaterialOutwardEntries: (filter) =>
    get<MaterialOutwardEntry[]>(`${GATE_ENDPOINTS.MATERIAL_OUTWARD}${filterQuery(filter)}`),
  getMaterialOutwardById: (id) => get<MaterialOutwardEntry>(`${GATE_ENDPOINTS.MATERIAL_OUTWARD}/${id}`),
  searchOutwardDocuments: (query) =>
    get<OutwardDocumentSearchResult[]>(`${GATE_ENDPOINTS.OUTWARD_SEARCH}${buildQuery({ q: query })}`),
  verifyMaterialOutward: (id, input) =>
    send<MaterialOutwardEntry>(`${GATE_ENDPOINTS.MATERIAL_OUTWARD}/${id}/verify`, 'POST', input),
  holdMaterialOutward: (id, remarks) =>
    send<MaterialOutwardEntry>(`${GATE_ENDPOINTS.MATERIAL_OUTWARD}/${id}/hold`, 'POST', { remarks }),
  reportMaterialMismatch: (id, remarks) =>
    send<MaterialOutwardEntry>(`${GATE_ENDPOINTS.MATERIAL_OUTWARD}/${id}/mismatch`, 'POST', { remarks }),
  releaseMaterialOutward: (id) => send<MaterialOutwardEntry>(`${GATE_ENDPOINTS.MATERIAL_OUTWARD}/${id}/release`, 'POST'),
  rejectMaterialOutward: (id, remarks) =>
    send<MaterialOutwardEntry>(`${GATE_ENDPOINTS.MATERIAL_OUTWARD}/${id}/reject`, 'POST', { remarks }),

  // Gate passes
  getGatePasses: (filter) => get<GatePass[]>(`${GATE_ENDPOINTS.PASSES}${filterQuery(filter)}`),
  getGatePassById: (id) => get<GatePass>(`${GATE_ENDPOINTS.PASSES}/${id}`),
  createGatePass: (input) => send<GatePass>(GATE_ENDPOINTS.PASSES, 'POST', input),
  submitGatePass: (id) => send<GatePass>(`${GATE_ENDPOINTS.PASSES}/${id}/submit`, 'POST'),
  approveGatePass: (id, remarks) => send<GatePass>(`${GATE_ENDPOINTS.PASSES}/${id}/approve`, 'POST', { remarks }),
  rejectGatePass: (id, remarks) => send<GatePass>(`${GATE_ENDPOINTS.PASSES}/${id}/reject`, 'POST', { remarks }),
  markGatePassSentOut: (id) => send<GatePass>(`${GATE_ENDPOINTS.PASSES}/${id}/sent-out`, 'POST'),
  recordGatePassReturn: (id, input) => send<GatePass>(`${GATE_ENDPOINTS.PASSES}/${id}/returns`, 'POST', input),
  closeGatePass: (id, remarks) => send<GatePass>(`${GATE_ENDPOINTS.PASSES}/${id}/close`, 'POST', { remarks }),

  // Contractors
  getContractors: (filter) => get<ContractorEntry[]>(`${GATE_ENDPOINTS.CONTRACTORS}${filterQuery(filter)}`),
  getContractorById: (id) => get<ContractorEntry>(`${GATE_ENDPOINTS.CONTRACTORS}/${id}`),
  createContractorEntry: (input) => send<ContractorEntry>(GATE_ENDPOINTS.CONTRACTORS, 'POST', input),
  recordContractorExit: (id, remarks) =>
    send<ContractorEntry>(`${GATE_ENDPOINTS.CONTRACTORS}/${id}/exit`, 'POST', { remarks }),

  // Couriers
  getCouriers: (filter) => get<CourierEntry[]>(`${GATE_ENDPOINTS.COURIERS}${filterQuery(filter)}`),
  getCourierById: (id) => get<CourierEntry>(`${GATE_ENDPOINTS.COURIERS}/${id}`),
  createCourierEntry: (input) => send<CourierEntry>(GATE_ENDPOINTS.COURIERS, 'POST', input),
  markCourierHandedOver: (id, handedOverTo) =>
    send<CourierEntry>(`${GATE_ENDPOINTS.COURIERS}/${id}/handover`, 'POST', { handedOverTo }),

  // Approvals
  getGateApprovals: (filter) => get<GateApproval[]>(`${GATE_ENDPOINTS.APPROVALS}${filterQuery(filter)}`),
  getGateApprovalById: (id) => get<GateApproval>(`${GATE_ENDPOINTS.APPROVALS}/${id}`),
  approveGateRequest: (id, remarks) =>
    send<GateApproval>(`${GATE_ENDPOINTS.APPROVALS}/${id}/approve`, 'POST', { remarks }),
  rejectGateRequest: (id, remarks) => send<GateApproval>(`${GATE_ENDPOINTS.APPROVALS}/${id}/reject`, 'POST', { remarks }),
  sendBackGateRequest: (id, remarks) =>
    send<GateApproval>(`${GATE_ENDPOINTS.APPROVALS}/${id}/send-back`, 'POST', { remarks }),
}
