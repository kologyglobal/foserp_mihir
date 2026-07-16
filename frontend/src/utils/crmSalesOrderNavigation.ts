/** CRM sales order register paths (pipeline handover view). */

export const CRM_SALES_ORDERS_PATH = '/crm/sales-orders'
export const SALES_ORDERS_NEW_PATH = '/sales/orders/new'
export const FROM_CRM_QUERY = 'fromCrm'

export function isCrmPath(pathname: string): boolean {
  return pathname.startsWith('/crm')
}

export function isFromCrmSearchParam(value: string | null | undefined): boolean {
  return value === '1' || value === 'true'
}

export function crmSalesOrderPath(salesOrderId: string): string {
  return `/crm/sales-orders/${salesOrderId}`
}

export function salesOrderPath(salesOrderId: string): string {
  return `/sales/orders/${salesOrderId}`
}

export function salesOrderEditPath(salesOrderId: string): string {
  return `/sales/orders/${salesOrderId}/edit`
}

/**
 * Resolve SO detail URL.
 * Pass `true` / CRM pathname for `/crm/sales-orders/:id`, otherwise Sales module path.
 */
export function resolveSalesOrderDetailPath(
  salesOrderId: string,
  crmModeOrPathname: boolean | string = false,
): string {
  const crmMode =
    typeof crmModeOrPathname === 'string' ? isCrmPath(crmModeOrPathname) : crmModeOrPathname
  return crmMode ? crmSalesOrderPath(salesOrderId) : salesOrderPath(salesOrderId)
}

export interface BuildSalesOrderNewUrlOptions {
  fromCrm?: boolean
}

/** Blank new SO form; `fromCrm=1` preserves CRM chrome after save (direct or from quotation). */
export function buildBlankSalesOrderNewUrl(options?: BuildSalesOrderNewUrlOptions): string {
  if (!options?.fromCrm) return SALES_ORDERS_NEW_PATH
  const params = new URLSearchParams({ [FROM_CRM_QUERY]: '1' })
  return `${SALES_ORDERS_NEW_PATH}?${params.toString()}`
}

/** Create form stays on `/sales/orders/new`; `fromCrm=1` preserves CRM chrome after save. */
export function buildSalesOrderNewUrl(
  opportunityId: string,
  quotationDocumentId?: string | null,
  options?: BuildSalesOrderNewUrlOptions,
): string {
  const params = new URLSearchParams({ opportunityId })
  if (quotationDocumentId) params.set('quotationDocumentId', quotationDocumentId)
  if (options?.fromCrm) params.set(FROM_CRM_QUERY, '1')
  return `${SALES_ORDERS_NEW_PATH}?${params.toString()}`
}

export function resolveSalesOrderNewPath(
  opportunityId: string,
  quotationDocumentId?: string | null,
  fromCrm = false,
): string {
  return buildSalesOrderNewUrl(opportunityId, quotationDocumentId, { fromCrm })
}

export interface BuildSalesOrderEditUrlOptions {
  fromCrm?: boolean
}

/** Edit form stays on `/sales/orders/:id/edit`; `fromCrm=1` preserves CRM chrome (same as create). */
export function buildSalesOrderEditUrl(
  salesOrderId: string,
  options?: BuildSalesOrderEditUrlOptions,
): string {
  const base = salesOrderEditPath(salesOrderId)
  if (!options?.fromCrm) return base
  const params = new URLSearchParams({ [FROM_CRM_QUERY]: '1' })
  return `${base}?${params.toString()}`
}
