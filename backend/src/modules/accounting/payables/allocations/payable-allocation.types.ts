import type { PayableAllocationLineStatus, PayableAllocationStatus, Prisma } from '@prisma/client'

export const PAYABLE_ALLOCATION_AUDIT_ACTIONS = [
  'PAYABLE_ALLOCATION_CREATED',
  'PAYABLE_ALLOCATION_REVERSED',
] as const

export type PayableAllocationAuditAction = (typeof PAYABLE_ALLOCATION_AUDIT_ACTIONS)[number]

export interface CreatePayableAllocationBatchRecordInput {
  tenantId: string
  legalEntityId: string
  branchId?: string | null
  vendorId: string
  allocationReference: string
  sourceDebitOpenItemId: string
  allocationDate: Date
  currencyCode?: string
  exchangeRate?: Prisma.Decimal | number | string
  totalAllocatedAmount?: Prisma.Decimal | number | string
  baseTotalAllocatedAmount?: Prisma.Decimal | number | string
  status?: PayableAllocationStatus
  idempotencyKey?: string | null
  payloadHash?: string | null
  createdBy?: string | null
}

export interface CreatePayableAllocationLineRecordInput {
  sourceDebitOpenItemId: string
  targetCreditOpenItemId: string
  amount: Prisma.Decimal | number | string
  baseAmount: Prisma.Decimal | number | string
  reversedAmount?: Prisma.Decimal | number | string
  baseReversedAmount?: Prisma.Decimal | number | string
  status?: PayableAllocationLineStatus
}

// ─── Phase 4B4 — vendor payment allocation execution ─────────────────────────

export interface AllocatePayableLineInput {
  targetCreditOpenItemId: string
  expectedTargetUpdatedAt: string
  amount: string
}

export interface AllocateVendorPaymentInput {
  vendorPaymentId: string
  expectedPaymentUpdatedAt?: string
  expectedSourceOpenItemUpdatedAt: string
  allocationDate: string
  idempotencyKey: string
  lines: AllocatePayableLineInput[]
}

export interface AllocateVendorPaymentContext {
  tenantId: string
  userId: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface AllocateVendorAdjustmentInput {
  vendorAdjustmentId: string
  expectedAdjustmentUpdatedAt?: string
  expectedSourceOpenItemUpdatedAt: string
  allocationDate: string
  idempotencyKey: string
  lines: AllocatePayableLineInput[]
}

export interface AllocateVendorAdjustmentContext {
  tenantId: string
  userId: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface PayableAllocationBatchDto {
  id: string
  tenantId: string
  legalEntityId: string
  branchId: string | null
  vendorId: string
  allocationReference: string
  sourceDebitOpenItemId: string
  allocationDate: string
  currencyCode: string
  exchangeRate: string
  totalAllocatedAmount: string
  baseTotalAllocatedAmount: string
  status: PayableAllocationStatus
  idempotencyKey: string | null
  payloadHash: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface PayableAllocationLineDto {
  id: string
  tenantId: string
  legalEntityId: string
  allocationBatchId: string
  sourceDebitOpenItemId: string
  targetCreditOpenItemId: string
  amount: string
  baseAmount: string
  reversedAmount: string
  baseReversedAmount: string
  status: PayableAllocationLineStatus
  createdAt: string
  updatedAt: string
}

export interface PayableOpenItemBalanceDto {
  id: string
  side: 'DEBIT' | 'CREDIT'
  documentType: string
  documentNumber: string
  currencyCode: string
  originalAmount: string
  allocatedAmount: string
  adjustedAmount: string
  writtenOffAmount: string
  outstandingAmount: string
  baseOutstandingAmount: string
  status: string
  settledAt: string | null
  updatedAt: string
}

export interface CreatePayableAllocationResult {
  batch: PayableAllocationBatchDto
  lines: PayableAllocationLineDto[]
  payment: {
    id: string
    vendorPaymentNumber: string | null
  }
  sourceBefore: PayableOpenItemBalanceDto
  sourceAfter: PayableOpenItemBalanceDto
  targets: Array<{
    targetCreditOpenItemId: string
    vendorInvoiceId: string | null
    before: PayableOpenItemBalanceDto
    after: PayableOpenItemBalanceDto
  }>
  vendorAdvanceRemaining: string
  idempotentReplay: boolean
}

export interface AllocatableInvoiceItemDto {
  vendorInvoiceId: string | null
  openItemId: string
  documentNumber: string
  supplierInvoiceNumber: string | null
  documentDate: string | null
  postingDate: string | null
  dueDate: string | null
  currencyCode: string
  exchangeRate: string
  originalAmount: string
  outstandingAmount: string
  baseOutstandingAmount: string
  status: string
  suggestedAllocationAmount: string
  updatedAt: string
}

export interface PayableAllocationHistoryRow {
  batchId: string
  allocationLineId: string
  allocationReference: string
  allocationDate: string
  vendorPaymentId: string | null
  vendorPaymentNumber: string | null
  sourceDebitOpenItemId: string
  targetCreditOpenItemId: string
  vendorInvoiceId: string | null
  vendorInvoiceNumber: string | null
  supplierInvoiceNumber: string | null
  currencyCode: string
  amount: string
  baseAmount: string
  status: PayableAllocationLineStatus
  createdBy: string | null
  createdAt: string
}

export interface ListPayableAllocationsQuery {
  page?: number
  pageSize?: number
  limit?: number
}

// ─── Phase 4C1 — allocation reversal ─────────────────────────────────────────

export interface ReversePayableAllocationInput {
  allocationBatchId: string
  reversalDate: string
  reason: string
  idempotencyKey: string
  lineIds?: string[]
  expectedAllocationUpdatedAt: string
  expectedLines?: Array<{ allocationLineId: string; expectedUpdatedAt: string }>
  expectedOpenItems?: Array<{ openItemId: string; expectedUpdatedAt: string }>
}

export interface ReversePayableAllocationContext {
  tenantId: string
  userId: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface ReversePayableAllocationResult {
  idempotentReplay: boolean
  reversalBatchId: string
  reversalReference: string
  reversalDate: string
  allocationBatchId: string
  allocationReference: string
  totalReversedAmount: string
  baseTotalReversedAmount: string
  sourceAfter: {
    openItemId: string
    allocatedAmount: string
    outstandingAmount: string
    status: string
  }
  lines: Array<{
    allocationLineId: string
    reversalLineId: string
    targetCreditOpenItemId: string
    reversedAmount: string
    baseReversedAmount: string
    targetAllocatedAfter: string
    targetOutstandingAfter: string
    targetStatusAfter: string
  }>
  allocationBatchStatus: string
}
