import type { PostingResult } from '../../../posting/posting.types.js'

export const buildCustomerCreditNotePostEventKey = (id: string) => `CUSTOMER_CREDIT_NOTE_POST:${id}:V1`

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
