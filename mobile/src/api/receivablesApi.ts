import { apiClient, tenantPath } from '@/api/client'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

export interface ArCustomerSummary {
  customerId: string
  customerCode: string | null
  customerName: string | null
  openItemCount: number
  outstandingAmount: string
  baseOutstandingAmount: string
  oldestDueDate: string | null
  maxDaysOverdue: number | null
}

export interface ArOpenItem {
  openItemId: string
  salesInvoiceId: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  dueDate: string | null
  outstandingAmount: string
  invoiceStatus: string | null
  daysOutstanding?: number
  status?: string
}

/** Accounting AR — only call when user has finance.ar.view. */
export async function listArCustomerSummaries(params: {
  legalEntityId: string
  reportDate?: string
  page?: number
  pageSize?: number
}) {
  return apiClient.get<{ items?: ArCustomerSummary[]; data?: ArCustomerSummary[] } | ArCustomerSummary[]>(
    tenantPath(`/accounting/receivables/customers${buildQuery(params)}`),
  )
}

export async function listArCustomerOpenItems(
  customerId: string,
  params: { legalEntityId: string; page?: number; pageSize?: number },
) {
  return apiClient.get<{ items?: ArOpenItem[] } | ArOpenItem[]>(
    tenantPath(
      `/accounting/receivables/customers/${customerId}/open-items${buildQuery(params)}`,
    ),
  )
}
