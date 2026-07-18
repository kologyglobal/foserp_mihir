import { isApiMode } from '../../config/apiConfig'
import type {
  AgeingReportDto,
  CreateCustomerCreditNoteInput,
  CreateSalesInvoiceInput,
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
  PostSalesInvoiceResult,
  ReceivableOverviewDto,
  ReceivableReconciliationDto,
  SalesInvoiceDto,
  SalesInvoiceValidationPreview,
  UpdateCustomerCreditNoteInput,
  UpdateSalesInvoiceInput,
} from '../../types/moneyIn'
import * as api from '../api/receivablesApi'
import { getReceivablesDemoState, seedReceivablesDemoIfEmpty } from '../../store/receivablesDemoStore'
import { resolveLegalEntityId } from './financeApiBridge'
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
  const legalEntityId = resolveLegalEntityId(filters?.legalEntityId)
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

export async function getReceivableOverview(legalEntityId?: string): Promise<ReceivableOverviewDto> {
  const leId = resolveLegalEntityId(legalEntityId)
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
  const legalEntityId = resolveLegalEntityId(params?.legalEntityId as string | undefined)
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
  const legalEntityId = resolveLegalEntityId(params?.legalEntityId as string | undefined)
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
  const legalEntityId = resolveLegalEntityId(params?.legalEntityId as string | undefined)
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
  const leId = resolveLegalEntityId(legalEntityId)
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
  const legalEntityId = resolveLegalEntityId(params?.legalEntityId as string | undefined)
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
  const leId = resolveLegalEntityId(legalEntityId)
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
  const legalEntityId = resolveLegalEntityId(filters?.legalEntityId)
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

/** Demo customer options for invoice form */
export function listDemoCustomers() {
  return [
    { id: 'b2000001-0001-4001-8001-000000000001', label: 'CUST-MHL — Mahindra Logistics Ltd' },
    { id: 'b2000002-0002-4002-8002-000000000002', label: 'CUST-TML — Tata Motors — Pune Plant' },
    { id: 'b2000003-0003-4003-8003-000000000003', label: 'CUST-AL — Ashok Leyland — Chennai' },
  ]
}
