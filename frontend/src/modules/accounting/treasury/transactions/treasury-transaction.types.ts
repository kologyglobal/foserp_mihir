export type TreasuryTransactionReconciliationStatus =
  | 'UNRECONCILED'
  | 'PARTIALLY_RECONCILED'
  | 'FULLY_RECONCILED'

export interface TreasuryTransactionDto {
  id: string
  postingDate: string
  documentDate: string
  voucherId: string
  voucherNumber: string
  voucherType: string
  treasuryAccountId: string
  treasuryAccountCode: string
  treasuryAccountName: string
  treasuryAccountType: 'BANK' | 'CASH'
  currencyCode: string
  partyName: string | null
  reference: string | null
  narration: string | null
  sourceModule: string | null
  sourceDocumentType: string | null
  sourceDocumentId: string | null
  debitAmount: string
  creditAmount: string
  reconciliationStatus: TreasuryTransactionReconciliationStatus | null
  reconciledAmount: string | null
  unreconciledAmount: string | null
  isReversal: boolean
}

export interface ListTreasuryTransactionsQuery {
  legalEntityId: string
  treasuryAccountId?: string
  accountType?: 'BANK' | 'CASH'
  dateFrom?: string
  dateTo?: string
  reconciliationStatus?: TreasuryTransactionReconciliationStatus
  search?: string
  page?: number
  limit?: number
  sortOrder?: 'asc' | 'desc'
}
