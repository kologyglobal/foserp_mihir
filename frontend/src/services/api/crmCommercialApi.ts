import { apiRequest, tenantPath } from './client'
import type {
  CrmPaymentAllocation,
  CrmPaymentReceipt,
  CrmTaxInvoice,
} from '@/types/crmCommercial'
import type { ProformaInvoice } from '@/types/proformaInvoice'

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

export type CommercialSyncBundle = {
  receipts: CrmPaymentReceipt[]
  invoices: CrmTaxInvoice[]
  allocations: CrmPaymentAllocation[]
  proformas: ProformaInvoice[]
}

export async function fetchCommercialSync(companyId?: string) {
  return apiRequest<CommercialSyncBundle>(
    `${tenantPath('/crm/commercial/sync')}${buildQuery({ companyId })}`,
  )
}

export async function fetchCommercialProformas(params?: Record<string, string | undefined>) {
  return apiRequest<ProformaInvoice[]>(`${tenantPath('/crm/commercial/proformas')}${buildQuery(params)}`)
}

export async function fetchCommercialProforma(id: string) {
  return apiRequest<ProformaInvoice>(tenantPath(`/crm/commercial/proformas/${id}`))
}

export async function createCommercialProforma(body: Record<string, unknown>) {
  return apiRequest<ProformaInvoice>(tenantPath('/crm/commercial/proformas'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateCommercialProforma(id: string, body: Record<string, unknown>) {
  return apiRequest<ProformaInvoice>(tenantPath(`/crm/commercial/proformas/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function issueCommercialProforma(id: string) {
  return apiRequest<ProformaInvoice>(tenantPath(`/crm/commercial/proformas/${id}/issue`), { method: 'POST' })
}

export async function cancelCommercialProforma(id: string) {
  return apiRequest<ProformaInvoice>(tenantPath(`/crm/commercial/proformas/${id}/cancel`), { method: 'POST' })
}

export async function fetchCommercialReceipts(params?: Record<string, string | undefined>) {
  return apiRequest<CrmPaymentReceipt[]>(`${tenantPath('/crm/commercial/receipts')}${buildQuery(params)}`)
}

export async function createCommercialReceipt(body: {
  companyId: string
  receiptDate: string
  paymentMode: string
  transactionRef?: string | null
  amount: number
  remarks?: string | null
  attachmentName?: string | null
  proformaInvoiceId?: string | null
  proformaNo?: string | null
  proformaGrandTotal?: number
}) {
  return apiRequest<CrmPaymentReceipt>(tenantPath('/crm/commercial/receipts'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function fetchCommercialInvoices(params?: Record<string, string | undefined>) {
  return apiRequest<CrmTaxInvoice[]>(`${tenantPath('/crm/commercial/invoices')}${buildQuery(params)}`)
}

export async function createCommercialInvoice(body: Record<string, unknown>) {
  return apiRequest<CrmTaxInvoice>(tenantPath('/crm/commercial/invoices'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function postCommercialInvoice(id: string) {
  return apiRequest<CrmTaxInvoice>(tenantPath(`/crm/commercial/invoices/${id}/post`), { method: 'POST' })
}

export async function cancelCommercialInvoice(id: string) {
  return apiRequest<CrmTaxInvoice>(tenantPath(`/crm/commercial/invoices/${id}/cancel`), { method: 'POST' })
}

export async function allocateCommercialPayments(body: {
  receiptId: string
  allocationDate?: string
  remarks?: string | null
  allocations: Array<{ invoiceId: string; amount: number }>
}) {
  return apiRequest<CrmPaymentAllocation[]>(tenantPath('/crm/commercial/allocations'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function reverseCommercialAllocation(id: string) {
  return apiRequest<CrmPaymentAllocation>(tenantPath(`/crm/commercial/allocations/${id}/reverse`), {
    method: 'POST',
  })
}
