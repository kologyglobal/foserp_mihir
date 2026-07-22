/** Finance Phase 5B3 — Read-only bankbook/cashbook API types. */

export interface BookQuery {
  legalEntityId: string
  treasuryAccountId: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export interface BookEntryRowDto {
  entryId: string
  postingDate: string
  documentDate: string
  voucherNumber: string
  voucherType: string
  sourceModule: string | null
  sourceDocumentType: string | null
  sourceDocumentId: string | null
  narration: string | null
  debitAmount: string
  creditAmount: string
  runningBalance: string
}

export interface BookResultDto {
  treasuryAccountId: string
  treasuryAccountCode: string
  treasuryAccountName: string
  glAccountId: string
  currencyCode: string
  dateFrom: string | null
  dateTo: string | null
  openingBalance: string
  closingBalance: string
  entries: BookEntryRowDto[]
  total: number
  page: number
  limit: number
}
