import type {
  PayableOpenItem,
  PayableOpenItemDocumentType,
  PayableOpenItemSide,
  PayableOpenItemStatus,
  Prisma,
} from '@prisma/client'

export type { PayableOpenItem }

export interface CreatePayableOpenItemRecordInput {
  tenantId: string
  legalEntityId: string
  branchId?: string | null
  vendorId: string
  vendorCodeSnapshot: string
  vendorNameSnapshot: string
  side: PayableOpenItemSide
  documentType: PayableOpenItemDocumentType
  documentId: string
  documentNumber: string
  documentDate: Date
  postingDate: Date
  dueDate?: Date | null
  currencyCode?: string
  exchangeRate?: Prisma.Decimal | number | string
  originalAmount: Prisma.Decimal | number | string
  allocatedAmount?: Prisma.Decimal | number | string
  adjustedAmount?: Prisma.Decimal | number | string
  writtenOffAmount?: Prisma.Decimal | number | string
  outstandingAmount: Prisma.Decimal | number | string
  baseOriginalAmount: Prisma.Decimal | number | string
  baseAllocatedAmount?: Prisma.Decimal | number | string
  baseAdjustedAmount?: Prisma.Decimal | number | string
  baseWrittenOffAmount?: Prisma.Decimal | number | string
  baseOutstandingAmount: Prisma.Decimal | number | string
  status?: PayableOpenItemStatus
  isDisputed?: boolean
  isOnHold?: boolean
  vendorPayableAccountId: string
  sourceVendorInvoiceId?: string | null
  sourceVendorPaymentId?: string | null
  sourceVendorAdjustmentId?: string | null
  accountingVoucherId?: string | null
  postingEventId?: string | null
  createdBy?: string | null
}
