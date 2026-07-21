import { apiRequest, tenantPath } from '../api/client'

export type PurchaseTimelineEntityType =
  | 'purchase-requisition'
  | 'planning-row'
  | 'rfq'
  | 'purchase-order'

export type PurchaseTimelineEvent = {
  id: string
  source: 'audit' | 'status_history'
  tenantId: string | null
  module: string
  entityType: string
  entityId: string
  action: string
  actionLabel: string
  previousValue: unknown
  newValue: unknown
  actorId: string | null
  actorName: string | null
  timestamp: string
  remarks: string | null
  requestMetadata: {
    ipAddress: string | null
    userAgent: string | null
  } | null
}

export async function getPurchaseTimelineApi(
  entityType: PurchaseTimelineEntityType,
  entityId: string,
) {
  return apiRequest<PurchaseTimelineEvent[]>(
    `${tenantPath('/purchase/timeline')}/${entityType}/${entityId}`,
  )
}
