/**
 * Inventory accounting events — flag-gated GL trail for GRN / adjustments / FG dispatch.
 * Base: /api/v1/t/:tenantSlug/inventory/accounting/...
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

export type InventoryAccountingEventType =
  | 'GRN_INWARD'
  | 'GRN_REVERSAL'
  | 'PURCHASE_RETURN'
  | 'STOCK_ADJUSTMENT'
  | 'STOCK_ADJUSTMENT_REVERSAL'
  | 'STOCK_COUNT_ADJUSTMENT'
  | 'STOCK_COUNT_REVERSAL'
  | 'FG_DISPATCH'
  | 'FG_DISPATCH_REVERSAL'

export type InventoryAccountingEventStatus =
  | 'RECORDED'
  | 'POSTED'
  | 'SKIPPED_ZERO'
  | 'SKIPPED_FLAG_OFF'
  | 'SKIPPED_NO_LEGAL_ENTITY'
  | 'FAILED'
  | 'REVERSED'

export interface InventoryAccountingGateStatus {
  legalEntityId: string | null
  enabled: boolean
  reason: 'ENABLED' | 'FLAG_OFF' | 'NO_LEGAL_ENTITY'
}

export interface InventoryAccountingEventDto {
  id: string
  legalEntityId: string | null
  eventType: InventoryAccountingEventType | string
  status: InventoryAccountingEventStatus | string
  movementId: string | null
  idempotencyKey: string
  sourceDocumentType: string
  sourceDocumentId: string
  quantity: string
  amount: string
  currencyCode: string
  voucherId: string | null
  postingEventId: string | null
  failureReason: string | null
  postedAt: string | null
  createdAt: string
}

const BASE = '/inventory/accounting'

export async function fetchInventoryAccountingGate(
  legalEntityId?: string,
): Promise<ApiResponse<InventoryAccountingGateStatus>> {
  return apiRequest<InventoryAccountingGateStatus>(
    `${tenantPath(`${BASE}/gate`)}${buildQuery({ legalEntityId })}`,
  )
}

export async function fetchInventoryAccountingEvents(params?: {
  page?: number
  limit?: number
  eventType?: string
  status?: string
  legalEntityId?: string
}): Promise<ApiResponse<InventoryAccountingEventDto[]>> {
  return apiRequest<InventoryAccountingEventDto[]>(
    `${tenantPath(`${BASE}/events`)}${buildQuery({
      page: params?.page ?? 1,
      limit: params?.limit ?? 50,
      eventType: params?.eventType,
      status: params?.status,
      legalEntityId: params?.legalEntityId,
    })}`,
  )
}

export async function fetchInventoryAccountingEvent(
  id: string,
): Promise<ApiResponse<InventoryAccountingEventDto>> {
  return apiRequest<InventoryAccountingEventDto>(tenantPath(`${BASE}/events/${id}`))
}
