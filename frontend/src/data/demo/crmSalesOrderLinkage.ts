import type { SalesOrder } from '../../types/mrp'

/** Pipeline quotation status cycle — index % 10 */
export const DEMO_QUOTATION_STATUS_CYCLE = [
  'draft',
  'pending_approval',
  'approved',
  'sent',
  'converted',
  'pending_approval',
  'sent',
  'converted',
  'approved',
  'converted',
] as const

export function isConvertedDemoQuotation(pipelineIndex: number): boolean {
  return DEMO_QUOTATION_STATUS_CYCLE[pipelineIndex % DEMO_QUOTATION_STATUS_CYCLE.length] === 'converted'
}

export interface DemoPipelineLink {
  pipelineIndex: number
  salesOrderId: string
  salesOrderNo: string
  quotationId: string
  quotationNo: string
  opportunityId: string
  opportunityNo: string
  quotationDocumentId: string
}

export function demoPipelineLink(pipelineIndex: number): DemoPipelineLink {
  const n = pipelineIndex + 1
  const pad3 = String(n).padStart(3, '0')
  const pad4 = String(n).padStart(4, '0')
  return {
    pipelineIndex,
    salesOrderId: `so-demo-${pad3}`,
    salesOrderNo: `SO-2026-${pad4}`,
    quotationId: `quo-demo-${pad4}`,
    quotationNo: `QUO-${pad4}`,
    opportunityId: `opp-crm-${pad3}`,
    opportunityNo: `OPP-${pad3}`,
    quotationDocumentId: `qdoc-${pad4}`,
  }
}

/** CRM linkage for showcase anchor SO-0001 (ABC Cement · cust-abc · pipeline row 1). */
export const ANCHOR_SO_PIPELINE_INDEX = 0

export function enrichAnchorSalesOrder(order: SalesOrder): SalesOrder {
  const link = demoPipelineLink(ANCHOR_SO_PIPELINE_INDEX)
  return {
    ...order,
    source: 'quotation',
    inquiryId: null,
    opportunityId: link.opportunityId,
    quotationId: link.quotationId,
    quotationNo: link.quotationNo,
    quotationRevisionNo: 1,
    quotationDocumentId: link.quotationDocumentId,
    quotationDocumentRevisionNo: 0,
    salesOwnerId: 'user-rajesh',
    salesOwnerName: 'Rajesh Kumar',
  }
}

/** Attach CRM / sales-pipeline foreign keys to a demo MRP sales order. */
export function enrichDemoMrpSalesOrder(order: SalesOrder, pipelineIndex: number): SalesOrder {
  const link = demoPipelineLink(pipelineIndex)
  const converted = isConvertedDemoQuotation(pipelineIndex)
  return {
    ...order,
    inquiryId: null,
    opportunityId: link.opportunityId,
    ...(converted
      ? {
          source: 'quotation' as const,
          quotationId: link.quotationId,
          quotationNo: link.quotationNo,
          quotationRevisionNo: 1,
          quotationDocumentId: link.quotationDocumentId,
          quotationDocumentRevisionNo: 0,
        }
      : {
          quotationId: null,
          quotationNo: null,
        }),
  }
}
