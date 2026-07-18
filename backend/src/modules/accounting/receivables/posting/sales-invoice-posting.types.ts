import type { PostingResult } from '../../posting/posting.types.js'
import type { SalesInvoiceDto } from '../sales-invoices/sales-invoice.types.js'

export interface PostSalesInvoiceInput {
  tenantId: string
  invoiceId: string
  userId: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface PostSalesInvoiceResult {
  invoice: SalesInvoiceDto
  posting: PostingResult
  receivableOpenItemId: string
  idempotentReplay: boolean
}

export interface SalesInvoicePostingValidationContext {
  receivableAccountId: string
  financialYearId: string
}

export function buildSalesInvoicePostEventKey(invoiceId: string): string {
  return `SALES_INVOICE_POST:${invoiceId}:V1`
}
