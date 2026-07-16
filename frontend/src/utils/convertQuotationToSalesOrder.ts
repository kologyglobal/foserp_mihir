import { useCrmStore } from '../store/crmStore'
import type { CrmSalesOrderHandoverInput } from './crmQuotationSoConversion'
import type { StoreActionResult } from '../store/storeAction'

export type ConvertQuotationToSalesOrderResult = StoreActionResult & {
  salesOrderId?: string
  salesOrderNo?: string
  /** True when API returned 409 / quotation was already converted. */
  alreadyConverted?: boolean
}

/**
 * Shared convert handler used by list, 360 header, and smart overview.
 * Accepts quotation document id (CRM) — resolves quotationId for the API bridge.
 */
export async function convertQuotationToSalesOrder(
  documentId: string,
  handover?: CrmSalesOrderHandoverInput,
): Promise<ConvertQuotationToSalesOrderResult> {
  const result = await Promise.resolve(
    useCrmStore.getState().convertQuotationDocumentToSalesOrder(documentId, handover),
  )
  return result as ConvertQuotationToSalesOrderResult
}
