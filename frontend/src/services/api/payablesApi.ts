import type {
  AllocatableVendorInvoicesResult,
  ApDocumentReversalPreview,
  ApReversalHistoryRow,
  CreateVendorAdjustmentAllocationInput,
  CreateVendorAdjustmentInput,
  CreateVendorInvoiceInput,
  CreateVendorPaymentAllocationInput,
  CreateVendorPaymentInput,
  ListVendorAdjustmentsQuery,
  ListVendorInvoicesQuery,
  ListVendorPaymentsQuery,
  PaginatedVendorAdjustments,
  PaginatedVendorInvoices,
  PaginatedVendorPayments,
  PayableAgeingReportDto,
  PayableOutstandingOpenItemDto,
  PayableOverviewDto,
  PayableReportingListResult,
  PaymentPlanningDto,
  PayableAllocationDetail,
  PayableAllocationHistoryRow,
  PayableAllocationResult,
  PostVendorAdjustmentResult,
  PostVendorInvoiceResult,
  PostVendorPaymentResult,
  ReverseApDocumentInput,
  ReversePayableAllocationResult,
  ReverseVendorAdjustmentResult,
  ReverseVendorInvoiceResult,
  ReverseVendorPaymentResult,
  UpdateVendorAdjustmentInput,
  UpdateVendorInvoiceInput,
  UpdateVendorPaymentInput,
  VendorAdjustmentApprovalDetail,
  VendorAdjustmentDto,
  VendorInvoiceApprovalDetail,
  VendorInvoiceDto,
  VendorPayableDetailDto,
  VendorPaymentApprovalDetail,
  VendorPaymentDto,
  AcknowledgePayableReconciliationExceptionInput,
  CreatePayableCloseGateRunInput,
  CreatePayableReconciliationRunInput,
  ListPayableCloseGateRunsQuery,
  ListPayableReconciliationExceptionsQuery,
  ListPayableReconciliationRunsQuery,
  PaginatedPayableCloseGateRuns,
  PaginatedPayableReconciliationAccountResults,
  PaginatedPayableReconciliationExceptions,
  PaginatedPayableReconciliationRuns,
  PaginatedPayableReconciliationVendorResults,
  PayableCloseGateRunDetailDto,
  PayableReconciliationAccountResultDto,
  PayableReconciliationExceptionDto,
  PayableReconciliationRunDto,
  PayableReconciliationVendorBalanceRow,
} from '../../types/moneyOut'
import { apiDownloadBlob, apiRequest, tenantPath, type ApiResponse } from './client'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

const BASE = '/accounting/payables/vendor-invoices'

export async function listVendorInvoices(params: ListVendorInvoicesQuery) {
  const res = await apiRequest<VendorInvoiceDto[]>(
    `${tenantPath(BASE)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`,
  )
  const meta = res.meta ?? { page: 1, limit: params.limit ?? 20, total: res.data.length, totalPages: 1 }
  return {
    ...res,
    data: {
      items: res.data,
      page: meta.page,
      limit: meta.limit,
      total: meta.total,
      totalPages: meta.totalPages,
    } satisfies PaginatedVendorInvoices,
  } as ApiResponse<PaginatedVendorInvoices>
}

export async function getVendorInvoice(id: string) {
  return apiRequest<VendorInvoiceDto>(tenantPath(`${BASE}/${id}`))
}

export async function createVendorInvoiceDraft(data: CreateVendorInvoiceInput) {
  return apiRequest<VendorInvoiceDto>(tenantPath(BASE), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateVendorInvoiceDraft(id: string, data: UpdateVendorInvoiceInput) {
  return apiRequest<VendorInvoiceDto>(tenantPath(`${BASE}/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function validateVendorInvoice(id: string) {
  return apiRequest<VendorInvoiceDto>(tenantPath(`${BASE}/${id}/validate`), { method: 'POST' })
}

export async function submitVendorInvoice(id: string, body: { expectedUpdatedAt?: string; comments?: string } = {}) {
  return apiRequest<VendorInvoiceDto>(tenantPath(`${BASE}/${id}/submit`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function markVendorInvoiceReady(id: string, body: { expectedUpdatedAt?: string } = {}) {
  return apiRequest<VendorInvoiceDto>(tenantPath(`${BASE}/${id}/mark-ready`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function approveVendorInvoice(id: string, body: { expectedUpdatedAt?: string; comments?: string } = {}) {
  return apiRequest<VendorInvoiceDto>(tenantPath(`${BASE}/${id}/approve`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function rejectVendorInvoice(id: string, body: { expectedUpdatedAt?: string; reason: string }) {
  return apiRequest<VendorInvoiceDto>(tenantPath(`${BASE}/${id}/reject`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function reviseVendorInvoice(id: string, body: { expectedUpdatedAt?: string; reason: string }) {
  return apiRequest<VendorInvoiceDto>(tenantPath(`${BASE}/${id}/revise`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function cancelVendorInvoice(id: string, body: { expectedUpdatedAt?: string; reason: string }) {
  return apiRequest<VendorInvoiceDto>(tenantPath(`${BASE}/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function postVendorInvoice(id: string, body: { expectedUpdatedAt: string }) {
  return apiRequest<PostVendorInvoiceResult>(tenantPath(`${BASE}/${id}/post`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getVendorInvoiceApproval(id: string) {
  return apiRequest<VendorInvoiceApprovalDetail>(tenantPath(`${BASE}/${id}/approval`))
}

/** DRAFT-only refresh of the vendor party snapshot from MasterVendor. */
export interface VendorInvoiceMasterRefreshPreview {
  invoiceId: string
  vendorId: string
  current: Record<string, unknown>
  proposed: Record<string, unknown>
  changedFields: string[]
}

export async function previewVendorInvoiceRefreshFromMaster(id: string) {
  return apiRequest<VendorInvoiceMasterRefreshPreview>(
    tenantPath(`${BASE}/${id}/refresh-from-master/preview`),
    { method: 'POST', body: '{}' },
  )
}

export async function applyVendorInvoiceRefreshFromMaster(id: string) {
  return apiRequest<VendorInvoiceDto>(tenantPath(`${BASE}/${id}/refresh-from-master`), {
    method: 'POST',
    body: '{}',
  })
}

// ─── Vendor payments (Phase 4B1–4B4) ───

const VP_BASE = '/accounting/payables/vendor-payments'

export async function listVendorPayments(params: ListVendorPaymentsQuery) {
  const res = await apiRequest<VendorPaymentDto[]>(
    `${tenantPath(VP_BASE)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`,
  )
  const meta = res.meta ?? { page: 1, limit: params.limit ?? 20, total: res.data.length, totalPages: 1 }
  return {
    ...res,
    data: {
      items: res.data,
      page: meta.page,
      limit: meta.limit,
      total: meta.total,
      totalPages: meta.totalPages,
    } satisfies PaginatedVendorPayments,
  } as ApiResponse<PaginatedVendorPayments>
}

export async function getVendorPayment(id: string) {
  return apiRequest<VendorPaymentDto>(tenantPath(`${VP_BASE}/${id}`))
}

export async function createVendorPaymentDraft(data: CreateVendorPaymentInput) {
  return apiRequest<VendorPaymentDto>(tenantPath(VP_BASE), { method: 'POST', body: JSON.stringify(data) })
}

export async function updateVendorPaymentDraft(id: string, data: UpdateVendorPaymentInput) {
  return apiRequest<VendorPaymentDto>(tenantPath(`${VP_BASE}/${id}`), { method: 'PATCH', body: JSON.stringify(data) })
}

export async function validateVendorPayment(id: string) {
  return apiRequest<VendorPaymentDto>(tenantPath(`${VP_BASE}/${id}/validate`), { method: 'POST' })
}

export async function submitVendorPayment(id: string, body: { expectedUpdatedAt?: string; comments?: string } = {}) {
  return apiRequest<VendorPaymentDto>(tenantPath(`${VP_BASE}/${id}/submit`), { method: 'POST', body: JSON.stringify(body) })
}

export async function markVendorPaymentReady(id: string, body: { expectedUpdatedAt?: string } = {}) {
  return apiRequest<VendorPaymentDto>(tenantPath(`${VP_BASE}/${id}/mark-ready`), { method: 'POST', body: JSON.stringify(body) })
}

export async function approveVendorPayment(id: string, body: { expectedUpdatedAt?: string; comments?: string } = {}) {
  return apiRequest<VendorPaymentDto>(tenantPath(`${VP_BASE}/${id}/approve`), { method: 'POST', body: JSON.stringify(body) })
}

export async function rejectVendorPayment(id: string, body: { expectedUpdatedAt?: string; reason: string }) {
  return apiRequest<VendorPaymentDto>(tenantPath(`${VP_BASE}/${id}/reject`), { method: 'POST', body: JSON.stringify(body) })
}

export async function reviseVendorPayment(id: string, body: { expectedUpdatedAt?: string; reason: string }) {
  return apiRequest<VendorPaymentDto>(tenantPath(`${VP_BASE}/${id}/revise`), { method: 'POST', body: JSON.stringify(body) })
}

export async function cancelVendorPayment(id: string, body: { expectedUpdatedAt?: string; reason: string }) {
  return apiRequest<VendorPaymentDto>(tenantPath(`${VP_BASE}/${id}/cancel`), { method: 'POST', body: JSON.stringify(body) })
}

export async function postVendorPayment(id: string, body: { expectedUpdatedAt: string }) {
  return apiRequest<PostVendorPaymentResult>(tenantPath(`${VP_BASE}/${id}/post`), { method: 'POST', body: JSON.stringify(body) })
}

export async function getVendorPaymentApproval(id: string) {
  return apiRequest<VendorPaymentApprovalDetail>(tenantPath(`${VP_BASE}/${id}/approval`))
}

// ─── Vendor payment allocations (Phase 4B4) — subledger only, no GL ───
// Allocation creates PayableAllocationBatch/Lines + AP open-item balance updates only.
// It never creates an AccountingVoucher, GL entry, PostingEvent, or number-series consumption.

export async function getAllocatableVendorInvoices(
  vendorPaymentId: string,
  params: { targetAmount?: string; page?: number; pageSize?: number } = {},
) {
  return apiRequest<AllocatableVendorInvoicesResult>(
    `${tenantPath(`${VP_BASE}/${vendorPaymentId}/allocatable-invoices`)}${buildQuery(
      params as unknown as Record<string, string | number | boolean | undefined>,
    )}`,
  )
}

export async function createVendorPaymentAllocation(
  vendorPaymentId: string,
  data: CreateVendorPaymentAllocationInput,
) {
  return apiRequest<PayableAllocationResult>(tenantPath(`${VP_BASE}/${vendorPaymentId}/allocations`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function listVendorPaymentAllocations(
  vendorPaymentId: string,
  params: { page?: number; pageSize?: number } = {},
) {
  return apiRequest<PayableAllocationHistoryRow[]>(
    `${tenantPath(`${VP_BASE}/${vendorPaymentId}/allocations`)}${buildQuery(
      params as unknown as Record<string, string | number | boolean | undefined>,
    )}`,
  )
}

export async function listVendorInvoiceAllocations(
  vendorInvoiceId: string,
  params: { page?: number; pageSize?: number } = {},
) {
  return apiRequest<PayableAllocationHistoryRow[]>(
    `${tenantPath(`${BASE}/${vendorInvoiceId}/allocations`)}${buildQuery(
      params as unknown as Record<string, string | number | boolean | undefined>,
    )}`,
  )
}

export async function getPayableAllocation(allocationId: string) {
  return apiRequest<PayableAllocationDetail>(tenantPath(`/accounting/payables/allocations/${allocationId}`))
}

// ─── Vendor adjustments (Phase 4C2) ───

const VA_BASE = '/accounting/payables/vendor-adjustments'

export async function listVendorAdjustments(params: ListVendorAdjustmentsQuery) {
  const res = await apiRequest<VendorAdjustmentDto[]>(
    `${tenantPath(VA_BASE)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`,
  )
  const meta = res.meta ?? { page: 1, limit: params.limit ?? 20, total: res.data.length, totalPages: 1 }
  return {
    ...res,
    data: {
      items: res.data,
      page: meta.page,
      limit: meta.limit,
      total: meta.total,
      totalPages: meta.totalPages,
    } satisfies PaginatedVendorAdjustments,
  } as ApiResponse<PaginatedVendorAdjustments>
}

export async function getVendorAdjustment(id: string) {
  return apiRequest<VendorAdjustmentDto>(tenantPath(`${VA_BASE}/${id}`))
}

export async function createVendorAdjustmentDraft(data: CreateVendorAdjustmentInput) {
  return apiRequest<VendorAdjustmentDto>(tenantPath(VA_BASE), { method: 'POST', body: JSON.stringify(data) })
}

export async function updateVendorAdjustmentDraft(id: string, data: UpdateVendorAdjustmentInput) {
  return apiRequest<VendorAdjustmentDto>(tenantPath(`${VA_BASE}/${id}`), { method: 'PATCH', body: JSON.stringify(data) })
}

export async function validateVendorAdjustment(id: string) {
  return apiRequest<VendorAdjustmentDto>(tenantPath(`${VA_BASE}/${id}/validate`), { method: 'POST' })
}

export async function submitVendorAdjustment(id: string, body: { expectedUpdatedAt?: string; comments?: string } = {}) {
  return apiRequest<VendorAdjustmentDto>(tenantPath(`${VA_BASE}/${id}/submit`), { method: 'POST', body: JSON.stringify(body) })
}

export async function markVendorAdjustmentReady(id: string, body: { expectedUpdatedAt?: string } = {}) {
  return apiRequest<VendorAdjustmentDto>(tenantPath(`${VA_BASE}/${id}/mark-ready`), { method: 'POST', body: JSON.stringify(body) })
}

export async function approveVendorAdjustment(id: string, body: { expectedUpdatedAt?: string; comments?: string } = {}) {
  return apiRequest<VendorAdjustmentDto>(tenantPath(`${VA_BASE}/${id}/approve`), { method: 'POST', body: JSON.stringify(body) })
}

export async function rejectVendorAdjustment(id: string, body: { expectedUpdatedAt?: string; reason: string }) {
  return apiRequest<VendorAdjustmentDto>(tenantPath(`${VA_BASE}/${id}/reject`), { method: 'POST', body: JSON.stringify(body) })
}

export async function reviseVendorAdjustment(id: string, body: { expectedUpdatedAt?: string; reason: string }) {
  return apiRequest<VendorAdjustmentDto>(tenantPath(`${VA_BASE}/${id}/revise`), { method: 'POST', body: JSON.stringify(body) })
}

export async function cancelVendorAdjustment(id: string, body: { expectedUpdatedAt?: string; reason: string }) {
  return apiRequest<VendorAdjustmentDto>(tenantPath(`${VA_BASE}/${id}/cancel`), { method: 'POST', body: JSON.stringify(body) })
}

export async function postVendorAdjustment(id: string, body: { expectedUpdatedAt: string }) {
  return apiRequest<PostVendorAdjustmentResult>(tenantPath(`${VA_BASE}/${id}/post`), { method: 'POST', body: JSON.stringify(body) })
}

export async function getVendorAdjustmentApproval(id: string) {
  return apiRequest<VendorAdjustmentApprovalDetail>(tenantPath(`${VA_BASE}/${id}/approval`))
}

export async function getVendorAdjustmentReversalPreview(id: string) {
  return apiRequest<ApDocumentReversalPreview>(tenantPath(`${VA_BASE}/${id}/reversal-preview`))
}

export async function reverseVendorAdjustment(id: string, body: ReverseApDocumentInput) {
  return apiRequest<ReverseVendorAdjustmentResult>(tenantPath(`${VA_BASE}/${id}/reverse`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getAllocatablePayablesForDebitNote(
  vendorAdjustmentId: string,
  params: { targetAmount?: string; page?: number; pageSize?: number } = {},
) {
  return apiRequest<AllocatableVendorInvoicesResult>(
    `${tenantPath(`${VA_BASE}/${vendorAdjustmentId}/allocatable-payables`)}${buildQuery(
      params as unknown as Record<string, string | number | boolean | undefined>,
    )}`,
  )
}

export async function createVendorAdjustmentAllocation(
  vendorAdjustmentId: string,
  data: CreateVendorAdjustmentAllocationInput,
) {
  return apiRequest<PayableAllocationResult>(tenantPath(`${VA_BASE}/${vendorAdjustmentId}/allocations`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function listVendorAdjustmentAllocations(
  vendorAdjustmentId: string,
  params: { page?: number; pageSize?: number } = {},
) {
  return apiRequest<PayableAllocationHistoryRow[]>(
    `${tenantPath(`${VA_BASE}/${vendorAdjustmentId}/allocations`)}${buildQuery(
      params as unknown as Record<string, string | number | boolean | undefined>,
    )}`,
  )
}

// ─── AP document reversals (Phase 4C1) ───

export async function getVendorPaymentReversalPreview(id: string) {
  return apiRequest<ApDocumentReversalPreview>(tenantPath(`${VP_BASE}/${id}/reversal-preview`))
}

export async function reverseVendorPayment(id: string, body: ReverseApDocumentInput) {
  return apiRequest<ReverseVendorPaymentResult>(tenantPath(`${VP_BASE}/${id}/reverse`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getVendorInvoiceReversalPreview(id: string) {
  return apiRequest<ApDocumentReversalPreview>(tenantPath(`${BASE}/${id}/reversal-preview`))
}

export async function reverseVendorInvoice(id: string, body: ReverseApDocumentInput) {
  return apiRequest<ReverseVendorInvoiceResult>(tenantPath(`${BASE}/${id}/reverse`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function reversePayableAllocation(allocationId: string, body: {
  reversalDate: string
  reason: string
  idempotencyKey: string
  expectedAllocationUpdatedAt: string
  lineIds?: string[]
  expectedLines?: Array<{ allocationLineId: string; expectedUpdatedAt: string }>
  expectedOpenItems?: Array<{ openItemId: string; expectedUpdatedAt: string }>
}) {
  return apiRequest<ReversePayableAllocationResult>(tenantPath(`/accounting/payables/allocations/${allocationId}/reverse`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** No dedicated history endpoint yet — returns empty list gracefully. */
export async function listApReversalHistory(_params: { legalEntityId?: string; page?: number; limit?: number } = {}) {
  return {
    success: true as const,
    message: 'AP reversal history endpoint not available',
    data: [] as ApReversalHistoryRow[],
    meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
  }
}

// ─── AP reporting (Phase 4D1) ───────────────────────────────────────────────

const REPORTING_BASE = '/accounting/payables'

export async function getPayableOverview(params: { legalEntityId: string; reportDate?: string }) {
  return apiRequest<PayableOverviewDto>(`${tenantPath(`${REPORTING_BASE}/overview`)}${buildQuery(params)}`)
}

export async function listPayableOutstanding(params: Record<string, string | number | boolean | undefined>) {
  return apiRequest<PayableReportingListResult<PayableOutstandingOpenItemDto>>(
    `${tenantPath(`${REPORTING_BASE}/outstanding`)}${buildQuery(params)}`,
  )
}

export async function getPayableAgeingReport(params: Record<string, string | number | boolean | undefined>) {
  return apiRequest<PayableAgeingReportDto>(`${tenantPath(`${REPORTING_BASE}/ageing`)}${buildQuery(params)}`)
}

export async function listVendorPayableSummaries(params: Record<string, string | number | boolean | undefined>) {
  return apiRequest<PayableReportingListResult<VendorPayableDetailDto>>(
    `${tenantPath(`${REPORTING_BASE}/vendors`)}${buildQuery(params)}`,
  )
}

export async function getVendorPayableSummary(vendorId: string, params: { legalEntityId: string; reportDate?: string }) {
  return apiRequest<VendorPayableDetailDto>(
    `${tenantPath(`${REPORTING_BASE}/vendors/${vendorId}`)}${buildQuery(params)}`,
  )
}

export async function listVendorPayableOpenItems(
  vendorId: string,
  params: Record<string, string | number | boolean | undefined>,
) {
  return apiRequest<PayableReportingListResult<PayableOutstandingOpenItemDto>>(
    `${tenantPath(`${REPORTING_BASE}/vendors/${vendorId}/open-items`)}${buildQuery(params)}`,
  )
}

export async function getPaymentPlanning(params: Record<string, string | number | boolean | undefined>) {
  return apiRequest<PaymentPlanningDto>(`${tenantPath(`${REPORTING_BASE}/payment-planning`)}${buildQuery(params)}`)
}

// ─── AP reconciliation + close gate (Phase 4D2) ─────────────────────────────

const RECON_BASE = '/accounting/payables/reconciliation'
const CLOSE_GATE_BASE = '/accounting/payables/close-gate'

function paginatedResponse<T>(
  res: ApiResponse<T[]>,
  page: number,
  pageSize: number,
): ApiResponse<{ items: T[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const meta = res.meta ?? { page, limit: pageSize, total: res.data.length, totalPages: 1 }
  return {
    ...res,
    data: {
      items: res.data,
      page: meta.page,
      pageSize: meta.limit,
      total: meta.total,
      totalPages: meta.totalPages,
    },
  }
}

export async function createPayableReconciliationRun(data: CreatePayableReconciliationRunInput) {
  return apiRequest<PayableReconciliationRunDto>(tenantPath(`${RECON_BASE}/runs`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function listPayableReconciliationRuns(params: ListPayableReconciliationRunsQuery) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const res = await apiRequest<PayableReconciliationRunDto[]>(
    `${tenantPath(`${RECON_BASE}/runs`)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`,
  )
  return paginatedResponse(res, page, pageSize) as ApiResponse<PaginatedPayableReconciliationRuns>
}

export async function getPayableReconciliationRun(id: string) {
  return apiRequest<PayableReconciliationRunDto>(tenantPath(`${RECON_BASE}/runs/${id}`))
}

export async function listPayableReconciliationRunAccounts(
  runId: string,
  params: { page?: number; pageSize?: number } = {},
) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 50
  const res = await apiRequest<PayableReconciliationAccountResultDto[]>(
    `${tenantPath(`${RECON_BASE}/runs/${runId}/accounts`)}${buildQuery(
      params as unknown as Record<string, string | number | boolean | undefined>,
    )}`,
  )
  return paginatedResponse(res, page, pageSize) as ApiResponse<PaginatedPayableReconciliationAccountResults>
}

export async function listPayableReconciliationRunVendors(
  runId: string,
  params: { page?: number; pageSize?: number } = {},
) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 50
  const res = await apiRequest<PayableReconciliationVendorBalanceRow[]>(
    `${tenantPath(`${RECON_BASE}/runs/${runId}/vendors`)}${buildQuery(
      params as unknown as Record<string, string | number | boolean | undefined>,
    )}`,
  )
  return paginatedResponse(res, page, pageSize) as ApiResponse<PaginatedPayableReconciliationVendorResults>
}

export async function listPayableReconciliationRunExceptions(
  runId: string,
  params: ListPayableReconciliationExceptionsQuery = {},
) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 50
  const res = await apiRequest<PayableReconciliationExceptionDto[]>(
    `${tenantPath(`${RECON_BASE}/runs/${runId}/exceptions`)}${buildQuery(
      params as unknown as Record<string, string | number | boolean | undefined>,
    )}`,
  )
  return paginatedResponse(res, page, pageSize) as ApiResponse<PaginatedPayableReconciliationExceptions>
}

export async function getPayableReconciliationException(id: string) {
  return apiRequest<PayableReconciliationExceptionDto>(tenantPath(`${RECON_BASE}/exceptions/${id}`))
}

export async function acknowledgePayableReconciliationException(
  id: string,
  body: AcknowledgePayableReconciliationExceptionInput = {},
) {
  return apiRequest<PayableReconciliationExceptionDto>(tenantPath(`${RECON_BASE}/exceptions/${id}/acknowledge`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function exportPayableReconciliationRun(runId: string) {
  return apiDownloadBlob(tenantPath(`${RECON_BASE}/runs/${runId}/export`))
}

export async function createPayableCloseGateRun(data: CreatePayableCloseGateRunInput) {
  return apiRequest<PayableCloseGateRunDetailDto['run']>(tenantPath(`${CLOSE_GATE_BASE}/runs`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function listPayableCloseGateRuns(params: ListPayableCloseGateRunsQuery) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const res = await apiRequest<PayableCloseGateRunDetailDto['run'][]>(
    `${tenantPath(`${CLOSE_GATE_BASE}/runs`)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`,
  )
  return paginatedResponse(res, page, pageSize) as ApiResponse<PaginatedPayableCloseGateRuns>
}

export async function getPayableCloseGateRun(id: string) {
  return apiRequest<PayableCloseGateRunDetailDto>(tenantPath(`${CLOSE_GATE_BASE}/runs/${id}`))
}

export async function getLatestPayableCloseGateRun(params: { legalEntityId: string; periodId: string }) {
  return apiRequest<PayableCloseGateRunDetailDto | null>(
    `${tenantPath(`${CLOSE_GATE_BASE}/latest`)}${buildQuery(params)}`,
  )
}

export async function exportPayableCloseGateRun(runId: string) {
  return apiDownloadBlob(tenantPath(`${CLOSE_GATE_BASE}/runs/${runId}/export`))
}

// ─── AP disputes (vendor invoice + PO/GRN context) ───────────────────────────

export type ApDisputeStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'AWAITING_VENDOR'
  | 'AWAITING_INTERNAL_TEAM'
  | 'RESOLVED'
  | 'REJECTED'
  | 'CLOSED'

export type ApDisputeType =
  | 'PRICE_DIFFERENCE'
  | 'QUANTITY_DIFFERENCE'
  | 'QUALITY_ISSUE'
  | 'DELIVERY_DELAY'
  | 'SHORT_SUPPLY'
  | 'TAX_ISSUE'
  | 'MISSING_DOCUMENT'
  | 'DUPLICATE_INVOICE'
  | 'COMMERCIAL_TERMS'
  | 'OTHER'

export type ApDisputePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface ApDisputeSourceLinkDto {
  sourceType: string
  sourceDocumentId: string
  sourceDocumentNumberSnapshot: string | null
}

export interface ApDisputeDto {
  id: string
  tenantId: string
  legalEntityId: string
  disputeNumber: string
  vendorId: string
  vendorCodeSnapshot: string
  vendorNameSnapshot: string
  vendorInvoiceId: string
  payableOpenItemId: string | null
  vendorInvoiceNumber: string
  supplierInvoiceNumber: string
  sourceLinks: ApDisputeSourceLinkDto[]
  disputeDate: string
  disputeType: ApDisputeType
  disputedAmount: string
  description: string
  ownerName: string
  responsibleDepartment: string
  priority: ApDisputePriority
  targetResolutionDate: string | null
  status: ApDisputeStatus
  resolution: string | null
  debitNoteRequired: boolean
  paymentHold: boolean
  supportingDocuments: string[]
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface ListApDisputesQuery {
  legalEntityId: string
  status?: ApDisputeStatus
  vendorId?: string
  vendorInvoiceId?: string
  purchaseOrderId?: string
  search?: string
  page?: number
  limit?: number
  sortOrder?: 'asc' | 'desc'
}

export interface CreateApDisputeInput {
  legalEntityId: string
  vendorInvoiceId: string
  disputeDate: string
  disputeType: ApDisputeType
  disputedAmount: string
  description: string
  ownerName: string
  responsibleDepartment: string
  priority?: ApDisputePriority
  targetResolutionDate?: string | null
  debitNoteRequired?: boolean
  paymentHold?: boolean
  supportingDocuments?: string[]
}

export interface UpdateApDisputeInput {
  disputeDate?: string
  disputeType?: ApDisputeType
  disputedAmount?: string
  description?: string
  ownerName?: string
  responsibleDepartment?: string
  priority?: ApDisputePriority
  targetResolutionDate?: string | null
  debitNoteRequired?: boolean
  paymentHold?: boolean
  supportingDocuments?: string[]
}

const AP_DISPUTE_BASE = '/accounting/payables/disputes'

export async function listApDisputes(params: ListApDisputesQuery) {
  return apiRequest<ApDisputeDto[]>(
    `${tenantPath(AP_DISPUTE_BASE)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`,
  )
}

export async function getApDispute(id: string) {
  return apiRequest<ApDisputeDto>(tenantPath(`${AP_DISPUTE_BASE}/${id}`))
}

export async function createApDispute(data: CreateApDisputeInput) {
  return apiRequest<ApDisputeDto>(tenantPath(AP_DISPUTE_BASE), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateApDispute(id: string, data: UpdateApDisputeInput) {
  return apiRequest<ApDisputeDto>(tenantPath(`${AP_DISPUTE_BASE}/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function transitionApDispute(id: string, body: { status: ApDisputeStatus; resolution?: string | null }) {
  return apiRequest<ApDisputeDto>(tenantPath(`${AP_DISPUTE_BASE}/${id}/transition`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function deleteApDispute(id: string) {
  return apiRequest<ApDisputeDto>(tenantPath(`${AP_DISPUTE_BASE}/${id}`), { method: 'DELETE' })
}
