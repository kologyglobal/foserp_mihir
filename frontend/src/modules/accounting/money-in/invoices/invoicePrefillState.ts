import type { InvoicePrefillFromDispatchDto, InvoicePrefillFromCrmTaxInvoiceDto } from '@/types/moneyIn'

export interface DispatchInvoicePrefillState {
  dispatchPrefill: InvoicePrefillFromDispatchDto
}

export interface CrmTaxInvoicePrefillState {
  crmTaxInvoicePrefill: InvoicePrefillFromCrmTaxInvoiceDto
}
