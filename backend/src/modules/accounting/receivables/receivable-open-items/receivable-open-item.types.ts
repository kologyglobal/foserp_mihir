export type ReceivableDocumentType =
  | 'SALES_INVOICE'
  | 'CREDIT_NOTE'
  | 'CUSTOMER_CREDIT_NOTE'
  | 'DEBIT_NOTE'
  | 'OPENING_BALANCE'
  | 'CUSTOMER_RECEIPT'
export type ReceivableOpenItemSide = 'DEBIT' | 'CREDIT'
export type ReceivableOpenItemStatus = 'OPEN' | 'PARTIALLY_SETTLED' | 'SETTLED' | 'DISPUTED' | 'ON_HOLD'

export interface ReceivableOpenItemDto {
  id: string
  tenantId: string
  legalEntityId: string
  branchId: string | null
  side: ReceivableOpenItemSide
  documentType: ReceivableDocumentType
  documentId: string
  documentNumberSnapshot: string | null
  salesInvoiceId: string | null
  customerReceiptId: string | null
  customerCreditNoteId: string | null
  customerId: string
  customerNameSnapshot: string | null
  receivableAccountId: string | null
  currencyCode: string
  exchangeRate: string
  originalAmount: string
  openAmount: string
  allocatedAmount: string
  adjustedAmount: string
  writtenOffAmount: string
  baseOriginalAmount: string
  baseOpenAmount: string
  baseAllocatedAmount: string
  baseAdjustedAmount: string
  baseWrittenOffAmount: string
  documentDate: string | null
  dueDate: string | null
  status: ReceivableOpenItemStatus
  accountingVoucherId: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface ListReceivableOpenItemsQuery {
  legalEntityId: string
  customerId?: string
  status?: ReceivableOpenItemStatus
  documentType?: ReceivableDocumentType
  side?: ReceivableOpenItemSide
  page?: number
  limit?: number
}
