import type { PostingResult } from '../../../posting/posting.types.js'

export const buildCustomerCreditNotePostEventKey = (id: string) => `CUSTOMER_CREDIT_NOTE_POST:${id}:V1`
export const buildCustomerCreditNoteReverseEventKey = (id: string) => `CUSTOMER_CREDIT_NOTE_REVERSE:${id}:V1`

export interface ReverseCustomerCreditNoteInput {
  tenantId: string
  creditNoteId: string
  reason: string
  userId: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface ReverseCustomerCreditNoteResult {
  creditNote: unknown
  posting: PostingResult
  reversalVoucherId: string
  idempotentReplay: boolean
}

export interface PostCustomerCreditNoteInput {
  tenantId: string
  creditNoteId: string
  userId: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface PostCustomerCreditNoteResult {
  creditNote: unknown
  posting: PostingResult
  creditOpenItemId: string
  idempotentReplay: boolean
}
