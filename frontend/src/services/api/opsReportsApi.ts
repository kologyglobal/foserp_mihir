/**
 * Phase 7D — Ops reporting API client.
 * Base path: /api/v1/t/:tenantSlug/... (manufacturing report catalog/runner, saved views,
 * shopfloor live board, operations exceptions, manufacturing traceability).
 *
 * Backend endpoints are being built alongside this client — paths follow the Phase 7D spec.
 * All reads/writes are gated behind `isApiMode()` at the call site; this module has no
 * demo-mode fallback by design (see `manufacturingSettingsService` for the demo report engine).
 */
import { apiPostDownloadBlob, apiRequest, tenantPath } from './client'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

// ─── Report catalog ──────────────────────────────────────────────────────────

export type ManufacturingReportAvailability = 'READY' | 'PARTIAL' | 'UNAVAILABLE' | 'AVAILABLE'

export interface ManufacturingReportCatalogItem {
  key: string
  label: string
  module: string
  category?: string | null
  description?: string | null
  status: ManufacturingReportAvailability
  reason?: string | null
  permission?: string | null
  supportsExport?: boolean
}

type CatalogApiRow = {
  key: string
  name?: string
  label?: string
  module: string
  description?: string | null
  availability?: ManufacturingReportAvailability
  status?: ManufacturingReportAvailability
  unavailableReason?: string | null
  reason?: string | null
  exportSupported?: boolean
  disabled?: boolean
}

function mapCatalogItem(row: CatalogApiRow): ManufacturingReportCatalogItem {
  const availability = row.availability ?? row.status ?? (row.disabled ? 'UNAVAILABLE' : 'READY')
  return {
    key: row.key,
    label: row.label ?? row.name ?? row.key,
    module: row.module,
    description: row.description ?? null,
    status: availability === 'AVAILABLE' ? 'READY' : availability,
    reason: row.reason ?? row.unavailableReason ?? null,
    supportsExport: row.exportSupported,
  }
}

export async function getManufacturingReportCatalog() {
  const res = await apiRequest<{ reports: CatalogApiRow[] } | CatalogApiRow[]>(
    tenantPath('/reports/manufacturing/catalog'),
  )
  const raw = Array.isArray(res.data) ? res.data : (res.data?.reports ?? [])
  return { ...res, data: raw.map(mapCatalogItem) }
}

// ─── Report query / export ───────────────────────────────────────────────────

export interface ManufacturingReportFilters {
  dateFrom?: string
  dateTo?: string
  status?: string
  search?: string
  page?: number
  pageSize?: number
  [key: string]: string | number | boolean | undefined
}

export interface ManufacturingReportColumn {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
}

export interface ManufacturingReportPagination {
  page: number
  pageSize: number
  total: number
  totalPages?: number
}

export interface ManufacturingReportResult {
  reportKey: string
  label?: string
  title?: string
  columns: Array<ManufacturingReportColumn | string | { key: string; label: string }>
  rows: Array<Record<string, unknown>>
  summary?: Record<string, unknown>
  calculationNotes?: string[]
  warnings?: string[]
  pagination?: ManufacturingReportPagination
  generatedAt?: string
}

export async function queryManufacturingReport(reportKey: string, filters?: ManufacturingReportFilters) {
  const res = await apiRequest<Record<string, unknown>>(tenantPath(`/reports/manufacturing/${reportKey}/query`), {
    method: 'POST',
    body: JSON.stringify(filters ?? {}),
  })
  const raw = res.data ?? {}
  const paginationRaw = (raw.pagination ?? {}) as Record<string, unknown>
  const columnsRaw = (raw.columns ?? []) as Array<ManufacturingReportColumn | string | { key: string; label: string }>
  const mapped: ManufacturingReportResult = {
    reportKey: String(raw.reportKey ?? reportKey),
    label: (raw.label as string | undefined) ?? (raw.title as string | undefined),
    title: raw.title as string | undefined,
    columns: columnsRaw,
    rows: (raw.rows as Array<Record<string, unknown>>) ?? [],
    summary: (raw.summary as Record<string, unknown> | undefined) ?? undefined,
    calculationNotes:
      (raw.calculationNotes as string[] | undefined) ??
      (typeof raw.description === 'string' ? [raw.description] : undefined),
    warnings: (raw.warnings as string[] | undefined) ?? undefined,
    pagination: paginationRaw.page
      ? {
          page: Number(paginationRaw.page),
          pageSize: Number(paginationRaw.pageSize ?? filters?.pageSize ?? 25),
          total: Number(paginationRaw.total ?? paginationRaw.totalRows ?? 0),
          totalPages: Number(paginationRaw.totalPages ?? 1),
        }
      : undefined,
    generatedAt: raw.generatedAt as string | undefined,
  }
  return { ...res, data: mapped }
}

export async function exportManufacturingReport(reportKey: string, filters?: ManufacturingReportFilters) {
  return apiPostDownloadBlob(tenantPath(`/reports/manufacturing/${reportKey}/export`), filters ?? {})
}

// ─── Saved views ──────────────────────────────────────────────────────────────

export interface SavedReportView {
  id: string
  reportKey: string
  name: string
  filters: Record<string, unknown>
  isDefault?: boolean
  isShared?: boolean
  createdAt?: string
  updatedAt?: string
  createdBy?: string | null
}

export async function listSavedViews(reportKey?: string) {
  return apiRequest<SavedReportView[]>(`${tenantPath('/reports/saved-views')}${buildQuery({ reportKey })}`)
}

export async function createSavedView(data: {
  reportKey: string
  name: string
  filters: Record<string, unknown>
  isDefault?: boolean
}) {
  return apiRequest<SavedReportView>(tenantPath('/reports/saved-views'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateSavedView(
  id: string,
  data: Partial<{ name: string; filters: Record<string, unknown>; isDefault: boolean }>,
) {
  return apiRequest<SavedReportView>(tenantPath(`/reports/saved-views/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteSavedView(id: string) {
  return apiRequest<null>(tenantPath(`/reports/saved-views/${id}`), { method: 'DELETE' })
}

// ─── Shopfloor live board ─────────────────────────────────────────────────────

export interface ShopfloorLiveWorkOrder {
  id: string
  orderNumber: string
  itemCode?: string | null
  itemName?: string | null
  status: string
  health?: string | null
  workCentreName?: string | null
  machineName?: string | null
  operatorName?: string | null
  plannedQty?: number | null
  completedQty?: number | null
  progressPct?: number | null
  startedAt?: string | null
  dueDate?: string | null
  [key: string]: unknown
}

export interface ShopfloorLiveResult {
  asOf: string
  summary?: Record<string, unknown>
  workOrders: ShopfloorLiveWorkOrder[]
  suggestedRefreshSeconds?: number
}

export async function getShopfloorLive(filters?: Record<string, string | number | boolean | undefined>) {
  const res = await apiRequest<{
    rows?: Array<Record<string, unknown>>
    lastRefreshed?: string
    suggestedRefreshSeconds?: number
    workOrders?: ShopfloorLiveWorkOrder[]
    asOf?: string
  }>(`${tenantPath('/manufacturing/shopfloor/live')}${buildQuery(filters)}`)

  const rawRows = res.data.workOrders ?? res.data.rows ?? []
  const workOrders: ShopfloorLiveWorkOrder[] = rawRows.map((row) => {
    const r = row as Record<string, unknown>
    const planned = Number(r.plannedQty ?? r.plannedQuantity ?? 0)
    const completed = Number(r.completedQty ?? r.goodQuantity ?? 0)
    return {
      id: String(r.id ?? r.workOrderId ?? ''),
      orderNumber: String(r.orderNumber ?? ''),
      itemCode: (r.itemCode as string | null | undefined) ?? (r.productItemCode as string | null | undefined) ?? null,
      itemName: (r.itemName as string | null | undefined) ?? (r.productItemName as string | null | undefined) ?? null,
      status: String(r.status ?? r.orderStatus ?? r.healthStatus ?? 'READY').toLowerCase(),
      health: (r.health as string | null | undefined) ?? (r.healthStatus as string | null | undefined) ?? null,
      workCentreName: (r.workCentreName as string | null | undefined) ?? (r.workCentre as string | null | undefined) ?? null,
      machineName: (r.machineName as string | null | undefined) ?? (r.machine as string | null | undefined) ?? null,
      operatorName: (r.operatorName as string | null | undefined) ?? null,
      plannedQty: planned || null,
      completedQty: completed || null,
      progressPct: planned > 0 ? Math.round((completed / planned) * 100) : null,
      startedAt: (r.startedAt as string | null | undefined) ?? null,
      dueDate: (r.dueDate as string | null | undefined) ?? null,
      ...r,
    }
  })

  return {
    ...res,
    data: {
      asOf: res.data.asOf ?? res.data.lastRefreshed ?? new Date().toISOString(),
      workOrders,
      suggestedRefreshSeconds: res.data.suggestedRefreshSeconds ?? 30,
    } satisfies ShopfloorLiveResult,
  }
}

// ─── Operations exceptions ────────────────────────────────────────────────────

export interface OperationsException {
  id: string
  type: string
  severity: string
  status: string
  title: string
  description?: string | null
  sourceModule?: string | null
  sourceEntityType?: string | null
  sourceEntityId?: string | null
  sourceLink?: string | null
  raisedAt: string
  acknowledgedAt?: string | null
  acknowledgedBy?: string | null
  [key: string]: unknown
}

export interface ExceptionsSummary {
  total: number
  open: number
  acknowledged: number
  bySeverity?: Record<string, number>
  byType?: Record<string, number>
}

export async function getExceptionsSummary(filters?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<ExceptionsSummary>(`${tenantPath('/operations/exceptions/summary')}${buildQuery(filters)}`)
}

export async function listExceptions(filters?: Record<string, string | number | boolean | undefined>) {
  const res = await apiRequest<{ exceptions?: OperationsException[] } | OperationsException[]>(
    `${tenantPath('/operations/exceptions')}${buildQuery(filters)}`,
  )
  const raw = Array.isArray(res.data) ? res.data : (res.data?.exceptions ?? [])
  const mapped: OperationsException[] = (raw as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id ?? row.exceptionKey ?? ''),
    type: String(row.type ?? row.category ?? 'UNKNOWN'),
    severity: String(row.severity ?? 'MEDIUM'),
    status: String(row.status ?? row.resolutionStatus ?? 'OPEN'),
    title: String(row.title ?? row.exceptionKey ?? 'Exception'),
    description: (row.description as string | null | undefined) ?? (row.detail as string | null | undefined) ?? null,
    sourceModule: (row.sourceModule as string | null | undefined) ?? (row.sourceType as string | null | undefined) ?? null,
    sourceEntityType: (row.sourceEntityType as string | null | undefined) ?? (row.sourceType as string | null | undefined) ?? null,
    sourceEntityId: (row.sourceEntityId as string | null | undefined) ?? (row.sourceId as string | null | undefined) ?? null,
    sourceLink: (row.sourceLink as string | null | undefined) ?? null,
    raisedAt: String(row.raisedAt ?? row.referenceDate ?? new Date().toISOString()),
    acknowledgedAt: (row.acknowledgedAt as string | null | undefined) ?? null,
    acknowledgedBy: (row.acknowledgedBy as string | null | undefined) ?? null,
  }))
  return { ...res, data: mapped }
}

export async function acknowledgeException(id: string, data?: { remarks?: string }) {
  return apiRequest<OperationsException>(tenantPath(`/operations/exceptions/${id}/acknowledge`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

// ─── Manufacturing traceability ───────────────────────────────────────────────

export interface TraceabilitySearchResult {
  id: string
  type: string
  label: string
  code?: string | null
  [key: string]: unknown
}

export interface TraceabilityNode {
  id: string
  type: string
  label: string
  timestamp?: string | null
  status?: string | null
  details?: Record<string, unknown>
  links?: Array<{ id: string; type: string; label: string }>
}

export interface TraceabilityLineageResult {
  rootId: string
  rootType: string
  nodes: TraceabilityNode[]
}

export async function searchTraceability(query: string) {
  const res = await apiRequest<{ results?: TraceabilitySearchResult[] } | TraceabilitySearchResult[]>(
    `${tenantPath('/manufacturing/traceability/search')}${buildQuery({ q: query })}`,
  )
  const raw = Array.isArray(res.data) ? res.data : ((res.data as { results?: TraceabilitySearchResult[] })?.results ?? [])
  return { ...res, data: raw }
}

export async function getTraceabilityLineage(entityId: string, entityType?: string) {
  const type = entityType && entityType.length > 0 ? entityType : 'work-order'
  return apiRequest<TraceabilityLineageResult>(
    tenantPath(`/manufacturing/traceability/${type}/${entityId}`),
  )
}