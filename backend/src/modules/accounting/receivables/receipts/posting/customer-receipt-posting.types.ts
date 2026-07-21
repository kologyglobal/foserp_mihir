import type { PostingResult } from '../../../posting/posting.types.js'
import type { CustomerReceiptDto } from '../customer-receipt.types.js'

export interface PostCustomerReceiptInput {
  tenantId: string
  receiptId: string
  userId: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface PostCustomerReceiptResult {
  receipt: CustomerReceiptDto
  posting: PostingResult
  creditOpenItemId: string
  idempotentReplay: boolean
}

export interface CustomerReceiptPostingValidationContext {
  bankCashAccountId: string
  customerReceivableAccountId: string
  customerTdsAccountId: string | null
  financialYearId: string
}

export function buildCustomerReceiptPostEventKey(receiptId: string): string {
  return `CUSTOMER_RECEIPT_POST:${receiptId}:V1`
}

export function buildCustomerReceiptReverseEventKey(receiptId: string): string {
  return `CUSTOMER_RECEIPT_REVERSE:${receiptId}:V1`
}

export interface ReverseCustomerReceiptInput {
  tenantId: string
  receiptId: string
  reason: string
  userId: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface ReverseCustomerReceiptResult {
  receipt: CustomerReceiptDto
  posting: PostingResult
  reversalVoucherId: string
  idempotentReplay: boolean
}
