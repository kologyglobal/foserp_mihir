import type {
  CustomerReceiptValidationPreview,
  CustomerTdsInput,
  CustomerTdsMode,
  ReceiptBankChargeInput,
  ReceiptOtherDeductionInput,
} from './calculation/customer-receipt-calculation.types.js'
import type { CustomerReceiptAllowedActions } from './customer-receipt-allowed-actions.js'

export type CustomerReceiptStatus = 'DRAFT' | 'READY_TO_POST' | 'POSTED' | 'CANCELLED'
export type CustomerReceiptPaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'CHEQUE' | 'UPI' | 'CARD' | 'OTHER'
export type CustomerReceiptSourceType = 'DIRECT' | 'BANK_IMPORT'
export type CustomerReceiptAllocationStatus = 'DRAFT' | 'POSTED' | 'REVERSED'
export type CustomerReceiptDeductionType = 'BANK_CHARGE' | 'OTHER_DEDUCTION'

export interface CustomerReceiptDeductionLineDto {
  id: string
  lineNumber: number
  type: CustomerReceiptDeductionType
  code: string | null
  description: string
  amount: string
  baseAmount: string
  accountId: string | null
}

export interface CustomerReceiptTdsDto {
  mode: CustomerTdsMode
  value: string | null
  calculationBase: string | null
  sectionCode: string | null
  certificateReference: string | null
  accountId: string | null
  amount: string
}

export type { CustomerReceiptAllowedActions }

export interface CustomerReceiptDto {
  id: string
  tenantId: string
  legalEntityId: string
  branchId: string | null
  financialYearId: string | null
  receiptNumber: string | null
  draftReference: string | null
  status: CustomerReceiptStatus
  customerId: string
  customerCodeSnapshot: string | null
  customerNameSnapshot: string
  customerGstinSnapshot: string | null
  customerPanSnapshot: string | null
  customerStateCodeSnapshot: string | null
  customerCountryCodeSnapshot: string | null
  customerBillingAddressSnapshot: Record<string, unknown> | null
  sourceType: CustomerReceiptSourceType
  sourceDocumentId: string | null
  sourceDocumentNumberSnapshot: string | null
  paymentMethod: CustomerReceiptPaymentMethod
  receiptDate: string
  postingDate: string | null
  valueDate: string | null
  referenceNumber: string | null
  transactionReference: string | null
  customerBankReference: string | null
  chequeNumber: string | null
  chequeDate: string | null
  bankName: string | null
  currencyCode: string
  exchangeRate: string
  grossReceiptAmount: string
  customerTdsAmount: string
  bankChargeAmount: string
  otherDeductionAmount: string
  bankCashAmount: string
  allocatableAmount: string
  allocatedAmount: string
  unallocatedAmount: string
  baseGrossReceiptAmount: string
  baseCustomerTdsAmount: string
  baseBankChargeAmount: string
  baseOtherDeductionAmount: string
  baseBankCashAmount: string
  baseAllocatableAmount: string
  baseAllocatedAmount: string
  baseUnallocatedAmount: string
  bankCashAccountId: string | null
  customerReceivableAccountId: string | null
  bankChargeAccountId: string | null
  customerTdsReceivableAccountId: string | null
  otherDeductionAccountId: string | null
  customerTds: CustomerReceiptTdsDto | null
  accountingVoucherId: string | null
  postingEventId: string | null
  creditOpenItemId: string | null
  narration: string | null
  internalRemarks: string | null
  postedAt: string | null
  postedBy: string | null
  cancelledAt: string | null
  cancelledBy: string | null
  cancellationReason: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  bankCharges?: CustomerReceiptDeductionLineDto[]
  otherDeductions?: CustomerReceiptDeductionLineDto[]
  allowedActions?: CustomerReceiptAllowedActions
  validationSummary?: Pick<CustomerReceiptValidationPreview, 'valid' | 'errors' | 'warnings'> | null
  metaWarnings?: Array<{ code: string; message: string }>
  /** Credit-side ReceivableOpenItem summary — populated only when status=POSTED (Phase 3B4). */
  creditOpenItem?: {
    id: string
    status: string
    outstandingAmount: string
    originalAmount: string
  } | null
  /** GeneralLedgerEntry count for the posted voucher — populated only when status=POSTED (Phase 3B4). */
  ledgerEntryCount?: number
}

export interface CustomerReceiptDetailDto extends CustomerReceiptDto {
  bankCharges: CustomerReceiptDeductionLineDto[]
  otherDeductions: CustomerReceiptDeductionLineDto[]
}

export interface CustomerReceiptListItemDto extends Omit<CustomerReceiptDto, 'bankCharges' | 'otherDeductions' | 'validationSummary'> {}

export interface CustomerReceiptAllocationDto {
  id: string
  tenantId: string
  legalEntityId: string
  customerId: string
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
  status: CustomerReceiptAllocationStatus
  allocationSequence: number
  createdBy: string | null
  createdAt: string
  reversedAt: string | null
  reversedBy: string | null
  reversalReason: string | null
}

export interface ListCustomerReceiptsQuery {
  legalEntityId: string
  branchId?: string
  customerId?: string
  status?: CustomerReceiptStatus
  paymentMethod?: CustomerReceiptPaymentMethod
  sourceType?: CustomerReceiptSourceType
  currencyCode?: string
  createdBy?: string
  receiptDateFrom?: string
  receiptDateTo?: string
  postingDateFrom?: string
  postingDateTo?: string
  search?: string
  page?: number
  limit?: number
  pageSize?: number
  sort?: string
  sortOrder?: 'asc' | 'desc'
}

export interface ListCustomerReceiptAllocationsQuery {
  legalEntityId: string
  receiptId?: string
  invoiceId?: string
  customerId?: string
  status?: CustomerReceiptAllocationStatus
  page?: number
  limit?: number
}

/** Commercial + TDS inputs persisted as JSON on the receipt header to rebuild calculation input without trusting client totals. */
export interface CustomerReceiptCalculationContext {
  sourceType: CustomerReceiptSourceType
  sourceDocumentId?: string | null
  sourceDocumentNumber?: string | null
  paymentMethod: CustomerReceiptPaymentMethod
  currencyCode: string
  exchangeRate: string
  bankCashAmount: string
  bankCashAccountId?: string | null
  customerReceivableAccountId?: string | null
  customerTds?: CustomerTdsInput | null
  bankCharges?: ReceiptBankChargeInput[] | null
  otherDeductions?: ReceiptOtherDeductionInput[] | null
  instrumentNumber?: string | null
  instrumentDate?: string | null
  bankReference?: string | null
  transactionReference?: string | null
  narration?: string | null
  notes?: string | null
  valueDate?: string | null
}

export type CustomerReceiptWithDeductions = import('@prisma/client').CustomerReceipt & {
  deductionLines: import('@prisma/client').CustomerReceiptDeductionLine[]
}
