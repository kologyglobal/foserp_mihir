import type { ReceivableOpenItemStatus } from '@prisma/client'

export type CustomerCreditNoteAllocationStatus = 'DRAFT' | 'POSTED' | 'REVERSED'
export type CustomerCreditNoteAllocationBatchStatus = 'PROCESSING' | 'POSTED' | 'FAILED' | 'REVERSED'

export interface CreditNoteAllocationLineInput {
  invoiceId: string
  invoiceOpenItemId: string
  allocationAmount: string
}

export interface AllocateCustomerCreditNoteInput {
  creditNoteId: string
  allocationDate: string
  allocations: CreditNoteAllocationLineInput[]
}

export interface AllocateCustomerCreditNoteContext {
  tenantId: string
  userId: string
  idempotencyKey: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface ReverseCustomerCreditNoteAllocationInput {
  creditNoteId: string
  batchId: string
  reason: string
}

export interface ReverseCustomerCreditNoteAllocationContext {
  tenantId: string
  userId: string
  idempotencyKey: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface CustomerCreditNoteAllocationDto {
  id: string
  tenantId: string
  legalEntityId: string
  customerId: string
  batchId: string | null
  creditNoteId: string
  creditNoteOpenItemId: string
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
  status: CustomerCreditNoteAllocationStatus
  allocationSequence: number
  createdBy: string | null
  createdAt: string
  reversedAt: string | null
  reversedBy: string | null
  reversalReason: string | null
}

export interface CustomerCreditNoteAllocationBatchDto {
  id: string
  tenantId: string
  legalEntityId: string
  creditNoteId: string
  creditNoteOpenItemId: string
  customerId: string
  idempotencyKey: string
  payloadHash: string
  status: CustomerCreditNoteAllocationBatchStatus
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
  reversedAt: string | null
  reversedBy: string | null
  reversalReason: string | null
}

export interface CreditNoteAllocationPreviewIssue {
  code: string
  message: string
  severity: 'ERROR' | 'WARNING'
  field?: string
}

export interface CreditNoteAllocationPreviewLineDto {
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
  issues: CreditNoteAllocationPreviewIssue[]
}

export interface CustomerCreditNoteAllocationPreview {
  creditNoteId: string
  creditOpenItemId: string
  currencyCode: string
  exchangeRate: string
  creditNoteUnallocatedBefore: string
  totalProposedAllocation: string
  creditNoteUnallocatedAfter: string
  customerAdvanceAfter: string
  valid: boolean
  lines: CreditNoteAllocationPreviewLineDto[]
  errors: CreditNoteAllocationPreviewIssue[]
  warnings: CreditNoteAllocationPreviewIssue[]
}

export interface AllocateCustomerCreditNoteResult {
  batch: CustomerCreditNoteAllocationBatchDto
  allocations: CustomerCreditNoteAllocationDto[]
  creditNote: {
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

export interface CreditNoteAllocationHistoryRow {
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
  status: CustomerCreditNoteAllocationStatus
  createdBy: string | null
  createdAt: string
}

export interface InvoiceCreditNoteAllocationHistoryRow {
  batchId: string | null
  allocationId: string
  creditNoteId: string
  creditNoteNumber: string | null
  creditNoteDate: string | null
  allocationDate: string
  allocatedAmount: string
  baseAllocatedAmount: string
  customerId: string
  customerName: string | null
  status: CustomerCreditNoteAllocationStatus
  createdBy: string | null
  createdAt: string
}

export interface CustomerCreditNoteCreditDto {
  creditOpenItemId: string
  creditNoteId: string | null
  creditNoteNumber: string | null
  customerId: string
  customerName: string | null
  creditNoteDate: string | null
  postingDate: string | null
  currencyCode: string
  originalAmount: string
  allocatedAmount: string
  outstandingAmount: string
  baseOutstandingAmount: string
  status: ReceivableOpenItemStatus | string
}

export interface ListCreditNoteAllocationsQuery {
  page?: number
  pageSize?: number
  limit?: number
}
