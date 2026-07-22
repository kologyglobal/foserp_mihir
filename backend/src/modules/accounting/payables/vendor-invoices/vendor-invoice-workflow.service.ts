import type { Request } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import type { VendorInvoiceSourceMode } from '../../shared/master-resolvers/accounting-source-document-resolver.js'
import { buildSupplierInvoiceUniquenessKey } from './vendor-invoice-number-normalization.js'
import { recalculateVendorInvoice } from './vendor-invoice-draft.service.js'
import { revalidateVendorInvoiceSourceLinks } from './vendor-invoice-source-validation.service.js'
import * as repo from './vendor-invoice.repository.js'
import {
  VendorInvoiceDuplicateUniquenessKeyError,
  VendorInvoiceExactDuplicateError,
  VendorInvoiceInvalidStatusError,
  VendorInvoiceNotReadyError,
  VendorInvoiceStaleVersionError,
} from './vendor-invoice.errors.js'
import type {
  CancelVendorInvoiceInput,
  MarkVendorInvoiceReadyInput,
  ReviseVendorInvoiceInput,
  SubmitVendorInvoiceInput,
} from './vendor-invoice.schemas.js'
import type { VendorInvoiceWithLines } from './vendor-invoice.types.js'
import { serializeVendorInvoice } from './vendor-invoice-read.service.js'

async function audit(req: Request, tenantId: string, id: string, action: string, newValues?: unknown) {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'finance',
    entity: 'vendor_invoice',
    entityId: id,
    action,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

function assertExpectedUpdatedAt(invoice: VendorInvoiceWithLines, expectedUpdatedAt?: string): void {
  if (!expectedUpdatedAt) return
  if (invoice.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) throw new VendorInvoiceStaleVersionError()
}

/** Phase 4A3 — claim `supplierInvoiceUniquenessKey`; the DB `@unique` column enforces the conflict. */
export async function claimUniquenessKey(tx: Prisma.TransactionClient, invoice: VendorInvoiceWithLines): Promise<string> {
  const key = buildSupplierInvoiceUniquenessKey({
    tenantId: invoice.tenantId,
    legalEntityId: invoice.legalEntityId,
    vendorId: invoice.vendorId,
    financialYearId: invoice.financialYearId,
    supplierInvoiceNumberNormalized: invoice.supplierInvoiceNumberNormalized,
  })
  try {
    await tx.vendorInvoice.update({ where: { id: invoice.id }, data: { supplierInvoiceUniquenessKey: key } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new VendorInvoiceDuplicateUniquenessKeyError()
    }
    throw err
  }
  return key
}

export async function releaseUniquenessKey(tx: Prisma.TransactionClient, invoiceId: string): Promise<void> {
  await tx.vendorInvoice.update({ where: { id: invoiceId }, data: { supplierInvoiceUniquenessKey: null } })
}

async function assertReadyForWorkflow(tenantId: string, invoice: VendorInvoiceWithLines, userId?: string | null) {
  const calcContext = invoice.calculationContext as { sourceMode?: VendorInvoiceSourceMode } | null
  await revalidateVendorInvoiceSourceLinks(
    tenantId,
    invoice.vendorId,
    (invoice.sourceLinks ?? []).map((link) => ({
      sourceType: link.sourceType,
      sourceDocumentId: link.sourceDocumentId,
    })),
    calcContext?.sourceMode,
  )

  const result = await recalculateVendorInvoice(tenantId, invoice, userId)
  if (result.duplicateAssessment.isBlocking) {
    throw new VendorInvoiceExactDuplicateError()
  }
  if (!result.validation.isValid) {
    throw new VendorInvoiceNotReadyError(
      result.validation.errors[0]?.message ?? 'Vendor invoice failed validation',
      result.validation.errors.map((e) => ({ field: e.field ?? 'invoice', message: e.message })),
    )
  }
  await repo.persistCalculatedFields(tenantId, invoice.id, result, userId)
  return result
}

export async function submitVendorInvoice(req: Request, tenantId: string, id: string, input: SubmitVendorInvoiceInput) {
  const invoice = await repo.findVendorInvoiceWithLinesOrThrow(tenantId, id)
  if (invoice.status !== 'DRAFT' || !invoice.approvalRequired) {
    throw new VendorInvoiceInvalidStatusError('Only approval-required draft vendor invoices can be submitted')
  }
  assertExpectedUpdatedAt(invoice, input.expectedUpdatedAt)
  const userId = req.context?.userId
  await assertReadyForWorkflow(tenantId, invoice, userId)

  const cycleNumber = (await prisma.financeApprovalRequest.count({
    where: { tenantId, legalEntityId: invoice.legalEntityId, documentType: 'VENDOR_INVOICE', documentId: id },
  })) + 1

  await prisma.$transaction(async (tx) => {
    await claimUniquenessKey(tx, invoice)
    const approval = await tx.financeApprovalRequest.create({
      data: {
        tenantId,
        legalEntityId: invoice.legalEntityId,
        documentType: 'VENDOR_INVOICE',
        documentId: id,
        documentNumberSnapshot: invoice.draftReference,
        documentStatusSnapshot: 'PENDING_APPROVAL',
        cycleNumber,
        status: 'PENDING',
        amountBasis: invoice.vendorPayableAmount,
        currencyCode: invoice.currencyCode,
        currentLevel: 1,
        totalLevels: 1,
        requestedBy: userId,
        workflowSnapshotJson: input.comments ? { comments: input.comments } : undefined,
      },
    })
    await tx.vendorInvoice.update({
      where: { id, tenantId },
      data: {
        status: 'PENDING_APPROVAL',
        approvalRequestId: approval.id,
        submittedAt: new Date(),
        submittedBy: userId,
        updatedBy: userId,
      },
    })
  })

  await audit(req, tenantId, id, 'VENDOR_INVOICE_SUBMITTED')
  return serializeVendorInvoice(req, await repo.findVendorInvoiceWithLinesOrThrow(tenantId, id))
}

export async function markVendorInvoiceReady(req: Request, tenantId: string, id: string, input: MarkVendorInvoiceReadyInput) {
  const invoice = await repo.findVendorInvoiceWithLinesOrThrow(tenantId, id)
  if (invoice.status !== 'DRAFT' || invoice.approvalRequired) {
    throw new VendorInvoiceInvalidStatusError('Only non-approval draft vendor invoices can be marked ready to post')
  }
  assertExpectedUpdatedAt(invoice, input.expectedUpdatedAt)
  const userId = req.context?.userId
  await assertReadyForWorkflow(tenantId, invoice, userId)

  await prisma.$transaction(async (tx) => {
    await claimUniquenessKey(tx, invoice)
    await tx.vendorInvoice.update({
      where: { id, tenantId },
      data: { status: 'READY_TO_POST', readyToPostAt: new Date(), readyToPostBy: userId, updatedBy: userId },
    })
  })

  await audit(req, tenantId, id, 'VENDOR_INVOICE_READY_TO_POST')
  return serializeVendorInvoice(req, await repo.findVendorInvoiceWithLinesOrThrow(tenantId, id))
}

export async function reviseVendorInvoice(req: Request, tenantId: string, id: string, input: ReviseVendorInvoiceInput) {
  const invoice = await repo.findVendorInvoiceWithLinesOrThrow(tenantId, id)
  if (!['REJECTED', 'READY_TO_POST'].includes(invoice.status)) {
    throw new VendorInvoiceInvalidStatusError('Only rejected or ready-to-post vendor invoices can be revised')
  }
  assertExpectedUpdatedAt(invoice, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.vendorInvoice.update({
    where: { id, tenantId },
    data: {
      status: 'DRAFT',
      readyToPostAt: null,
      readyToPostBy: null,
      rejectedAt: null,
      rejectedBy: null,
      approvalRequestId: null,
      updatedBy: userId,
    },
  })

  await audit(req, tenantId, id, 'VENDOR_INVOICE_REVISED', { reason: input.reason })
  return serializeVendorInvoice(req, await repo.findVendorInvoiceWithLinesOrThrow(tenantId, id))
}

export async function cancelVendorInvoice(req: Request, tenantId: string, id: string, input: CancelVendorInvoiceInput) {
  const invoice = await repo.findVendorInvoiceWithLinesOrThrow(tenantId, id)
  if (!['DRAFT', 'REJECTED', 'READY_TO_POST', 'PENDING_APPROVAL'].includes(invoice.status)) {
    throw new VendorInvoiceInvalidStatusError('Vendor invoice cannot be cancelled in its current status')
  }
  assertExpectedUpdatedAt(invoice, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.$transaction(async (tx) => {
    if (invoice.status === 'PENDING_APPROVAL' && invoice.approvalRequestId) {
      await tx.financeApprovalRequest.updateMany({
        where: { id: invoice.approvalRequestId, tenantId, status: 'PENDING' },
        data: { status: 'CANCELLED', completedAt: new Date(), completedBy: userId, documentStatusSnapshot: 'CANCELLED' },
      })
    }
    await releaseUniquenessKey(tx, id)
    await tx.vendorInvoice.update({
      where: { id, tenantId },
      data: {
        status: 'CANCELLED',
        cancellationReason: input.reason,
        cancelledAt: new Date(),
        cancelledBy: userId,
        updatedBy: userId,
      },
    })
  })

  await audit(req, tenantId, id, 'VENDOR_INVOICE_CANCELLED', { reason: input.reason })
  return serializeVendorInvoice(req, await repo.findVendorInvoiceWithLinesOrThrow(tenantId, id))
}
