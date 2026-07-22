/**
 * DRAFT-only Refresh from Master for Vendor Invoice party snapshots.
 */
import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import {
  AccountingVendorInactiveError,
  AccountingVendorNotFoundError,
  requireActiveAccountingVendor,
  type AccountingVendorParty,
} from '../../shared/master-resolvers/accounting-vendor-resolver.js'
import * as repo from './vendor-invoice.repository.js'
import {
  VendorInvoiceInactiveVendorError,
  VendorInvoiceInvalidStatusError,
  VendorInvoiceVendorNotFoundError,
} from './vendor-invoice.errors.js'
import { serializeVendorInvoice } from './vendor-invoice-read.service.js'

export interface VendorInvoiceMasterRefreshPreview {
  invoiceId: string
  vendorId: string
  current: {
    vendorCodeSnapshot: string | null
    vendorNameSnapshot: string | null
    vendorGstinSnapshot: string | null
    vendorPanSnapshot: string | null
    vendorStateCodeSnapshot: string | null
    vendorAddressSnapshot: unknown
    paymentTermsDaysSnapshot: number | null
  }
  proposed: {
    vendorCodeSnapshot: string
    vendorNameSnapshot: string
    vendorGstinSnapshot: string | null
    vendorPanSnapshot: string | null
    vendorStateCodeSnapshot: string | null
    vendorAddressSnapshot: Record<string, string | null>
    paymentTermsDaysSnapshot: number
  }
  changedFields: string[]
}

async function loadVendor(tenantId: string, vendorId: string): Promise<AccountingVendorParty> {
  try {
    return await requireActiveAccountingVendor(tenantId, vendorId)
  } catch (err) {
    if (err instanceof AccountingVendorNotFoundError) throw new VendorInvoiceVendorNotFoundError()
    if (err instanceof AccountingVendorInactiveError) throw new VendorInvoiceInactiveVendorError()
    throw err
  }
}

function proposedFromVendor(vendor: AccountingVendorParty) {
  return {
    vendorCodeSnapshot: vendor.code,
    vendorNameSnapshot: vendor.name,
    vendorGstinSnapshot: vendor.gstin,
    vendorPanSnapshot: vendor.pan,
    vendorStateCodeSnapshot: vendor.stateCode ?? vendor.state,
    vendorAddressSnapshot: {
      line1: vendor.address,
      line2: vendor.address2,
      city: vendor.city,
      state: vendor.state,
      pincode: vendor.pincode,
      country: vendor.country,
    },
    paymentTermsDaysSnapshot: vendor.paymentTermsDays,
  }
}

function diffFields(
  current: VendorInvoiceMasterRefreshPreview['current'],
  proposed: VendorInvoiceMasterRefreshPreview['proposed'],
): string[] {
  const keys = Object.keys(proposed) as Array<keyof typeof proposed>
  return keys.filter((key) => JSON.stringify(current[key]) !== JSON.stringify(proposed[key]))
}

export async function previewVendorInvoiceRefreshFromMaster(
  tenantId: string,
  invoiceId: string,
): Promise<VendorInvoiceMasterRefreshPreview> {
  const invoice = await repo.findVendorInvoiceWithLinesOrThrow(tenantId, invoiceId)
  if (invoice.status !== 'DRAFT') {
    throw new VendorInvoiceInvalidStatusError('Refresh from Master is only allowed on DRAFT vendor invoices')
  }
  const vendor = await loadVendor(tenantId, invoice.vendorId)
  const current = {
    vendorCodeSnapshot: invoice.vendorCodeSnapshot,
    vendorNameSnapshot: invoice.vendorNameSnapshot,
    vendorGstinSnapshot: invoice.vendorGstinSnapshot,
    vendorPanSnapshot: invoice.vendorPanSnapshot,
    vendorStateCodeSnapshot: invoice.vendorStateCodeSnapshot,
    vendorAddressSnapshot: invoice.vendorAddressSnapshot,
    paymentTermsDaysSnapshot: invoice.paymentTermsDaysSnapshot,
  }
  const proposed = proposedFromVendor(vendor)
  return {
    invoiceId: invoice.id,
    vendorId: invoice.vendorId,
    current,
    proposed,
    changedFields: diffFields(current, proposed),
  }
}

export async function applyVendorInvoiceRefreshFromMaster(
  req: Request,
  tenantId: string,
  invoiceId: string,
): Promise<unknown> {
  const preview = await previewVendorInvoiceRefreshFromMaster(tenantId, invoiceId)
  const vendor = await loadVendor(tenantId, preview.vendorId)
  const proposed = proposedFromVendor(vendor)

  if (preview.changedFields.length > 0) {
    await prisma.vendorInvoice.update({
      where: { id: invoiceId, tenantId },
      data: {
        vendorCodeSnapshot: proposed.vendorCodeSnapshot,
        vendorNameSnapshot: proposed.vendorNameSnapshot,
        vendorGstinSnapshot: proposed.vendorGstinSnapshot,
        vendorPanSnapshot: proposed.vendorPanSnapshot,
        vendorStateCodeSnapshot: proposed.vendorStateCodeSnapshot,
        vendorAddressSnapshot: proposed.vendorAddressSnapshot as unknown as Prisma.InputJsonValue,
        paymentTermsDaysSnapshot: proposed.paymentTermsDaysSnapshot,
        updatedBy: req.context?.userId ?? null,
      },
    })

    const audit = auditFromRequest(req)
    await createAuditLog({
      tenantId,
      userId: audit.userId,
      module: 'finance',
      entity: 'vendor_invoice',
      entityId: invoiceId,
      action: 'VENDOR_INVOICE_REFRESHED_FROM_MASTER',
      newValues: { changedFields: preview.changedFields },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    })
  }

  const invoice = await repo.findVendorInvoiceWithLinesOrThrow(tenantId, invoiceId)
  return serializeVendorInvoice(req, invoice)
}
