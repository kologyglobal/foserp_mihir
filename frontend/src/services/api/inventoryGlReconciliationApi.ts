/**
 * FIN-CLOSE-1 — Inventory ↔ GL / WIP ↔ GL trial balance + unified failed events.
 * Base: /api/v1/t/:tenantSlug/accounting/inventory-gl-reconciliation/...
 */
import { apiRequest, tenantPath, type ApiResponse } from './client'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

const BASE = '/accounting/inventory-gl-reconciliation'

export type InventoryGlReasonCode =
  | 'MATCHED'
  | 'MAPPING_MISSING'
  | 'ACCOUNTING_EVENT_FAILED'
  | 'ACCOUNTING_EVENT_UNPOSTED'
  | 'GRIR_NOT_CLEARED'
  | 'MANUAL_GL_ENTRY_DIFFERENCE'
  | 'OPERATIONAL_VALUE_DIFFERENCE'
  | 'FEATURE_FLAG_OFF'

export interface InventoryGlTrialBalanceRowDto {
  mappingKey: string
  accountId: string | null
  accountCode: string | null
  accountName: string | null
  operationalBalance: string
  glBalance: string
  difference: string
  status: 'MATCHED' | 'DIFFERENCE' | 'UNMAPPED' | 'WARNING'
  reasonCodes: InventoryGlReasonCode[]
  drillDown: {
    failedEventCount: number
    unpostedEventCount: number
    notes: string[]
  }
}

export interface InventoryGlTrialBalanceDto {
  legalEntityId: string
  asOfDate: string
  generatedAt: string
  tolerance: string
  inventoryAccountingEnabled: boolean
  manufacturingAccountingEnabled: boolean
  rows: InventoryGlTrialBalanceRowDto[]
  totals: {
    matched: number
    differences: number
    unmapped: number
    warnings: number
    absoluteDifference: string
  }
  forceBalanceAllowed: false
  actions: string[]
}

export interface UnifiedFailedAccountingEventDto {
  id: string
  source: 'INVENTORY' | 'MANUFACTURING'
  eventType: string
  status: string
  legalEntityId: string | null
  productionOrderId: string | null
  sourceDocumentType: string
  sourceDocumentId: string
  amount: string
  failureReason: string | null
  voucherId: string | null
  postingEventId: string | null
  idempotencyKey: string
  createdAt: string
  updatedAt: string | null
  canRetry: boolean
  links: {
    eventPath: string
    sourcePath: string | null
    voucherPath: string | null
  }
}

export async function fetchInventoryGlTrialBalance(params?: {
  legalEntityId?: string
  asOfDate?: string
  tolerance?: string
}): Promise<ApiResponse<InventoryGlTrialBalanceDto>> {
  return apiRequest(`${tenantPath(BASE)}/trial-balance${buildQuery(params)}`)
}

export async function fetchUnifiedFailedAccountingEvents(params?: {
  legalEntityId?: string
  source?: 'INVENTORY' | 'MANUFACTURING' | 'ALL'
  includeUnposted?: boolean
  page?: number
  limit?: number
}): Promise<
  ApiResponse<{
    items: UnifiedFailedAccountingEventDto[]
    total: number
    page: number
    limit: number
    forceBalanceAllowed: false
  }>
> {
  return apiRequest(
    `${tenantPath(BASE)}/failed-events${buildQuery({
      legalEntityId: params?.legalEntityId,
      source: params?.source,
      includeUnposted:
        params?.includeUnposted === undefined ? undefined : params.includeUnposted ? 'true' : 'false',
      page: params?.page,
      limit: params?.limit,
    })}`,
  )
}

export async function retryUnifiedFailedAccountingEvent(
  id: string,
  source: 'INVENTORY' | 'MANUFACTURING',
): Promise<ApiResponse<UnifiedFailedAccountingEventDto>> {
  return apiRequest(`${tenantPath(BASE)}/failed-events/${id}/retry`, {
    method: 'POST',
    body: JSON.stringify({ source }),
  })
}
