/**
 * Payables / vendor-invoice API bridge — Phase 4A5.
 * API mode only (no separate AP demo workflow).
 */
import { isApiMode } from '../../config/apiConfig'
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
  PayableReconciliationExceptionDto,
  PayableReconciliationRunDto,
} from '../../types/moneyOut'
import * as api from '../api/payablesApi'
import { formatApiError } from '../api/apiErrors'
import { resolveLegalEntityId } from './financeApiBridge'
import { mapMoneyOutError } from '../../modules/accounting/money-out/moneyOutUi'

function unwrap<T>(res: { data: T }): T {
  return res.data
}

function requireApiMode(): void {
  if (!isApiMode()) {
    throw new Error('Vendor invoices require API mode (VITE_USE_API=true). Demo AP workflow is not available.')
  }
}

function rethrowMapped(err: unknown): never {
  const msg = formatApiError(err)
  const code = err instanceof Error && 'code' in err ? String((err as { code?: string }).code) : undefined
  throw new Error(mapMoneyOutError(code, msg))
}

export async function listVendorInvoices(filters?: Partial<ListVendorInvoicesQuery>): Promise<PaginatedVendorInvoices> {
  requireApiMode()
  const legalEntityId = resolveLegalEntityId(filters?.legalEntityId)
  try {
    return unwrap(await api.listVendorInvoices({ legalEntityId, page: 1, limit: 50, ...filters }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function getVendorInvoice(id: string): Promise<VendorInvoiceDto> {
  requireApiMode()
  try {
    return unwrap(await api.getVendorInvoice(id))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function createVendorInvoiceDraft(input: CreateVendorInvoiceInput): Promise<VendorInvoiceDto> {
  requireApiMode()
  try {
    return unwrap(await api.createVendorInvoiceDraft({ ...input, legalEntityId: resolveLegalEntityId(input.legalEntityId) }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function updateVendorInvoiceDraft(id: string, input: UpdateVendorInvoiceInput): Promise<VendorInvoiceDto> {
  requireApiMode()
  try {
    return unwrap(await api.updateVendorInvoiceDraft(id, input))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function validateVendorInvoice(id: string): Promise<VendorInvoiceDto> {
  requireApiMode()
  try {
    return unwrap(await api.validateVendorInvoice(id))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function submitVendorInvoice(
  id: string,
  expectedUpdatedAt?: string,
  comments?: string,
): Promise<VendorInvoiceDto> {
  requireApiMode()
  try {
    return unwrap(await api.submitVendorInvoice(id, { expectedUpdatedAt, comments }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function markVendorInvoiceReady(id: string, expectedUpdatedAt?: string): Promise<VendorInvoiceDto> {
  requireApiMode()
  try {
    return unwrap(await api.markVendorInvoiceReady(id, { expectedUpdatedAt }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function approveVendorInvoice(
  id: string,
  expectedUpdatedAt?: string,
  comments?: string,
): Promise<VendorInvoiceDto> {
  requireApiMode()
  try {
    return unwrap(await api.approveVendorInvoice(id, { expectedUpdatedAt, comments }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function rejectVendorInvoice(
  id: string,
  reason: string,
  expectedUpdatedAt?: string,
): Promise<VendorInvoiceDto> {
  requireApiMode()
  try {
    return unwrap(await api.rejectVendorInvoice(id, { reason, expectedUpdatedAt }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function reviseVendorInvoice(
  id: string,
  reason: string,
  expectedUpdatedAt?: string,
): Promise<VendorInvoiceDto> {
  requireApiMode()
  try {
    return unwrap(await api.reviseVendorInvoice(id, { reason, expectedUpdatedAt }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function cancelVendorInvoice(
  id: string,
  reason: string,
  expectedUpdatedAt?: string,
): Promise<VendorInvoiceDto> {
  requireApiMode()
  try {
    return unwrap(await api.cancelVendorInvoice(id, { reason, expectedUpdatedAt }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function postVendorInvoice(id: string, expectedUpdatedAt: string): Promise<PostVendorInvoiceResult> {
  requireApiMode()
  try {
    return unwrap(await api.postVendorInvoice(id, { expectedUpdatedAt }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function getVendorInvoiceApproval(id: string): Promise<VendorInvoiceApprovalDetail> {
  requireApiMode()
  try {
    return unwrap(await api.getVendorInvoiceApproval(id))
  } catch (e) {
    rethrowMapped(e)
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Vendor payments / advances — Phase 4B5 (API mode only)
 * ──────────────────────────────────────────────────────────────────────────── */

export async function listVendorPayments(
  filters?: Partial<ListVendorPaymentsQuery>,
): Promise<PaginatedVendorPayments> {
  requireApiMode()
  const legalEntityId = resolveLegalEntityId(filters?.legalEntityId)
  try {
    return unwrap(await api.listVendorPayments({ legalEntityId, page: 1, limit: 50, ...filters }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function getVendorPayment(id: string): Promise<VendorPaymentDto> {
  requireApiMode()
  try {
    return unwrap(await api.getVendorPayment(id))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function createVendorPaymentDraft(input: CreateVendorPaymentInput): Promise<VendorPaymentDto> {
  requireApiMode()
  try {
    return unwrap(
      await api.createVendorPaymentDraft({ ...input, legalEntityId: resolveLegalEntityId(input.legalEntityId) }),
    )
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function updateVendorPaymentDraft(id: string, input: UpdateVendorPaymentInput): Promise<VendorPaymentDto> {
  requireApiMode()
  try {
    return unwrap(await api.updateVendorPaymentDraft(id, input))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function validateVendorPayment(id: string): Promise<VendorPaymentDto> {
  requireApiMode()
  try {
    return unwrap(await api.validateVendorPayment(id))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function submitVendorPayment(
  id: string,
  expectedUpdatedAt?: string,
  comments?: string,
): Promise<VendorPaymentDto> {
  requireApiMode()
  try {
    return unwrap(await api.submitVendorPayment(id, { expectedUpdatedAt, comments }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function markVendorPaymentReady(id: string, expectedUpdatedAt?: string): Promise<VendorPaymentDto> {
  requireApiMode()
  try {
    return unwrap(await api.markVendorPaymentReady(id, { expectedUpdatedAt }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function approveVendorPayment(
  id: string,
  expectedUpdatedAt?: string,
  comments?: string,
): Promise<VendorPaymentDto> {
  requireApiMode()
  try {
    return unwrap(await api.approveVendorPayment(id, { expectedUpdatedAt, comments }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function rejectVendorPayment(
  id: string,
  reason: string,
  expectedUpdatedAt?: string,
): Promise<VendorPaymentDto> {
  requireApiMode()
  try {
    return unwrap(await api.rejectVendorPayment(id, { reason, expectedUpdatedAt }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function reviseVendorPayment(
  id: string,
  reason: string,
  expectedUpdatedAt?: string,
): Promise<VendorPaymentDto> {
  requireApiMode()
  try {
    return unwrap(await api.reviseVendorPayment(id, { reason, expectedUpdatedAt }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function cancelVendorPayment(
  id: string,
  reason: string,
  expectedUpdatedAt?: string,
): Promise<VendorPaymentDto> {
  requireApiMode()
  try {
    return unwrap(await api.cancelVendorPayment(id, { reason, expectedUpdatedAt }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function postVendorPayment(id: string, expectedUpdatedAt: string): Promise<PostVendorPaymentResult> {
  requireApiMode()
  try {
    return unwrap(await api.postVendorPayment(id, { expectedUpdatedAt }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function getVendorPaymentApproval(id: string): Promise<VendorPaymentApprovalDetail> {
  requireApiMode()
  try {
    return unwrap(await api.getVendorPaymentApproval(id))
  } catch (e) {
    rethrowMapped(e)
  }
}

/* ── Payable allocations (subledger only, no GL) ── */

export async function getAllocatableVendorInvoices(
  vendorPaymentId: string,
  params: { targetAmount?: string; page?: number; pageSize?: number } = {},
): Promise<AllocatableVendorInvoicesResult> {
  requireApiMode()
  try {
    return unwrap(await api.getAllocatableVendorInvoices(vendorPaymentId, params))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function createVendorPaymentAllocation(
  vendorPaymentId: string,
  input: CreateVendorPaymentAllocationInput,
): Promise<PayableAllocationResult> {
  requireApiMode()
  try {
    return unwrap(await api.createVendorPaymentAllocation(vendorPaymentId, input))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function listVendorPaymentAllocations(
  vendorPaymentId: string,
  params: { page?: number; pageSize?: number } = {},
): Promise<PayableAllocationHistoryRow[]> {
  requireApiMode()
  try {
    return unwrap(await api.listVendorPaymentAllocations(vendorPaymentId, params))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function listVendorInvoiceAllocations(
  vendorInvoiceId: string,
  params: { page?: number; pageSize?: number } = {},
): Promise<PayableAllocationHistoryRow[]> {
  requireApiMode()
  try {
    return unwrap(await api.listVendorInvoiceAllocations(vendorInvoiceId, params))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function getPayableAllocation(allocationId: string): Promise<PayableAllocationDetail> {
  requireApiMode()
  try {
    return unwrap(await api.getPayableAllocation(allocationId))
  } catch (e) {
    rethrowMapped(e)
  }
}

/* ── Vendor adjustments (Phase 4C2) ── */

export async function listVendorAdjustments(
  filters?: Partial<ListVendorAdjustmentsQuery>,
): Promise<PaginatedVendorAdjustments> {
  requireApiMode()
  const legalEntityId = resolveLegalEntityId(filters?.legalEntityId)
  try {
    return unwrap(await api.listVendorAdjustments({ legalEntityId, page: 1, limit: 50, ...filters }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function getVendorAdjustment(id: string): Promise<VendorAdjustmentDto> {
  requireApiMode()
  try {
    return unwrap(await api.getVendorAdjustment(id))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function createVendorAdjustmentDraft(input: CreateVendorAdjustmentInput): Promise<VendorAdjustmentDto> {
  requireApiMode()
  try {
    return unwrap(
      await api.createVendorAdjustmentDraft({ ...input, legalEntityId: resolveLegalEntityId(input.legalEntityId) }),
    )
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function updateVendorAdjustmentDraft(
  id: string,
  input: UpdateVendorAdjustmentInput,
): Promise<VendorAdjustmentDto> {
  requireApiMode()
  try {
    return unwrap(await api.updateVendorAdjustmentDraft(id, input))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function validateVendorAdjustment(id: string): Promise<VendorAdjustmentDto> {
  requireApiMode()
  try {
    return unwrap(await api.validateVendorAdjustment(id))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function submitVendorAdjustment(
  id: string,
  expectedUpdatedAt?: string,
  comments?: string,
): Promise<VendorAdjustmentDto> {
  requireApiMode()
  try {
    return unwrap(await api.submitVendorAdjustment(id, { expectedUpdatedAt, comments }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function markVendorAdjustmentReady(id: string, expectedUpdatedAt?: string): Promise<VendorAdjustmentDto> {
  requireApiMode()
  try {
    return unwrap(await api.markVendorAdjustmentReady(id, { expectedUpdatedAt }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function approveVendorAdjustment(
  id: string,
  expectedUpdatedAt?: string,
  comments?: string,
): Promise<VendorAdjustmentDto> {
  requireApiMode()
  try {
    return unwrap(await api.approveVendorAdjustment(id, { expectedUpdatedAt, comments }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function rejectVendorAdjustment(
  id: string,
  reason: string,
  expectedUpdatedAt?: string,
): Promise<VendorAdjustmentDto> {
  requireApiMode()
  try {
    return unwrap(await api.rejectVendorAdjustment(id, { reason, expectedUpdatedAt }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function reviseVendorAdjustment(
  id: string,
  reason: string,
  expectedUpdatedAt?: string,
): Promise<VendorAdjustmentDto> {
  requireApiMode()
  try {
    return unwrap(await api.reviseVendorAdjustment(id, { reason, expectedUpdatedAt }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function cancelVendorAdjustment(
  id: string,
  reason: string,
  expectedUpdatedAt?: string,
): Promise<VendorAdjustmentDto> {
  requireApiMode()
  try {
    return unwrap(await api.cancelVendorAdjustment(id, { reason, expectedUpdatedAt }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function postVendorAdjustment(id: string, expectedUpdatedAt: string): Promise<PostVendorAdjustmentResult> {
  requireApiMode()
  try {
    return unwrap(await api.postVendorAdjustment(id, { expectedUpdatedAt }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function getVendorAdjustmentApproval(id: string): Promise<VendorAdjustmentApprovalDetail> {
  requireApiMode()
  try {
    return unwrap(await api.getVendorAdjustmentApproval(id))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function getAllocatablePayablesForDebitNote(
  vendorAdjustmentId: string,
  params: { targetAmount?: string; page?: number; pageSize?: number } = {},
): Promise<AllocatableVendorInvoicesResult> {
  requireApiMode()
  try {
    return unwrap(await api.getAllocatablePayablesForDebitNote(vendorAdjustmentId, params))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function createVendorAdjustmentAllocation(
  vendorAdjustmentId: string,
  input: CreateVendorAdjustmentAllocationInput,
): Promise<PayableAllocationResult> {
  requireApiMode()
  try {
    return unwrap(await api.createVendorAdjustmentAllocation(vendorAdjustmentId, input))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function listVendorAdjustmentAllocations(
  vendorAdjustmentId: string,
  params: { page?: number; pageSize?: number } = {},
): Promise<PayableAllocationHistoryRow[]> {
  requireApiMode()
  try {
    return unwrap(await api.listVendorAdjustmentAllocations(vendorAdjustmentId, params))
  } catch (e) {
    rethrowMapped(e)
  }
}

/* ── AP reversals (Phase 4C1 + 4C2) ── */

export async function getVendorPaymentReversalPreview(id: string): Promise<ApDocumentReversalPreview> {
  requireApiMode()
  try {
    return unwrap(await api.getVendorPaymentReversalPreview(id))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function reverseVendorPaymentApi(
  id: string,
  body: ReverseApDocumentInput,
): Promise<ReverseVendorPaymentResult> {
  requireApiMode()
  try {
    return unwrap(await api.reverseVendorPayment(id, body))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function getVendorInvoiceReversalPreview(id: string): Promise<ApDocumentReversalPreview> {
  requireApiMode()
  try {
    return unwrap(await api.getVendorInvoiceReversalPreview(id))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function reverseVendorInvoiceApi(
  id: string,
  body: ReverseApDocumentInput,
): Promise<ReverseVendorInvoiceResult> {
  requireApiMode()
  try {
    return unwrap(await api.reverseVendorInvoice(id, body))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function getVendorAdjustmentReversalPreview(id: string): Promise<ApDocumentReversalPreview> {
  requireApiMode()
  try {
    return unwrap(await api.getVendorAdjustmentReversalPreview(id))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function reverseVendorAdjustmentApi(
  id: string,
  body: ReverseApDocumentInput,
): Promise<ReverseVendorAdjustmentResult> {
  requireApiMode()
  try {
    return unwrap(await api.reverseVendorAdjustment(id, body))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function reversePayableAllocationApi(
  allocationId: string,
  body: {
    reversalDate: string
    reason: string
    idempotencyKey: string
    expectedAllocationUpdatedAt: string
    lineIds?: string[]
    expectedLines?: Array<{ allocationLineId: string; expectedUpdatedAt: string }>
    expectedOpenItems?: Array<{ openItemId: string; expectedUpdatedAt: string }>
  },
): Promise<ReversePayableAllocationResult> {
  requireApiMode()
  try {
    return unwrap(await api.reversePayableAllocation(allocationId, body))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function listApReversalHistory(
  filters?: { legalEntityId?: string; page?: number; limit?: number },
): Promise<ApReversalHistoryRow[]> {
  requireApiMode()
  try {
    const res = await api.listApReversalHistory(filters)
    return res.data
  } catch {
    return []
  }
}

// ─── AP reporting (Phase 4D1) — API mode only ───────────────────────────────

export async function getPayableOverview(legalEntityId?: string): Promise<PayableOverviewDto> {
  requireApiMode()
  const leId = resolveLegalEntityId(legalEntityId)
  try {
    return unwrap(await api.getPayableOverview({ legalEntityId: leId }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function listPayableOutstanding(
  params?: Record<string, string | number | boolean | undefined>,
): Promise<PayableReportingListResult<PayableOutstandingOpenItemDto>> {
  requireApiMode()
  const legalEntityId = resolveLegalEntityId(params?.legalEntityId as string | undefined)
  try {
    return unwrap(await api.listPayableOutstanding({ legalEntityId, ...params }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function getPayableAgeingReport(
  params?: Record<string, string | number | boolean | undefined>,
): Promise<PayableAgeingReportDto> {
  requireApiMode()
  const legalEntityId = resolveLegalEntityId(params?.legalEntityId as string | undefined)
  try {
    return unwrap(await api.getPayableAgeingReport({ legalEntityId, ...params }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function listVendorPayableSummaries(
  params?: Record<string, string | number | boolean | undefined>,
): Promise<PayableReportingListResult<VendorPayableDetailDto>> {
  requireApiMode()
  const legalEntityId = resolveLegalEntityId(params?.legalEntityId as string | undefined)
  try {
    return unwrap(await api.listVendorPayableSummaries({ legalEntityId, ...params }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function getVendorPayableSummary(vendorId: string, legalEntityId?: string): Promise<VendorPayableDetailDto> {
  requireApiMode()
  const leId = resolveLegalEntityId(legalEntityId)
  try {
    return unwrap(await api.getVendorPayableSummary(vendorId, { legalEntityId: leId }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function listVendorPayableOpenItems(
  vendorId: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<PayableReportingListResult<PayableOutstandingOpenItemDto>> {
  requireApiMode()
  const legalEntityId = resolveLegalEntityId(params?.legalEntityId as string | undefined)
  try {
    return unwrap(await api.listVendorPayableOpenItems(vendorId, { legalEntityId, ...params }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function getPaymentPlanning(
  params?: Record<string, string | number | boolean | undefined>,
): Promise<PaymentPlanningDto> {
  requireApiMode()
  const legalEntityId = resolveLegalEntityId(params?.legalEntityId as string | undefined)
  try {
    return unwrap(await api.getPaymentPlanning({ legalEntityId, ...params }))
  } catch (e) {
    rethrowMapped(e)
  }
}

// ─── AP reconciliation + close gate (Phase 4D2) — API mode only ─────────────

export async function createPayableReconciliationRun(
  input: Omit<CreatePayableReconciliationRunInput, 'legalEntityId'> & { legalEntityId?: string },
): Promise<PayableReconciliationRunDto> {
  requireApiMode()
  try {
    return unwrap(
      await api.createPayableReconciliationRun({
        ...input,
        legalEntityId: resolveLegalEntityId(input.legalEntityId),
      }),
    )
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function listPayableReconciliationRuns(
  filters?: Partial<ListPayableReconciliationRunsQuery>,
): Promise<PaginatedPayableReconciliationRuns> {
  requireApiMode()
  const legalEntityId = resolveLegalEntityId(filters?.legalEntityId)
  try {
    return unwrap(await api.listPayableReconciliationRuns({ legalEntityId, page: 1, pageSize: 20, ...filters }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function getPayableReconciliationRun(id: string): Promise<PayableReconciliationRunDto> {
  requireApiMode()
  try {
    return unwrap(await api.getPayableReconciliationRun(id))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function listPayableReconciliationRunAccounts(
  runId: string,
  params: { page?: number; pageSize?: number } = {},
): Promise<PaginatedPayableReconciliationAccountResults> {
  requireApiMode()
  try {
    return unwrap(await api.listPayableReconciliationRunAccounts(runId, params))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function listPayableReconciliationRunVendors(
  runId: string,
  params: { page?: number; pageSize?: number } = {},
): Promise<PaginatedPayableReconciliationVendorResults> {
  requireApiMode()
  try {
    return unwrap(await api.listPayableReconciliationRunVendors(runId, params))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function listPayableReconciliationRunExceptions(
  runId: string,
  params: ListPayableReconciliationExceptionsQuery = {},
): Promise<PaginatedPayableReconciliationExceptions> {
  requireApiMode()
  try {
    return unwrap(await api.listPayableReconciliationRunExceptions(runId, params))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function getPayableReconciliationException(id: string): Promise<PayableReconciliationExceptionDto> {
  requireApiMode()
  try {
    return unwrap(await api.getPayableReconciliationException(id))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function acknowledgePayableReconciliationException(
  id: string,
  note?: string,
): Promise<PayableReconciliationExceptionDto> {
  requireApiMode()
  try {
    const body: AcknowledgePayableReconciliationExceptionInput = note ? { note } : {}
    return unwrap(await api.acknowledgePayableReconciliationException(id, body))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function exportPayableReconciliationRun(runId: string): Promise<{ blob: Blob; filename?: string }> {
  requireApiMode()
  try {
    return await api.exportPayableReconciliationRun(runId)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function createPayableCloseGateRun(
  input: Omit<CreatePayableCloseGateRunInput, 'legalEntityId'> & { legalEntityId?: string },
): Promise<PayableCloseGateRunDetailDto['run']> {
  requireApiMode()
  try {
    return unwrap(
      await api.createPayableCloseGateRun({
        ...input,
        legalEntityId: resolveLegalEntityId(input.legalEntityId),
      }),
    )
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function listPayableCloseGateRuns(
  filters?: Partial<ListPayableCloseGateRunsQuery>,
): Promise<PaginatedPayableCloseGateRuns> {
  requireApiMode()
  const legalEntityId = resolveLegalEntityId(filters?.legalEntityId)
  try {
    return unwrap(await api.listPayableCloseGateRuns({ legalEntityId, page: 1, pageSize: 20, ...filters }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function getPayableCloseGateRun(id: string): Promise<PayableCloseGateRunDetailDto> {
  requireApiMode()
  try {
    return unwrap(await api.getPayableCloseGateRun(id))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function getLatestPayableCloseGateRun(
  periodId: string,
  legalEntityId?: string,
): Promise<PayableCloseGateRunDetailDto | null> {
  requireApiMode()
  const leId = resolveLegalEntityId(legalEntityId)
  try {
    return unwrap(await api.getLatestPayableCloseGateRun({ legalEntityId: leId, periodId }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function exportPayableCloseGateRun(runId: string): Promise<{ blob: Blob; filename?: string }> {
  requireApiMode()
  try {
    return await api.exportPayableCloseGateRun(runId)
  } catch (e) {
    rethrowMapped(e)
  }
}
