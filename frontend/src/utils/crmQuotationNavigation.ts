/** CRM quotation register and deep-link helpers (replaces legacy /sales/quotations paths). */

export const CRM_QUOTATIONS_PATH = '/crm/quotations'

export const CRM_QUOTATIONS_NEW_PATH = '/crm/quotations/new'

/** Filtered list — quotations awaiting internal/customer approval */
export const CRM_QUOTATIONS_PENDING_APPROVAL_PATH =
  '/crm/quotations?status=pending_approval&segment=pending'

export function crmQuotationPath(quotationOrDocumentId: string): string {
  return `/crm/quotations/${quotationOrDocumentId}`
}

export function crmQuotationEditorPath(
  quotationId: string,
  documentId?: string | null,
): string {
  if (documentId) return `/crm/quotations/${quotationId}/editor?doc=${documentId}`
  return `/crm/quotations/${quotationId}/editor`
}
