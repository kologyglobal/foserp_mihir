/**
 * Validate + enrich Sales Invoice source links (O2C).
 * Hard remaining-qty guard for OUTBOUND_DISPATCH links.
 */
import type { Prisma } from '@prisma/client'
import {
  assertDispatchLineInvoiceReadyQty,
  lockDispatchLineConsumption,
} from '../source/invoice-ready.service.js'
import { loadSalesOrderSource } from '../source/sales-order-source.service.js'
import { SalesInvoiceValidationFailedError } from './sales-invoice.errors.js'
import type { CreateSalesInvoiceSourceLinkInput } from './sales-invoice-source-link.repository.js'

export type SalesInvoiceSourceMode = 'DIRECT' | 'SALES_ORDER' | 'OUTBOUND_DISPATCH'

export interface SourceLinkRequest {
  sourceType: 'SALES_ORDER' | 'OUTBOUND_DISPATCH' | 'DELIVERY_CHALLAN'
  sourceDocumentId: string
  sourceLineId?: string | null
  salesOrderId?: string | null
  salesOrderLineId?: string | null
  deliveryChallanId?: string | null
  deliveryChallanLineId?: string | null
  quantity: string
  salesInvoiceLineId?: string | null
  itemId?: string | null
  itemCodeSnapshot?: string | null
  itemNameSnapshot?: string | null
  sourceDocumentNumberSnapshot?: string | null
}

export async function validateAndEnrichSalesInvoiceSourceLinks(input: {
  tenantId: string
  customerId: string
  sourceType: SalesInvoiceSourceMode
  sourceDocumentId?: string | null
  sourceLinks?: SourceLinkRequest[] | null
  excludeSalesInvoiceId?: string
  tx?: Prisma.TransactionClient
}): Promise<{
  sourceLinks: CreateSalesInvoiceSourceLinkInput[]
  warnings: Array<{ code: string; message: string }>
  primarySalesOrderId: string | null
}> {
  const warnings: Array<{ code: string; message: string }> = []
  const links = input.sourceLinks ?? []

  if (input.sourceType === 'DIRECT') {
    if (links.length > 0) {
      throw new SalesInvoiceValidationFailedError(
        'Direct invoices cannot carry source links',
        [{ field: 'sourceLinks', message: 'Remove source links for DIRECT invoices' }],
      )
    }
    return { sourceLinks: [], warnings, primarySalesOrderId: null }
  }

  if (input.sourceType === 'SALES_ORDER') {
    if (!input.sourceDocumentId) {
      throw new SalesInvoiceValidationFailedError('Sales order is required', [
        { field: 'sourceDocumentId', message: 'sourceDocumentId is required for SALES_ORDER' },
      ])
    }
    const so = await loadSalesOrderSource(input.tenantId, input.sourceDocumentId, input.customerId)
    warnings.push(...so.warnings)
    // Optional SO-level links without dispatch qty (service invoice / advance commercial)
    if (links.length === 0) {
      return {
        sourceLinks: [
          {
            sourceType: 'SALES_ORDER',
            sourceDocumentId: input.sourceDocumentId,
            salesOrderId: input.sourceDocumentId,
            quantity: '0',
            sourceDocumentNumberSnapshot: so.snapshot.orderNumber,
          },
        ],
        warnings,
        primarySalesOrderId: input.sourceDocumentId,
      }
    }
  }

  const dispatchLineIds = links
    .filter((l) => l.sourceType === 'OUTBOUND_DISPATCH' && l.sourceLineId)
    .map((l) => l.sourceLineId!)

  if (input.tx && dispatchLineIds.length > 0) {
    await lockDispatchLineConsumption(input.tx, input.tenantId, dispatchLineIds)
  }

  const enriched: CreateSalesInvoiceSourceLinkInput[] = []
  let primarySalesOrderId: string | null =
    input.sourceType === 'SALES_ORDER' ? (input.sourceDocumentId ?? null) : null

  for (const link of links) {
    if (link.sourceType === 'OUTBOUND_DISPATCH') {
      if (!link.sourceLineId) {
        throw new SalesInvoiceValidationFailedError(
          'Outbound dispatch line is required on source links',
          [{ field: 'sourceLinks', message: 'sourceLineId required for OUTBOUND_DISPATCH' }],
        )
      }
      const qtyCheck = await assertDispatchLineInvoiceReadyQty(
        input.tenantId,
        link.sourceLineId,
        link.quantity,
        { excludeSalesInvoiceId: input.excludeSalesInvoiceId, tx: input.tx },
      )
      void qtyCheck
      if (!primarySalesOrderId && link.salesOrderId) primarySalesOrderId = link.salesOrderId
      enriched.push({
        sourceType: 'OUTBOUND_DISPATCH',
        sourceDocumentId: link.sourceDocumentId,
        sourceLineId: link.sourceLineId,
        salesOrderId: link.salesOrderId ?? null,
        salesOrderLineId: link.salesOrderLineId ?? null,
        deliveryChallanId: link.deliveryChallanId ?? null,
        deliveryChallanLineId: link.deliveryChallanLineId ?? null,
        quantity: link.quantity,
        salesInvoiceLineId: link.salesInvoiceLineId ?? null,
        itemId: link.itemId ?? null,
        itemCodeSnapshot: link.itemCodeSnapshot ?? null,
        itemNameSnapshot: link.itemNameSnapshot ?? null,
        sourceDocumentNumberSnapshot: link.sourceDocumentNumberSnapshot ?? null,
      })
      continue
    }

    if (link.sourceType === 'SALES_ORDER') {
      const so = await loadSalesOrderSource(input.tenantId, link.sourceDocumentId, input.customerId)
      warnings.push(...so.warnings)
      primarySalesOrderId = link.sourceDocumentId
      enriched.push({
        sourceType: 'SALES_ORDER',
        sourceDocumentId: link.sourceDocumentId,
        salesOrderId: link.sourceDocumentId,
        salesOrderLineId: link.salesOrderLineId ?? null,
        quantity: link.quantity,
        sourceDocumentNumberSnapshot: so.snapshot.orderNumber,
        salesInvoiceLineId: link.salesInvoiceLineId ?? null,
      })
      continue
    }

    // DELIVERY_CHALLAN — documentary only; qty still must be backed by a dispatch line if provided
    enriched.push({
      sourceType: 'DELIVERY_CHALLAN',
      sourceDocumentId: link.sourceDocumentId,
      sourceLineId: link.sourceLineId ?? null,
      salesOrderId: link.salesOrderId ?? null,
      salesOrderLineId: link.salesOrderLineId ?? null,
      deliveryChallanId: link.sourceDocumentId,
      deliveryChallanLineId: link.deliveryChallanLineId ?? link.sourceLineId ?? null,
      quantity: link.quantity,
      salesInvoiceLineId: link.salesInvoiceLineId ?? null,
      sourceDocumentNumberSnapshot: link.sourceDocumentNumberSnapshot ?? null,
    })
  }

  if (input.sourceType === 'OUTBOUND_DISPATCH' && enriched.filter((e) => e.sourceType === 'OUTBOUND_DISPATCH').length === 0) {
    throw new SalesInvoiceValidationFailedError(
      'At least one outbound dispatch source link is required',
      [{ field: 'sourceLinks', message: 'Add outbound dispatch lines' }],
    )
  }

  return { sourceLinks: enriched, warnings, primarySalesOrderId }
}
