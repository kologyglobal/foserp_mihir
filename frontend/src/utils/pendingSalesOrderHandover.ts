import type { QuotationDocument } from '../types/crm'
import type { Opportunity } from '../types/crm'
import type { SalesOrder } from '../types/mrp'
import type { Quotation } from '../types/sales'

export const PENDING_SO_ID_PREFIX = 'pending-quo-doc:'

/** Display-only register status for approved quotations awaiting SO conversion. */
export const PENDING_SO_STATUS = 'pending_so' as const

export type PendingSoRegisterStatus = typeof PENDING_SO_STATUS

export function isPendingSalesOrderHandover(row: Pick<SalesOrder, 'id' | 'status'>): boolean {
  return row.status === PENDING_SO_STATUS || row.id.startsWith(PENDING_SO_ID_PREFIX)
}

export function pendingSalesOrderDocumentId(rowId: string): string | null {
  if (!rowId.startsWith(PENDING_SO_ID_PREFIX)) return null
  return rowId.slice(PENDING_SO_ID_PREFIX.length)
}

function isWonOpportunity(opportunity: Opportunity | undefined): boolean {
  if (!opportunity) return false
  return opportunity.status === 'won' || opportunity.stage === 'won'
}

/**
 * Latest approved quotation documents that are not yet converted to a sales order.
 * These appear on the Sales Order register as "Pending SO" until conversion.
 *
 * Includes:
 * - Approved quotes on won opportunities (no SO yet)
 * - Direct approved quotes with no opportunity (ready for SO)
 */
export function listPendingQuotationSoHandovers(input: {
  quotationDocuments: QuotationDocument[]
  quotations: Quotation[]
  opportunities: Opportunity[]
  salesOrders: SalesOrder[]
}): SalesOrder[] {
  const { quotationDocuments, quotations, opportunities, salesOrders } = input
  const soByQuotationId = new Set(
    salesOrders
      .map((o) => o.quotationId)
      .filter((id): id is string => Boolean(id)),
  )
  const soByDocumentId = new Set(
    salesOrders
      .map((o) => o.quotationDocumentId)
      .filter((id): id is string => Boolean(id)),
  )

  const latestByQuotation = new Map<string, QuotationDocument>()
  for (const doc of quotationDocuments) {
    const prev = latestByQuotation.get(doc.quotationId)
    if (!prev || doc.revisionNo > prev.revisionNo) latestByQuotation.set(doc.quotationId, doc)
  }

  const quotationById = new Map(quotations.map((q) => [q.id, q]))
  const opportunityById = new Map(opportunities.map((o) => [o.id, o]))

  const rows: SalesOrder[] = []
  for (const doc of latestByQuotation.values()) {
    if (doc.status !== 'approved') continue
    if (doc.salesOrderId) continue
    if (soByDocumentId.has(doc.id) || soByQuotationId.has(doc.quotationId)) continue

    const salesQuo = quotationById.get(doc.quotationId)
    if (salesQuo?.salesOrderId) continue

    const opportunity = doc.opportunityId
      ? opportunityById.get(doc.opportunityId)
      : undefined
    // Won quotations only: won opportunity, or direct quote (no opportunity).
    if (doc.opportunityId && !isWonOpportunity(opportunity)) continue

    const primaryLine = doc.priceLines[0]
    const qty = doc.priceLines.reduce((s, l) => s + (Number(l.qty) || 0), 0) || 1
    const productId = primaryLine?.productId || opportunity?.productId || salesQuo?.productId || ''
    const quotationNo = salesQuo?.quotationNo ?? doc.quotationId
    const customerId = salesQuo?.customerId ?? opportunity?.customerId ?? ''
    if (!customerId) continue

    rows.push({
      id: `${PENDING_SO_ID_PREFIX}${doc.id}`,
      salesOrderNo: `Pending · ${quotationNo}`,
      customerId,
      productId: productId || '—',
      qty,
      requiredDate:
        salesQuo?.validityDate
        || opportunity?.expectedCloseDate
        || doc.modifiedAt?.slice(0, 10)
        || doc.createdAt.slice(0, 10),
      status: PENDING_SO_STATUS as SalesOrder['status'],
      remarks: 'Won quotation awaiting sales order',
      createdAt: doc.modifiedAt ?? doc.createdAt,
      orderDate: doc.modifiedAt?.slice(0, 10) ?? doc.createdAt.slice(0, 10),
      source: 'quotation',
      quotationId: doc.quotationId,
      quotationNo,
      quotationRevisionNo: doc.revisionNo,
      quotationDocumentId: doc.id,
      quotationDocumentRevisionNo: doc.revisionNo,
      opportunityId: doc.opportunityId,
      contactId: doc.contactId,
      grandTotal: doc.totalAmount,
      unitPrice: primaryLine?.unitPrice ?? null,
      salesOwnerId: doc.salesOwnerId,
      salesOwnerName: doc.salesOwnerName,
      locationId: doc.locationId ?? null,
    })
  }

  return rows.sort((a, b) => (b.orderDate ?? b.createdAt).localeCompare(a.orderDate ?? a.createdAt))
}

/** Create-SO URL for a pending handover row. */
export function buildPendingSoCreateUrl(
  row: SalesOrder,
  options?: { fromCrm?: boolean },
): string {
  const docId = row.quotationDocumentId || pendingSalesOrderDocumentId(row.id)
  const params = new URLSearchParams()
  if (row.opportunityId) params.set('opportunityId', row.opportunityId)
  if (docId) params.set('quotationDocumentId', docId)
  if (options?.fromCrm) params.set('fromCrm', '1')
  const qs = params.toString()
  return qs ? `/sales/orders/new?${qs}` : '/sales/orders/new'
}
