import { isApiMode } from '../../config/apiConfig'
import type {
  AgeingReportDto,
  CreateCustomerCreditNoteInput,
  CreateSalesInvoiceInput,
  DispatchLineInvoiceReadyDto,
  InvoicePrefillFromDispatchDto,
  ListInvoiceReadyQuery,
  CreditNoteAllocationHistoryRow,
  CreditNoteAllocationPreview,
  CreditNoteAllocationRequest,
  CreditNoteAllocationResult,
  CreditNoteValidationPreview,
  CustomerCreditNoteDto,
  CustomerCreditNoteListItemDto,
  CustomerReceivableDetailDto,
  ListCustomerCreditNotesQuery,
  ListSalesInvoicesQuery,
  PaginatedResult,
  PostCreditNoteResult,
  PostCustomerReceiptResult,
  PostSalesInvoiceResult,
  ReverseSalesInvoiceResult,
  ReceiptAllocationHistoryRow,
  ReceiptAllocationPreview,
  ReceiptAllocationRequest,
  ReceiptAllocationResult,
  ReceivableOverviewDto,
  ReceivableReconciliationDto,
  CreateCustomerReceiptInput,
  CustomerReceiptDto,
  CustomerReceiptListItemDto,
  CustomerReceiptValidationPreview,
  ListCustomerReceiptsQuery,
  SalesInvoiceDto,
  SalesInvoiceValidationPreview,
  UpdateCustomerCreditNoteInput,
  UpdateCustomerReceiptInput,
  UpdateSalesInvoiceInput,
} from '../../types/moneyIn'
import * as api from '../api/receivablesApi'
import { getReceivablesDemoState, seedReceivablesDemoIfEmpty } from '../../store/receivablesDemoStore'
import { ensureLegalEntityId } from './financeApiBridge'
import { formatApiError } from '../api/apiErrors'
import { mapMoneyInError } from '../../modules/accounting/money-in/moneyInUi'

function unwrap<T>(res: { data: T }): T {
  return res.data
}

function rethrowMapped(err: unknown): never {
  const msg = formatApiError(err)
  const code = err instanceof Error && 'code' in err ? String((err as { code?: string }).code) : undefined
  throw new Error(mapMoneyInError(code, msg))
}

export async function listSalesInvoices(filters?: Partial<ListSalesInvoicesQuery>): Promise<SalesInvoiceDto[]> {
  const legalEntityId = await ensureLegalEntityId(filters?.legalEntityId)
  if (isApiMode()) {
    try {
      return unwrap(await api.listSalesInvoices({ legalEntityId, ...filters }))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  seedReceivablesDemoIfEmpty(legalEntityId)
  return getReceivablesDemoState().listInvoices({ legalEntityId, ...filters })
}

export async function getSalesInvoice(id: string): Promise<SalesInvoiceDto> {
  if (isApiMode()) {
    try {
      return unwrap(await api.getSalesInvoice(id))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  const inv = getReceivablesDemoState().getInvoice(id)
  if (!inv) throw new Error('Sales invoice not found')
  return inv
}

export async function createSalesInvoice(input: CreateSalesInvoiceInput): Promise<SalesInvoiceDto> {
  if (isApiMode()) {
    try {
      return unwrap(await api.createSalesInvoice(input))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  return getReceivablesDemoState().createInvoice(input)
}

export async function updateSalesInvoice(id: string, input: UpdateSalesInvoiceInput): Promise<SalesInvoiceDto> {
  if (isApiMode()) {
    try {
      return unwrap(await api.updateSalesInvoice(id, input))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().updateInvoice(id, input)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function validateSalesInvoice(id: string): Promise<SalesInvoiceValidationPreview> {
  if (isApiMode()) {
    try {
      return unwrap(await api.validateSalesInvoice(id))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  return getReceivablesDemoState().validateInvoice(id)
}

export async function markSalesInvoiceReady(id: string): Promise<SalesInvoiceDto> {
  if (isApiMode()) {
    try {
      return unwrap(await api.markSalesInvoiceReady(id))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().markReady(id)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function cancelSalesInvoice(id: string, cancellationReason: string): Promise<SalesInvoiceDto> {
  if (isApiMode()) {
    try {
      return unwrap(await api.cancelSalesInvoice(id, cancellationReason))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  return getReceivablesDemoState().cancelInvoice(id, cancellationReason)
}

export async function postSalesInvoice(id: string): Promise<PostSalesInvoiceResult> {
  if (isApiMode()) {
    try {
      return unwrap(await api.postSalesInvoice(id))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().postInvoice(id)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function reverseSalesInvoice(
  id: string,
  reason: string,
  idempotencyKey?: string,
): Promise<ReverseSalesInvoiceResult> {
  if (isApiMode()) {
    try {
      return unwrap(await api.reverseSalesInvoice(id, reason, idempotencyKey))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().reverseInvoiceDemo(id, reason)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function getReceivableOverview(legalEntityId?: string): Promise<ReceivableOverviewDto> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) {
    try {
      return unwrap(await api.getReceivableOverview({ legalEntityId: leId }))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  seedReceivablesDemoIfEmpty(leId)
  return getReceivablesDemoState().getOverview(leId)
}

export async function listOutstanding(params?: Record<string, string | number | boolean | undefined>) {
  const legalEntityId = await ensureLegalEntityId(params?.legalEntityId as string | undefined)
  if (isApiMode()) {
    try {
      return unwrap(await api.listOutstanding({ legalEntityId, ...params }))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  seedReceivablesDemoIfEmpty(legalEntityId)
  return getReceivablesDemoState().listOutstanding({ legalEntityId, ...params })
}

export async function getAgeingReport(params?: Record<string, string | number | boolean | undefined>): Promise<AgeingReportDto> {
  const legalEntityId = await ensureLegalEntityId(params?.legalEntityId as string | undefined)
  if (isApiMode()) {
    try {
      return unwrap(await api.getAgeingReport({ legalEntityId, ...params }))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  seedReceivablesDemoIfEmpty(legalEntityId)
  return getReceivablesDemoState().getAgeing({ legalEntityId, ...params })
}

export async function listCustomerSummaries(params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<CustomerReceivableDetailDto>> {
  const legalEntityId = await ensureLegalEntityId(params?.legalEntityId as string | undefined)
  if (isApiMode()) {
    try {
      return unwrap(await api.listCustomerSummaries({ legalEntityId, ...params }))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  seedReceivablesDemoIfEmpty(legalEntityId)
  return getReceivablesDemoState().listCustomers({ legalEntityId, ...params })
}

export async function getCustomerSummary(customerId: string, legalEntityId?: string): Promise<CustomerReceivableDetailDto> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) {
    try {
      return unwrap(await api.getCustomerSummary(customerId, { legalEntityId: leId }))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  seedReceivablesDemoIfEmpty(leId)
  const row = getReceivablesDemoState().getCustomer(customerId, leId)
  if (!row) throw new Error('Customer not found')
  return row
}

export async function listCustomerOpenItems(customerId: string, params?: Record<string, string | number | boolean | undefined>) {
  const legalEntityId = await ensureLegalEntityId(params?.legalEntityId as string | undefined)
  if (isApiMode()) {
    try {
      return unwrap(await api.listCustomerOpenItems(customerId, { legalEntityId, ...params }))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  seedReceivablesDemoIfEmpty(legalEntityId)
  return getReceivablesDemoState().listCustomerOpenItems(customerId, { legalEntityId, ...params })
}

export async function getReconciliation(legalEntityId?: string): Promise<ReceivableReconciliationDto> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) {
    try {
      return unwrap(await api.getReconciliation({ legalEntityId: leId }))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  seedReceivablesDemoIfEmpty(leId)
  return getReceivablesDemoState().getReconciliation(leId)
}

// ─── Customer credit notes (Phase 3C6) ─────────────────────────────────────

export async function listCustomerCreditNotes(filters?: Partial<ListCustomerCreditNotesQuery>): Promise<CustomerCreditNoteListItemDto[]> {
  const legalEntityId = await ensureLegalEntityId(filters?.legalEntityId)
  if (isApiMode()) {
    try {
      return unwrap(await api.listCustomerCreditNotes({ legalEntityId, ...filters }))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  seedReceivablesDemoIfEmpty(legalEntityId)
  return getReceivablesDemoState().listCreditNotes({ legalEntityId, ...filters })
}

export async function getCustomerCreditNote(id: string): Promise<CustomerCreditNoteDto> {
  if (isApiMode()) {
    try {
      return unwrap(await api.getCustomerCreditNote(id))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  const note = getReceivablesDemoState().getCreditNote(id)
  if (!note) throw new Error('Credit note not found')
  return note
}

export async function createCustomerCreditNote(input: CreateCustomerCreditNoteInput): Promise<CustomerCreditNoteDto> {
  if (isApiMode()) {
    try {
      return unwrap(await api.createCustomerCreditNote(input))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  return getReceivablesDemoState().createCreditNote(input)
}

export async function updateCustomerCreditNote(id: string, input: UpdateCustomerCreditNoteInput): Promise<CustomerCreditNoteDto> {
  if (isApiMode()) {
    try {
      return unwrap(await api.updateCustomerCreditNote(id, input))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().updateCreditNote(id, input)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function validateCustomerCreditNote(id: string): Promise<CreditNoteValidationPreview> {
  if (isApiMode()) {
    try {
      return unwrap(await api.validateCustomerCreditNote(id))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().validateCreditNote(id)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function submitCustomerCreditNote(id: string, comments?: string): Promise<CustomerCreditNoteDto> {
  if (isApiMode()) {
    try {
      return unwrap(await api.submitCustomerCreditNote(id, comments))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().submitCreditNote(id)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function approveCustomerCreditNote(id: string, comments?: string): Promise<CustomerCreditNoteDto> {
  if (isApiMode()) {
    try {
      return unwrap(await api.approveCustomerCreditNote(id, comments))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().approveCreditNote(id)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function rejectCustomerCreditNote(id: string, comments?: string): Promise<CustomerCreditNoteDto> {
  if (isApiMode()) {
    try {
      return unwrap(await api.rejectCustomerCreditNote(id, comments))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().rejectCreditNote(id)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function markCustomerCreditNoteReady(id: string): Promise<CustomerCreditNoteDto> {
  if (isApiMode()) {
    try {
      return unwrap(await api.markCustomerCreditNoteReady(id))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().markCreditNoteReady(id)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function cancelCustomerCreditNote(id: string, cancellationReason: string): Promise<CustomerCreditNoteDto> {
  if (isApiMode()) {
    try {
      return unwrap(await api.cancelCustomerCreditNote(id, cancellationReason))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().cancelCreditNote(id, cancellationReason)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function postCustomerCreditNote(id: string): Promise<PostCreditNoteResult> {
  if (isApiMode()) {
    try {
      return unwrap(await api.postCustomerCreditNote(id))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().postCreditNote(id)
  } catch (e) {
    rethrowMapped(e)
  }
}

// ─── Credit note allocations ───────────────────────────────────────────────

export async function previewCreditNoteAllocation(
  creditNoteId: string,
  body: CreditNoteAllocationRequest,
): Promise<CreditNoteAllocationPreview> {
  if (isApiMode()) {
    try {
      return unwrap(await api.previewCreditNoteAllocation(creditNoteId, body))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().previewCreditNoteAllocationDemo(creditNoteId, body)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function allocateCreditNote(
  creditNoteId: string,
  body: CreditNoteAllocationRequest,
  idempotencyKey: string,
): Promise<CreditNoteAllocationResult> {
  if (isApiMode()) {
    try {
      return unwrap(await api.allocateCreditNote(creditNoteId, body, idempotencyKey))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().allocateCreditNoteDemo(creditNoteId, body)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function listCreditNoteAllocations(creditNoteId: string): Promise<CreditNoteAllocationHistoryRow[]> {
  if (isApiMode()) {
    try {
      return unwrap(await api.listCreditNoteAllocations(creditNoteId))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  return getReceivablesDemoState().listCreditNoteAllocationsDemo(creditNoteId)
}

export async function reverseCreditNoteAllocation(
  creditNoteId: string,
  batchId: string,
  reason: string,
  idempotencyKey: string,
): Promise<CreditNoteAllocationResult> {
  if (isApiMode()) {
    try {
      return unwrap(await api.reverseCreditNoteAllocation(creditNoteId, batchId, reason, idempotencyKey))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().reverseCreditNoteAllocationDemo(creditNoteId, batchId, reason)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function reverseCustomerCreditNote(
  id: string,
  reason: string,
  idempotencyKey: string,
): Promise<PostCreditNoteResult> {
  if (isApiMode()) {
    try {
      return unwrap(await api.reverseCustomerCreditNote(id, reason, idempotencyKey))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().reverseCreditNoteDemo(id, reason)
  } catch (e) {
    rethrowMapped(e)
  }
}

// ─── Customer receipts (Phase 3B6) ─────────────────────────────────────────

export async function listCustomerReceipts(filters?: Partial<ListCustomerReceiptsQuery>): Promise<CustomerReceiptListItemDto[]> {
  const legalEntityId = await ensureLegalEntityId(filters?.legalEntityId)
  if (isApiMode()) {
    try {
      return unwrap(await api.listCustomerReceipts({ legalEntityId, ...filters }))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  seedReceivablesDemoIfEmpty(legalEntityId)
  return getReceivablesDemoState().listReceipts({ legalEntityId, ...filters })
}

export async function getCustomerReceipt(id: string): Promise<CustomerReceiptDto> {
  if (isApiMode()) {
    try {
      return unwrap(await api.getCustomerReceipt(id))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  const receipt = getReceivablesDemoState().getReceipt(id)
  if (!receipt) throw new Error('Customer receipt not found')
  return receipt
}

export async function createCustomerReceipt(input: CreateCustomerReceiptInput): Promise<CustomerReceiptDto> {
  if (isApiMode()) {
    try {
      return unwrap(await api.createCustomerReceipt(input))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  return getReceivablesDemoState().createReceipt(input)
}

export async function updateCustomerReceipt(id: string, input: UpdateCustomerReceiptInput): Promise<CustomerReceiptDto> {
  if (isApiMode()) {
    try {
      return unwrap(await api.updateCustomerReceipt(id, input))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().updateReceipt(id, input)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function validateCustomerReceipt(id: string): Promise<CustomerReceiptValidationPreview> {
  if (isApiMode()) {
    try {
      return unwrap(await api.validateCustomerReceipt(id))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().validateReceipt(id)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function markCustomerReceiptReady(id: string): Promise<CustomerReceiptDto> {
  if (isApiMode()) {
    try {
      return unwrap(await api.markCustomerReceiptReady(id))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().markReceiptReady(id)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function cancelCustomerReceipt(id: string, cancellationReason: string): Promise<CustomerReceiptDto> {
  if (isApiMode()) {
    try {
      return unwrap(await api.cancelCustomerReceipt(id, cancellationReason))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().cancelReceipt(id, cancellationReason)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function postCustomerReceipt(id: string): Promise<PostCustomerReceiptResult> {
  if (isApiMode()) {
    try {
      return unwrap(await api.postCustomerReceipt(id))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().postReceipt(id)
  } catch (e) {
    rethrowMapped(e)
  }
}

// ─── Receipt allocations ────────────────────────────────────────────────────

export async function previewReceiptAllocation(receiptId: string, body: ReceiptAllocationRequest): Promise<ReceiptAllocationPreview> {
  if (isApiMode()) {
    try {
      return unwrap(await api.previewReceiptAllocation(receiptId, body))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().previewReceiptAllocationDemo(receiptId, body)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function allocateReceipt(
  receiptId: string,
  body: ReceiptAllocationRequest,
  idempotencyKey: string,
): Promise<ReceiptAllocationResult> {
  if (isApiMode()) {
    try {
      return unwrap(await api.allocateReceipt(receiptId, body, idempotencyKey))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().allocateReceiptDemo(receiptId, body)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function listReceiptAllocations(receiptId: string): Promise<ReceiptAllocationHistoryRow[]> {
  if (isApiMode()) {
    try {
      return unwrap(await api.listReceiptAllocations(receiptId))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  return getReceivablesDemoState().listReceiptAllocationsDemo(receiptId)
}

export async function reverseReceiptAllocation(
  receiptId: string,
  batchId: string,
  reason: string,
  idempotencyKey: string,
): Promise<ReceiptAllocationResult> {
  if (isApiMode()) {
    try {
      return unwrap(await api.reverseReceiptAllocation(receiptId, batchId, reason, idempotencyKey))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().reverseReceiptAllocationDemo(receiptId, batchId, reason)
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function reverseCustomerReceipt(
  id: string,
  reason: string,
  idempotencyKey: string,
): Promise<PostCustomerReceiptResult> {
  if (isApiMode()) {
    try {
      return unwrap(await api.reverseCustomerReceipt(id, reason, idempotencyKey))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  try {
    return getReceivablesDemoState().reverseReceiptDemo(id, reason)
  } catch (e) {
    rethrowMapped(e)
  }
}

// ─── Invoice-ready dispatch lines (O2C Wave 2) ─────────────────────────────

export async function listInvoiceReadyDispatchLines(
  params?: Partial<ListInvoiceReadyQuery>,
): Promise<DispatchLineInvoiceReadyDto[]> {
  if (isApiMode()) {
    try {
      return unwrap(await api.listInvoiceReadyDispatchLines(params))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  return []
}

export async function prefillInvoiceFromDispatch(
  outboundDispatchLineIds: string[],
): Promise<InvoicePrefillFromDispatchDto> {
  if (isApiMode()) {
    try {
      return unwrap(await api.prefillInvoiceFromDispatch(outboundDispatchLineIds))
    } catch (e) {
      rethrowMapped(e)
    }
  }
  throw new Error('Invoice prefill from dispatch requires API mode')
}

// ─── AR disputes (Wave 5) ───────────────────────────────────────────────────

export async function listArDisputes(
  filters?: Partial<api.ListArDisputesQuery>,
): Promise<api.ArDisputeDto[]> {
  if (!isApiMode()) throw new Error('AR disputes list requires API mode')
  try {
    const legalEntityId = await ensureLegalEntityId(filters?.legalEntityId)
    return unwrap(await api.listArDisputes({ legalEntityId, ...filters }))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function getArDispute(id: string): Promise<api.ArDisputeDto> {
  if (!isApiMode()) throw new Error('AR dispute detail requires API mode')
  try {
    return unwrap(await api.getArDispute(id))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function createArDispute(input: api.CreateArDisputeInput): Promise<api.ArDisputeDto> {
  if (!isApiMode()) throw new Error('AR dispute create requires API mode')
  try {
    return unwrap(
      await api.createArDispute({
        ...input,
        legalEntityId: await ensureLegalEntityId(input.legalEntityId),
      }),
    )
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function updateArDispute(id: string, input: api.UpdateArDisputeInput): Promise<api.ArDisputeDto> {
  if (!isApiMode()) throw new Error('AR dispute update requires API mode')
  try {
    return unwrap(await api.updateArDispute(id, input))
  } catch (e) {
    rethrowMapped(e)
  }
}

export async function transitionArDispute(
  id: string,
  body: { status: api.ArDisputeStatus; resolution?: string | null },
): Promise<api.ArDisputeDto> {
  if (!isApiMode()) throw new Error('AR dispute transition requires API mode')
  try {
    return unwrap(await api.transitionArDispute(id, body))
  } catch (e) {
    rethrowMapped(e)
  }
}
