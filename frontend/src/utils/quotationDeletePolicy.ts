/** Soft-delete is allowed only while quotation / document status is Draft. */
export function isQuotationDeletableStatus(status: string | null | undefined): boolean {
  return status === 'draft'
}
