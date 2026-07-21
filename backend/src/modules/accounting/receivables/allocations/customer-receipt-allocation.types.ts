import type { ReceivableOpenItemStatus } from '@prisma/client'

export type CustomerReceiptAllocationStatus = 'DRAFT' | 'POSTED' | 'REVERSED'
export type CustomerReceiptAllocationBatchStatus = 'PROCESSING' | 'POSTED' | 'FAILED'

export interface AllocationLineInput {
  invoiceId: string
  invoiceOpenItemId: string
  allocationAmount: string
}

export interface AllocateCustomerReceiptInput {
  receiptId: string
  allocationDate: string
  allocations: AllocationLineInput[]
}

export interface AllocateCustomerReceiptContext {
  tenantId: string
  userId: string
  idempotencyKey: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface CustomerReceiptAllocationDto {
  id: string
  tenantId: string
  legalEntityId: string
  customerId: string
  batchId: string | null
  receiptId: string
  receiptOpenItemId: string
  invoiceId: string | null
  invoiceOpenItemId: string
  allocationDate: string
  postingDate: string | null
  currencyCode: string
  exchangeRate: string
  allocatedAmount: string
  baseAllocatedAmount: string
  invoiceOutstandingBefore: string | null
  invoiceOutstandingAfter: string | null
  baseInvoiceOutstandingBefore: string | null
  baseInvoiceOutstandingAfter: string | null
  status: CustomerReceiptAllocationStatus
  allocationSequence: number
  createdBy: string | null
  createdAt: string
  reversedAt: string | null
  reversedBy: string | null
  reversalReason: string | null
}

export interface CustomerReceiptAllocationBatchDto {
  id: string
  tenantId: string
  legalEntityId: string
  receiptId: string
  receiptOpenItemId: string
  customerId: string
  idempotencyKey: string
  payloadHash: string
  status: CustomerReceiptAllocationBatchStatus
  allocationDate: string
  currencyCode: string
  exchangeRate: string
  totalAllocatedAmount: string
  baseTotalAllocatedAmount: string
  allocationCount: number
  attemptCount: number
  createdBy: string | null
  createdAt: string
  completedAt: string | null
  failedAt: string | null
  failureCode: string | null
  failureMessage: string | null
}

export interface AllocationPreviewIssue {
  code: string
  message: string
  severity: 'ERROR' | 'WARNING'
  field?: string
}

export interface AllocationPreviewLineDto {
  invoiceId: string
  invoiceOpenItemId: string
  invoiceNumber: string | null
  currencyCode: string
  invoiceOutstandingBefore: string
  proposedAllocationAmount: string
  invoiceOutstandingAfter: string
  baseInvoiceOutstandingBefore: string
  baseProposedAllocationAmount: string
  baseInvoiceOutstandingAfter: string
  status: 'VALID' | 'INVALID'
  issues: AllocationPreviewIssue[]
}

export interface CustomerReceiptAllocationPreview {
  receiptId: string
  creditOpenItemId: string
  currencyCode: string
  exchangeRate: string
  receiptUnallocatedBefore: string
  totalProposedAllocation: string
  receiptUnallocatedAfter: string
  customerAdvanceAfter: string
  valid: boolean
  lines: AllocationPreviewLineDto[]
  errors: AllocationPreviewIssue[]
  warnings: AllocationPreviewIssue[]
}

export interface AllocateCustomerReceiptResult {
  batch: CustomerReceiptAllocationBatchDto
  allocations: CustomerReceiptAllocationDto[]
  receipt: {
    id: string
    allocatedAmount: string
    unallocatedAmount: string
    baseAllocatedAmount: string
    baseUnallocatedAmount: string
  }
  creditOpenItem: {
    id: string
    openAmount: string
    allocatedAmount: string
    status: string
  }
  invoices: Array<{
    invoiceId: string
    openItemId: string
    openAmount: string
    allocatedAmount: string
    status: string
    amountPaid: string
    outstandingAmount: string
  }>
  customerAdvance: string
  idempotentReplay: boolean
}

export interface ReceiptAllocationHistoryRow {
  batchId: string | null
  allocationId: string
  allocationDate: string
  allocationSequence: number
  invoiceId: string | null
  invoiceNumber: string | null
  invoiceOpenItemId: string
  allocatedAmount: string
  baseAllocatedAmount: string
  invoiceOutstandingBefore: string | null
  invoiceOutstandingAfter: string | null
  status: CustomerReceiptAllocationStatus
  createdBy: string | null
  createdAt: string
}

export interface InvoiceAllocationHistoryRow {
  batchId: string | null
  allocationId: string
  /** Phase 3C5 — distinguishes receipt-sourced vs credit-note-sourced allocation rows. */
  sourceType: 'CUSTOMER_RECEIPT' | 'CUSTOMER_CREDIT_NOTE'
  receiptId: string | null
  receiptNumber: string | null
  receiptDate: string | null
  /** Phase 3C5 — populated only for CUSTOMER_CREDIT_NOTE rows. */
  creditNoteId: string | null
  creditNoteNumber: string | null
  creditNoteDate: string | null
  allocationDate: string
  allocatedAmount: string
  baseAllocatedAmount: string
  customerId: string
  customerName: string | null
  status: CustomerReceiptAllocationStatus
  createdBy: string | null
  createdAt: string
}

export interface CustomerCreditDto {
  creditOpenItemId: string
  /** Phase 3C5 — distinguishes receipt-sourced vs credit-note-sourced customer credit. */
  sourceType: 'CUSTOMER_RECEIPT' | 'CUSTOMER_CREDIT_NOTE'
  receiptId: string | null
  receiptNumber: string | null
  /** Phase 3C5 — populated only for CUSTOMER_CREDIT_NOTE rows. */
  creditNoteId: string | null
  creditNoteNumber: string | null
  customerId: string
  customerName: string | null
  receiptDate: string | null
  postingDate: string | null
  currencyCode: string
  originalAmount: string
  allocatedAmount: string
  outstandingAmount: string
  baseOutstandingAmount: string
  status: ReceivableOpenItemStatus | string
}

export interface ListReceiptAllocationsQuery {
  page?: number
  pageSize?: number
  limit?: number
}

export interface ListCustomerCreditsQuery {
  legalEntityId: string
  branchId?: string
  customerId?: string
  currencyCode?: string
  status?: string
  receiptDateFrom?: string
  receiptDateTo?: string
  search?: string
  includeSettled?: boolean
  page?: number
  pageSize?: number
  limit?: number
}
