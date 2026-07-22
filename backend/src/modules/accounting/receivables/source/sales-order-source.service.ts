import type { SalesOrderLineDto } from '../../../crm/sales-orders/sales-order.types.js'
import {
  requireEligibleSalesOrder,
  SourceDocumentIneligibleError,
  SourceDocumentNotFoundError,
  SourceDocumentPartyMismatchError,
  type SourceEligibilityResult,
} from '../../shared/master-resolvers/accounting-source-document-resolver.js'
import {
  SalesOrderCancelledError,
  SalesOrderCustomerMismatchError,
  SalesOrderNotFoundError,
  SalesInvoiceValidationFailedError,
} from '../sales-invoices/sales-invoice.errors.js'

export interface SalesOrderSourceSnapshot {
  id: string
  orderNumber: string
  customerId: string
  status: string
  orderDate: string | null
  customerPoNumber: string | null
  lines: SalesOrderLineDto[]
}

export interface SalesOrderSourceContext {
  snapshot: SalesOrderSourceSnapshot
  warnings: Array<{ code: string; message: string }>
  eligibility: SourceEligibilityResult
}

function mapSnapshot(eligibility: SourceEligibilityResult): SalesOrderSourceSnapshot {
  const snap = eligibility.snapshot
  return {
    id: eligibility.documentId,
    orderNumber: eligibility.documentNumber,
    customerId: eligibility.partyId,
    status: eligibility.status,
    orderDate: eligibility.documentDate,
    customerPoNumber: (snap.customerPoNumber as string | null | undefined) ?? null,
    lines: Array.isArray(snap.lines) ? (snap.lines as SalesOrderLineDto[]) : [],
  }
}

/**
 * Load + strengthen SO eligibility for Sales Invoice linking.
 * Status whitelist, customer match, already-invoiced warning, remaining-qty warning.
 */
export async function loadSalesOrderSource(
  tenantId: string,
  salesOrderId: string,
  expectedCustomerId: string,
): Promise<SalesOrderSourceContext> {
  try {
    const eligibility = await requireEligibleSalesOrder(tenantId, salesOrderId, expectedCustomerId)
    return {
      snapshot: mapSnapshot(eligibility),
      warnings: eligibility.warnings,
      eligibility,
    }
  } catch (err) {
    if (err instanceof SourceDocumentNotFoundError) {
      throw new SalesOrderNotFoundError(salesOrderId)
    }
    if (err instanceof SourceDocumentPartyMismatchError) {
      throw new SalesOrderCustomerMismatchError()
    }
    if (err instanceof SourceDocumentIneligibleError) {
      if (err.code === 'SALES_ORDER_CANCELLED') throw new SalesOrderCancelledError()
      throw new SalesInvoiceValidationFailedError(err.message, [
        { field: 'sourceDocumentId', message: err.message },
      ])
    }
    throw err
  }
}
