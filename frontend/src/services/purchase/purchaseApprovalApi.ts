import { apiRequest, tenantPath } from '../api/client'
import type {
  PurchaseApprovalQueueRow,
  PurchaseApprovalReviewDetail,
} from '../../types/purchaseDomain'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

const base = () => tenantPath('/purchase/approvals')

export type ApiPurchaseApprovalListFilters = {
  page?: number
  limit?: number
  tab?: string
  documentType?: string
  documentNumber?: string
  requester?: string
  department?: string
  locationId?: string
}

export async function listPurchaseApprovalsApi(filters: ApiPurchaseApprovalListFilters = {}) {
  return apiRequest<PurchaseApprovalQueueRow[]>(`${base()}${buildQuery(filters)}`)
}

export async function getPurchaseApprovalApi(id: string) {
  return apiRequest<PurchaseApprovalReviewDetail>(`${base()}/${id}`)
}

export async function delegatePurchaseApprovalApi(
  id: string,
  payload: { toUserId: string; remarks?: string },
) {
  return apiRequest<{
    approvalId: string
    delegatedTo: { id: string; name: string; email: string; role: string }
  }>(`${base()}/${id}/delegate`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
