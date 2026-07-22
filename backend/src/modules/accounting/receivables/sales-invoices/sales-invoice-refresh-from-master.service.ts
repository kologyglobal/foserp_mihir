/**
 * DRAFT-only Refresh from Master for Sales Invoice party snapshots.
 */
import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import { requireActiveCustomerParty } from '../customer-party/customer-party.service.js'
import type { CustomerParty } from '../customer-party/customer-party.types.js'
import * as repo from './sales-invoice.repository.js'
import { SalesInvoiceInvalidStatusError, SalesInvoiceValidationFailedError } from './sales-invoice.errors.js'
import { serializeSalesInvoiceDetail } from './sales-invoice-read.service.js'

export interface SalesInvoiceMasterRefreshPreview {
  invoiceId: string
  customerId: string
  current: {
    customerCodeSnapshot: string | null
    customerNameSnapshot: string | null
    customerGstinSnapshot: string | null
    customerPanSnapshot: string | null
    customerStateCodeSnapshot: string | null
    customerBillingAddressSnapshot: unknown
    customerShippingAddressSnapshot: unknown
    paymentTermsDays: number | null
  }
  proposed: {
    customerCodeSnapshot: string | null
    customerNameSnapshot: string | null
    customerGstinSnapshot: string | null
    customerPanSnapshot: string | null
    customerStateCodeSnapshot: string | null
    customerBillingAddressSnapshot: CustomerParty['billingAddress']
    customerShippingAddressSnapshot: CustomerParty['shippingAddress']
    paymentTermsDays: number | null
  }
  changedFields: string[]
}

function partyProposed(party: CustomerParty, existingPaymentTermsDays: number | null) {
  return {
    customerCodeSnapshot: party.code,
    customerNameSnapshot: party.name,
    customerGstinSnapshot: party.gstin,
    customerPanSnapshot: party.pan,
    customerStateCodeSnapshot: party.stateCode,
    customerBillingAddressSnapshot: party.billingAddress,
    customerShippingAddressSnapshot: party.shippingAddress,
    paymentTermsDays: existingPaymentTermsDays ?? party.creditDays ?? null,
  }
}

function diffFields(
  current: SalesInvoiceMasterRefreshPreview['current'],
  proposed: SalesInvoiceMasterRefreshPreview['proposed'],
): string[] {
  const keys = Object.keys(proposed) as Array<keyof typeof proposed>
  return keys.filter((key) => JSON.stringify(current[key]) !== JSON.stringify(proposed[key]))
}

export async function previewSalesInvoiceRefreshFromMaster(
  tenantId: string,
  invoiceId: string,
): Promise<SalesInvoiceMasterRefreshPreview> {
  const invoice = await repo.findSalesInvoiceWithLinesOrThrow(tenantId, invoiceId)
  if (invoice.status !== 'DRAFT') {
    throw new SalesInvoiceInvalidStatusError('Refresh from Master is only allowed on DRAFT sales invoices')
  }
  const party = await requireActiveCustomerParty(tenantId, invoice.customerId)
  const current = {
    customerCodeSnapshot: invoice.customerCodeSnapshot,
    customerNameSnapshot: invoice.customerNameSnapshot,
    customerGstinSnapshot: invoice.customerGstinSnapshot,
    customerPanSnapshot: invoice.customerPanSnapshot,
    customerStateCodeSnapshot: invoice.customerStateCodeSnapshot,
    customerBillingAddressSnapshot: invoice.customerBillingAddressSnapshot,
    customerShippingAddressSnapshot: invoice.customerShippingAddressSnapshot,
    paymentTermsDays: invoice.paymentTermsDays,
  }
  const proposed = partyProposed(party, invoice.paymentTermsDays)
  return {
    invoiceId: invoice.id,
    customerId: invoice.customerId,
    current,
    proposed,
    changedFields: diffFields(current, proposed),
  }
}

export async function applySalesInvoiceRefreshFromMaster(
  req: Request,
  tenantId: string,
  invoiceId: string,
): Promise<unknown> {
  const preview = await previewSalesInvoiceRefreshFromMaster(tenantId, invoiceId)
  if (preview.changedFields.length === 0) {
    const invoice = await repo.findSalesInvoiceWithLinesOrThrow(tenantId, invoiceId)
    return serializeSalesInvoiceDetail(req, invoice)
  }

  const party = await requireActiveCustomerParty(tenantId, preview.customerId)
  await prisma.salesInvoice.update({
    where: { id: invoiceId },
    data: {
      customerCodeSnapshot: party.code,
      customerNameSnapshot: party.name,
      customerGstinSnapshot: party.gstin,
      customerPanSnapshot: party.pan,
      customerStateCodeSnapshot: party.stateCode,
      customerBillingAddressSnapshot: party.billingAddress as unknown as Prisma.InputJsonValue,
      customerShippingAddressSnapshot: party.shippingAddress as unknown as Prisma.InputJsonValue,
      paymentTermsDays: preview.proposed.paymentTermsDays,
      updatedBy: req.context?.userId ?? null,
    },
  })

  const audit = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'sales_invoice',
    entityId: invoiceId,
    action: 'SALES_INVOICE_REFRESHED_FROM_MASTER',
    newValues: { changedFields: preview.changedFields },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  const invoice = await repo.findSalesInvoiceWithLinesOrThrow(tenantId, invoiceId)
  return serializeSalesInvoiceDetail(req, invoice)
}

export { SalesInvoiceValidationFailedError }
